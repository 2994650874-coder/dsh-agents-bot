/**
 * 头像面板的共享 UI 状态。
 *
 * 为什么要有这一层：右侧栏的图标入口、面板正文、选择器、以及**设置页**是
 * 四棵互不相邻的 React 树，都要读同一份状态。DSH 的 slot store 只服务
 * 「单个 slot 内部共享」，跨 slot 的视图状态得自己带一个 —— 这里用最朴素的
 * 外部 store + `useSyncExternalStore`，不引任何依赖。
 *
 * ── 状态的三种性质，决定它存哪 ──────────────────────────────────────
 *
 *  1. **个体外观**（`look` / `looks`）—— 「我喜欢这个 bot 长这样」。
 *     审美，存 localStorage，面板里改。
 *
 *  2. **通用配置**（`rotation` / `fps` / `sleepMinutes`）—— 「这台机器上
 *     所有 agent 都这样反应」。配置，存 localStorage，**设置页里改**。
 *
 *  3. **瞬时视图**（`picker` / `editTarget` / `preview`）—— 不持久化。
 *
 * 为什么通用配置不存进宿主 settings 文档（像 dsh-connect-workbuddy 那样）：
 * 那个插件管的是 Host 侧 provider 行为，必须让 Host 读到。这里的帧率和
 * 动画映射是**纯渲染偏好**，Host 不需要知道。存 localStorage 少一层依赖，
 * 也不会在「设置 → 插件」里出现一份重复的通用表单。
 *
 * ── 这里没有几何 ────────────────────────────────────────────────────
 * 面板住在右侧栏里，宽高由宿主框架决定，自己不可拖不可拉。所以本文件里
 * **没有** x/y/w/h、没有最小尺寸、没有顶栏安全区 —— 那些全是浮窗形态才
 * 需要的东西，已随浮窗一起封存到 `archive/float-window/`。别再往这里加回来。
 */
import { useSyncExternalStore } from 'react'
import { addMonitorQueue, clearMonitorQueue, removeMonitorQueue, seedMonitorQueue, visitMonitorQueue, type QueueState } from './monitorQueue'
import {
  COLOR_OPTIONS,
  DEFAULT_LOOK,
  EXPRESSION_PRESET_ORDER,
  PRESET_DEFAULT,
  PRESET_MAX,
  PRESET_MIN,
  SHAPE_IDS,
  sanitizePreset,
  type AvatarLook,
  type PresetSlot
} from './look'
import type { StateId } from '../bot/states'
import {
  ACTIVITY_ORDER,
  ANIMATION_OPTIONS,
  DEFAULT_ROTATION,
  DEFAULT_SLEEP_MINUTES,
  MAX_PLAYS,
  MAX_ROTATION_ITEMS,
  MIN_PLAYS,
  SLEEP_OPTIONS,
  type Activity,
  type Rotation
} from './activities'

/**
 * 合法的动画 id 集合。
 *
 * 从 `ANIMATION_OPTIONS` 推，不另列一份 —— 两份列表会漂移，而漂移的
 * 表现是「设置里存了某个动画，升级后读回来被当成坏值丢掉」。
 */
const ANIMATION_IDS = new Set<string>(ANIMATION_OPTIONS.map((o) => o.id))

/** 最多同时监控几个。3×3 是视觉上限，再多只是噪声。 */
export const MAX_MONITORED = 9

export interface GridSpec {
  rows: number
  cols: number
}

/**
 * 容器朝向。
 *
 * 为什么需要：同一套格子代码要同时服务「宽容器」和「窄容器」。
 * 右侧栏是竖的（高 > 宽），横屏阶梯（2 格排成 1 行 2 列）在那里
 * 会把每格压到 320px 以下，头像放不进去；竖屏要反过来，行多于列。
 */
export type Orientation = 'landscape' | 'portrait'

/**
 * 格子数 → 行列。
 *
 * 两套阶梯，按容器朝向选：
 *
 *   横（landscape）：1→1×1，2→1×2，3~4→2×2，5~6→2×3，7~9→3×3
 *   竖（portrait）： 1→1×1，2→2×1，3→3×1，4→2×2，5~6→3×2，7~9→3×3
 *
 * 竖梯在 3 格时用 3×1 而不是 2×2 —— 2×2 会空出一格，看着像漏了一个。
 */
export function gridOf(n: number, orientation: Orientation = 'landscape'): GridSpec {
  if (n <= 1) return { rows: 1, cols: 1 }
  if (orientation === 'portrait') {
    if (n <= 2) return { rows: 2, cols: 1 }
    if (n <= 3) return { rows: 3, cols: 1 }
    if (n <= 4) return { rows: 2, cols: 2 }
    if (n <= 6) return { rows: 3, cols: 2 }
    return { rows: 3, cols: 3 }
  }
  if (n <= 2) return { rows: 1, cols: 2 }
  if (n <= 4) return { rows: 2, cols: 2 }
  if (n <= 6) return { rows: 2, cols: 3 }
  return { rows: 3, cols: 3 }
}

/**
 * 由容器宽高比定朝向，带**滞回**。
 *
 * 为什么要有死区：右栏宽度是用户拖着调的，比例在 1.0 附近抖动时
 * 不加死区会让格子阶梯在两个形态之间反复翻转，看着像在闪。
 * 死区内沿用上一次的判断，所以只要不真的跨过去就不会翻。
 *
 * 阈值取 0.9 / 1.1 而不是 1.0：正方向的容器（比如 1:1 的预览框）
 * 维持原判，避免边界上的无意义翻转。
 */
export function orientationOf(w: number, h: number, prev: Orientation): Orientation {
  if (!(w > 0) || !(h > 0)) return prev
  const a = w / h
  if (a < 0.9) return 'portrait'
  if (a > 1.1) return 'landscape'
  return prev
}

/** 动画帧率上限。给用户自己体感差异用。 */
export type Fps = 45 | 60 | 90 | 120

/**
 * 帧率档位。
 *
 * 为什么这是个「上限」而不是「实际帧率」：rAF 由屏幕刷新率驱动，
 * 设 60 在 144Hz 屏上会渲染 60 次/秒（跳帧）；屏幕是天花板，这里只负责往下压。
 *
 * 30 明显顿，保持下线；90/120 作为高刷屏的可选上限，增加子页 CPU 绘制量。
 * 默认仍是 60，45 是为省 CPU 准备的折中。
 */
export const FPS_OPTIONS: { id: Fps; label: string; hint: string }[] = [
  { id: 45, label: '45', hint: '省一些 CPU，动画仍算顺' },
  { id: 60, label: '60', hint: '标准流畅（默认）' },
  { id: 90, label: '90', hint: '高刷可选；隔离子页绘制量增加' },
  { id: 120, label: '120', hint: '高刷可选；隔离子页绘制量更高' }
]

/** 默认 60：这个动画本身很慢（呼吸 3 秒、形态过渡 0.45 秒），60 已看不出差别。 */
export const DEFAULT_FPS: Fps = 60
export const DEFAULT_MAIN_BOT_SIZE = 96
export const MIN_MAIN_BOT_SIZE = 64
export const MAX_MAIN_BOT_SIZE = 192
export function readMainBotSize(raw: unknown): number {
  const size = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(size) && size >= MIN_MAIN_BOT_SIZE && size <= MAX_MAIN_BOT_SIZE
    ? Math.round(size) : DEFAULT_MAIN_BOT_SIZE
}

/**
 * 「每个动画至少显示多久」的档位。
 *
 * 为什么默认 0（关）：它是**行为改变** —— 面板从「实时反映每一刻」变成
 * 「平滑地反映」，短活动会被合并。这种改变应该由用户显式选择，不该
 * 偷偷默认打开。
 *
 * 1600 是实测的甜点（`probe-dwell-sim.mjs`）：播完率 49% → 95%，
 * 而 `reading` / `writing` 仍保留 93% / 96%。再往上播完率更高，
 * 但短活动合并得更狠。
 *
 * ── 最高档 2400 -> 3000（2026-10-31）────────────────────────────────
 * 用户：「你应该发现我在干嘛了，把动画停留的2.4s改成3s」。他把节流开到
 * 最高档在用，而最高的那档必须能装下最长的常用动画。改成 3000 之后它
 * 装得下环绕（3,0 s）和上传（3,0 s），2400 装不下 —— 一档装不下动画的
 * 「最平滑」是自相矛盾的。
 *
 * 老存盘里的 2400 会落到 `readDwell` 并回落到默认（关闭），因为档位表里
 * 已经没有这个值了。这是**静默改行为**，所以 `readDwell` 里专门做了一次
 * 迁移：2400 视作 3000 的旧名字。
 */
export const DWELL_OPTIONS: { id: number; label: string; hint: string }[] = [
  { id: 0, label: '关闭', hint: '真实反映每一刻，但短动画会一闪而过' },
  { id: 1200, label: '1.2 秒', hint: '轻微平滑，短活动仍常出现' },
  { id: 1600, label: '1.6 秒', hint: '推荐：动画基本能播完，读文件仍看得见' },
  { id: 3000, label: '3.0 秒', hint: '最平滑，能装下环绕 / 上传的整遍；短活动会合并很多' }
]

/** 默认关闭 = 改造前行为。 */
export const DEFAULT_DWELL_MS = 0

export interface UiState {
  /** 用户勾选要监视的会话 id（有序，不含「当前窗口」那个 —— 它永远在第一位）。 */
  picked: string[]
  /** 全局外观：没有单独设置的 agent 都用它；主窗口主 Bot 读取此项。 */
  look: AvatarLook
  /** 主窗口消息 Bot 独立外观；不改变侧栏监控格及 per-agent 外观。 */
  messageLook: AvatarLook
  /** 按会话 id 单独设置的外观。只存与全局不同的那些。 */
  looks: Record<string, AvatarLook>
  /** 自定义区是否展开 */
  customizer: boolean
  /** 选择器是否展开。不持久化。 */
  picker: boolean
  /** 外观区正在编辑哪个 agent。undefined = 编辑全局。不持久化。 */
  editTarget: string | undefined
  /**
   * 试片：把预览用的头像钉在某个状态。null = 跟随真实状态。不持久化。
   *
   * **住在设置页，不在右栏。** 试片的作用是「看一眼这个动画长什么样」，
   * 而动画映射也在设置页 —— 配置和预览必须挨着，否则配完要来回切。
   * 右栏的格子本身就在实时显示真实状态，不需要另一个预览位。
   */
  preview: StateId | null
  /**
   * 试片的表情。`null` = 还没手动选过，跟随全局。
   *
   * 试片原本只钉动画，图案和表情都跟全局走 —— 想看「宝石 + 惊讶」得先跑去
   * 右栏改全局、回来再看、再改回去。现在试片自己带图案和表情，是一个
   * 自由预览台。不碰它的人行为完全不变（默认 null）。
   *
   * ── 界面上为什么没有「跟全局」这一项（v0.3.12）──────────────────
   * 它曾经是两列芯片里的第一枚，用户要求去掉：「只会造成干扰」。
   * 判据是那个值**不是一种表情**，而是一个状态开关混在表情列表里，
   * 用户得先分辨哪个不是表情。去掉后 `null` 仍然表示跟随全局，
   * 只是这个状态不再需要一枚按钮来表示（初始高亮直接落在全局值上）。
   *
   * 不持久化：它是「临时看一眼」的工具，记住上次看了什么没有意义。
   */
  previewExpression: string | null
  /**
   * 试片的图案。`null` = 还没手动选过，跟随全局。同上，不持久化。
   */
  previewShape: string | null
  /**
   * 试片的配色。`null` = 跟随全局。不持久化。
   *
   * 2026-10-31 加的：顺位表加了颜色槽以后，「这一行配出来什么色」只有点进
   * 右栏才能看，设置页里看不到。试片补上配色列，它才真的是「任意动画 ×
   * 任意图案 × 任意配色 × 任意表情」的四自由度预览台。
   */
  previewColor: string | null
  /**
   * 试片正在「试播」哪一条轮播。`null` = 只播单个动画。
   *
   * 「动画映射」每行行尾那枚「试播」把它整条搬到试片上播 —— 用户原话：
   * 「动画映射的每一行后面，能不能都追加一个试播，然后直接反馈到预览去？
   * 这样就不用回到窗口去观察了」。
   *
   * 只给「播一遍列表」是不够的：轮播是 `Bot` 内部用 rAF 按时间算的，
   * 外面没有第二个时钟。所以直接把 `Rotation` 交给 `Bot` 的 `rotation` 属性，
   * 一个时钟、一份实现。
   *
   * 不持久化：这是「临时看一眼」，记住上次试播了什么没有意义。
   * 手动点任意一枚动画芯片（`setPreview`）就清掉它 —— 点单个动画的意图
   * 明确是「就看这个」，不该被上一条轮播盖住。
   */
  previewRotation: Rotation | null
  /** 动画帧率上限，全局生效（不分 agent）。 */
  fps: Fps
  /** Main-window Bot diameter in CSS pixels; sidebar grid remains automatic. */
  mainBotSize: number
  /**
   * 每个动画至少显示多久才允许切换（毫秒）。`0` = 不节流（默认，= 改造前行为）。
   *
   * 存在的理由：真实工具调用极短（read 8ms / write 26ms），而对应动画要
   * 2~3.4 秒 —— 不节流时 49% 的动画播不完，看起来像「一闪而过」。
   * 详见 `client/dwell.ts` 与 README「活动切换太快」一节。
   */
  dwellMs: number
  /** 每个活动配哪几个动画、各播几遍。 */
  rotation: Record<Activity, Rotation>
  /**
   * 自动分配顺位：第 2~9 格各长什么样（图案 + 表情，逐行显式指定）。
   *
   * **第 1 格不在表里** —— 它是当前窗口，外观由「外观 · 全局」决定。
   * 所以表长 8 行时正好覆盖满 9 格。
   *
   * 行数由用户定（2~8），**短了会重复**：第 N 格取 `(N-1) % 行数`。
   * 空表不合法（取不到值），读盘时回落默认表。
   */
  preset: PresetSlot[]
  /** 空闲多少分钟后算休眠。 */
  sleepMinutes: number
}

const KEY = 'dsh-agents-bot:ui'

/**
 * 老键名。插件 2026-10-31 从 `dsh-agent-avatar` 改名为 `dsh-agents-bot`，
 * 存盘键跟着换 —— 但**不能就这么换**：用户调过的轮播、顺位、外观全在旧键下，
 * 直接读新键等于把他所有配置清零，表现是「升级完一切都回默认了」。
 *
 * 所以第一次读新键为空时，把旧键整份搬过来，然后删掉旧键。
 * 只在「新键没有、旧键有」时搬 —— 反复 `load()` 也只搬一次。
 */
const LEGACY_KEY = 'dsh-agent-avatar:ui'

function readStored(): string | null {
  try {
    const fresh = localStorage.getItem(KEY)
    if (fresh !== null) return fresh
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (legacy === null) return null
    localStorage.setItem(KEY, legacy)
    localStorage.removeItem(LEGACY_KEY)
    return legacy
  } catch {
    return null
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function load(): Partial<UiState> {
  try {
    const raw = readStored()
    if (!raw) return {}
    const v = JSON.parse(raw) as Record<string, unknown>
    const look = readLook(v.look)
    const picked = Array.isArray(v.picked) ? v.picked.filter((x): x is string => typeof x === 'string') : []
    // 注意：老存盘里可能还留着 `geom`（浮窗时代的坐标）。这里**故意不读**它 ——
    // 几何已经不是本插件的状态了，读进来只会变成一份没人用又没人清的垃圾。
    return {
      picked: picked.slice(0, MAX_MONITORED - 1),
      look,
      // Older installs rendered the second Bot with global look. Snapshot that look once
      // when this key is absent; never share its object reference or overwrite an existing choice.
      messageLook: Object.prototype.hasOwnProperty.call(v, 'messageLook') ? readLook(v.messageLook) : { ...look },
      looks: readLooks(v.looks),
      customizer: v.customizer === true,
      fps: readFps(v.fps),
      mainBotSize: readMainBotSize(v.mainBotSize),
      dwellMs: readDwell(v.dwellMs),
      rotation: readRotation(v.rotation),
      preset: readPreset(v.preset, v.shapeOrder),
      sleepMinutes: readSleep(v.sleepMinutes)
    }
  } catch {
    return {}
  }
}

/**
 * 读帧率档位。只认现存档位，坏值回落默认 —— 否则会被任意数字带跑。
 *
 * 旧存盘的 90/120 可以直接恢复；已经下线的 30 仍回落到默认 60。
 * 不为已删除的档位保留隐性兼容，避免选项和存盘行为分叉。
 */
function readFps(raw: unknown): Fps {
  const n = typeof raw === 'number' ? raw : Number(raw)
  for (const o of FPS_OPTIONS) if (o.id === n) return o.id
  return DEFAULT_FPS
}

function readSleep(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  for (const o of SLEEP_OPTIONS) if (o.id === n) return o.id
  return DEFAULT_SLEEP_MINUTES
}

/**
 * 读节流档位。只认现存档位，坏值回落默认。
 *
 * 跟 `readFps` 同一套纪律：不为已删除的档位保留兼容 —— 那等于把「已下线
 * 的选项」留在数据层里，以后更难清。
 *
 * ── 唯一的例外：2400 → 3000（2026-10-31）────────────────────────────
 * 最高档从 2.4 秒改成 3.0 秒，用户的存盘里正躺着 2400（他一直在开最高档）。
 * 按上面的纪律它会被当成「已下线的档位」清成 0（关闭）—— 表现是「升级完
 * 节流自己关了」，那是一次用户没做过的行为改变。
 *
 * 所以 2400 单独认成 3000：数字变了，语义没变（都是「最高档、最平滑」）。
 * 这不是为旧值保留兼容，是给**改名**做迁移。
 */
function readDwell(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (n === 2400) return 3000
  for (const o of DWELL_OPTIONS) if (o.id === n) return o.id
  return DEFAULT_DWELL_MS
}

/**
 * 读顺位表，兼容旧格式。
 *
 * 旧版（v0.3.9 及以前）存的是 `shapeOrder: string[]` —— 只有图案、没有表情，
 * 表情是按「全局锚点往后走 N 步」算出来的。新版是 `preset: {shape,expression}[]`。
 *
 * 直接丢掉旧值等于把用户调过的顺位抹掉，所以这里做一次迁移：图案沿用旧表，
 * 表情按**旧算法**（全局表情往后走 i+1 步）补出来 —— 这样迁移后画面逐格不变。
 * 用户看到的是「升级了，样子没变」。
 */
function readPreset(raw: unknown, legacy: unknown): PresetSlot[] {
  if (raw !== undefined) return sanitizePreset(raw)
  if (!Array.isArray(legacy)) return [...PRESET_DEFAULT]
  const exprBase = DEFAULT_LOOK.expression
  const at = EXPRESSION_PRESET_ORDER.indexOf(exprBase)
  const out = legacy
    .filter((x): x is string => typeof x === 'string')
    .slice(0, PRESET_MAX)
    .map((shape, i) => ({
      shape,
      expression:
        EXPRESSION_PRESET_ORDER[(Math.max(0, at) + i + 1) % EXPRESSION_PRESET_ORDER.length] ??
        DEFAULT_LOOK.expression
    }))
  return out.length ? sanitizePreset(out) : [...PRESET_DEFAULT]
}

/** 从任意对象读一份外观，缺字段回落到默认值。 */
function readLook(raw: unknown): AvatarLook {
  const v = (raw ?? {}) as Record<string, unknown>
  return {
    shape: typeof v.shape === 'string' ? v.shape : DEFAULT_LOOK.shape,
    color: typeof v.color === 'string' ? v.color : DEFAULT_LOOK.color,
    expression: typeof v.expression === 'string' ? v.expression : DEFAULT_LOOK.expression,
    size: num(v.size, DEFAULT_LOOK.size)
  }
}

/** 读「按 agent 单独设置」的外观表。坏条目直接丢掉，不整份作废。 */
function readLooks(raw: unknown): Record<string, AvatarLook> {
  const out: Record<string, AvatarLook> = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof id === 'string' && value && typeof value === 'object') out[id] = readLook(value)
  }
  return out
}

/**
 * 读轮播配置。
 *
 * 逐活动合并而不是整份替换：新版本可能加了新活动（比如这次加了
 * 「压缩上下文」和「后台任务」），老存盘里没有它们。整份替换会让这些
 * 新活动变成空配置（= 不播动画），表现为「升级后这两个状态不亮了」。
 * 所以缺的活动一律回落到默认值。
 *
 * 单个活动的配置坏了（不是数组、动画名不存在、遍数越界）也只丢那一项。
 */
function readRotation(raw: unknown): Record<Activity, Rotation> {
  const out = {} as Record<Activity, Rotation>
  const src = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>
  for (const activity of ACTIVITY_ORDER) {
    const fallback = DEFAULT_ROTATION[activity]
    const value = src[activity]
    if (!Array.isArray(value)) {
      out[activity] = fallback
      continue
    }
    const items = value
      .slice(0, MAX_ROTATION_ITEMS)
      .map((item) => {
        if (!item || typeof item !== 'object') return null
        const { state, plays } = item as { state?: unknown; plays?: unknown }
        if (typeof state !== 'string') return null
        if (!ANIMATION_IDS.has(state)) return null
        const n = typeof plays === 'number' ? plays : Number(plays)
        if (!Number.isFinite(n)) return null
        return { state: state as StateId, plays: Math.min(MAX_PLAYS, Math.max(MIN_PLAYS, Math.round(n))) }
      })
      .filter((x): x is { state: StateId; plays: number } => x !== null)
    out[activity] = items.length > 0 ? items : fallback
  }
  return out
}

/**
 * 合法的动画 id 集合，见上方 `ANIMATION_IDS`。
 */

const persisted = load()

const DEFAULTS: UiState = {
  picked: persisted.picked ?? [],
  look: persisted.look ?? DEFAULT_LOOK,
  messageLook: persisted.messageLook ?? { ...DEFAULT_LOOK },
  looks: persisted.looks ?? {},
  // Placement is window memory. A previous main-mode expansion must not reopen on a fresh sidebar window.
  // This runs once at module initialization, not on every AvatarPanel remount.
  customizer: false,
  picker: false,
  editTarget: undefined,
  preview: null,
  previewExpression: null,
  previewShape: null,
  previewColor: null,
  previewRotation: null,
  fps: persisted.fps ?? DEFAULT_FPS,
  mainBotSize: persisted.mainBotSize ?? DEFAULT_MAIN_BOT_SIZE,
  dwellMs: persisted.dwellMs ?? DEFAULT_DWELL_MS,
  rotation: persisted.rotation ?? DEFAULT_ROTATION,
  preset: persisted.preset ?? [...PRESET_DEFAULT],
  sleepMinutes: persisted.sleepMinutes ?? DEFAULT_SLEEP_MINUTES
}

let state: UiState = { ...DEFAULTS, picker: false, editTarget: undefined, preview: null }

const subs = new Set<() => void>()

function emit() {
  for (const fn of subs) fn()
}

function persist() {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        picked: state.picked,
        look: state.look,
        messageLook: state.messageLook,
        looks: state.looks,
        customizer: state.customizer,
        fps: state.fps,
        mainBotSize: state.mainBotSize,
        dwellMs: state.dwellMs,
        rotation: state.rotation,
        preset: state.preset,
        sleepMinutes: state.sleepMinutes
      })
    )
  } catch {
    /* 存不下就算了，不影响看 */
  }
}

export function getUi(): UiState {
  return state
}

export function patchUi(patch: Partial<UiState>): void {
  state = { ...state, ...patch }
  persist()
  emit()
}

/* ── 两个面板互斥 ──────────────────────────────────────────────────── */

/**
 * 面板互斥切换。
 *
 * 之前的 bug：两个布尔值各自 toggle，结果是「点监视能盖住外观，点外观盖不住监视」——
 * 因为渲染时写了 `customizer && !picker`，外观自己不知道被压着。
 * 现在改成单一来源：同一时刻最多只有一个面板开着。
 */
export function togglePanel(which: 'picker' | 'customizer'): void {
  if (which === 'picker') {
    patchUi({ picker: !state.picker, customizer: false })
  } else {
    patchUi({ customizer: !state.customizer, picker: false })
  }
}

/* ── 外观：全局 + 按 agent 覆盖 ────────────────────────────────────── */

/** 取某个 agent 实际生效的外观。没有单独设置就用全局。 */
export function lookOf(sessionId: string | undefined, state0 = state): AvatarLook {
  if (sessionId !== undefined) {
    const own = state0.looks[sessionId]
    if (own) return own
  }
  return state0.look
}

/**
 * 改外观。`target` 为 undefined 时改全局，否则只改那个 agent。
 *
 * 改 agent 时把整份外观存下来（不是只存差异）—— 这样「全局改了」不会
 * 意外影响已经单独设过的 agent，符合「我已经定好这个了」的预期。
 */
export function setLook(target: string | undefined, next: AvatarLook): void {
  if (target === undefined) {
    patchUi({ look: next })
    return
  }
  patchUi({ looks: { ...state.looks, [target]: next } })
}

/** 只修改主窗口消息 Bot；不会触动主 Bot 全局外观或侧栏格子。 */
export function setMessageLook(next: AvatarLook): void {
  patchUi({ messageLook: next })
}

/** 取消某个 agent 的单独外观，回落到全局。 */
export function resetLook(target: string): void {
  if (!(target in state.looks)) return
  const next = { ...state.looks }
  delete next[target]
  patchUi({ looks: next })
}

/** 有几个 agent 单独设过外观（用于胶囊上的提示）。 */
export function overriddenCount(state0 = state): number {
  return Object.keys(state0.looks).length
}

/* ── 通用配置：帧率 / 轮播 / 休眠阈值 ──────────────────────────────── */

/** 主窗口专用尺寸；坏输入保持现值，侧栏自动格子尺寸不受影响。 */
export function setMainBotSize(size: number): void {
  if (!Number.isFinite(size)) return
  const next = Math.min(MAX_MAIN_BOT_SIZE, Math.max(MIN_MAIN_BOT_SIZE, Math.round(size)))
  if (state.mainBotSize !== next) patchUi({ mainBotSize: next })
}

/** 改帧率上限。全局生效，所有格子一起。 */
export function setFps(fps: Fps): void {
  if (state.fps === fps) return
  patchUi({ fps })
}

/**
 * 改「动画至少停留多久」。
 *
 * 改这个值时**必须清掉每格的节流状态** —— 否则从 0 切到 1600 时，
 * 那些格子的 `DwellState` 还停留在旧计时（或者根本没有），
 * 表现是「刚打开节流的那一秒画面乱跳」。
 * 由面板自己处理：它监听 `dwellMs` 变化并重置 map，见 `AvatarPanel`。
 */
export function setDwellMs(dwellMs: number): void {
  const n = DWELL_OPTIONS.some((o) => o.id === dwellMs) ? dwellMs : DEFAULT_DWELL_MS
  if (state.dwellMs === n) return
  patchUi({ dwellMs: n })
}

/** 改某个活动的轮播配置。整条替换（不是逐项改）。 */
export function setRotation(activity: Activity, rotation: Rotation): void {
  const items = rotation
    .slice(0, MAX_ROTATION_ITEMS)
    .map((r) => ({
      state: r.state,
      plays: Math.min(MAX_PLAYS, Math.max(MIN_PLAYS, Math.round(r.plays)))
    }))
  if (items.length === 0) return // 空配置会让那个活动没有动画，不允许
  patchUi({ rotation: { ...state.rotation, [activity]: items } })
}

/** 恢复某个活动到默认轮播。 */
export function resetRotation(activity: Activity): void {
  patchUi({ rotation: { ...state.rotation, [activity]: DEFAULT_ROTATION[activity] } })
}

/** 把所有活动的轮播恢复默认。 */
export function resetAllRotation(): void {
  patchUi({ rotation: DEFAULT_ROTATION })
}

/** 某个活动是否被改过（设置页用来标「已改」）。 */
export function rotationChanged(activity: Activity, state0 = state): boolean {
  return JSON.stringify(state0.rotation[activity]) !== JSON.stringify(DEFAULT_ROTATION[activity])
}

/** 改休眠阈值。 */
export function setSleepMinutes(minutes: number): void {
  const ok = SLEEP_OPTIONS.some((o) => o.id === minutes)
  if (!ok || state.sleepMinutes === minutes) return
  patchUi({ sleepMinutes: minutes })
}

/* ── 自动分配顺位 ──────────────────────────────────────────────────── */

/**
 * 改顺位表（整条替换）。
 *
 * 存之前过一遍 `sanitizePreset`：设置页的下拉理论上只会产生合法值，但这
 * 条数据要落盘，落盘的东西可以被手工改 —— 和 `rotation` 同一套纪律。
 */
export function setPreset(next: PresetSlot[]): void {
  const clean = sanitizePreset(next)
  if (JSON.stringify(clean) === JSON.stringify(state.preset)) return
  patchUi({ preset: clean })
}
/** 改某一行（图案或表情）。越界忽略 —— 并发下删行与改行可能撞一起。 */
export function setPresetAt(index: number, patch: Partial<PresetSlot>): void {
  const cur = state.preset[index]
  if (!cur) return
  const next = state.preset.map((row, i) => (i === index ? { ...row, ...patch } : row))
  setPreset(next)
}

/** 删掉某一行。删到下限就不再删 —— 返回是否真的删了。 */
export function removePresetAt(index: number): boolean {
  if (state.preset.length <= PRESET_MIN) return false
  if (index < 0 || index >= state.preset.length) return false
  setPreset(state.preset.filter((_, i) => i !== index))
  return true
}

/**
 * 末尾加一行。
 *
 * 挑一套「还没用过的组合」：图案 / 配色 / 表情都优先选表里没出现过的，
 * 都被占了就回到第一个（允许重复，用户自己决定）。
 */
export function addPresetRow(): boolean {
  if (state.preset.length >= PRESET_MAX) return false
  const usedShape = new Set(state.preset.map((r) => r.shape))
  const shape =
    SHAPE_IDS.find((id) => !usedShape.has(id)) ?? SHAPE_IDS[0] ?? DEFAULT_LOOK.shape
  const usedColor = new Set(state.preset.map((r) => r.color))
  const color =
    Object.keys(COLOR_OPTIONS).find((id) => !usedColor.has(id)) ??
    Object.keys(COLOR_OPTIONS)[0] ??
    DEFAULT_LOOK.color
  const usedExpr = new Set(state.preset.map((r) => r.expression))
  const expression =
    EXPRESSION_PRESET_ORDER.find((id) => !usedExpr.has(id)) ?? DEFAULT_LOOK.expression
  setPreset([...state.preset, { shape, color, expression }])
  return true
}

/** 顺位是否被改过（设置页用来标「已改」）。 */
export function presetChanged(state0 = state): boolean {
  return JSON.stringify(state0.preset) !== JSON.stringify(PRESET_DEFAULT)
}

/** 恢复默认顺位。 */
export function resetPreset(): void {
  patchUi({ preset: PRESET_DEFAULT.map((r) => ({ ...r })) })
}

/* ── 试片 ──────────────────────────────────────────────────────────── */

/**
 * 设置试片状态。null = 跟随真实状态。
 *
 * 顺手清掉「试播中的轮播」：用户点了某一枚动画芯片，意图明确是「就看这个」，
 * 不该被上一条轮播盖住（否则点了眨眼，画面还在空闲↔眨眼之间来回跳，
 * 看着像按钮没反应）。
 */
export function setPreview(state: StateId | null): void {
  patchUi({ preview: state, previewRotation: null })
}

/**
 * 把一整条轮播搬到试片上播（「动画映射」行尾的「试播」）。
 *
 * 为什么要整条搬而不是只播第一项：用户配「空闲×5 + 眨眼×1」时想看的正是
 * 这个交替节奏，只播一项就只能在窗口里干等。
 *
 * `preview` 同时钉到第一项，是为了在轮播停下来（比如切走页面）时画面不会
 * 跳回别的状态 —— `Bot` 的 `state` 在引导播时只作为初始值，但试片没配轮播
 * 时它就是唯一的来源。
 */
export function playRotationInPreview(rotation: Rotation): void {
  if (rotation.length === 0) return
  patchUi({
    preview: rotation[0]!.state,
    previewRotation: rotation.map((r) => ({ ...r }))
  })
}

/** 结束试播，回到单个动画。 */
export function stopPreviewRotation(): void {
  if (state.previewRotation === null) return
  patchUi({ previewRotation: null })
}

/**
 * 设置试片的表情。
 *
 * 试片原来只钉「动画」，图案和表情都跟全局走 —— 于是想看「宝石 + 惊讶」
 * 长什么样，得先跑去右栏改全局，回来再看，改回去还得再跑一趟。
 * 现在试片自己带表情，配合图案列，就是一个自由预览台。
 *
 * `null` = 跟随全局。默认是 null，所以不碰它的人行为完全不变。
 * 界面上没有「跟全局」按钮（v0.3.12 去掉，理由见 `previewExpression` 的注释），
 * 但这个值本身保留 —— 用户没法主动点回 null，可它仍是初始态与回落目标。
 */
export function setPreviewExpression(expression: string | null): void {
  patchUi({ previewExpression: expression })
}

/** 设置试片的图案。`null` = 跟随全局。 */
export function setPreviewShape(shape: string | null): void {
  patchUi({ previewShape: shape })
}

/**
 * 设置试片的配色。`null` = 跟随全局。
 *
 * 和图案、表情同一套语义：没点过就跟着全局走，点过就独立。
 * 界面上同样没有「跟全局」按钮（v0.3.12 的判决：那是一个状态开关，
 * 混在一列外观选项里只会造成干扰）。
 */
export function setPreviewColor(color: string | null): void {
  patchUi({ previewColor: color })
}

/**
 * 把某一行的三者一次性喂给试片。
 *
 * 「动画映射」和「自动分配顺位」的行尾各有一枚「试播」：点它就把这一行的
 * 配置原样搬到试片上，不用回右栏对着格子看。所以这里要**整份**写，
 * 包括把 `null` 覆盖掉 —— 否则「点了第 4 格的颜色」却发现画面还是上一行
 * 的颜色，看的人会以为按钮没反应。
 */
export function previewSlotOf(slot: PresetSlot): void {
  patchUi({
    previewShape: slot.shape,
    previewColor: slot.color,
    previewExpression: slot.expression
  })
}

/* ── 固定容量监控队列：会话切换只改内存，不写 localStorage ───────── */

let monitorQueue: QueueState | null = null
let activeMonitorId: string | undefined
const automaticPresetSlots = new Map<string, number>()

/** 自动顺位首次按 Bot id 认领，之后换格不换脸；显式 looks[id] 优先。 */
export function presetPositionFor(sessionId: string, firstPosition: number): number {
  const known = automaticPresetSlots.get(sessionId)
  if (known !== undefined) return known
  const position = Math.max(0, firstPosition)
  automaticPresetSlots.set(sessionId, position)
  return position
}

/**
 * 按「这一帧实际显示的队列」同步自动顺位认领，避免两个不同会话撞进同一格顺位。
 *
 * ── 为什么需要 ──────────────────────────────────────────────────────
 * `presetPositionFor` 只保证「同一个 id 稳定」，不保证「不同 id 不同」：
 * 队列重排时两个会话若先后以同一个格位首次露面，会被认领到同一行顺位，
 * 于是两格取到同一套外观，容易看错。这里在整帧渲染前统一认领一次。
 *
 * ── 规则 ────────────────────────────────────────────────────────────
 *  1. 已经认领过的 id 保留原顺位（换格不换脸，既有行为不变）。
 *  2. 新 id 优先坐自己当前的格位；若该格位已被别人占，顺延到最近的空位。
 *  3. 已离开画面的 id 释放其格位，避免去重表只增不减。
 *  4. 全程只动模块级内存 Map，不写 localStorage、不触碰隔离协议。
 *
 * 只保证「自动顺位不撞」；用户手动把两行设成一样、或顺位表短于格子数时
 * 从头循环重复，仍按设置页既定口径保留（那是用户的自由）。
 *
 * 返回这一帧的认领表快照，供渲染期读；同时写回模块级 Map，供
 * `presetPositionFor` 等既有读取点保持一致。
 */
export function syncPresetSlots(shownIds: readonly string[]): Map<string, number> {
  // 空队列多来自「当前会话暂未识别」这类瞬时状态（子页会被卸载），不是所有
  // 会话真的离开了。此时保留认领表，恢复后外观不重排。
  if (shownIds.length === 0) return new Map(automaticPresetSlots)
  const kept = new Map<string, number>()
  for (const [id, position] of automaticPresetSlots) {
    if (shownIds.includes(id)) kept.set(id, position)
  }
  automaticPresetSlots.clear()
  const taken = new Set<number>()
  // 先安置已经认领过的：保留原顺位（换格不换脸），但若两个旧 id 撞了同一格，
  // 只留一个，另一个落到下一轮重新分配 —— 这就是去重。
  for (const id of shownIds) {
    const known = kept.get(id)
    if (known !== undefined && !taken.has(known)) {
      automaticPresetSlots.set(id, known)
      taken.add(known)
    }
  }
  for (const id of shownIds) {
    if (automaticPresetSlots.has(id)) continue
    let position = Math.max(0, shownIds.indexOf(id))
    while (taken.has(position)) position += 1
    automaticPresetSlots.set(id, position)
    taken.add(position)
  }
  return new Map(automaticPresetSlots)
}

function currentMonitorQueue(): QueueState {
  return monitorQueue ?? seedMonitorQueue(state.picked, activeMonitorId, MAX_MONITORED)
}

function publishMonitorQueue(next: QueueState, activeId: string | undefined, save: boolean): void {
  monitorQueue = next
  if (activeId !== undefined) activeMonitorId = activeId
  const nextPicked = next.order.filter((id) => id !== activeMonitorId)
  if (nextPicked.length === state.picked.length && nextPicked.every((id, i) => id === state.picked[i])) {
    if (save) persist()
    return
  }
  state = { ...state, picked: nextPicked }
  if (save) persist()
  emit()
}

/** 勾选会扩一格（上限九格）；满额时手动加选不会悄悄挤掉另一格。 */
export function togglePicked(sessionId: string): boolean {
  if (!sessionId || sessionId === activeMonitorId) return false
  if (state.picked.includes(sessionId)) {
    removePicked(sessionId)
    return true
  }
  const before = currentMonitorQueue()
  const next = addMonitorQueue(before, sessionId, MAX_MONITORED)
  if (next.capacity === before.capacity && !next.order.includes(sessionId)) return false
  publishMonitorQueue(activeMonitorId ? visitMonitorQueue(next, activeMonitorId, new Set()) : next, activeMonitorId, true)
  return true
}

export function removePicked(sessionId: string): void {
  if (!state.picked.includes(sessionId)) return
  publishMonitorQueue(removeMonitorQueue(currentMonitorQueue(), sessionId, activeMonitorId), activeMonitorId, true)
}

export function clearPicked(): void {
  if (state.picked.length === 0) return
  publishMonitorQueue(clearMonitorQueue(currentMonitorQueue(), activeMonitorId), activeMonitorId, true)
}

/** 渲染期间只算候选，不修改共享 store；未知当前会话时不推断删除。 */
export function monitoredList(activeId: string | undefined, picked: string[], unavailable: ReadonlySet<string> = new Set()): string[] {
  const queue = monitorQueue ?? seedMonitorQueue(picked, activeId, MAX_MONITORED)
  return activeId ? visitMonitorQueue(queue, activeId, unavailable).order : [...queue.order]
}

/** 提交真实访问顺序；只更新内存，切换会话绝不触发整份配置落盘。 */
export function visitMonitored(activeId: string | undefined, unavailable: ReadonlySet<string>): void {
  if (!activeId) return
  const initial = monitorQueue ?? seedMonitorQueue(state.picked, activeId, MAX_MONITORED)
  const next = visitMonitorQueue(initial, activeId, unavailable)
  publishMonitorQueue(next, activeId, false)
}

function subscribe(fn: () => void): () => void {
  subs.add(fn)
  return () => {
    subs.delete(fn)
  }
}

/**
 * 读一项状态。`useSyncExternalStore` 要求快照在状态不变时返回同一个引用，
 * 所以只能按字段读 —— 别提供「返回整个 state」的钩子，那样每次渲染都是新对象。
 */
export function useUi<K extends keyof UiState>(key: K): UiState[K] {
  return useSyncExternalStore(subscribe, () => state[key])
}

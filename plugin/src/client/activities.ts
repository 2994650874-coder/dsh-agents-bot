/**
 * agent 状态 → 动画状态 的映射表。
 *
 * 左列是「agent 在干什么」（业务语义），右列是 bloub 引擎的实测状态。
 * 分开写是因为这两套词表来源完全不同：左边来自 DSH 的 session/工具事件，
 * 右边是逐帧从参考视频量出来的，改动右边等于改美术，不该被业务需求顺手带走。
 *
 * ── 为什么这里是「默认值」而不是「唯一答案」 ─────────────────────────
 * 每个活动配哪个动画，是**用户偏好**，不是代码事实。所以本文件给出
 * `DEFAULT_ROTATION`（开箱即用的那一份），用户可以在设置页里改；
 * 改过的存 localStorage，没改过的走这里。
 *
 * 引擎侧的硬约束不能靠配置绕过：某些状态画自己的形状（`!`、三点、蛋），
 * 它们不吃身形/表情覆盖。那是美术事实，配错了只是「不好看」，不会坏。
 *
 * ── 数据来源 ────────────────────────────────────────────────────────
 * 工具级信息（在跑什么工具、出错、压缩、后台任务）来自 Host 半侧的
 * `agentsBot` 投影单元 —— 见 `src/host/index.ts`。客户端不重放日志。
 */
import type { StateId } from '../bot/states'

/** agent 当前在做什么。由 `deriveActivity` 从真实状态推导。 */
export type Activity =
  | 'idle' // 空闲，等活
  | 'thinking' // 在想（模型在跑，还没吐工具）
  | 'reading' // 读文件
  | 'searching' // 检索
  | 'running' // 跑命令
  | 'writing' // 写文件 / 改代码
  | 'compacting' // 压缩上下文
  | 'background' // 后台任务（结果已返回、任务仍在跑）
  | 'waiting' // 等用户确认 / 等输入
  | 'done' // 刚完成，还没被看过
  | 'error' // 出错（含中断 / 配额 / harness 自身报错）
  | 'spawning' // 子代理刚被创建，还没起来
  | 'sleep' // 长时间没有活动

/** 两个正式 UI 共用的活动呈现：全称、窄胶囊短称和状态灯颜色。 */
export const ACTIVITY_PRESENTATION: Record<Activity, { label: string; short?: string; color: string }> = {
  idle: { label: '空闲', color: '#8db6a0' },
  thinking: { label: '思考中', color: '#5aa9e6' },
  reading: { label: '读文件', color: '#5aa9e6' },
  searching: { label: '检索中', color: '#5aa9e6' },
  running: { label: '跑命令', color: '#5aa9e6' },
  writing: { label: '写文件', color: '#5aa9e6' },
  compacting: { label: '压缩上下文', short: '压缩', color: '#5aa9e6' },
  background: { label: '后台任务', short: '后台', color: '#5aa9e6' },
  waiting: { label: '等待确认', short: '等待', color: '#f0b429' },
  done: { label: '刚完成', short: '完成', color: '#5aa9e6' },
  error: { label: '出错', color: '#e0563f' },
  spawning: { label: '启动中', short: '启动', color: '#5aa9e6' },
  sleep: { label: '休眠', color: '#8db6a0' }
}

/** 兼容设置页和主窗口的全称入口；值只从唯一呈现字典生成。 */
export const ACTIVITY_LABEL: Record<Activity, string> = Object.fromEntries(
  Object.entries(ACTIVITY_PRESENTATION).map(([activity, presentation]) => [activity, presentation.label])
) as Record<Activity, string>

/** 窄胶囊未定义短称时自然回落全称。 */
export function activityShortLabel(activity: Activity): string {
  const presentation = ACTIVITY_PRESENTATION[activity]
  return presentation.short ?? presentation.label
}

/** 设置页里按这个顺序排。 */
export const ACTIVITY_ORDER: Activity[] = [
  'idle',
  'thinking',
  'reading',
  'searching',
  'running',
  'writing',
  'compacting',
  'background',
  'waiting',
  'done',
  'error',
  'spawning',
  'sleep'
]

/**
 * 一条轮播项：某个动画，播几遍。
 *
 * 为什么用「遍」而不是「秒」：每个动画有自己实测的长度（眨眼 1.6 秒、
 * 思考 2.6 秒、检索 3.4 秒）。用秒的话，同一个 15 秒在眨眼那里是 9 遍、
 * 在检索那里只有 4 遍，用户算不清自己配出来是什么样。用遍数就是
 * 「空闲播 5 遍，眨眼播 1 遍」，所见即所得。
 *
 * 而且按整遍播永远不会截断动画 —— 有几个状态被截断会露馅
 * （`alert` 的感叹号 2 秒才回位，`orbit` 2.5 秒才收干净）。
 */
export interface RotationItem {
  state: StateId
  /** 播几遍。1 ~ 20。 */
  plays: number
}

/** 一个活动的轮播配置。最多两项，一项就是不轮播。 */
export type Rotation = RotationItem[]

/** 每个活动最多配几项。用户明确要求「最多二组」。 */
export const MAX_ROTATION_ITEMS = 2

/** 播几遍的上下限。 */
export const MIN_PLAYS = 1
export const MAX_PLAYS = 20

/**
 * 默认轮播表 —— 开箱即用的那一份。
 *
 * ── 2026-10-31：烧录成作者自己的那一份 ────────────────────────────────
 * 用户原话：「把我目前的动画映射和顺位分配顺位烧录成插件的默认（就是如果
 * 一个人安装这个插件，默认就是这个样子的意思）」。
 *
 * 所以下面 13 行**不是设计稿，是从他的存盘里原样搬过来的** —— 每个人装的
 * 第一眼就是他调了很久的成果。搬运时一行没改（`plays` 全是 1，多数活动是
 * 两项轮播）。
 *
 * ── 这改变了什么 ─────────────────────────────────────────────────────
 * 旧默认是「大多数活动只有一项」，只有 `idle` 和 `thinking` 配了两项。新默认
 * 里 13 个活动**全部**是两项 —— 也就是说每个人第一眼看到的是交替动画，而不是
 * 固定播一个。这是他的审美选择，不是我的。
 *
 * ── 为什么老存盘不受影响 ─────────────────────────────────────────────
 * 这些值只在 localStorage **没有**这项配置时才生效。他（以及任何已经装过的人）
 * 存盘里有 `rotation`，读盘走的是存档，所以他自己看到的画面一点不变。
 * 烧录只影响「全新安装的人」。
 */
export const DEFAULT_ROTATION: Record<Activity, Rotation> = {
  idle: [
    { state: 'idle', plays: 1 },
    { state: 'wink', plays: 1 }
  ],
  thinking: [
    { state: 'burst', plays: 1 },
    { state: 'wink', plays: 1 }
  ],
  reading: [
    { state: 'receiving', plays: 1 },
    { state: 'loading', plays: 1 }
  ],
  searching: [
    { state: 'search', plays: 1 },
    { state: 'wide', plays: 1 }
  ],
  running: [
    { state: 'orbit', plays: 1 },
    { state: 'radar', plays: 1 }
  ],
  /*
   * `writing` → `alert`（2026-10-31）。三个状态换了名字：`alert` 现在叫
   * 「写文件」，`exclaim` 叫「错误」，`play` 叫「环流」。活动映射跟着走，
   * 否则面板上会出现「写文件 · 环流」——名字对了，动画是另一回事。
   */
  writing: [
    { state: 'alert', plays: 1 },
    { state: 'sending', plays: 1 }
  ],
  compacting: [
    { state: 'thinking', plays: 1 },
    { state: 'celebrate', plays: 1 }
  ],
  background: [
    { state: 'uploading', plays: 1 },
    { state: 'idle', plays: 1 }
  ],
  waiting: [
    { state: 'notify', plays: 1 },
    { state: 'exclaim', plays: 1 }
  ],
  done: [
    { state: 'play', plays: 1 },
    { state: 'wink', plays: 1 }
  ],
  error: [
    { state: 'exclaim', plays: 1 },
    { state: 'progress', plays: 1 }
  ],
  /*
   * 启动中仍用「弹跳」(2026-10-30)：`egg` 被提升成了 FORME（见
   * `bot/skins.ts`，`oeuf`），形状不能放进轮播。用户选 `bounce` 的理由
   * 仍然成立 —— 一个点弹几下就说明「在起、还没站稳」。
   */
  spawning: [
    { state: 'bounce', plays: 1 },
    { state: 'idle', plays: 1 }
  ],
  sleep: [
    { state: 'sleeping', plays: 1 },
    { state: 'idle', plays: 1 }
  ]
}

/**
 * 每个活动的**主状态**（轮播的第一项）。
 *
 * 用于不需要轮播的地方：试片、格子角标、以及「配置读坏了」时的回落。
 * 直接从 `DEFAULT_ROTATION` 推，不另写一份 —— 两份表迟早不同步。
 */
export const ACTIVITY_STATE: Record<Activity, StateId> = Object.fromEntries(
  ACTIVITY_ORDER.map((a) => [a, DEFAULT_ROTATION[a][0]!.state])
) as Record<Activity, StateId>

/**
 * 空闲多久算休眠。
 *
 * 用户要求做成可配置项，默认 30 分钟。放在设置页最底下一行，
 * 和轮播行分开 —— 它是阈值不是动画。
 */
export const SLEEP_OPTIONS: { id: number; label: string }[] = [
  { id: 5, label: '5 分钟' },
  { id: 10, label: '10 分钟' },
  { id: 15, label: '15 分钟' },
  { id: 30, label: '30 分钟' },
  { id: 60, label: '1 小时' },
  { id: 120, label: '2 小时' }
]

export const DEFAULT_SLEEP_MINUTES = 30

/** 按工具名判活动。名字取 DSH 工具表的原名，不做模糊匹配。 */
export function activityOfTool(tool: string): Activity {
  switch (tool) {
    case 'read':
    case 'read_image':
    case 'knowledge_get_document':
      return 'reading'
    case 'grep':
    case 'glob':
    case 'web_search':
    case 'web_fetch':
    case 'anysearch_search':
    case 'anysearch_batch_search':
    case 'anysearch_capabilities':
    case 'knowledge_search':
      return 'searching'
    case 'bash':
    case 'pwsh':
    case 'terminal_send':
    case 'run_code':
      return 'running'
    case 'write':
    case 'edit':
      return 'writing'
    case 'spawn_teammate':
    case 'subagent':
    case 'subagent_fork':
    case 'workflow':
    case 'ralph':
      return 'spawning'
    case 'ask_user_question':
      return 'waiting'
    default:
      // 其余工具（todo_write / present / job_* / mnemon_* ...）都算「在想」，
      // 它们不是文件或命令操作，画成思考中的三点最贴切。
      return 'thinking'
  }
}

/**
 * 所有可选的动画（设置页的下拉列表）。
 *
 * 用 `SEQUENCE` 的顺序（即参考视频的播放顺序），这样列表本身有含义，
 * 不是字母序的杂烩。
 *
 * ── 2026-10-30：删掉两个、改名一个、新增十一个 ──────────────────────
 * 用户对旧列表的判决：
 *   · 旧的 `orbit`（三角+六条椭圆）「太丑了，一坨线在乱转」→ 移除，换成
 *     上游的五点环绕。根因是量出来的：旧椭圆全是 1.3~1.4 半径，等于六根
 *     刚性线条在转；上游的五个点是**圆盘**，半径和透明度随深度变化。
 *   · 旧的 `swirl`（漩涡）「太丑了」→ 移除。它原来是压缩上下文的动画，
 *     现在压缩上下文改用 `progress`（进度环），语义更准。
 *   · 旧的 `sleep` 其实是「上下弹的小点」，不是睡眠。用户指出后改名成
 *     `bounce`（弹跳），真正的睡眠用上游的 `sleeping` 补上。
 *
 * **`hexagon`（六边形）不在表里**：它在引擎里是一个独立状态，但没有任何活动
 * 映射到它，唯一能看到它的地方就是试片 —— 也就是一个只为试片存在的选项。
 * 已从试片移除。它和身形里的 `hexagone` 不是同一个东西：那一个是解析式生成的
 * 圆角六边形，这一个是从参考视频逐帧量出来的另一套轮廓，朝向差 30°。
 */
export const ANIMATION_OPTIONS: { id: StateId; label: string }[] = [
  { id: 'idle', label: '空闲' },
  { id: 'thinking', label: '思考' },
  { id: 'wink', label: '眨眼' },
  { id: 'search', label: '检索' },
  { id: 'wide', label: '等待' },
  /*
   * ── 2026-10-31：三个名字换了，画没动 ────────────────────────────────
   * 用户原话：「（写文件）的名字改成环流，（出错）的名字改成（写文件），
   * （惊叹）的名字改成（错误）」。
   *
   * 换的是**标签**，不是 id、不是美术。id 被量法表、老存盘、历史看板
   * （`turn*.html` 内联的是当时的引擎）引用着，动 id 等于断掉那些档案。
   *
   *   play    → 环流    （一条线扫过身体，本来就不像「写文件」）
   *   alert   → 写文件  （倾斜的「!」来回移动 + 抖动，像在落笔）
   *   exclaim → 错误    （竖着的「!」，一动不动，是报错的样子）
   *
   * 配套改了 `DEFAULT_ROTATION`：`writing` 活动指向 alert，`error` 活动指向
   * exclaim —— 否则面板上会出现「写文件 · 环流」这种字面冲突。
   */
  { id: 'alert', label: '写文件' },
  { id: 'notify', label: '完成' },
  { id: 'exclaim', label: '错误' },
  { id: 'bounce', label: '弹跳' },
  { id: 'play', label: '环流' },
  { id: 'orbit', label: '环绕' },
  { id: 'radar', label: '雷达' },
  { id: 'progress', label: '进度' },
  { id: 'celebrate', label: '庆祝' },
  { id: 'loading', label: '加载' },
  { id: 'waking', label: '苏醒' },
  { id: 'sleeping', label: '睡眠' },
  { id: 'sending', label: '发送' },
  { id: 'receiving', label: '接收' },
  { id: 'uploading', label: '上传' },
  { id: 'burst', label: '爆发' },
  { id: 'comet', label: '跑命令' }
]

/**
 * 试片用的状态列表 —— 与 `ANIMATION_OPTIONS` 同一份。
 *
 * 为什么不另写一份：试片的功能是「看一眼这个动画长什么样」，所以它
 * 必须能预览**设置页里能选到的每一个**。两份表分开维护，迟早出现
 * 「设置里能选、试片里看不到」的洞。
 */
export const PREVIEW_STATES = ANIMATION_OPTIONS

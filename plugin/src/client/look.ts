/**
 * 头像外观设置：形状 / 配色 / 表情。
 *
 * 这些值只影响 `baseBody` / `baseFace` 状态（idle、wink、wide、notify），
 * 其余状态里轮廓本身就是动画，不能被用户覆盖 —— 这条是引擎的硬约束，见
 * `src/bot/skins.ts` 与 docs/architecture.md。
 */
import { COLOR_BY_ID, COLORS, DEFAULT_COLOR, DEFAULT_SHAPE, SHAPE_BY_ID } from '../bot/skins'
import { DEFAULT_EXPRESSION, EXPRESSIONS } from '../bot/expressions'

export interface AvatarLook {
  shape: string
  color: string
  expression: string
  /** 头像在面板里的像素尺寸 */
  size: number
}

export const DEFAULT_LOOK: AvatarLook = {
  shape: DEFAULT_SHAPE,
  color: DEFAULT_COLOR,
  expression: DEFAULT_EXPRESSION,
  size: 96
}

/** 形状的中文名。引擎里的 id 是法语，面板上不直接显示。 */
const SHAPE_LABEL: Record<string, string> = {
  cercle: '圆',
  galet: '卵石',
  squircle: '圆角方',
  capsule: '胶囊',
  triangle: '三角',
  hexagone: '六边形',
  nuage: '云',
  goutte: '水滴',
  // 以下 6 个来自 grok-icon-study 的 animation.html，半径由
  // `tools/gen-shapes.mjs` 从它的 SVG path 转换而来（见 README
  // 《能不能把它的「编辑页面」搬进设置页》）。
  bouclier: '盾牌',
  dome: '穹顶',
  arche: '拱门',
  cylindre: '圆柱',
  gemme: '宝石',
  cristal: '晶体',
  oeuf: '蛋'
}

const COLOR_LABEL: Record<string, string> = {
  encre: '墨黑',
  brun: '棕',
  rouge: '红',
  orange: '橙',
  ambre: '琥珀',
  vert: '绿',
  turquoise: '青绿',
  bleu: '蓝',
  violet: '紫',
  rose: '粉',
  gris: '灰',
  creme: '奶油'
}

const EXPR_LABEL: Record<string, string> = {
  neutre: '中性',
  attentif: '专注',
  surpris: '惊讶',
  excite: '兴奋',
  heureux: '开心',
  hilare: '大笑',
  colere: '生气',
  triste: '难过',
  effraye: '害怕',
  mefiant: '戒备',
  confus: '困惑',
  curieux: '好奇',
  fier: '自豪',
  timide: '害羞',
  blase: '厌了',
  somnolent: '困倦'
}

/**
 * 身形在面板上的排列顺序。
 *
 * 这是 **UI 顺序**，与 `bot/skins.ts` 里 `SHAPES` 的数组顺序无关 ——
 * 后者是引擎侧（eyefit 预计算表的构建顺序），改了没有任何视觉收益却有风险。
 *
 * 前 8 个是用户点名的顺序；后 6 个是从 grok-icon-study 搬来的，接在卵石之后、
 * 水滴之前 —— 水滴保持在最末（它一直是「不参与顺位」的那个，位置不动）。
 */
const SHAPE_ORDER: string[] = [
  'cercle',
  'squircle',
  'hexagone',
  'nuage',
  'capsule',
  'triangle',
  'galet',
  'bouclier',
  'dome',
  'arche',
  'cylindre',
  'gemme',
  'cristal',
  // L'oeuf vient de l'ETAT `egg`, promu au rang de forme (2026-10-30) : il
  // arrive en fin de liste, a cote des autres formes « pleines » — sa place
  // naturelle, puisque rien ne le distingue d'une silhouette ordinaire.
  'oeuf',
  'goutte'
]

/**
 * 顺位表的一行：一个格子长什么样 = 图案 + 配色 + 表情。
 *
 * 为什么把三者绑成一对，而不是各存一张表：用户要的是「第 3 格 = 六边形 +
 * 紫色 + 困惑」这种**成套**的指定。分几张表存的话，长度一旦不同步（删行只删了
 * 其中一张），第 N 格的图案和表情就会来自不同位置 —— 这种错位不报错，
 * 只是看起来莫名其妙。绑成一套，这种可能就不存在了。
 *
 * ── 配色是 2026-10-31 加的 ──────────────────────────────────────────
 * 用户要求「自动分配顺位需要增加颜色的可选槽」。在那之前配色只能全局调，
 * 9 个格子颜色全都一样 —— 要让网格一眼分得清，颜色是比图案更强的区分信号。
 * 老存盘里没有 `color`，读盘时按行号补默认色（见 `sanitizePreset`）。
 */
export interface PresetSlot {
  shape: string
  color: string
  expression: string
}

/**
 * 顺位表覆盖的格子数。
 *
 * **8 = `MAX_MONITORED` - 1。** 减掉的那个是第 1 格：它永远是当前窗口，
 * 外观由右栏的「外观 · 全局」决定，不归顺位管（设置页的说明里也一直这么写）。
 * 所以 8 行 + 第 1 格 = 9 格，与监视上限重合，9 个格子全不同。
 */
export const PRESET_SIZE = 8

/** 行数下限：再少，第 4 格以后就开始重复了。 */
export const PRESET_MIN = 2
/** 行数上限 = 覆盖满 9 格，再多也排不满。 */
export const PRESET_MAX = PRESET_SIZE

/**
 * 配色在面板上的排列顺序。
 *
 * 与 `bot/skins.ts` 里 `COLORS` 的数组顺序一致 —— 不另排，因为右栏「外观」
 * 那个配色选择器就是按 `COLORS` 排的，设置页跟着排，用户在两处看到的是同一个
 * 顺序。`ordered()` 会把漏列的补到末尾，所以将来加色不会静默消失。
 */
const COLOR_ORDER: string[] = [
  'encre',
  'brun',
  'rouge',
  'orange',
  'ambre',
  'vert',
  'turquoise',
  'bleu',
  'violet',
  'rose',
  'gris',
  'creme'
]

/**
 * 表情在面板上的排列顺序。
 *
 * 前 8 个是用户点名的顺序（中性 → 好奇 → 困惑 → 专注 → 害羞 → 困倦 →
 * 难过 → 害怕），后 8 个是他没说的，按原顺序补在后面。
 */
const EXPRESSION_ORDER: string[] = [
  'neutre',
  'curieux',
  'confus',
  'attentif',
  'timide',
  'somnolent',
  'triste',
  'effraye',
  'surpris',
  'excite',
  'heureux',
  'hilare',
  'colere',
  'mefiant',
  'fier',
  'blase'
]

/** 表情顺位与显示顺序同一份 —— 用户没有要排除任何表情。 */
const EXPRESSION_PRESET_ORDER = EXPRESSION_ORDER

/**
 * 默认顺位表：8 行，每行「图案 + 配色 + 表情」。
 *
 * ── 2026-10-31：烧录成作者自己的那一份 ────────────────────────────────
 * 用户原话：「把我目前的动画映射和顺位分配顺位烧录成插件的默认（就是如果
 * 一个人安装这个插件，默认就是这个样子的意思）」。
 *
 * 下面 8 行**不是设计稿，是从他的存盘里原样搬过来的**，包括：
 *
 *   第 2 格 圆角方 + 棕 + 困惑      第 6 格 拱门 + 绿 + 困倦
 *   第 3 格 六边形 + 红 + 好奇      第 7 格 穹顶 + 青绿 + 厌了
 *   第 4 格 云 + 橙 + 专注          第 8 格 水滴 + 蓝 + 害怕
 *   第 5 格 圆柱 + 琥珀 + 害羞      第 9 格 蛋 + 紫 + 惊讶
 *
 * ── 这推翻了三条旧约束，需记录在案 ──────────────────────────────────
 * 旧默认刻意排除了三样东西，现在都被烧录进来的表破了：
 *
 *  1. **水滴**：旧注释写「用户明确要求不排列水滴」。但那是他当时的设置，
 *     现在他自己的表第 8 行就是水滴 —— 以存盘为准，旧的禁令作废。
 *  2. **拱门**：旧注释写「它在惊讶下两眼贴在一起」。新表第 6 行用的是
 *     拱门 + 困倦，不是惊讶，所以那个问题不会被触发；但这意味着**拱门
 *     进顺位不再有形状上的禁忌**，只剩「别配惊讶」这一条在 README 眼距表里。
 *  3. **图案顺序与面板顺序一致**：旧表前 6 项刻意等于面板前 6 项，为的是
 *     「面板上第 2 个身形 = 第 2 格拿到的身形」。新表是用户自己排的，
 *     两者不再一致（比如圆柱在面板里排第 12，在顺位里排第 5）。
 *     这不是错误，是「顺位是他自己的编排」这一事实的直接结果。
 *
 * 本文件不再是「算出来的默认」，而是「一份抄写」。要改默认就直接改这张表。
 */
export const PRESET_DEFAULT: PresetSlot[] = [
  { shape: 'squircle', color: 'brun', expression: 'confus' },
  { shape: 'hexagone', color: 'rouge', expression: 'curieux' },
  { shape: 'nuage', color: 'orange', expression: 'attentif' },
  { shape: 'cylindre', color: 'ambre', expression: 'timide' },
  { shape: 'arche', color: 'vert', expression: 'somnolent' },
  { shape: 'dome', color: 'turquoise', expression: 'blase' },
  { shape: 'goutte', color: 'bleu', expression: 'effraye' },
  { shape: 'oeuf', color: 'violet', expression: 'surpris' }
]

/**
 * 按给定顺序重排一份 id → 名字典。
 *
 * 末尾会把顺序表里漏掉的条目补回去：漏列的表现是「选项从面板上静默消失」，
 * 那种 bug 只有用户发现得了，所以宁可让漏列的项排在末尾，也不要丢。
 */
function ordered(labels: Record<string, string>, order: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const id of order) {
    const label = labels[id]
    if (label !== undefined) out[id] = label
  }
  for (const [id, label] of Object.entries(labels)) {
    if (!(id in out)) out[id] = label
  }
  return out
}

export const SHAPE_OPTIONS = ordered(SHAPE_LABEL, SHAPE_ORDER)
/* 配色也走 `ordered`：与右栏配色选择器同一顺序，且将来加色不会静默消失。 */
export const COLOR_OPTIONS = ordered(COLOR_LABEL, COLOR_ORDER)
export const EXPRESSION_OPTIONS = ordered(EXPR_LABEL, EXPRESSION_ORDER)

/** 图案 id 的显示顺序（= 下拉框与面板的顺序）。 */
export const SHAPE_IDS: string[] = Object.keys(SHAPE_OPTIONS)

/**
 * 第 `index` 格（0 = 当前窗口）的默认外观。
 *
 * ── 判据 ────────────────────────────────────────────────────────────
 * 第 1 格（`index = 0`）**原样返回全局**，所以全局那三个控件始终对当前窗口有效。
 * 第 N 格（N ≥ 2）取顺位表第 `N - 2` 行，**就是那一行写的东西，不跟全局转**。
 *
 * 默认表下逐格是：
 *
 *   第 1 格 圆 + 中性（= 全局）   第 6 格 三角 + 困倦
 *   第 2 格 圆角方 + 好奇          第 7 格 卵石 + 难过
 *   第 3 格 六边形 + 困惑          第 8 格 穹顶 + 害怕
 *   第 4 格 云 + 专注              第 9 格 宝石 + 惊讶
 *   第 5 格 胶囊 + 害羞
 *
 * ── 为什么改成「表里写什么就是什么」 ────────────────────────────────
 * 改版前顺位以全局为锚点往后走（`stepIn`），好处是改一次全局整排跟着转。
 * 但用户现在要的是**在设置页逐行指定**「第 3 格 = 六边形 + 困惑」——
 * 一旦逐行可编辑，锚点就成了错位来源：填的是第 3 行，实际显示在第 5 格。
 * 两者不能共存，取「所见即所得」。
 *
 * 代价（写在设置页说明里）：改全局只影响第 1 格。
 *
 * ── 不参与顺位的 ────────────────────────────────────────────────────
 *   · **尺寸**：永远照抄全局，不分格
 *   · **水滴**：默认表里没有（用户要求不排），但设置页可以手动选上
 *   · **拱门**：默认表里没有，它在「惊讶」下两眼贴在一起（见 README 眼距表），
 *     同样可以手动选上
 *
 *   **配色从 2026-10-31 起参与顺位**（用户要求加颜色槽），所以上面那句
 *   「配色永远照抄全局」已经不成立了 —— 只对第 1 格成立。
 *
 * ── 顺位是「第几格」而不是「哪个会话」────────────────────────────────
 * 增删中间格子会让后面的格子整体前移一格，外观跟着换。这是有意的：
 * 手动调过的格子存在 `looks[id]` 里，不参与顺位，不会跳。
 */
export function presetLookAt(
  index: number,
  base: AvatarLook,
  slots: PresetSlot[] = PRESET_DEFAULT
): AvatarLook {
  if (index <= 0) return base
  const table = slots.length ? slots : PRESET_DEFAULT
  const slot = table[(index - 1) % table.length]!
  /* `color` 可能是老存盘里没有的字段（undefined）—— 那时保持全局色，
     不要让 `undefined` 漏进 `Bot`（会渲染成没有墨色的一团）。 */
  return {
    ...base,
    shape: slot.shape,
    color: slot.color ?? base.color,
    expression: slot.expression
  }
}

/**
 * 清洗用户存的顺位表。
 *
 * 存盘可以被手工改，所以不能信：每一行必须是「存在的图案 id + 存在的表情 id」，
 * 坏行整行丢掉。结果为空则回落默认 —— 空表会让 `presetLookAt` 取到 undefined。
 *
 * **允许重复**：两格长一样是用户的自由（比如他想要两个圆的）。
 * 这里只挡「取不到值」和「取到不存在的值」，不替用户判断审美。
 *
 * ── 配色缺失不是坏行 ────────────────────────────────────────────────
 * 配色是 2026-10-31 才加进 `PresetSlot` 的。在那之前存下来的表里每一行都
 * 只有 `{shape, expression}`。若把「没有 color」当成坏行，升级后用户调过的
 * 顺位会**整份被丢掉** —— 那种表现是「升级完格子全变了」，比少个颜色严重
 * 得多。所以缺色按行号补默认色（`PRESET_DEFAULT[i].color`），保持逐格观感
 * 尽量接近升级前。颜色写坏了（存在但不在表里）同样补默认色，不丢行。
 */
export function sanitizePreset(raw: unknown): PresetSlot[] {
  if (!Array.isArray(raw)) return PRESET_DEFAULT.map((r) => ({ ...r }))
  const out: PresetSlot[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const { shape, color, expression } = row as {
      shape?: unknown
      color?: unknown
      expression?: unknown
    }
    if (typeof shape !== 'string' || !(shape in SHAPE_LABEL)) continue
    if (typeof expression !== 'string' || !(expression in EXPR_LABEL)) continue
    const fallbackColor = PRESET_DEFAULT[out.length]?.color ?? DEFAULT_LOOK.color
    const safeColor = typeof color === 'string' && color in COLOR_LABEL ? color : fallbackColor
    out.push({ shape, color: safeColor, expression })
    if (out.length >= PRESET_MAX) break
  }
  return out.length ? out : PRESET_DEFAULT.map((r) => ({ ...r }))
}

/** 顺位里有没有这个图案（右栏的选项用来标「不参与顺位，只能手动选」）。 */
export function inShapePreset(id: string, slots: PresetSlot[] = PRESET_DEFAULT): boolean {
  return slots.some((s) => s.shape === id)
}

export { EXPRESSION_PRESET_ORDER }

export function shapeRadiiOf(shape: string): number[] | null {
  return SHAPE_BY_ID.get(shape)?.radii ?? null
}

export function inkOf(color: string): string {
  return COLOR_BY_ID.get(color)?.hex ?? '#0a0a0c'
}

export function expressionOf(id: string) {
  return EXPRESSIONS.find((e) => e.id === id) ?? null
}

export { COLORS, EXPRESSIONS }

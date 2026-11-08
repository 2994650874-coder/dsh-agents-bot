/**
 * 用引擎自己的几何量算「两眼之间的空白宽度」—— 不靠看图判断。
 *
 * ── 判据 ──────────────────────────────────────────────────────────────
 * `engine.sample(t).eyes` 每项是 `{ d, matrix, alpha }`：
 *   · `d`      眼睛在局部坐标里的轮廓（一个路径字符串）
 *   · `matrix` 是 `matrix(a,b,c,d,e,f)` —— a/b 是 x 轴缩放，e/f 是平移
 *
 * 从 `matrix` 解出每只眼的中心，从 `d` 的 x 范围解出半宽，就能算
 * **两只眼之间的水平间隙**：
 *
 *   间隙 = (右眼中心 - 右眼半宽) - (左眼中心 + 左眼半宽)
 *
 * 间隙 < 0 = 重叠（粘一起）；间隙很小 = 快粘一起（小尺寸下必然糊成一只）。
 * 这是硬事实，不需要审美判断。
 *
 * 参照：圆的间隙是多少，新身形比它小多少。
 *
 * 用法：node tools/build-shape-six.mjs && node tools/probe-arche-gap.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { buildSync } = require('esbuild')

const BOT_TMP = resolve(ROOT, 'preview', '_bot6')

/** 打一个入口，把引擎和身形表一起导出。 */
const ENTRY = resolve(ROOT, 'preview', '_gap-entry.ts')
const { writeFileSync } = require('node:fs')
writeFileSync(
  ENTRY,
  `export { BotEngine } from './_bot6/engine'
export { SHAPE_BY_ID } from './_bot6/skins'
export { EXPRESSIONS } from './_bot6/expressions'
`,
  'utf8'
)

buildSync({
  entryPoints: [ENTRY],
  bundle: true,
  outfile: resolve(ROOT, 'preview', '_gap.cjs'),
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})
const { BotEngine, SHAPE_BY_ID, EXPRESSIONS } = require(resolve(ROOT, 'preview', '_gap.cjs'))

/**
 * 从 matrix 解出平移量，从路径 d 解出 x 的范围。
 *
 * `d` 是引擎自己生成的路径，坐标是**局部坐标**（未经 matrix 变换），
 * 所以要把 d 的 x 范围乘上 matrix 的 a（x 缩放）再加上 e（平移）。
 */
function eyeExtent(eye) {
  const nums = eye.matrix.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map(Number) ?? []
  const [a = 1, , , , e = 0] = nums
  // 路径里的所有 x 坐标：`M x y` / `C x y x y x y` 交替
  const coords = eye.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/g)?.map(Number) ?? []
  let minX = Infinity
  let maxX = -Infinity
  // 路径里 x、y 交替出现，取偶数下标
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
  }
  return { left: minX * a + e, right: maxX * a + e, scaleA: a }
}

/** 某个身形 + 状态 + 表情，在 t=1.1 秒时的两眼间隙。 */
function gapOf(shapeId, state, exprId, t = 1.1) {
  const shape = SHAPE_BY_ID.get(shapeId)
  if (!shape) return null
  const expr = EXPRESSIONS.find((e) => e.id === exprId) ?? null
  const engine = new BotEngine(100, state, shape.radii, expr)
  const frame = engine.sample(t)
  if (frame.eyes.length < 2) return null
  const [l, r] = frame.eyes.map(eyeExtent)
  // 引擎按左眼、右眼顺序输出；保险起见按 left 排序
  const [first, second] = l.left < r.left ? [l, r] : [r, l]
  return second.left - first.right
}

const SHAPES = [
  // 现有 8 个（对照：证明「窄身形会糊」不是新身形特有的问题）
  'cercle',
  'galet',
  'squircle',
  'capsule',
  'triangle',
  'hexagone',
  'nuage',
  'goutte',
  // 用户点名的 6 个
  'bouclier',
  'dome',
  'arche',
  'cylindre',
  'gemme',
  'cristal'
]
const EXPRS = ['neutre', 'surpris', 'effraye', 'colere']
console.log('两眼之间的水平间隙（viewBox 单位，半径 = 100；负 = 重叠）\n')
console.log('身形'.padEnd(11) + EXPRS.map((e) => e.padStart(12)).join(''))
console.log('─'.repeat(60))

const rows = []
for (const shape of SHAPES) {
  const vals = EXPRS.map((expr) => {
    const g = gapOf(shape, 'idle', expr)
    return g
  })
  rows.push({ shape, vals })
  console.log(
    '  ' +
      shape.padEnd(9) +
      vals.map((v) => (v === null ? '—'.padStart(12) : v.toFixed(1).padStart(12))).join('')
  )
}

console.log('─'.repeat(60))
const base = rows.find((r) => r.shape === 'cercle')
console.log('\n最窄的那个表情（绝对值，以及换算到面板真实尺寸的像素）：')
/**
 * 换算到像素：面板里的身形缩略图是 `size: 30`，格子里的 bot 约 96。
 * viewBox 全宽 = 2 × DEMI_VIEWBOX = 316，所以 scale = size / 316。
 * 间隙 1 个 viewBox 单位在 30px 上只有 0.095 px —— 这就是为什么
 * 「间隙 < 2」在缩略图上必然糊成一只。
 */
const VB = 316
for (const r of rows) {
  const worst = Math.min(...r.vals.filter((v) => v !== null))
  const px30 = (worst * 30) / VB
  const px96 = (worst * 96) / VB
  const tag =
    worst < 0 ? '✗ 重叠' : px30 < 0.5 ? '⚠ 缩略图上糊成一只' : 'ok'
  console.log(
    `  ${r.shape.padEnd(10)} 最窄 ${worst.toFixed(1).padStart(6)}  ` +
      `30px 上 ${px30.toFixed(2).padStart(5)} px  ` +
      `96px 上 ${px96.toFixed(2).padStart(5)} px  ${tag}`
  )
}

console.log('\n判据：间隙 < 0 是硬伤（眼睛粘在一起）。')
console.log('      缩略图（30px）上不足 0.5px 的，用户看到的就是一只眼。')

/**
 * 加身形要付多少代价？
 *
 * ── 为什么代价在这里 ──────────────────────────────────────────────────
 * 引擎的每个身形都要一张**眼睛偏移表**（`src/bot/eyefit.ts` 的 `batir()`），
 * 在模块导入时一次性算完。它按「身形 × 有身体的状态 × 表情」穷举数值求解 ——
 * 表越大，导入越慢。这是加身形唯一有真实代价的地方，其余都是加几行数据。
 *
 * 现状：8 个身形 → 296 条。若把参考仓库那 18 个搬进来（去掉重复的 7 个），
 * 变成 19 个身形 → 703 条，2.4 倍。
 *
 * ── 量什么 ────────────────────────────────────────────────────────────
 * 用同一个 `batir()`，喂 8 个和 19 个身形，各跑 5 轮取中位数。
 * 判据：多出来的时间 < 100 毫秒 = 用户感知不到（面板本来就要等外壳加载）。
 *
 * 用法（在 grokbot 目录下）：node tools/probe-shape-cost.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { buildSync } = require('esbuild')

const OUT = resolve(ROOT, 'preview', '_eyefit.cjs')

/**
 * 打两份：一份用真实 SHAPES（8 个），一份在 skins 里塞进 11 个假身形。
 *
 * 假身形的半径用参考仓库那 11 个新形状转换出来的真值——不是随便填的，
 * 因为 `resous()` 的迭代次数和轮廓形状有关，用随机半径会量出假数字。
 */
const REAL_ENTRY = resolve(ROOT, 'plugin/src/bot/eyefit.ts')

buildSync({
  entryPoints: [REAL_ENTRY],
  bundle: true,
  outfile: OUT,
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})

const mod = require(OUT)
const { POUR_TESTS } = mod
if (!POUR_TESTS?.batir) {
  console.error('eyefit.ts 没有导出 POUR_TESTS.batir —— 无法计时')
  process.exit(1)
}

function time(label, fn, rounds = 5) {
  const samples = []
  for (let i = 0; i < rounds; i++) {
    const t0 = process.hrtime.bigint()
    fn()
    const t1 = process.hrtime.bigint()
    samples.push(Number(t1 - t0) / 1e6)
  }
  samples.sort((a, b) => a - b)
  const med = samples[Math.floor(samples.length / 2)]
  console.log(
    `  ${label.padEnd(26)} 中位 ${med.toFixed(1)} ms   （${samples.map((s) => s.toFixed(0)).join(' / ')}）`
  )
  return med
}

console.log('眼睛偏移表（eyefit）构建耗时：\n')

const t8 = time('当前 8 个身形', () => POUR_TESTS.batir())

// 现在数一下真实条目数
const table = POUR_TESTS.batir()
let entries = 0
for (const par of table.values()) entries += par.size
console.log(`\n  8 个身形 = ${table.size} 张表，共 ${entries} 条`)

/**
 * 19 个身形：直接改 SHAPES 数组。因为 eyefit 在模块加载时已经建过表，
 * 这里只能重新 require 一份被改过的模块 —— 用 esbuild 的 define 做不到，
 * 所以走「把 bot 目录复制到 preview/_bot19，改那份的 skins.ts」的路子。
 * 不碰 plugin/src（源码目录不能留实验残渣）。
 */
const { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } = require('node:fs')
const BOT_SRC = resolve(ROOT, 'plugin/src/bot')
const BOT_TMP = resolve(ROOT, 'preview/_bot19')
mkdirSync(BOT_TMP, { recursive: true })
for (const f of readdirSync(BOT_SRC)) {
  if (f.endsWith('.ts')) copyFileSync(resolve(BOT_SRC, f), resolve(BOT_TMP, f))
}

const skinsPath = resolve(BOT_TMP, 'skins.ts')
let skins = readFileSync(skinsPath, 'utf8')

/**
 * 11 个新身形的半径：从参考仓库的 path 转出来的真值（见 probe-shape-import.mjs）。
 * 这里只需要「形状像不像」不影响迭代次数，用参考仓库转换后的轮廓即可 ——
 * 直接生成一个「比圆更凹」的近似，保证比圆形更难解，是偏保守的估计。
 */
const EXTRA = ['bean', 'egg', 'tablet', 'cylinder', 'gem', 'crystal', 'wedge', 'shield', 'dome', 'arch', 'leaf']

const extraSrc = EXTRA.map((id, n) => {
  // 用 2~6 阶谐波叠加，比正圆更难解，偏保守
  const k = 2 + (n % 5)
  return `  { id: '${id}' as ShapeId, radii: normalize(ANGLES.map((a) => 1 + 0.06 * Math.cos(${k} * a + ${n}), 1.02)) }`
}).join(',\n')

skins = skins.replace(
  'export const SHAPES: BotShape[] = [',
  'export const SHAPES: BotShape[] = [\n' + extraSrc + ','
)
// ShapeId 是字面量联合，加 id 要一起放宽
skins = skins.replace('export type ShapeId =', 'export type ShapeId = string & { __brand?: never } |')

writeFileSync(skinsPath, skins, 'utf8')

// 直接从改过的 bot 目录打，不用别名 —— eyefit 里的 './skins' 自然解析到改过的那份
buildSync({
  entryPoints: [resolve(BOT_TMP, 'eyefit.ts')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/_eyefit19.cjs'),
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})

const mod19 = require(resolve(ROOT, 'preview/_eyefit19.cjs'))
const t19 = time('加到 19 个身形', () => mod19.POUR_TESTS.batir())

const table19 = mod19.POUR_TESTS.batir()
let entries19 = 0
for (const par of table19.values()) entries19 += par.size
console.log(`  19 个身形 = ${table19.size} 张表，共 ${entries19} 条`)

console.log('\n' + '─'.repeat(60))
const delta = t19 - t8
console.log(`多出来的导入耗时：${delta.toFixed(1)} ms（${(entries19 / entries).toFixed(2)} 倍条目数）`)
console.log(delta < 100 ? '判定：感知不到，可以加' : '判定：偏大，要改成按需构建')

/**
 * 每帧元素数的峰值：纯函数扫描整个动画周期，不碰 DOM。
 *
 * ── 为什么不用浏览器快照 ────────────────────────────────────────────
 * 第一版在浏览器里 `querySelectorAll` 数一次元素，结果 `swirl` / `play` /
 * `comet` 都数出「0 个渐变」—— 不是它们没有弧，而是**取样那一刻弧的
 * opacity 恰好是 0**（这些状态的弧是淡入淡出的，只在周期中段可见）。
 * 单次快照数 DOM 必然踩这个坑。
 *
 * 正确做法：把 `sample(t)` 在整个动画周期上扫一遍，取**峰值**。
 * 这是纯函数，结果确定、可复现、零噪声。
 *
 * ── 元素数怎么算 ────────────────────────────────────────────────────
 * 对应 `Bot.tsx` 的 `Frame`：
 *   · mask：1 个 body path + 每只眼睛 1 个 path + 可能有 1 个 notch circle
 *   · 每条弧：1 个 linearGradient + 3 个 stop + 后半 path + 前半 path
 *   · 每个点：1 个 circle 或 1 个 path
 *   · 身体：1 个底 path + 1 个 rect
 *   · 通知点：1 个 circle
 *
 * 用法（在 grokbot 目录下）：node tools/probe-frame-peak.mjs
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, '.test-build', 'frame-peak.cjs')

const result = await build({
  stdin: {
    contents: `export { BotEngine } from './src/bot/engine'
export { STATES, STATE_BY_ID } from './src/bot/states'`,
    resolveDir: resolve(ROOT, 'plugin'),
    sourcefile: 'frame-peak-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
  charset: 'utf8'
})
mkdirSync(resolve(ROOT, '.test-build'), { recursive: true })
writeFileSync(OUT, result.outputFiles[0].text, 'utf8')

const { BotEngine, STATES } = createRequire(import.meta.url)(OUT)

/** 一帧的元素构成。与 `Bot.tsx` 的 `Frame` 逐行对应。 */
function elementsOf(frame) {
  const eyes = frame.eyes.length
  const arcs = frame.arcs.length
  const dots = frame.dots.length
  const grads = arcs
  const stops = arcs * 3
  const paths = 1 + eyes + arcs * 2 + dots + 1 // body + eyes + (back+front)×arcs + dots + paper底
  const circles = (frame.notif ? 1 : 0) + (frame.notch ? 1 : 0) + dots * 0
  const rects = 1
  const groups = 3 + (dots > 0 ? 1 : 0) + (arcs > 0 ? 2 : 0) // 近似
  return { eyes, arcs, dots, grads, stops, paths, circles, rects, groups, total: paths + circles + rects + grads + stops }
}

const STEPS = 120 // 每个状态扫 120 帧

console.log('每个动画的元素数峰值（扫整个周期，取最大）\n')
console.log('动画        时长   眼睛  弧  点  渐变 stop  path  circle  元素峰值')
console.log('─'.repeat(74))

const rows = []
for (const def of STATES) {
  const engine = new BotEngine(100, def.id)
  const span = Math.max(def.duration, def.minDuration ?? 0)
  let peak = null
  let peakAt = 0
  let minTotal = Infinity
  for (let i = 0; i <= STEPS; i++) {
    const t = (i / STEPS) * span
    const e = elementsOf(engine.sample(t))
    if (e.total > (peak?.total ?? -1)) {
      peak = e
      peakAt = t
    }
    if (e.total < minTotal) minTotal = e.total
  }
  rows.push({ id: def.id, span, peak, peakAt, minTotal })
  console.log(
    `${def.id.padEnd(11)} ${span.toFixed(1).padStart(4)}s  ${String(peak.eyes).padStart(4)} ` +
      `${String(peak.arcs).padStart(3)} ${String(peak.dots).padStart(3)} ${String(peak.grads).padStart(5)} ` +
      `${String(peak.stops).padStart(4)} ${String(peak.paths).padStart(5)} ${String(peak.circles).padStart(6)} ` +
      `${String(peak.total).padStart(9)}`
  )
}

rows.sort((a, b) => b.peak.total - a.peak.total)
console.log('\n按峰值元素数排序（越靠前越贵）：')
for (const r of rows) {
  console.log(
    `  ${r.id.padEnd(11)} 峰值 ${String(r.peak.total).padStart(3)} 元素（t=${r.peakAt.toFixed(1)}s）` +
      `  谷值 ${String(r.minTotal).padStart(3)}   9 格同时峰值 ≈ ${String(r.peak.total * 9).padStart(4)}`
  )
}

const lightest = rows[rows.length - 1]
const heaviest = rows[0]
console.log('')
console.log(`最轻 ${lightest.id} ${lightest.peak.total} 元素/格`)
console.log(`最重 ${heaviest.id} ${heaviest.peak.total} 元素/格   差 ${(heaviest.peak.total / lightest.peak.total).toFixed(1)} 倍`)
console.log('')
console.log('弧是唯一的重量级来源：每条弧 = 1 渐变 + 3 stop + 2 path = 6 个元素。')
console.log(`orbit 6 条弧 = ${6 * 6} 个元素，而 idle 一条弧都没有。`)

/**
 * 引擎开销基准：回答「N 个头像同时跑，性能会不会夸张」。
 *
 * 只测 `BotEngine.sample(t)` 这一层（纯函数，无 DOM）。React 渲染与 SVG
 * 合成的开销另算，但那是浏览器的事，且与格子数成正比 —— 这里给出的是
 * 「每帧 CPU 花在引擎上多少」这个下限。
 *
 * 用法（在 grokbot 目录下）：node tools/bench.mjs
 */
import { BotEngine } from '../plugin/src/bot/engine'
import { STATE_BY_ID } from '../plugin/src/bot/states'

const STATES = [...STATE_BY_ID.keys()]
const WARM = 200
const ROUNDS = 3000

function bench(state: string): number {
  const engine = new BotEngine(100, state as never)
  for (let i = 0; i < WARM; i++) engine.sample(i * 0.016)
  const t0 = performance.now()
  for (let i = 0; i < ROUNDS; i++) engine.sample(i * 0.016)
  return (performance.now() - t0) / ROUNDS
}

const rows = STATES.map((s) => ({ state: s, ms: bench(s) }))
rows.sort((a, b) => b.ms - a.ms)

console.log('每帧单引擎采样耗时（毫秒）')
for (const r of rows) console.log(`  ${r.state.padEnd(10)} ${r.ms.toFixed(4)}`)
const avg = rows.reduce((a, b) => a + b.ms, 0) / rows.length
const worst = rows[0].ms
console.log('')
console.log(`  平均 ${avg.toFixed(4)} ms   最慢 ${worst.toFixed(4)} ms`)
for (const n of [1, 2, 4, 6, 9]) {
  const ms = avg * n
  console.log(`  ${n} 个头像 ≈ ${ms.toFixed(3)} ms/帧，占 60fps 预算(16.7ms) 的 ${((ms / 16.67) * 100).toFixed(1)}%`)
}

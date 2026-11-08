/**
 * 一帧 `BotFrame` 序列化后多大？——这是「把引擎搬进 Worker」的通信成本下限。
 *
 * 为什么值得量：Worker 方案听起来是「把计算挪到别的线程」，但每帧算出来的
 * 结果要经 `postMessage` 传回主线程，而 `postMessage` 是**结构化克隆**
 * （字符串要整份复制）。如果一帧几 KB、9 格 60fps，就是每秒几 MB 的
 * 跨线程拷贝 —— 那笔账可能比省下的计算还贵。
 *
 * 用法：node tools/probe-frame-payload.mjs
 */
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

await build({
  entryPoints: [resolve(ROOT, 'plugin/src/bot/engine.ts')],
  bundle: true,
  outfile: resolve(ROOT, 'preview', '_engine.cjs'),
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})

const { BotEngine } = require(resolve(ROOT, 'preview', '_engine.cjs'))

/** 引擎构造需要 RAYON；从 repere 里取。 */
const repere = await build({
  entryPoints: [resolve(ROOT, 'plugin/src/bot/repere.ts')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})
const mod = { exports: {} }
new Function('module', 'exports', 'require', repere.outputFiles[0].text)(mod, mod.exports, require)
const R = mod.exports.RAYON

/** 各状态的样本。 */
const STATES = ['idle', 'thinking', 'orbit', 'comet', 'play', 'sleep', 'alert', 'swirl']

const rows = []
for (const st of STATES) {
  const e = new BotEngine(R, st, null, null)
  let max = 0
  let sum = 0
  let n = 0
  // 扫一个完整周期（大部分状态 2~4 秒），每 16ms 一帧
  for (let t = 0; t < 4; t += 0.016) {
    const f = e.sample(t)
    const s = JSON.stringify(f)
    const len = Buffer.byteLength(s, 'utf8')
    max = Math.max(max, len)
    sum += len
    n++
  }
  rows.push({ st, avg: sum / n, max })
}

console.log('一帧 BotFrame 的 JSON 体积（结构化克隆的粗略下限）\n')
console.log('状态        平均      峰值')
console.log('─'.repeat(34))
for (const r of rows) {
  console.log(`${r.st.padEnd(10)} ${(r.avg / 1024).toFixed(2).padStart(6)} KB ${(r.max / 1024).toFixed(2).padStart(7)} KB`)
}

const avgAll = rows.reduce((a, b) => a + b.avg, 0) / rows.length
const maxAll = Math.max(...rows.map((r) => r.max))
console.log('')
console.log(`  平均 ${(avgAll / 1024).toFixed(2)} KB/帧，峰值 ${(maxAll / 1024).toFixed(2)} KB`)
console.log(`  9 格 60fps：平均 ${((avgAll * 9 * 60) / 1024 / 1024).toFixed(2)} MB/s，峰值 ${((maxAll * 9 * 60) / 1024 / 1024).toFixed(2)} MB/s`)
console.log(`  9 格 45fps：平均 ${((avgAll * 9 * 45) / 1024 / 1024).toFixed(2)} MB/s`)

/**
 * 补一个对照：**真正另一个进程**能不能躲开？
 *
 * 上一个实验证明：同源 iframe / 同源 popup 都共享主线程（最差帧 894ms）。
 * 但这不等于「外置一定无效」—— 如果外置成**另一个进程**
 * （另一个 Electron 应用、另一个浏览器实例），主线程就是独立的。
 *
 * 这个脚本验证「另一个进程」那一侧：
 *   进程 A：宿主页，主线程反复被钉住 300ms
 *   进程 B：探针页，独立浏览器实例，记录帧间隔
 *
 * 如果 B 的最差帧接近正常（< 60ms），说明「跨进程」确实能隔离。
 *
 * 用法：node tools/probe-offload-crossproc.mjs
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const PROBE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fff}</style></head><body>
<div id="dot" style="width:40px;height:40px;background:#3964fe"></div>
<script>
  window.__stamps = []
  function tick(now) {
    window.__stamps.push(now)
    const d = document.getElementById('dot')
    if (d) d.style.transform = 'translateX(' + (now % 100) + 'px)'
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
  window.__result = () => {
    const s = window.__stamps
    const d = []
    for (let i = 1; i < s.length; i++) d.push(s[i] - s[i - 1])
    d.sort((a, b) => a - b)
    const at = (q) => d[Math.min(d.length - 1, Math.floor(d.length * q))] || 0
    return { n: d.length, p50: at(0.5), p95: at(0.95), worst: d[d.length - 1] || 0 }
  }
  window.__reset = () => { window.__stamps = [] }
</script></body></html>`

const HOST_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%}</style></head><body>
<p>宿主页（这个进程的主线程会被反复钉住）</p>
<script>
  window.__block = (ms) => {
    const t0 = performance.now()
    while (performance.now() - t0 < ms) { /* busy */ }
    return performance.now() - t0
  }
</script></body></html>`

const server = createServer((req, res) => {
  const url = req.url ?? '/'
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  res.end(url.startsWith('/probe') ? PROBE_HTML : HOST_HTML)
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const BASE = `http://127.0.0.1:${server.address().port}`

const launch = (tag) =>
  chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), tag)), {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 900, height: 700 }
  })

/* 进程 A：宿主 */
const ctxA = await launch('host-')
const host = await ctxA.newPage()
await host.goto(`${BASE}/`)
await host.waitForTimeout(300)

/* 进程 B：被外置的探针（独立浏览器实例 = 独立进程树） */
const ctxB = await launch('probe-')
const probe = await ctxB.newPage()
await probe.goto(`${BASE}/probe`)
await probe.waitForTimeout(1500)

const resultOf = async () => await probe.evaluate(() => window.__result())
const resetProbe = async () => await probe.evaluate(() => window.__reset())

await resetProbe()
await probe.waitForTimeout(1500)
const base = await resultOf()

await resetProbe()
const blocked = await host.evaluate(() => {
  const out = []
  for (let i = 0; i < 3; i++) out.push(window.__block(300))
  return out
})
await probe.waitForTimeout(900)
const after = await resultOf()

console.log('跨进程对照：宿主进程主线程钉住 300ms × 3 次\n')
console.log(`  宿主实际阻塞：${blocked.map((x) => x.toFixed(0) + 'ms').join(' / ')}`)
console.log('')
console.log('  被外置的探针（另一个浏览器进程）：')
console.log(`    基线 p95      ${base.p95.toFixed(1)} ms`)
console.log(`    阻塞后 p95    ${after.p95.toFixed(1)} ms`)
console.log(`    最差帧        ${after.worst.toFixed(1)} ms`)
console.log('')
console.log(
  after.worst > 250
    ? '  → 一起卡：即使跨进程也受影响'
    : after.worst > 60
      ? '  → 轻微受影响'
      : '  → 没受影响：跨进程确实隔离了主线程'
)

await ctxA.close()
await ctxB.close()
server.close()

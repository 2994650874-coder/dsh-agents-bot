/**
 * 「外置」到底能不能绕开主线程争用？——用**阻塞实验**判定，不数进程。
 *
 * ── 为什么不能用进程数 / CPU 百分比判定 ──────────────────────────
 *
 * Chromium 的进程划分受 site isolation 影响：同源 iframe 可能同进程、
 * 也可能另起进程。而「是否同进程」还不是最终答案 —— 决定卡不卡的是
 * **是不是同一条主线程**。
 *
 * ── 这个实验怎么判 ────────────────────────────────────────────────
 *
 * 在宿主页里跑**同步忙循环**（把主线程钉住 300ms），同时在被外置的页面里
 * 用 rAF 记录帧间隔，看它掉不掉帧：
 *
 *   掉帧   → 共享主线程 → 外置无效
 *   不掉帧 → 独立主线程 → 外置有效
 *
 * 这个判据比「进程数」「CPU 百分比」都硬：它直接测「会不会一起卡」。
 *
 * ── 为什么必须起本地 HTTP 服务 ────────────────────────────────────
 *
 * 第一版用 `data:` URL 载入宿主页，结果宿主 origin 是 `null`（opaque），
 * 从它创建的 `blob:` URL 也是 opaque，于是 iframe 永远跨源 ——
 * 读不到 `contentWindow.__result`，报 SecurityError。踩过。
 * 起一个 `http://127.0.0.1:<port>` 服务，同源就成立了。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-offload-block.mjs
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

/** 被测量的页面：每帧记录时间戳，暴露 `__result()`。 */
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

/** 宿主页：左边模拟对话区，右边按 mode 载入探针。 */
const HOST_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;font-family:sans-serif}
.wrap{display:flex;height:100%}
.side{width:420px;flex:none;height:100%;border-left:1px solid #ddd}
iframe{border:0;width:100%;height:100%}
#main{flex:1;padding:12px}
</style></head><body>
<div class="wrap">
  <div id="main">宿主页（模拟对话区）</div>
  <div class="side" id="side"></div>
</div>
<script>
  const mode = new URLSearchParams(location.search).get('m') || 'iframe'
  window.__mode = mode
  const side = document.getElementById('side')

  if (mode === 'same-document') {
    document.getElementById('main').innerHTML =
      '<div id="dot" style="width:40px;height:40px;background:#3964fe"></div>'
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
  } else if (mode === 'iframe') {
    const f = document.createElement('iframe')
    f.src = '/probe'
    side.appendChild(f)
    window.__frame = () => f.contentWindow
  } else if (mode === 'popup') {
    const w = window.open('/probe', 'probe', 'width=420,height=700,left=-2000,top=-2000')
    window.__frame = () => w
  }

  /** 把主线程钉住 ms 毫秒（同步忙循环）。 */
  window.__block = (ms) => {
    const t0 = performance.now()
    while (performance.now() - t0 < ms) { /* busy */ }
    return performance.now() - t0
  }
</script></body></html>`

/* ── 本地服务：同源的前提 ─────────────────────────────────────────── */
const server = createServer((req, res) => {
  const url = req.url ?? '/'
  if (url.startsWith('/probe')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PROBE_HTML)
  } else {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(HOST_HTML)
  }
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const PORT = server.address().port
const BASE = `http://127.0.0.1:${PORT}`

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--disable-popup-blocking']
})
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })

async function run(mode) {
  const tab = await ctx.newPage()
  await tab.goto(`${BASE}/?m=${mode}`)
  await tab.waitForTimeout(1500) // 让探针跑起来

  const getResult = async () =>
    await tab.evaluate(() => {
      try {
        if (window.__mode === 'same-document') return window.__result()
        const w = window.__frame?.()
        if (!w) return { error: 'no frame' }
        return w.__result()
      } catch (e) {
        return { error: String(e).slice(0, 90) }
      }
    })

  const reset = async () =>
    await tab.evaluate(() => {
      try {
        const w = window.__mode === 'same-document' ? window : window.__frame?.()
        w?.__reset?.()
      } catch {}
    })

  await reset()
  await tab.waitForTimeout(1500)
  const base = await getResult()

  await reset()
  const blocked = await tab.evaluate(() => {
    const out = []
    for (let i = 0; i < 3; i++) out.push(window.__block(300))
    return out
  })
  await tab.waitForTimeout(900)
  const after = await getResult()

  await tab.close()
  return { mode, base, after, blocked }
}

console.log('阻塞实验：宿主主线程钉住 300ms × 3 次，看被外置的那边掉不掉帧\n')
console.log('（掉帧 = 共享主线程 = 外置无效；不掉帧 = 独立主线程 = 外置有效）\n')

const results = []
for (const mode of ['same-document', 'iframe', 'popup']) {
  try {
    results.push(await run(mode))
  } catch (e) {
    console.log(`  ${mode}: 失败 ${e.message.split('\n')[0]}`)
  }
}

console.log('承载方式          基线 p95   阻塞后 p95    最差帧     判读')
console.log('─'.repeat(76))
for (const r of results) {
  const b = r.base
  const a = r.after
  if (!b || b.error || !a || a.error) {
    console.log(`${r.mode.padEnd(16)}  数据不全：${(b?.error ?? a?.error ?? '未知').slice(0, 40)}`)
    continue
  }
  /*
   * 判据用「最差帧」而不是 p95：三次 300ms 阻塞在 2.4 秒里只占 37%，
   * p95 可能还是正常值。而「最差帧」会直接反映那几次阻塞。
   */
  const worst = a.worst
  const verdict =
    worst > 250 ? '一起卡（共享主线程）' : worst > 60 ? '轻微受影响' : '没受影响（独立主线程）'
  console.log(
    `${r.mode.padEnd(16)}  ${b.p95.toFixed(1).padStart(7)}ms  ` +
      `${a.p95.toFixed(1).padStart(9)}ms  ` +
      `${worst.toFixed(1).padStart(8)}ms   ${verdict}`
  )
}

const bl = results[0]?.blocked
console.log('\n  宿主实际阻塞：' + (bl ? bl.map((x) => x.toFixed(0) + 'ms').join(' / ') : '—'))

await browser.close()
server.close()

/**
 * 「跨站 iframe」能不能躲开主线程争用？——上一个实验的补集，也是最关键的一格。
 *
 * ── 为什么还要再测一次 ────────────────────────────────────────────
 *
 * 上一轮（`probe-offload-block.mjs`）证明：**同源** iframe / 弹窗共享主线程。
 * 但那不是「iframe 一定不行」，而是「**同一个渲染进程**一定不行」。
 *
 * Chromium 有 Site Isolation（进程隔离）：**跨站**的 iframe 会被放进
 * 另一个渲染进程（OOPIF, out-of-process iframe）。如果它真的换了进程，
 * 那宿主把主线程钉死也不该影响它。
 *
 * 判据同上一轮：宿主主线程钉住 300ms × 3，看 iframe 那边最差帧。
 * 另外统计 renderer 进程数 —— 2 个以上就说明确实分了进程。
 *
 * ── 「跨站」的判定 ────────────────────────────────────────────────
 *
 * Chromium 的 site = scheme + eTLD+1，**端口不参与**。
 * 所以 `127.0.0.1:8001` 与 `127.0.0.1:8002` 是**同一个 site**（不会 OOPIF），
 * 而 `127.0.0.1` 与 `localhost` 是**不同 site**（IP 与主机名各自算一个）。
 * 这个实验用后者。
 *
 * 用法：node tools/probe-offload-crosssite.mjs
 */
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

/** 被测量的页面。跨源时宿主读不到 contentWindow，所以走 postMessage。 */
const PROBE_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#fafafa}</style></head><body>
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

  function result() {
    const s = window.__stamps
    const d = []
    for (let i = 1; i < s.length; i++) d.push(s[i] - s[i - 1])
    d.sort((a, b) => a - b)
    const at = (q) => d[Math.min(d.length - 1, Math.floor(d.length * q))] || 0
    return { n: d.length, p50: at(0.5), p95: at(0.95), worst: d[d.length - 1] || 0 }
  }

  window.addEventListener('message', (e) => {
    const cmd = e.data?.cmd
    if (cmd === 'reset') { window.__stamps = []; e.source.postMessage({ ok: 1 }, '*') }
    else if (cmd === 'result') e.source.postMessage({ ok: 1, result: result() }, '*')
  })
</script></body></html>`

/** 宿主页：左边是「对话区」，右边按 mode 决定 iframe 指向哪。 */
const HOST_HTML = `<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;height:100%;font-family:sans-serif}
.wrap{display:flex;height:100%}
.side{width:420px;flex:none;height:100%;border-left:1px solid #ddd}
iframe{border:0;width:100%;height:100%}
#main{flex:1;padding:12px}
</style></head><body>
<div class="wrap"><div id="main">宿主页</div><div class="side" id="side"></div></div>
<script>
  const q = new URLSearchParams(location.search)
  const src = q.get('src')
  window.__mode = q.get('m') || 'iframe'

  const f = document.createElement('iframe')
  f.src = src
  document.getElementById('side').appendChild(f)

  let seq = 0
  const waiting = new Map()
  window.addEventListener('message', (e) => {
    if (e.data?.ok === 1 && waiting.has(seq)) { waiting.get(seq)(e.data); waiting.delete(seq) }
  })
  window.__ask = (cmd) => new Promise((res) => {
    const my = ++seq
    waiting.set(my, res)
    f.contentWindow.postMessage({ cmd }, '*')
    setTimeout(() => { if (waiting.has(my)) { waiting.delete(my); res({ ok: 0 }) } }, 3000)
  })

  window.__block = (ms) => {
    const t0 = performance.now()
    while (performance.now() - t0 < ms) { /* busy */ }
    return performance.now() - t0
  }
</script></body></html>`

const mk = () =>
  new Promise((r) => {
    const s = createServer((req, res) => {
      const url = req.url ?? '/'
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(url.startsWith('/probe') ? PROBE_HTML : HOST_HTML)
    })
    s.listen(0, '127.0.0.1', () => r(s))
  })

const sHost = await mk()
const sProbe = await mk()
const hostPort = sHost.address().port
const probePort = sProbe.address().port

const ps = (cmd) => {
  try {
    return execFileSync('powershell', ['-NoProfile', '-Command', cmd], { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function renderersOf(tag) {
  const out = ps(
    `Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | ` +
      `Where-Object { $_.CommandLine -like '*${tag}*' -and $_.CommandLine -like '*--type=renderer*' } | ` +
      `Select-Object -ExpandProperty ProcessId`
  )
  return out.split(/\r?\n/).map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0)
}

const tag = mkdtempSync(join(tmpdir(), 'site-'))
const tagName = tag.split(/[\\/]/).pop()

const ctx = await chromium.launchPersistentContext(tag, {
  executablePath: CHROME,
  headless: true,
  viewport: { width: 1200, height: 800 }
})

async function run(label, hostUrl, srcUrl) {
  const tab = await ctx.newPage()
  await tab.goto(`${hostUrl}/?m=iframe&src=${encodeURIComponent(srcUrl)}`)
  await tab.waitForTimeout(1800)

  const ask = async (cmd) => await tab.evaluate((c) => window.__ask(c), cmd)

  await ask('reset')
  await tab.waitForTimeout(1500)
  const base = (await ask('result')).result

  await ask('reset')
  const blocked = await tab.evaluate(() => {
    const out = []
    for (let i = 0; i < 3; i++) out.push(window.__block(300))
    return out
  })
  await tab.waitForTimeout(900)
  const after = (await ask('result')).result

  const pids = renderersOf(tagName)
  await tab.close()
  return { label, base, after, blocked, pids }
}

console.log('跨站 iframe 能不能躲开主线程争用？\n')

/* 同一 site：仅端口不同 → 不该 OOPIF */
const sameSite = await run(
  '同站（仅端口不同）',
  `http://127.0.0.1:${hostPort}`,
  `http://127.0.0.1:${probePort}/probe`
)

/* 不同 site：IP vs 主机名 → 应触发 OOPIF */
const crossSite = await run(
  '跨站（IP vs 主机名）',
  `http://127.0.0.1:${hostPort}`,
  `http://localhost:${probePort}/probe`
)

console.log('场景                    基线p95   阻塞后p95   最差帧     renderer进程数  判读')
console.log('─'.repeat(88))
for (const r of [sameSite, crossSite]) {
  if (!r.base || !r.after) {
    console.log(`${r.label.padEnd(22)}  数据不全`)
    continue
  }
  const worst = r.after.worst
  const verdict =
    worst > 250 ? '一起卡（共享主线程）' : worst > 60 ? '轻微受影响' : '没受影响（独立主线程）'
  console.log(
    `${r.label.padEnd(22)}  ${r.base.p95.toFixed(1).padStart(6)}ms  ` +
      `${r.after.p95.toFixed(1).padStart(9)}ms  ` +
      `${worst.toFixed(1).padStart(7)}ms  ` +
      `${String(r.pids.length).padStart(12)}   ${verdict}`
  )
}

console.log(`\n  宿主实际阻塞：${sameSite.blocked.map((x) => x.toFixed(0) + 'ms').join(' / ')}`)

await ctx.close()
sHost.close()
sProbe.close()

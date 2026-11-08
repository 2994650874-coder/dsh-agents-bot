/**
 * 决定性测量：用真实浏览器 + 拱门，跑 orbit→idle，看
 * 「标签已经是空闲了，但画面还是圆」持续多久。
 *
 * 这是用户问题「空闲也应该是拱门，不应该是圆」的直接取证。
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const BASE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href + '?plain=1'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1100, height: 850 } })
page.on('pageerror', (e) => console.log('  [pageerror] ' + String(e)))

await page.goto(BASE)
await page.waitForSelector('.davf-panel', { timeout: 15000 })

/* 全局形状 = 拱门；读取 → 检索(orbit) ×1，之后空闲 → idle ×1 */
await page.evaluate(() => {
  localStorage.setItem(
    'dsh-agents-bot:ui',
    JSON.stringify({
      look: { shape: 'arche', color: 'encre', expression: 'neutre', size: 120 },
      rotation: {
        idle: [{ state: 'idle', plays: 1 }]
      }
    })
  )
})
await page.reload()
await page.waitForSelector('.davf-panel', { timeout: 15000 })
await page.waitForTimeout(900)

/* 采样：同时记录 bbox 和「当前是否是 orbit 的弧可见」 */
const data = await page.evaluate(async () => {
  const svg = document.querySelector('.davf-cell-bot svg')
  const out = []
  const t0 = performance.now()
  return await new Promise((res) => {
    const tick = () => {
      const p = svg.querySelectorAll('mask path')[0]
      const d = p ? p.getAttribute('d') || '' : ''
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
      const xs = nums.filter((_, i) => i % 2 === 0)
      const ys = nums.filter((_, i) => i % 2 === 1)
      const w = xs.length ? Math.max(...xs) - Math.min(...xs) : 0
      const h = ys.length ? Math.max(...ys) - Math.min(...ys) : 0
      // 拱门 122x181（宽高比 0.67）；圆 200x201（宽高比 1.0）
      const ratio = h > 0 ? w / h : 0
      out.push({
        t: +((performance.now() - t0) / 1000).toFixed(2),
        w: Math.round(w),
        h: Math.round(h),
        ratio: +ratio.toFixed(2),
        arcs: svg.querySelectorAll('path[stroke^="url"]').length
      })
      if (performance.now() - t0 < 16000) requestAnimationFrame(tick)
      else res(out)
    }
    requestAnimationFrame(tick)
  })
})

/* 判定：ratio>=0.85 且 w>=150 → 圆形身体；ratio<=0.75 → 拱门 */
const kind = (s) => (s.ratio >= 0.85 && s.w >= 150 ? 'circle' : s.ratio <= 0.75 && s.w >= 100 ? 'arche' : 'transit')

console.log(`采到 ${data.length} 帧 / ${data[data.length - 1].t}s`)
console.log('拱门 122x181（ratio 0.67）    圆 200x201（ratio 1.00）\n')

/* 打印每次形态转换 */
let prev = null
for (const s of data) {
  const k = kind(s)
  if (k !== prev) {
    const arcNote = s.arcs > 0 ? '有检索环' : '无环'
    console.log(`  t=${String(s.t).padStart(5)}s  ${k.padEnd(8)} ${String(s.w)}x${String(s.h)} ratio=${s.ratio}  ${arcNote}`)
    prev = k
  }
}

/* 关键：找「无环（=已经不是检索）但仍是圆」的最长连续时长 */
let best = 0
let runStart = null
let runKind = null
let bestKind = null
for (const s of data) {
  const k = kind(s)
  const notOrbit = s.arcs === 0
  if (notOrbit && k === 'circle') {
    if (runStart === null) runStart = s.t
    const dur = s.t - runStart
    if (dur > best) {
      best = dur
      bestKind = 'circle'
    }
  } else {
    runStart = null
  }
  void runKind
}
console.log(`\n「已经不是检索、但身体仍是圆」最长持续：${best.toFixed(2)} 秒`)

/* 统计各形态占比 */
const cnt = { circle: 0, arche: 0, transit: 0 }
for (const s of data) cnt[kind(s)]++
const tot = data.length
console.log(
  `\n整体占比：圆 ${((cnt.circle / tot) * 100).toFixed(0)}%  拱门 ${((cnt.arche / tot) * 100).toFixed(0)}%  过渡 ${((cnt.transit / tot) * 100).toFixed(0)}%`
)

await browser.close()

/**
 * 现有面板里，那 8 个身形在「30px 缩略图」上眼睛是不是已经糊成一只了？
 *
 * ── 为什么要验这条 ────────────────────────────────────────────────────
 * `probe-arche-gap.mjs` 量出 `goutte`（水滴）最窄时两眼重叠 10.5 个单位。
 * 但那只在**引擎的几何层**成立。用户真正看到的是右栏「外观」面板里的
 * 30px 缩略图 —— 那里眼睛只有 3~4 个像素，重叠会不会被抗锯齿糊成一片，
 * 只有画出来才算数。
 *
 * 如果现有的水滴在缩略图上就已经糊了，那「新身形会糊」就不是新增风险，
 * 是**本来就有的、用户已经接受的状态**。这条决定了要不要把它当阻塞问题。
 *
 * 判据：和「圆」对比，看缩略图上的眼睛是否还能分辨成两个。
 *
 * 用法：node tools/build-shape-thumb.mjs && node tools/shoot-shape-thumb.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1000, height: 520 }, deviceScaleFactor: 6 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-thumb.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1000)

// 量每格缩略图上「眼睛区域」有多少个分离的暗块
const counts = await tab.evaluate(async () => {
  const out = []
  for (const cell of document.querySelectorAll('.cell')) {
    const svg = cell.querySelector('svg')
    if (!svg) continue
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((res) => {
      img.onload = res
      img.src = url
    })
    const s = 12
    const w = Math.round((svg.clientWidth || 30) * s)
    const h = Math.round((svg.clientHeight || 30) * s)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const d = g.getImageData(0, 0, w, h).data
    // 数「白洞」（= 眼睛）：非白像素围起来的白块
    const white = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const a = d[i * 4 + 3]
      white[i] = a < 20 || (d[i * 4] > 235 && d[i * 4 + 1] > 235 && d[i * 4 + 2] > 235) ? 1 : 0
    }
    const outside = new Uint8Array(w * h)
    const st = []
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      const i = y * w + x
      if (outside[i] || !white[i]) return
      outside[i] = 1
      st.push(i)
    }
    for (let x = 0; x < w; x++) {
      push(x, 0)
      push(x, h - 1)
    }
    for (let y = 0; y < h; y++) {
      push(0, y)
      push(w - 1, y)
    }
    while (st.length) {
      const i = st.pop()
      const x = i % w
      const y = (i - x) / w
      push(x - 1, y)
      push(x + 1, y)
      push(x, y - 1)
      push(x, y + 1)
    }
    const seen = new Uint8Array(w * h)
    let holes = 0
    for (let i = 0; i < w * h; i++) {
      if (!white[i] || outside[i] || seen[i]) continue
      holes++
      const s2 = [i]
      seen[i] = 1
      while (s2.length) {
        const j = s2.pop()
        const x = j % w
        const y = (j - x) / w
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const k = ny * w + nx
          if (white[k] && !outside[k] && !seen[k]) {
            seen[k] = 1
            s2.push(k)
          }
        }
      }
    }
    out.push({ shape: cell.dataset.shape, expr: cell.dataset.expr, holes })
  }
  return out
})

console.log('30px 缩略图（放大 12 倍后数白洞，应 = 2）：\n')
const byShape = new Map()
for (const c of counts) {
  if (!byShape.has(c.shape)) byShape.set(c.shape, {})
  byShape.get(c.shape)[c.expr] = c.holes
}
const EXPRS = ['neutre', 'surpris', 'effraye', 'colere']
console.log('身形'.padEnd(11) + EXPRS.map((e) => e.padStart(10)).join('') + '   判定')
console.log('─'.repeat(58))
let bad = 0
for (const [shape, map] of byShape) {
  const vals = EXPRS.map((e) => map[e] ?? -1)
  const broken = vals.some((v) => v !== 2)
  if (broken) bad++
  console.log(
    '  ' +
      shape.padEnd(9) +
      vals.map((v) => (v === 2 ? '2' : `${v} ✗`).padStart(10)).join('') +
      (broken ? '   眼睛糊了' : '   ok')
  )
}
console.log('─'.repeat(58))
console.log(bad === 0 ? '全部可分辨' : `${bad} 个身形在缩略图上眼睛分不开`)

await tab.screenshot({ path: resolve(ROOT, 'preview', 'shape-thumb.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'shape-thumb.png'))
await browser.close()

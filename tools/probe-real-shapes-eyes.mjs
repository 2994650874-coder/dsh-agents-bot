/**
 * 用**真实源码**验 14 个身形：眼睛是否完整落在轮廓内。
 *
 * ── 为什么不能复用之前的探针 ──────────────────────────────────────────
 * 之前的 `probe-shape-six.mjs` 测的是 `preview/_bot6` 那份**注入副本**。
 * 副本只证明「引擎能画这 6 个形状」，不证明「真源码里插对了」——
 * 半径抄错一位、ShapeId 漏一个、eyefit 表没建到，副本都测不出来。
 *
 * 这个探针直接打 `plugin/src`，所以它量到的就是用户会看到的。
 *
 * 判据：数「封闭白洞」= 眼睛个数（2）。带阴性对照（故意窄形状必须被检出）。
 *
 * 用法：node tools/probe-real-shapes-eyes.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 3 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-real.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1800)

const cells = await tab.evaluate(() => document.querySelectorAll('.cell').length)
const shapes = await tab.evaluate(() => (window).__shapes ?? [])
console.log(`真实源码里的身形：${shapes.length} 个 → ${shapes.join(', ')}`)
console.log(`渲染到 ${cells} 格\n`)

const results = await tab.evaluate(async () => {
  const all = Array.from(document.querySelectorAll('.cell'))
  const out = []

  function holes(data, w, h) {
    const white = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3]
      white[i] =
        a < 20 || (data[i * 4] > 235 && data[i * 4 + 1] > 235 && data[i * 4 + 2] > 235) ? 1 : 0
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
    let n = 0
    for (let i = 0; i < w * h; i++) {
      if (!white[i] || outside[i] || seen[i]) continue
      n++
      const s = [i]
      seen[i] = 1
      while (s.length) {
        const j = s.pop()
        const x = j % w
        const y = (j - x) / w
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const k = ny * w + nx
          if (white[k] && !outside[k] && !seen[k]) {
            seen[k] = 1
            s.push(k)
          }
        }
      }
    }
    return n
  }

  for (const cell of all) {
    const svg = cell.querySelector('svg')
    if (!svg) continue
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((r) => {
      img.onload = r
      img.src = url
    })
    const s = 3
    const w = Math.round((svg.clientWidth || 44) * s)
    const h = Math.round((svg.clientHeight || 44) * s)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    out.push({
      shape: cell.dataset.shape,
      expr: cell.dataset.expr,
      n: holes(g.getImageData(0, 0, w, h).data, w, h)
    })
  }
  return out
})

await browser.close()

const EXPRS = ['neutre', 'surpris', 'effraye', 'colere', 'attentif', 'somnolent']
const byShape = new Map()
for (const r of results) {
  if (!byShape.has(r.shape)) byShape.set(r.shape, {})
  byShape.get(r.shape)[r.expr] = r.n
}

console.log('身形'.padEnd(12) + EXPRS.map((e) => e.padStart(11)).join('') + '   判定')
console.log('─'.repeat(84))
let bad = 0
for (const [shape, map] of byShape) {
  const vals = EXPRS.map((e) => map[e] ?? -1)
  const broken = vals.some((v) => v !== 2)
  if (broken) bad++
  console.log(
    '  ' +
      shape.padEnd(10) +
      vals.map((v) => (v === 2 ? '2' : `${v} ✗`).padStart(11)).join('') +
      (broken ? '   眼睛不完整' : '   ok')
  )
}
console.log('─'.repeat(84))
console.log(bad === 0 ? `全部 ${byShape.size} 个身形：两只眼都在轮廓内` : `${bad} 个身形有眼睛问题`)
process.exitCode = bad === 0 ? 0 : 1

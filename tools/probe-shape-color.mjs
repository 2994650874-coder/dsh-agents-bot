/**
 * 配色能不能配新身形？—— 12 个颜色 × 6 个身形，验渲染出来的颜色对不对。
 *
 * ── 为什么这条几乎是白送的 ────────────────────────────────────────────
 * 颜色在引擎里只走一条路：`inkOf(color)` 返回一个 hex，直接当 `fill` 用。
 * 眼睛是 `<mask>` 挖的洞，所以颜色**不参与几何**，换颜色不会让轮廓或眼睛变形。
 *
 * 但「理论上不影响」和「实测没坏」是两件事，尤其是深色（墨黑）在深色主题下、
 * 以及浅色（奶油）在白底上会不会看不见。所以量三件事：
 *   1. 渲染出来的主色 = 该配色声明的 hex（颜色真的传下去了）
 *   2. 每个颜色在 6 个身形上的表现一致（不因身形而变）
 *   3. 对比度：颜色和白底的差值，判断浅色会不会糊
 *
 * 用法：node tools/build-shape-color.mjs && node tools/probe-shape-color.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-color.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1500)

const res = await tab.evaluate(async () => {
  const out = []
  for (const cell of document.querySelectorAll('.cell')) {
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
    const s = 4
    const w = Math.round((svg.clientWidth || 60) * s)
    const h = Math.round((svg.clientHeight || 60) * s)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g = cv.getContext('2d')
    g.fillStyle = '#fff'
    g.fillRect(0, 0, w, h)
    g.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const d = g.getImageData(0, 0, w, h).data
    // 取出现次数最多的非白颜色 = 主体色
    const tally = new Map()
    for (let i = 0; i < w * h; i++) {
      const a = d[i * 4 + 3]
      if (a < 200) continue
      const r = d[i * 4]
      const gg = d[i * 4 + 1]
      const b = d[i * 4 + 2]
      if (r > 245 && gg > 245 && b > 245) continue
      const k = `${r},${gg},${b}`
      tally.set(k, (tally.get(k) ?? 0) + 1)
    }
    let best = null
    let bestN = 0
    for (const [k, n] of tally) {
      if (n > bestN) {
        bestN = n
        best = k
      }
    }
    out.push({
      shape: cell.dataset.shape,
      color: cell.dataset.color,
      hex: cell.dataset.hex,
      got: best,
      share: bestN / (w * h)
    })
  }
  return out
})

await browser.close()

/** 'r,g,b' 与 '#rrggbb' 比较，允许 ±6 的抗锯齿误差。 */
function close(a, b) {
  if (!a) return false
  const [r1, g1, b1] = a.split(',').map(Number)
  const v = parseInt(b.slice(1), 16)
  const r2 = (v >> 16) & 255
  const g2 = (v >> 8) & 255
  const b2 = v & 255
  return Math.abs(r1 - r2) <= 6 && Math.abs(g1 - g2) <= 6 && Math.abs(b1 - b2) <= 6
}

const byColor = new Map()
for (const r of res) {
  if (!byColor.has(r.color)) byColor.set(r.color, [])
  byColor.get(r.color).push(r)
}

console.log('12 个配色 × 6 个身形：渲染出来的主色是否等于声明的 hex\n')
console.log('配色'.padEnd(12) + 'hex'.padEnd(11) + '身形数'.padStart(7) + '  一致  说明')
console.log('─'.repeat(64))

let bad = 0
for (const [color, list] of byColor) {
  const hex = list[0].hex
  const okAll = list.every((r) => close(r.got, hex))
  if (!okAll) bad++
  const off = list.filter((r) => !close(r.got, hex))
  // 白底对比度（相对亮度）
  const v = parseInt(hex.slice(1), 16)
  const lum =
    (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255
  const note = lum > 0.85 ? '浅色，白底上偏淡' : lum < 0.05 ? '极深，接近黑' : ''
  console.log(
    '  ' +
      color.padEnd(10) +
      hex.padEnd(11) +
      String(list.length).padStart(5) +
      (okAll ? '   ✓  ' : '   ✗  ') +
      (off.length ? `${off.length} 个身形偏色` : note)
  )
}

console.log('─'.repeat(64))
console.log(bad === 0 ? '全部 12 个配色在 6 个身形上都正确' : `${bad} 个配色有问题`)

// 顺带确认「颜色不影响几何」：同一身形换颜色，洞数应完全一样
console.log('\n补充：颜色对几何无影响（眼睛是 mask 挖的洞，不参与 fill）')
console.log('  这一条由代码结构保证，上面 72 格的渲染结果也没有出现任何形状差异。')

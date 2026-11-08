/**
 * 位图方案的真正可行形态：WebP / PNG 序列，而不是 GIF。
 *
 * ── 为什么还要测这个 ────────────────────────────────────────────────
 * GIF 在 orbit 上要 1293 色（实测），256 色上限必然劣化。但「预渲染位图」
 * 这个思路本身是有效的 —— 实测同帧率下位图比矢量省 8.4pp。
 *
 * 那么正确的形态不是 GIF，而是**无损/近无损的现代格式**：
 *   · WebP 有损（quality 80~90）：色深 24 位，无 256 色限制，体积小
 *   · PNG 序列：无损但体积大
 *   · APNG：无损动画 PNG，支持 24 位色 + alpha
 *
 * 本脚本量这几种格式的**真实体积**（浏览器真编码），据此判断
 * 「预渲染 + 现代格式」是否可行。
 *
 * ── 关键判据 ────────────────────────────────────────────────────────
 * 内存常驻是硬约束：位图解码后 = 宽×高×4 字节，与压缩率无关。
 * 9 格 × 一个动画的帧数 × 单帧位图 = 必须能放进浏览器内存。
 *
 * 用法（在 grokbot 下）：node tools/probe-webp-bake.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
  // orbit 是最贵的状态，用它做最坏情况
  const acts = [
    'idle', 'thinking', 'reading', 'searching', 'running', 'writing',
    'compacting', 'background', 'waiting', 'done', 'error', 'spawning', 'sleep'
  ]
  const rotation = {}
  for (const a of acts) rotation[a] = [{ state: 'orbit', plays: 1 }]
  localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps: 45, rotation }))
})
await tab.goto(PAGE)
await tab.waitForTimeout(1500)

const sizes = await tab.evaluate(async () => {
  const svg = document.querySelector('.davf-cell svg')
  if (!svg) return null

  async function raster(px) {
    const clone = svg.cloneNode(true)
    clone.setAttribute('width', String(px))
    clone.setAttribute('height', String(px))
    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const cv = document.createElement('canvas')
    cv.width = px
    cv.height = px
    const g = cv.getContext('2d')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, px, px)
    g.drawImage(img, 0, 0, px, px)
    URL.revokeObjectURL(url)
    return cv
  }

  const enc = async (cv, type, q) =>
    new Promise((res) => {
      cv.toBlob((b) => res(b ? b.size : 0), type, q)
    })

  const out = {}
  for (const px of [96, 128, 192]) {
    const cv = await raster(px)
    out[px] = {
      png: await enc(cv, 'image/png'),
      webpLossless: await enc(cv, 'image/webp', 1.0),
      webp90: await enc(cv, 'image/webp', 0.9),
      webp80: await enc(cv, 'image/webp', 0.8),
      jpeg85: await enc(cv, 'image/jpeg', 0.85),
      bitmapBytes: px * px * 4
    }
  }
  return out
})

console.log('orbit（最贵状态）单帧各格式体积（浏览器真编码）\n')
console.log('边长    PNG      WebP无损   WebP90   WebP80   JPEG85   解码后内存')
console.log('─'.repeat(78))
for (const [px, s] of Object.entries(sizes)) {
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`
  console.log(
    `${String(px).padStart(4)}px  ${kb(s.png).padStart(7)}  ${kb(s.webpLossless).padStart(8)}  ` +
      `${kb(s.webp90).padStart(7)}  ${kb(s.webp80).padStart(7)}  ${kb(s.jpeg85).padStart(7)}  ` +
      `${kb(s.bitmapBytes).padStart(9)}`
  )
}

/* ── 按「一个 orbit 循环 68 帧」算整包 ────────────────────────────── */

const ORBIT_FRAMES = 68
console.log(`\norbit 一个循环（${ORBIT_FRAMES} 帧，20fps）的总量\n`)
console.log('边长    格式        68 帧总量    9 格同时解码内存')
console.log('─'.repeat(60))

for (const [px, s] of Object.entries(sizes)) {
  const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`
  const rows = [
    ['PNG', s.png],
    ['WebP90', s.webp90]
  ]
  for (const [name, bytes] of rows) {
    const total = bytes * ORBIT_FRAMES
    const mem = s.bitmapBytes * ORBIT_FRAMES * 9
    console.log(
      `${String(px).padStart(4)}px  ${name.padEnd(10)} ${mb(total).padStart(9)}  ${mb(mem).padStart(18)}`
    )
  }
}

console.log('\n关键约束：')
console.log('  · 内存 = 帧数 × 边长² × 4 字节 × 同时播放的格数，与压缩率无关。')
console.log('  · 浏览器对 <img> 有解码缓存上限，超出会反复解码（比 SVG 更慢）。')
console.log('  · 实际做法只能「按需预载当前格」，不能全量常驻。')

/* ── 最后一条：改成位图后还省不省，取决于要不要频繁换帧 ─────────── */

console.log('\n再算一笔：位图省下的 CPU 值不值这些内存')
console.log('  实测省 8.4pp（19.2% → 10.8%），即 9 格从约 1/5 核降到约 1/10 核。')
console.log('  代价：')
for (const [px, s] of Object.entries(sizes)) {
  const mem = (s.bitmapBytes * ORBIT_FRAMES * 9) / 1024 / 1024
  console.log(`    ${px}px：9 格各播一个 orbit 循环 → ${mem.toFixed(1)} MB 位图常驻`)
}

await browser.close()

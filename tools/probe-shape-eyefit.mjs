/**
 * 加进来的 11 个身形，眼睛会不会把轮廓咬出缺口？
 *
 * ── 为什么这是唯一的真风险 ────────────────────────────────────────────
 * 眼睛不是画在身体上的白形状，是 `<mask>` 里挖的洞（`Bot.tsx` 第 170~176 行）：
 * 白色 = 身体轮廓，黑色 = 眼睛。所以「眼睛太靠边」不会表现为眼睛跑出去
 * （跑出去的地方本来就在身体外，看不见），而是**洞和身体外沿连成一片**，
 * 轮廓上被咬出一个缺口 —— 看起来像脸被削掉一块。
 *
 * 这在数值上有一个干净的等价判据：
 *   把渲染结果画到白底上 → 从画布边缘泛洪，标出「外面」
 *   → 剩下没被标到的白像素就是**封闭的洞**
 *   → 洞的个数必须等于眼睛个数（2）。少一个 = 有只眼把轮廓咬穿了。
 *
 * 不依赖任何坐标计算，也不需要知道 eye 的 matrix 怎么解 —— 量的是用户
 * 真正看到的像素。历史上 `capsule` + `effraye` 就是这么翻车的。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-shape-catalog.mjs && node tools/probe-shape-eyefit.mjs
 */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 4 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-catalog.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1500)

/**
 * 在页面里逐格量：把每个 svg 画到 4 倍画布上，数封闭白洞。
 *
 * 放大 4 倍是为了让 `somnolent` 那种极细的眼睛不至于因为抗锯齿消失 ——
 * 小尺寸下它可能只有一两个像素宽，直接量会误判成「没有洞」。
 */
const results = await tab.evaluate(async () => {
  const cells = Array.from(document.querySelectorAll('.cell'))
  const out = []

  /** 从四边泛洪标外部，剩下的白 = 封闭洞。 */
  function countHoles(data, w, h) {
    const white = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
      const a = data[i * 4 + 3]
      // 白底上「白」= 三通道都亮。透明也算外部（paper 是白，但保险）。
      white[i] = a < 20 || (r > 235 && g > 235 && b > 235) ? 1 : 0
    }
    const outside = new Uint8Array(w * h)
    const stack = []
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      const i = y * w + x
      if (outside[i] || !white[i]) return
      outside[i] = 1
      stack.push(i)
    }
    for (let x = 0; x < w; x++) {
      push(x, 0)
      push(x, h - 1)
    }
    for (let y = 0; y < h; y++) {
      push(0, y)
      push(w - 1, y)
    }
    while (stack.length) {
      const i = stack.pop()
      const x = i % w
      const y = (i - x) / w
      push(x - 1, y)
      push(x + 1, y)
      push(x, y - 1)
      push(x, y + 1)
    }
    // 剩下的白 = 洞，数连通块
    const seen = new Uint8Array(w * h)
    let holes = 0
    let biggest = 0
    for (let i = 0; i < w * h; i++) {
      if (!white[i] || outside[i] || seen[i]) continue
      holes++
      let size = 0
      const st = [i]
      seen[i] = 1
      while (st.length) {
        const j = st.pop()
        size++
        const x = j % w
        const y = (j - x) / w
        for (const [dx, dy] of [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1]
        ]) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const k = ny * w + nx
          if (white[k] && !outside[k] && !seen[k]) {
            seen[k] = 1
            st.push(k)
          }
        }
      }
      if (size > biggest) biggest = size
    }
    return { holes, biggest }
  }

  for (const cell of cells) {
    const shape = cell.dataset.shape
    const expr = cell.dataset.expr
    // 取每格第一张（30px，面板里的真实尺寸）
    const svg = cell.querySelector('svg')
    if (!svg) {
      out.push({ shape, expr, holes: -1, note: 'no svg' })
      continue
    }
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = () => rej(new Error('img load failed'))
      img.src = url
    })
    const scale = 4
    const w = Math.round((svg.clientWidth || 30) * scale)
    const h = Math.round((svg.clientHeight || 30) * scale)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g2 = cv.getContext('2d')
    // 白底：眼睛是洞，洞漏出来的是底色
    g2.fillStyle = '#ffffff'
    g2.fillRect(0, 0, w, h)
    g2.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const { holes, biggest } = countHoles(g2.getImageData(0, 0, w, h).data, w, h)
    out.push({ shape, expr, holes, biggest })
  }
  return out
})

await browser.close()

// ── 汇总 ──────────────────────────────────────────────────────────────
const byShape = new Map()
for (const r of results) {
  if (!byShape.has(r.shape)) byShape.set(r.shape, {})
  byShape.get(r.shape)[r.expr] = r
}

const EXPRS = ['effraye', 'colere', 'somnolent']
let bad = 0
console.log('每个身形 × 3 个表情，数「封闭白洞」个数（应恒为 2）：\n')
console.log('身形'.padEnd(12) + EXPRS.map((e) => e.padStart(12)).join(''))
console.log('─'.repeat(48))
for (const [shape, map] of byShape) {
  const row = EXPRS.map((e) => {
    const r = map[e]
    if (!r) return '—'.padStart(12)
    const mark = r.holes === 2 ? '' : ' ✗'
    return `${r.holes}${mark}`.padStart(12)
  }).join('')
  const broken = EXPRS.some((e) => map[e] && map[e].holes !== 2)
  if (broken) bad++
  console.log((broken ? '✗ ' : '  ') + shape.padEnd(10) + row)
}
console.log('─'.repeat(48))
console.log(bad === 0 ? `全部 ${byShape.size} 个身形：眼睛都在轮廓内，没咬穿` : `${bad} 个身形有眼睛咬穿轮廓`)
process.exitCode = bad === 0 ? 0 : 1

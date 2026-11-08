/**
 * 6 身形 × 5 状态 × 16 表情：眼睛会不会被轮廓咬掉？
 *
 * ── 第一版判据错了，记在这里 ──────────────────────────────────────────
 * 第一版数「封闭白洞个数 = 2」。结果 `notify` 报 5 个洞、`swirl` 报 3 个洞 ——
 * 那不是眼睛出问题，是**装饰**被数进去了：
 *   · `notify` 在轮廓上挖了一个凹槽（`notch`）放蓝点，凹槽是另一个洞
 *   · `swirl` 画了 3 条环（`arcs`），环自己也是闭合形状
 * 判据把装饰当成了眼睛，于是全部误报。
 *
 * ── 正确的判据：和同状态的「圆」比 ────────────────────────────────────
 * 装饰和身形无关（同一状态下所有身形都画同样的环/凹槽）。所以基准是
 * **同状态、同表情下的圆形**：它的洞数就是「装饰贡献的洞数」。
 *
 *   身形洞数 == 圆洞数  → 眼睛完整（该身形没多吃也没少吃洞）
 *   身形洞数 < 圆洞数   → **眼睛被咬掉了**（真问题）
 *   身形洞数 > 圆洞数   → 轮廓自身多出凹陷（可能是 r(θ) 填平失败，要看）
 *
 * 这是相对判据，自动扣掉装饰，不依赖我知道每种状态画了什么。
 *
 * 用法：node tools/build-shape-six.mjs && node tools/probe-shape-six.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 3 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-six.html').replace(/\\/g, '/'))
await tab.waitForTimeout(2000)

const cells = await tab.evaluate(() => document.querySelectorAll('.cell').length)
console.log(`渲染到 ${cells} 格（期望 14 身形 × 5 状态 × 16 表情 = 1120）\n`)

const results = await tab.evaluate(async () => {
  const all = Array.from(document.querySelectorAll('.cell'))
  const out = []

  /**
   * 数封闭白洞，并返回每个洞的面积。
   *
   * 面积是必须的：只有「眼睛那么大」的洞才算眼睛。装饰的环很细，
   * 面积远小于眼睛；这样即使某个状态多画了东西，也能按面积筛掉。
   */
  function analyze(data, w, h) {
    const white = new Uint8Array(w * h)
    for (let i = 0; i < w * h; i++) {
      const a = data[i * 4 + 3]
      const r = data[i * 4]
      const g = data[i * 4 + 1]
      const b = data[i * 4 + 2]
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
    const seen = new Uint8Array(w * h)
    const sizes = []
    for (let i = 0; i < w * h; i++) {
      if (!white[i] || outside[i] || seen[i]) continue
      let size = 0
      const st = [i]
      seen[i] = 1
      while (st.length) {
        const j = st.pop()
        size++
        const x = j % w
        const y = (j - x) / w
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
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
      sizes.push(size)
    }
    sizes.sort((a, b) => b - a)
    return { total: sizes.length, sizes }
  }

  for (const cell of all) {
    const svg = cell.querySelector('svg')
    if (!svg) continue
    const xml = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = () => rej(new Error('img fail'))
      img.src = url
    })
    const scale = 3
    const w = Math.round((svg.clientWidth || 44) * scale)
    const h = Math.round((svg.clientHeight || 44) * scale)
    const cv = document.createElement('canvas')
    cv.width = w
    cv.height = h
    const g2 = cv.getContext('2d')
    g2.fillStyle = '#ffffff'
    g2.fillRect(0, 0, w, h)
    g2.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    const r = analyze(g2.getImageData(0, 0, w, h).data, w, h)
    out.push({
      shape: cell.dataset.shape,
      state: cell.dataset.state,
      expr: cell.dataset.expr,
      holes: r.total,
      // 取最大的两个洞，它们应该是眼睛
      big: r.sizes.slice(0, 2),
      px: w * h
    })
  }
  return out
})

await browser.close()

// ── 用圆形做基准 ──────────────────────────────────────────────────────
const STATES = ['idle', 'wink', 'wide', 'notify', 'swirl']
const SHAPES = ['bouclier', 'dome', 'arche', 'cylindre', 'gemme', 'cristal']

const key = (state, expr) => `${state}|${expr}`
const baseline = new Map()
for (const r of results) {
  if (r.shape === 'cercle') baseline.set(key(r.state, r.expr), r)
}

console.log('判据：和同状态同表情的「圆」比洞数。')
console.log('  = 一致  ·  -N 眼睛被咬掉（真问题）  ·  +N 轮廓多出凹陷（要看）\n')
console.log('身形'.padEnd(12) + STATES.map((s) => s.padStart(11)).join(''))
console.log('─'.repeat(68))

const eyeLost = []
const extraHole = []
for (const shape of SHAPES) {
  const row = STATES.map((state) => {
    const set = results.filter((r) => r.shape === shape && r.state === state)
    let minus = 0
    let plus = 0
    for (const r of set) {
      const base = baseline.get(key(r.state, r.expr))
      if (!base) continue
      const d = r.holes - base.holes
      if (d < 0) {
        minus++
        eyeLost.push(`${shape} / ${state} / ${r.expr}：${r.holes} 洞（圆是 ${base.holes}）`)
      } else if (d > 0) {
        plus++
        extraHole.push(`${shape} / ${state} / ${r.expr}：${r.holes} 洞（圆是 ${base.holes}）`)
      }
    }
    if (minus) return `✗-${minus}`.padStart(11)
    if (plus) return `+${plus}`.padStart(11)
    return '一致'.padStart(11)
  }).join('')
  console.log('  ' + shape.padEnd(10) + row)
}

console.log('─'.repeat(68))
if (eyeLost.length === 0) {
  console.log('眼睛被咬掉：0 格 ✓')
} else {
  console.log(`眼睛被咬掉 ${eyeLost.length} 格：`)
  for (const f of eyeLost.slice(0, 15)) console.log('  ✗ ' + f)
}
if (extraHole.length) {
  console.log(`\n多出凹陷 ${extraHole.length} 格（不一定是坏事，要看是哪个方向）：`)
  for (const f of extraHole.slice(0, 8)) console.log('  · ' + f)
}

process.exitCode = eyeLost.length === 0 ? 0 : 1

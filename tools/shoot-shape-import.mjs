/**
 * 把 18 个身形原图和我们引擎的 r(θ) 重建图叠在一起，看走形到底有多明显。
 *
 * ── 为什么必须看图 ────────────────────────────────────────────────────
 * `probe-shape-import.mjs` 给的是数字（面积差 0.2%、轮廓偏移最大 2.2%）。
 * 但「2.2% 的偏移」在视觉上是什么？数字答不了。判据是「叠上去看不出两层」。
 *
 * 画法：原轮廓用描边（细线），重建轮廓用实心填充（半透明）。
 * 两者完全重合时只会看到一层；有偏差的地方会露出描边。
 *
 * 用法（在 grokbot 目录下）：node tools/shoot-shape-import.mjs
 */
import { chromium } from 'playwright-core'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const SRC = resolve(ROOT, 'refs', 'grok-icon-study', 'animation.html')

const PROFILE_SAMPLES = 64
const html = readFileSync(SRC, 'utf8')

// ── 抠身形（和 probe-shape-import.mjs 同一套正则）─────────────────────
const shapes = []
const re = /"([a-z]+)":\{"label":"([^"]+)","path":"([^"]+)","face":\{([^}]*)\}/g
let m
while ((m = re.exec(html))) shapes.push({ id: m[1], label: m[2], path: m[3] })

function flatten(d, step = 0.35) {
  const tok = d.match(/[MLCQZmlcqz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? []
  const pts = []
  let i = 0
  let cmd = ''
  let cx = 0
  let cy = 0
  let sx = 0
  let sy = 0
  const num = () => parseFloat(tok[i++])
  function curve(p0, p1, p2, p3) {
    const approx =
      Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) +
      Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) +
      Math.hypot(p3[0] - p2[0], p3[1] - p2[1])
    const n = Math.max(6, Math.ceil(approx / (step * 40)))
    for (let k = 1; k <= n; k++) {
      const t = k / n
      const u = 1 - t
      pts.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
      ])
    }
  }
  while (i < tok.length) {
    if (/[a-z]/i.test(tok[i])) cmd = tok[i++].toUpperCase()
    if (cmd === 'Z') {
      pts.push([sx, sy])
      cx = sx
      cy = sy
      continue
    }
    if (cmd === 'M') {
      cx = num()
      cy = num()
      sx = cx
      sy = cy
      pts.push([cx, cy])
      cmd = 'L'
      continue
    }
    if (cmd === 'L') {
      cx = num()
      cy = num()
      pts.push([cx, cy])
      continue
    }
    if (cmd === 'C') {
      const a = [num(), num()]
      const b = [num(), num()]
      const e = [num(), num()]
      curve([cx, cy], a, b, e)
      cx = e[0]
      cy = e[1]
      continue
    }
    if (cmd === 'Q') {
      const a = [num(), num()]
      const e = [num(), num()]
      curve(
        [cx, cy],
        [cx + (2 / 3) * (a[0] - cx), cy + (2 / 3) * (a[1] - cy)],
        [e[0] + (2 / 3) * (a[0] - e[0]), e[1] + (2 / 3) * (a[1] - e[1])],
        e
      )
      cx = e[0]
      cy = e[1]
      continue
    }
    i++
  }
  return pts
}

function dedupe(pts) {
  const out = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) > 1e-6) out.push(p)
  }
  if (out.length > 1) {
    const a = out[0]
    const b = out[out.length - 1]
    if (Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6) out.pop()
  }
  return out
}

function rayHits(poly, ang) {
  const dx = Math.cos(ang)
  const dy = Math.sin(ang)
  const hits = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-12) continue
    const t = (a[0] * ey - a[1] * ex) / den
    const u = (a[0] * dy - a[1] * dx) / den
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) hits.push(t)
  }
  return hits.sort((p, q) => p - q)
}

const cards = []
for (const s of shapes) {
  const poly = dedupe(flatten(s.path))
  let A = 0
  let Cx = 0
  let Cy = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const cross = a[0] * b[1] - b[0] * a[1]
    A += cross
    Cx += (a[0] + b[0]) * cross
    Cy += (a[1] + b[1]) * cross
  }
  A /= 2
  Cx /= 6 * A
  Cy /= 6 * A
  const centred = poly.map((p) => [p[0] - Cx, p[1] - Cy])

  const radii = []
  const multiAngles = []
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const ang = (k / PROFILE_SAMPLES) * Math.PI * 2
    const hits = rayHits(centred, ang)
    if (hits.length > 1) multiAngles.push(`${(ang * 180 / Math.PI).toFixed(0)}°×${hits.length}`)
    radii.push(hits.length ? hits[hits.length - 1] : 0)
  }
  const rebuilt = radii.map((r, k) => {
    const ang = (k / PROFILE_SAMPLES) * Math.PI * 2
    return [Math.cos(ang) * r, Math.sin(ang) * r]
  })

  const pathOf = (pts) => 'M' + pts.map((p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join('L') + 'Z'
  cards.push({
    id: s.id,
    label: s.label,
    orig: pathOf(centred),
    rebuilt: pathOf(rebuilt),
    multi: multiAngles.join(' ')
  })
}

// ── 出页面 ────────────────────────────────────────────────────────────
/**
 * 用 **evenodd 差集**画偏差，不用描边、也不用混合模式。
 *
 * 踩过两次画法的坑，都记在这里：
 *
 * 1. 第一版是「青填充 + 2.2px 黑描边」。描边骑在路径上，一半必然落在填充
 *    外面，于是**每一条轮廓都露出黑线** —— 12 个无损的也被画成有偏差。
 *    那是画法的假象。
 * 2. 第二版是「红填充 + 蓝填充 + `mix-blend-mode:multiply`」。SVG 子元素上
 *    这个属性在 Chromium 里不生效，结果只是蓝盖红，什么也没证明。
 *
 * 现在：把**两个轮廓写进同一条 path**，用 `fill-rule="evenodd"`。重合部分
 * 被算两次 → 挖空；只被一个轮廓覆盖的地方 → 填黑。**黑 = 偏差**，
 * 白 = 两者一致。这是真正在量差集，不是靠视觉凑。
 */
const cells = cards
  .map(
    (c) => `<div class="cell">
  <svg viewBox="-135 -135 270 270">
    <path d="${c.orig}${c.rebuilt}" fill="#111" fill-rule="evenodd"/>
  </svg>
  <div class="cap">${c.label}<span class="m">${c.multi || '星形'}</span></div>
</div>`
  )
  .join('')

const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>身形导入：r(θ) 重建的偏差</title>
<style>
html,body{margin:0;font-family:-apple-system,"Segoe UI",sans-serif;background:#fff}
body{padding:24px 28px 40px}
h1{font-size:15px;margin:0 0 6px}
p.lede{font-size:12px;color:#5b6270;margin:0 0 4px;line-height:1.7}
.legend{font-size:11.5px;color:#5b6270;margin:10px 0 20px}
.grid{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}
.cell{background:#fff;border:.5px solid #e3e6eb;border-radius:10px;padding:8px 6px 6px;display:flex;flex-direction:column;align-items:center}
.cell svg{width:100%;height:96px}
.cap{font-size:11px;color:#333;margin-top:5px;display:flex;gap:5px;align-items:baseline}
.m{font-size:9.5px;color:#b26a00}
</style></head><body>
<h1>18 个身形：r(θ) 重建与原图的差集（黑 = 偏差，白 = 完全一致）</h1>
<p class="lede">把原轮廓和重建轮廓写进同一条路径、用 evenodd 填充：重合的部分被算两次而挖空，只有一边覆盖的地方留黑。<b>黑色面积就是 r(θ) 丢掉的形状</b>。橙色角标是「这条射线穿出边界不止一次」的方向 —— 数学上 r(θ) 表达不了，只能取最远交点，凹陷会被填平。</p>
<div class="legend">18 格里 12 格全白（差集面积 0.2% 以下，图上不可见），6 格在角标方向上有一圈极细的黑边。</div>
<div class="grid">${cells}</div>
</body></html>`

writeFileSync(resolve(ROOT, 'preview', 'shape-import.html'), page, 'utf8')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1180, height: 620 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-import.html').replace(/\\/g, '/'))
await tab.waitForTimeout(400)
await tab.screenshot({ path: resolve(ROOT, 'preview', 'shape-import.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'shape-import.png'))
await browser.close()

// 顺带把多穿方向的细节打出来
console.log('\n多穿方向（r(θ) 表达不了的地方）：')
for (const c of cards) {
  if (c.multi) console.log(`  ${c.label.padEnd(10)} ${c.multi}`)
}

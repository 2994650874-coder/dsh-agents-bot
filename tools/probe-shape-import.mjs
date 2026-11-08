/**
 * 能不能把 grok-icon-study 那 18 个身形搬进我们的引擎？
 *
 * ── 两边的格式差在哪 ──────────────────────────────────────────────────
 * 参考仓库：一个绝对坐标的 SVG path（228×228 的框里画曲线）+ 一个 face 偏移
 *           {x, y, sx, sy, eye}。轮廓是**任意曲线**，可以是凹的、可以有平底。
 * 我们的引擎：`radii: number[]`，64 个角度上的半径采样（r(θ)），圆心到边界
 *           **每条射线只交一次** —— 也就是数学上的「星形域」。
 *
 * 所以「格式不通用」的准确含义是：**r(θ) 表达不了非星形轮廓**。
 * 云朵的凹口、盾牌的内收、拱门的直边，落成 r(θ) 会丢东西。丢多少要量。
 *
 * ── 这个脚本量什么 ────────────────────────────────────────────────────
 * 1. 把每个 path 展平成多边形
 * 2. 从质心按 64 个角度做射线求交，取**最远**交点当 r(θ)
 * 3. 用这些半径反推一个多边形，和原多边形比：
 *    · 面积差（%）
 *    · 顶点最大偏移（相对外接半径）
 *    · 射线是否多次穿出（>1 次 = 非星形，这是硬伤）
 * 4. 给出「能不能搬」的判据：多次穿出 = 0 且面积差 < 3% 就算能搬
 *
 * 用法（在 grokbot 目录下）：node tools/probe-shape-import.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(ROOT, 'refs', 'grok-icon-study', 'animation.html')

/** 我们引擎的采样数，必须和 src/bot/profiles.ts 的 PROFILE_SAMPLES 一致。 */
const PROFILE_SAMPLES = 64

const html = readFileSync(SRC, 'utf8')

// ── 抠出 18 个身形 ────────────────────────────────────────────────────
const shapes = []
const re = /"([a-z]+)":\{"label":"([^"]+)","path":"([^"]+)","face":\{([^}]*)\}/g
let m
while ((m = re.exec(html))) {
  shapes.push({ id: m[1], label: m[2], path: m[3], face: m[4] })
}
if (shapes.length !== 18) {
  console.error(`期望 18 个身形，抠到 ${shapes.length} 个 —— 正则和源码不同步了`)
  process.exit(1)
}

// ── path 展平（只支持 M/L/C/Q/Z，参考仓库只用到这几种）────────────────
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

  /** 一条三次/二次曲线按长度自适应细分，避免长边采样不足。 */
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
      // 二次升三次，复用同一套细分
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
    // 未知指令：跳过，避免死循环
    i++
  }
  return pts
}

/** 去掉相邻重复点，否则射线求交会撞到零长度边。 */
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

function area(poly) {
  let s = 0
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    s += a[0] * b[1] - b[0] * a[1]
  }
  return Math.abs(s) / 2
}

/**
 * 从原点沿 (cosθ, sinθ) 打一条射线，返回所有交点的距离（升序）。
 *
 * 交点个数就是「这条射线穿出边界几次」。星形域每个方向恰好 1 次；
 * 2 次以上说明有凹陷在射线后面，r(θ) 只能记住最远那个，凹陷会被填平。
 */
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
    const t = (a[0] * ey - a[1] * ex) / den // 沿射线的距离
    const u = (a[0] * dy - a[1] * dx) / den // 沿边的比例
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9) hits.push(t)
  }
  return hits.sort((p, q) => p - q)
}

/** 点到闭合折线的最短距离。 */
function distToPoly(poly, p) {
  let best = Infinity
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const ex = b[0] - a[0]
    const ey = b[1] - a[1]
    const len2 = ex * ex + ey * ey
    let t = len2 > 0 ? ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / len2 : 0
    t = Math.max(0, Math.min(1, t))
    const d = Math.hypot(p[0] - (a[0] + ex * t), p[1] - (a[1] + ey * t))
    if (d < best) best = d
  }
  return best
}

// ── 逐个身形做转换 ────────────────────────────────────────────────────
const rows = []
for (const s of shapes) {
  const poly = dedupe(flatten(s.path))
  if (poly.length < 8) {
    rows.push({ ...s, note: '展平失败' })
    continue
  }

  // 质心（面积加权）
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

  // 平移到质心
  const centred = poly.map((p) => [p[0] - Cx, p[1] - Cy])

  let multi = 0
  let maxHits = 0
  const radii = []
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const ang = (k / PROFILE_SAMPLES) * Math.PI * 2
    const hits = rayHits(centred, ang)
    if (hits.length > 1) multi++
    if (hits.length > maxHits) maxHits = hits.length
    radii.push(hits.length ? hits[hits.length - 1] : 0)
  }

  // 用 r(θ) 反推多边形
  const rebuilt = radii.map((r, k) => {
    const ang = (k / PROFILE_SAMPLES) * Math.PI * 2
    return [Math.cos(ang) * r, Math.sin(ang) * r]
  })

  const aOrig = area(centred)
  const aNew = area(rebuilt)
  const areaErr = Math.abs(aNew - aOrig) / aOrig

  // 双向最大偏移：原轮廓的顶点离新轮廓多远，反之亦然
  const peak = Math.max(...radii)
  let dOrig = 0
  for (const p of centred) dOrig = Math.max(dOrig, distToPoly(rebuilt, p))
  let dNew = 0
  for (const p of rebuilt) dNew = Math.max(dNew, distToPoly(centred, p))
  const dev = Math.max(dOrig, dNew) / peak

  rows.push({
    id: s.id,
    label: s.label,
    verts: poly.length,
    multi,
    maxHits,
    areaErr,
    dev,
    peak
  })
}

// ── 报告 ──────────────────────────────────────────────────────────────
const OK_AREA = 0.03
const OK_DEV = 0.02

console.log('把 18 个 SVG path 转成我们引擎的 r(θ) 64 采样：\n')
console.log(
  '身形'.padEnd(11) +
    '顶点'.padStart(6) +
    '多穿方向'.padStart(9) +
    '面积差'.padStart(9) +
    '轮廓偏移'.padStart(9) +
    '  判定'
)
console.log('─'.repeat(62))

let ok = 0
let borderline = 0
let bad = 0
for (const r of rows) {
  if (r.note) {
    console.log(`${r.id.padEnd(11)}${r.note}`)
    continue
  }
  const pass = r.multi === 0 && r.areaErr < OK_AREA && r.dev < OK_DEV
  const warn = r.multi <= 2 && r.areaErr < 0.08 && r.dev < 0.05
  const tag = pass ? '可直接搬' : warn ? '轻微失真' : '会走形'
  if (pass) ok++
  else if (warn) borderline++
  else bad++
  console.log(
    r.id.padEnd(11) +
      String(r.verts).padStart(6) +
      `${r.multi}/${PROFILE_SAMPLES}`.padStart(9) +
      `${(r.areaErr * 100).toFixed(1)}%`.padStart(9) +
      `${(r.dev * 100).toFixed(1)}%`.padStart(9) +
      '  ' +
      tag
  )
}

console.log('─'.repeat(62))
console.log(`可直接搬 ${ok} 个 · 轻微失真 ${borderline} 个 · 会走形 ${bad} 个（共 ${rows.length}）`)

const worst = rows
  .filter((r) => !r.note)
  .sort((a, b) => b.dev - a.dev)
  .slice(0, 3)
if (worst.length) {
  console.log('\n失真最大的三个：' + worst.map((w) => `${w.label} ${(w.dev * 100).toFixed(1)}%`).join(' · '))
}

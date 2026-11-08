/**
 * 生成要粘进 `plugin/src/bot/skins.ts` 的 6 个身形代码。
 *
 * ── 为什么用脚本生成而不是手抄 ────────────────────────────────────────
 * 每个身形是 64 个浮点半径。手抄必错，而且错了不会报错 —— 只会看起来
 * 「这个形状有点怪」。生成出来直接粘，数字一个都不用经过我的手。
 *
 * 转换口径和 `probe-shape-import.mjs` 完全一致（同一套射线求交），
 * 所以「量过能转」和「真的转了」是同一份数据。
 *
 * 用法（在 grokbot 目录下）：node tools/gen-shapes.mjs
 * 输出：preview/_shapes-snippet.txt（粘进 skins.ts 的数组项）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REF = resolve(ROOT, 'refs', 'grok-icon-study', 'animation.html')
const PROFILE_SAMPLES = 64

/** 参考仓库 id → 我们引擎的 id + 中文名。 */
const MAP = [
  { ref: 'shield', id: 'bouclier', zh: '盾牌' },
  { ref: 'dome', id: 'dome', zh: '穹顶' },
  { ref: 'arch', id: 'arche', zh: '拱门' },
  { ref: 'cylinder', id: 'cylindre', zh: '圆柱' },
  { ref: 'gem', id: 'gemme', zh: '宝石' },
  { ref: 'crystal', id: 'cristal', zh: '晶体' }
]

const html = readFileSync(REF, 'utf8')
const paths = {}
const re = /"([a-z]+)":\{"label":"([^"]+)","path":"([^"]+)"/g
let m
while ((m = re.exec(html))) paths[m[1]] = m[3]

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

/** 转成 64 个半径，归一化到峰值 1（引擎约定：所有形状视觉重量一致）。 */
function radiiOf(path) {
  const poly = dedupe(flatten(path))
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
  const r = []
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const ang = (k / PROFILE_SAMPLES) * Math.PI * 2
    const hits = rayHits(centred, ang)
    r.push(hits.length ? hits[hits.length - 1] : 0)
  }
  const peak = Math.max(...r)
  return r.map((v) => Math.round((v / peak) * 1e5) / 1e5)
}

const lines = []
for (const item of MAP) {
  if (!paths[item.ref]) {
    console.error(`参考仓库里找不到 ${item.ref}`)
    process.exit(1)
  }
  const r = radiiOf(paths[item.ref])
  if (r.some((v) => !Number.isFinite(v) || v <= 0)) {
    console.error(`${item.id} 转出了非法半径`)
    process.exit(1)
  }
  lines.push(`  { id: '${item.id}', radii: [${r.join(',')}] }`)
}

writeFileSync(resolve(ROOT, 'preview', '_shapes-snippet.txt'), lines.join(',\n') + '\n', 'utf8')
console.log('生成的数组项：\n')
for (const l of lines) {
  console.log('  ' + l.slice(0, 100) + (l.length > 100 ? ' …' : ''))
}
console.log(`\n完整内容写到 preview/_shapes-snippet.txt（${lines.length} 项，各 ${PROFILE_SAMPLES} 个半径）`)

// 顺带报每个形状的宽高比，用来预判眼睛会不会挤
console.log('\n宽高比（半径的 x 跨度 / y 跨度，越小越窄）：')
for (const item of MAP) {
  const r = radiiOf(paths[item.ref])
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (let k = 0; k < PROFILE_SAMPLES; k++) {
    const a = (k / PROFILE_SAMPLES) * Math.PI * 2
    const x = Math.cos(a) * r[k]
    const y = Math.sin(a) * r[k]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  const ratio = (maxX - minX) / (maxY - minY)
  console.log(`  ${item.id.padEnd(10)} ${ratio.toFixed(3)}  ${item.zh}`)
}

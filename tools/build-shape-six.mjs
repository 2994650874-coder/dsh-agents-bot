/**
 * 用户点名的 6 个身形的全矩阵检阅页：6 身形 × 5 状态 × 16 表情。
 *
 * 为什么只做 6 个而不是 11 个：用户点名要这 6 个。其余 5 个
 * （haricot / oeuf / comprime / coin / feuille）上一轮已经验过 3 个表情全过，
 * 要做的时候再补一轮即可。
 *
 * 用法：node tools/build-shape-six.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BOT_SRC = resolve(ROOT, 'plugin/src/bot')
const BOT_TMP = resolve(ROOT, 'preview/_bot6')
const REF = resolve(ROOT, 'refs', 'grok-icon-study', 'animation.html')
const PROFILE_SAMPLES = 64

/* 参考仓库 id → 我们的 id（只要这 6 个）*/
const PICK = {
  shield: 'bouclier',
  dome: 'dome',
  arch: 'arche',
  cylinder: 'cylindre',
  gem: 'gemme',
  crystal: 'cristal'
}

const html = readFileSync(REF, 'utf8')
const raw = {}
const re = /"([a-z]+)":\{"label":"([^"]+)","path":"([^"]+)"/g
let m
while ((m = re.exec(html))) raw[m[1]] = m[3]

for (const k of Object.keys(PICK)) {
  if (!raw[k]) {
    console.error(`参考仓库里找不到 ${k}`)
    process.exit(1)
  }
}

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

/* ── 复制 bot 目录，只注入这 6 个 ─────────────────────────────────── */
mkdirSync(BOT_TMP, { recursive: true })
for (const f of readdirSync(BOT_SRC)) {
  if (f.endsWith('.ts')) copyFileSync(resolve(BOT_SRC, f), resolve(BOT_TMP, f))
}

const skinsTs = resolve(BOT_TMP, 'skins.ts')
let src = readFileSync(skinsTs, 'utf8')
const injected = Object.entries(PICK)
  .map(([refId, ourId]) => `  { id: '${ourId}', radii: [${radiiOf(raw[refId]).join(',')}] }`)
  .join(',\n')

src = src.replace('export const SHAPES: BotShape[] = [', 'export const SHAPES: BotShape[] = [\n' + injected + ',')
src = src.replace(
  'export type ShapeId =',
  `export type ShapeId =\n  | ${Object.values(PICK)
    .map((v) => `'${v}'`)
    .join('\n  | ')}\n  |`
)
writeFileSync(skinsTs, src, 'utf8')
console.log(`已注入 ${Object.keys(PICK).length} 个身形到 preview/_bot6/skins.ts`)

/* ── 构建 ──────────────────────────────────────────────────────────── */
const { build } = await import('esbuild')

const redirectBot = {
  name: 'redirect-bot',
  setup(b) {
    b.onResolve({ filter: /\/bot\/[a-zA-Z]+$/ }, (args) => {
      const name = args.path.replace(/^.*\/bot\//, '')
      return { path: resolve(BOT_TMP, name + '.ts') }
    })
  }
}

await build({
  entryPoints: [resolve(ROOT, 'tools/shape-six.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/shape-six.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8',
  plugins: [redirectBot]
})

writeFileSync(
  resolve(ROOT, 'preview', 'shape-six.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>6 身形全矩阵</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./shape-six.js"></script></body></html>`,
  'utf8'
)
console.log('built preview/shape-six.html')

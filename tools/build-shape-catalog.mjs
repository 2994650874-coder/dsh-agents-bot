/**
 * 把 11 个新身形真正塞进引擎，画出眼睛，看会不会出事。
 *
 * ── 为什么要单独验这一条 ──────────────────────────────────────────────
 * 加身形不是「多几行数据」。引擎给每个身形预计算一张**眼睛偏移表**
 * （`bot/eyefit.ts` 的 `batir()`，按 身形 × 有身体的状态 × 表情 穷举求解）。
 * 这张表在模块导入时建，只认 `skins.ts` 里 `SHAPES` 有的形状。
 *
 * 表里没有的形状，偏移退回 (0,0) —— 眼睛就按正圆的余量摆。窄身形上
 * 眼睛会顶出轮廓（历史事故：`capsule` + `effraye`，七版逐帧方案都抖）。
 * 所以判据是：**新身形配上最窄的表情，眼睛还在轮廓里**。
 *
 * ── 怎么做的 ──────────────────────────────────────────────────────────
 * 不动 `plugin/src`。把整个 `bot/` 目录复制到 `preview/_bot19`，往那份
 * 的 `skins.ts` 注入 11 个从参考仓库转出来的真半径，然后用 esbuild 的
 * onResolve 把 `../bot/*` 重定向到副本 —— 这样 eyefit 会为 19 个身形建表。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-shape-catalog.mjs && node tools/shoot-shape-catalog.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BOT_SRC = resolve(ROOT, 'plugin/src/bot')
const BOT_TMP = resolve(ROOT, 'preview/_bot19')
const REF = resolve(ROOT, 'refs', 'grok-icon-study', 'animation.html')

const PROFILE_SAMPLES = 64

/* ── 1. 从参考仓库转出 11 个新身形的半径 ──────────────────────────── */

const html = readFileSync(REF, 'utf8')
const raw = []
const re = /"([a-z]+)":\{"label":"([^"]+)","path":"([^"]+)"/g
let m
while ((m = re.exec(html))) raw.push({ id: m[1], label: m[2], path: m[3] })

/** 我们已有 8 个的对应关系 —— 这 7 个不重复搬。 */
const ALREADY = new Set(['blob', 'pebble', 'squircle', 'capsule', 'hex', 'cloud', 'teardrop'])
const NEW = raw.filter((s) => !ALREADY.has(s.id))
if (NEW.length !== 11) {
  console.error(`期望 11 个新身形，抠到 ${NEW.length} 个`)
  process.exit(1)
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

/** 转成 64 个半径，并归一化到峰值 1（引擎的约定）。 */
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

/* ── 2. 复制 bot 目录，注入新身形 ─────────────────────────────────── */

mkdirSync(BOT_TMP, { recursive: true })
for (const f of readdirSync(BOT_SRC)) {
  if (f.endsWith('.ts')) copyFileSync(resolve(BOT_SRC, f), resolve(BOT_TMP, f))
}

const shapesTs = resolve(BOT_TMP, 'skins.ts')
let src = readFileSync(shapesTs, 'utf8')

/** 引擎里的 id 用中文名的拼音/意译，避免和参考仓库的英文混着用。 */
const ID_MAP = {
  bean: 'haricot',
  egg: 'oeuf',
  tablet: 'comprime',
  cylinder: 'cylindre',
  gem: 'gemme',
  crystal: 'cristal',
  wedge: 'coin',
  shield: 'bouclier',
  dome: 'dome',
  arch: 'arche',
  leaf: 'feuille'
}

const injected = NEW.map((s) => {
  const id = ID_MAP[s.id]
  const r = radiiOf(s.path)
  return `  { id: '${id}', radii: [${r.join(',')}] }`
}).join(',\n')

/**
 * ── 阴性对照 ──────────────────────────────────────────────────────────
 * 「19 个全过」本身不能证明判据有效 —— 判据可能永远返回 2。
 * 塞一个**故意过窄**的形状：横向压到 0.42（比胶囊还窄），眼睛必然咬穿。
 * 判据必须把它抓出来，否则整个探针是假的。
 *
 * 只在带 `--control` 时加，正常构建不带。
 */
const withControl = process.argv.includes('--control')
const control = withControl
  ? `,\n  { id: 'etroit', radii: Array.from({ length: PROFILE_SAMPLES }, (_, i) => {
      const a = (i / PROFILE_SAMPLES) * Math.PI * 2
      // 横向压扁到 0.42：比胶囊（0.62 双圆包络）窄得多，眼睛一定会顶出去
      return 1 / Math.hypot(Math.cos(a) / 0.42, Math.sin(a) / 1)
    }) }`
  : ''

src = src.replace('export const SHAPES: BotShape[] = [', 'export const SHAPES: BotShape[] = [\n' + injected + control + ',')
src = src.replace(
  'export type ShapeId =',
  `export type ShapeId =\n  | ${Object.values(ID_MAP)
    .map((v) => `'${v}'`)
    .join('\n  | ')}\n  |`
)
writeFileSync(shapesTs, src, 'utf8')

// 顺手确认注入成功
const check = readFileSync(shapesTs, 'utf8')
console.log(`已注入 ${Object.values(ID_MAP).length} 个新身形到 preview/_bot19/skins.ts`)

/* ── 3. 构建预览页 ─────────────────────────────────────────────────── */

const { build } = await import('esbuild')

/**
 * 把任何指向 `bot/xxx` 的 import 重定向到副本。
 *
 * 两种写法都要覆盖：`Bot.tsx` 用 `../bot/engine`，`shape-catalog.tsx` 用
 * `../plugin/src/bot/skins`。所以过滤器只认结尾的 `/bot/名字`，不看前缀。
 * 这样 eyefit 会按 19 个身形建表 —— 这是这个验证唯一的意义。
 */
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
  entryPoints: [resolve(ROOT, 'tools/shape-catalog.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/shape-catalog.js'),
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
  resolve(ROOT, 'preview/shape-catalog.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>新身形检阅</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./shape-catalog.js"></script></body></html>`,
  'utf8'
)

// 新 id 由页面自己通过 `window.__shapes` 报给截图脚本，不落中间文件 ——
// 那个 json 是构建产物，进 git 只会变成噪音。

console.log('built preview/shape-catalog.html')

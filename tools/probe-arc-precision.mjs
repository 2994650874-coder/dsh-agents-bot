/**
 * 弧的采样密度 → 字符串长度 / 几何偏差。
 *
 * ── 为什么这个值得测 ────────────────────────────────────────────────
 * `decor.ts` 的 `arcRender` 每条弧固定采样 **N = 64 段**，每段产出
 * 「M/L + 两个坐标」。6 条弧（orbit）就是 384 段、约 7 KB 的 `d` 字符串，
 * 且**每帧全量重算 + 重新设置属性**。
 *
 * 但弧的屏幕半径约 1.3R ≈ 130px，周长约 800px。64 段意味着每段约 12px，
 * 远超人眼与像素栅格能分辨的精度 —— 典型的「可以砍而观感不变」。
 *
 * ── 这个脚本量什么 ──────────────────────────────────────────────────
 *   · 不同 N 下的 `d` 字符串总长度（决定 SVG 属性解析成本）
 *   · 与 N=64 的几何偏差（最大像素误差），判断砍了会不会露馅
 *
 * 判据：**最大偏差 < 1px** 即可砍 —— 那在像素层面画出来是一样的。
 *
 * 用法（在 grokbot 目录下）：node tools/probe-arc-precision.mjs
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, '.test-build', 'arc-precision.cjs')

const result = await build({
  stdin: {
    contents: `export { TAU } from './src/bot/math'
export { RINGS, COMET_RIBBONS, arcRender } from './src/bot/decor'`,
    resolveDir: resolve(ROOT, 'plugin'),
    sourcefile: 'arc-precision-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
  charset: 'utf8'
})
mkdirSync(resolve(ROOT, '.test-build'), { recursive: true })
writeFileSync(OUT, result.outputFiles[0].text, 'utf8')

const { TAU, RINGS, COMET_RIBBONS } = createRequire(import.meta.url)(OUT)

/** 复刻 arcRender 的采样，只把 N 变成参数。 */
function sampleArc(seed, t, scale, N) {
  const spin = seed.phase + t * seed.speed * TAU
  const cu = Math.cos(seed.tilt)
  const su = Math.sin(seed.tilt)
  const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k))
  const span = seed.sweep * TAU
  const pts = []
  for (let i = 0; i <= N; i++) {
    const th = spin + (i / N) * span
    const ct = Math.cos(th)
    const st = Math.sin(th)
    const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx
    const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy
    const z = seed.a * st * kz
    pts.push({ x: x * scale, y: y * scale, behind: z < 0 })
  }
  return pts
}

/** 按 behind 分段拼成 SVG path（与 arcRender 同样逻辑）。 */
function toPath(pts) {
  let front = ''
  let back = ''
  let prev = null
  for (const p of pts) {
    const cmd = p.behind !== prev ? 'M' : 'L'
    const sx = p.x.toFixed(1)
    const sy = p.y.toFixed(1)
    if (p.behind) back += `${cmd}${sx} ${sy}`
    else front += `${cmd}${sx} ${sy}`
    prev = p.behind
  }
  return { front, back, len: front.length + back.length }
}

/** 与参照折线的最大几何偏差（px）。 */
function maxDeviation(refPts, testPts) {
  let worst = 0
  for (const p of refPts) {
    let best = Infinity
    for (let i = 0; i < testPts.length - 1; i++) {
      const a = testPts[i]
      const b = testPts[i + 1]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const L2 = dx * dx + dy * dy
      let u = L2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0
      u = Math.max(0, Math.min(1, u))
      const qx = a.x + u * dx
      const qy = a.y + u * dy
      const d = Math.hypot(p.x - qx, p.y - qy)
      if (d < best) best = d
    }
    if (best > worst) worst = best
  }
  return worst
}

const SCALE = 100
const N_LIST = [64, 48, 32, 24, 20, 16, 12, 8]

function table(label, seeds, t, perCount) {
  console.log(`\n${label} · t=${t}s\n`)
  console.log('  N    d 总长   相对 N=64   最大偏差')
  console.log('─'.repeat(48))
  const ref = seeds.map((s) => sampleArc(s, t, SCALE, 64))
  const refTotal = ref.reduce((a, pts) => a + toPath(pts).len, 0)
  for (const N of N_LIST) {
    const arcs = seeds.map((s) => sampleArc(s, t, SCALE, N))
    const total = arcs.reduce((a, pts) => a + toPath(pts).len, 0)
    let worstDev = 0
    for (let i = 0; i < seeds.length; i++) {
      const dev = maxDeviation(ref[i], arcs[i])
      if (dev > worstDev) worstDev = dev
    }
    const rel = ((total - refTotal) / refTotal) * 100
    console.log(
      `${String(N).padStart(3)}  ${String(total).padStart(7)}  ` +
        `${(rel === 0 ? '—' : `${rel.toFixed(0)}%`).padStart(10)}  ${worstDev.toFixed(2).padStart(7)} px`
    )
  }
  return refTotal
}

const orbitTotal = table(`orbit（${RINGS.length} 条弧，最重）`, RINGS, 0.7)
table(`comet（${COMET_RIBBONS.length} 条弧）`, COMET_RIBBONS, 0.2)

console.log('\n参考：弧的屏幕半径 1.3×100 = 130px，周长约 800px。')
console.log(`      N=64 时 orbit 的 6 条弧合计 ${orbitTotal} 字符的 d 字符串，每帧全量重算。`)
console.log('      「最大偏差 < 1px」= 像素层面画出来一样，可以砍。')

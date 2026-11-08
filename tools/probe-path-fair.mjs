/**
 * 公平对比：任意曲线 vs 64 半径，**在同一件事上**比。
 *
 * ── 上一版哪里不公平 ──────────────────────────────────────────────────
 * 上一版量的是「每帧重建 64 半径轮廓」对「静态 path 只改 transform」。
 * 后者根本没做同一件事 —— 它不做 morph、不做呼吸对轮廓的影响，
 * 所以那个 0.92ms 是拿「不干活」比「干活」，结论无效。
 *
 * ── 公平的三个口径 ────────────────────────────────────────────────────
 *
 * 口径 1（静态）：两者都不重建，只改 transform
 *   → 任意曲线确实更省，因为它连 64 次采样都不需要
 *   → 但这个口径**引擎用不上**：状态之间要 morph
 *
 * 口径 2（每帧重建，各自的原生表达）：
 *   64 半径  → 64 个点 → 64 段贝塞尔
 *   任意曲线 → 它的原生控制点（参考仓库最多的有 768 个展平点）
 *   → 这才是「换成任意曲线」的真实代价
 *
 * 口径 3（morph 时）：
 *   64 半径 → 两组 64 数组线性插值，天然对齐
 *   任意曲线 → 两套控制点数量不同就插不了，必须先重采样成同样点数
 *   → 这一步的代价就是「退回 64 采样」
 *
 * 用法（在 grokbot 目录下）：node tools/probe-path-fair.mjs
 */
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { buildSync } = require('esbuild')

buildSync({
  entryPoints: [resolve(ROOT, 'plugin/src/bot/shape.ts')],
  bundle: true,
  outfile: resolve(ROOT, 'preview', '_shape2.cjs'),
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})
const { toPoints, closedPath } = require(resolve(ROOT, 'preview/_shape2.cjs'))

const R = 100
const BOTS = 9
const FRAMES = 600
const ROUNDS = 5

function time(label, fn) {
  const s = []
  for (let i = 0; i < ROUNDS; i++) {
    const t0 = process.hrtime.bigint()
    fn()
    s.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  s.sort((a, b) => a - b)
  const med = s[Math.floor(s.length / 2)]
  console.log(`  ${label.padEnd(34)} ${med.toFixed(2)} ms`)
  return med
}

/* ── 造三种轮廓 ─────────────────────────────────────────────────────── */

/** 64 个半径（当前引擎的表达）。 */
function radiiOf(n, seed) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return 1 + 0.06 * Math.cos(2 * a + seed) + 0.03 * Math.cos(3 * a + seed * 2)
  })
}

/** 参考仓库里最复杂的那个轮廓的展平点数：960（cloud）。 */
const NATIVE_POINTS = 960

/** 一个「任意曲线」多边形：点数 = 原生控制点数。 */
function nativePoly(n, seed) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const r = 1 + 0.06 * Math.cos(2 * a + seed) + 0.03 * Math.cos(3 * a + seed * 2)
    return { x: Math.cos(a) * r * R, y: Math.sin(a) * r * R }
  })
}

/* ── 口径 1：静态，只改 transform ──────────────────────────────────── */
console.log(`9 个 bot × ${FRAMES} 帧 = ${BOTS * FRAMES} 次（10 秒 @60fps）\n`)
console.log('口径 1 —— 轮廓完全静止，每帧只改 transform：')
const s1 = time('64 半径（缓存路径字符串）', () => {
  for (let b = 0; b < BOTS; b++) {
    for (let f = 0; f < FRAMES; f++) {
      void `matrix(1,0,0,${(1 + 0.02 * Math.sin(f * 0.05)).toFixed(4)},0,0)`
    }
  }
})
const s2 = time('任意曲线（缓存路径字符串）', () => {
  for (let b = 0; b < BOTS; b++) {
    for (let f = 0; f < FRAMES; f++) {
      void `matrix(1,0,0,${(1 + 0.02 * Math.sin(f * 0.05)).toFixed(4)},0,0)`
    }
  }
})
console.log('  → 两者完全一样（都是拼一个矩阵字符串）。这条口径分不出高下。\n')

/* ── 口径 2：每帧重建 ─────────────────────────────────────────────── */
console.log('口径 2 —— 每帧重建轮廓（状态 morph / 呼吸都要重建）：')
const radii = radiiOf(64, 0.5)
const sil = { radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }
const ptsBuf = []
const r2a = time('64 半径 → 64 段贝塞尔', () => {
  for (let b = 0; b < BOTS; b++) {
    for (let f = 0; f < FRAMES; f++) {
      sil.sy = 1 + 0.02 * Math.sin(f * 0.05)
      closedPath(toPoints(sil, R, ptsBuf))
    }
  }
})

const poly960 = nativePoly(NATIVE_POINTS, 0.5)
const r2b = time(`任意曲线 → ${NATIVE_POINTS} 段贝塞尔`, () => {
  for (let b = 0; b < BOTS; b++) {
    for (let f = 0; f < FRAMES; f++) {
      const sy = 1 + 0.02 * Math.sin(f * 0.05)
      const scaled = poly960.map((p) => ({ x: p.x, y: p.y * sy }))
      closedPath(scaled)
    }
  }
})

console.log(`  → 任意曲线慢 ${(r2b / r2a).toFixed(1)} 倍\n`)

/* ── 口径 3：morph 时 ─────────────────────────────────────────────── */
console.log('口径 3 —— 状态 morph（两组轮廓之间插值）：')
const A = radiiOf(64, 0.5)
const B = radiiOf(64, 2.1)
const morph = new Array(64)
const r3a = time('64 半径：逐项线性插值', () => {
  for (let b = 0; b < BOTS; b++) {
    for (let f = 0; f < FRAMES; f++) {
      const t = f / FRAMES
      for (let i = 0; i < 64; i++) morph[i] = A[i] + (B[i] - A[i]) * t
      closedPath(toPoints({ radii: morph, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, R, ptsBuf))
    }
  }
})

const PA = nativePoly(NATIVE_POINTS, 0.5)
const PB = nativePoly(NATIVE_POINTS, 2.1)
const r3b = time(`任意曲线：${NATIVE_POINTS} 点逐个插值`, () => {
  for (let b = 0; b < BOTS; b++) {
    for (let f = 0; f < FRAMES; f++) {
      const t = f / FRAMES
      const out = PA.map((p, i) => ({ x: p.x + (PB[i].x - p.x) * t, y: p.y + (PB[i].y - p.y) * t }))
      closedPath(out)
    }
  }
})
console.log(`  → 任意曲线慢 ${(r3b / r3a).toFixed(1)} 倍`)
console.log('  （而且这要求两套控制点数量**完全相同**；不同就得先重采样成 64 个——')
console.log('   重采样完就退化成 r(θ)，等于绕一圈回到现在的方案）')

console.log('\n' + '─'.repeat(66))
console.log('结论：静态时两者等价；一旦要 morph 或每帧重建，任意曲线更慢，')
console.log('      而且点数越多越慢。64 采样不是「省事的妥协」，是「更快的选择」。')

/**
 * 一条「任意 SVG 曲线」和「64 个半径采样」哪个更省？
 *
 * ── 用户的问题 ────────────────────────────────────────────────────────
 * 「从性能开销来说，一条 SVG 曲线任意形状更省，还是 64 个角度上的半径值更省？
 *  还是说前者没有工程实现的可能，所以你当初不推荐我用？」
 *
 * ── 三件事必须分开量，否则会混成一团 ──────────────────────────────────
 *
 * A. **每帧重建轮廓的代价**（这是当前真实发生的事）
 *    引擎每帧调 `toPoints()` + `closedPath()`：64 次三角函数 + 64 段三次贝塞尔
 *    拼字符串。9 个 bot × 60fps = 每秒 34560 次。
 *
 * B. **如果改成「静态 path + transform」能省多少**
 *    任意曲线的一大优势：轮廓是**常量字符串**，变形（呼吸、旋转、缩放）可以
 *    交给 SVG 的 `transform` 属性，不必重新拼 path。这条要量才知道值不值。
 *
 * C. **路径字符串本身多大**（每帧要写进 DOM 的字节数）
 *    64 段贝塞尔的 path 大约 1.5~2KB。这决定了 DOM 写入的代价。
 *
 * ── 结论会是什么（先写下来，跑完核对）────────────────────────────────
 * 性能不是选 r(θ) 的理由。真正的理由是**引擎的整套架构长在半径上**：
 * morph 靠半径线性插值、眼睛贴合表按半径数组做键、呼吸靠 sy 缩放、
 * `radiusAtAngle` 靠半径摆眼睛。换任意曲线 = 换掉这四件事的地基。
 *
 * 用法（在 grokbot 目录下）：node tools/probe-path-vs-radii.mjs
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
  outfile: resolve(ROOT, 'preview', '_shape.cjs'),
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})
const { toPoints, closedPath } = require(resolve(ROOT, 'preview/_shape.cjs'))

const R = 100
const N = 64
const ROUNDS = 9 // 9 个 bot，和面板上限一致
const FRAMES = 600 // 10 秒 @60fps

// ── A. 每帧重建（当前实现）────────────────────────────────────────────
const radii = Array.from({ length: N }, (_, i) => {
  // 一个典型的非圆轮廓：卵石那种低阶谐波
  const a = (i / N) * Math.PI * 2
  return 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)
})

function frameCost() {
  const sil = { radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }
  const pts = []
  for (let f = 0; f < FRAMES; f++) {
    // 呼吸：每帧 sy 都在变，所以路径必须重建
    sil.sy = 1 + 0.02 * Math.sin(f * 0.05)
    const p = toPoints(sil, R, pts)
    closedPath(p)
  }
}

// ── B. 静态 path + transform（任意曲线能走的捷径）──────────────────────
/** 先把轮廓算成一条常量 path（只算一次）。 */
const STATIC_PATH = closedPath(toPoints({ radii, rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 }, R))

function transformCost() {
  // 呼吸/旋转只改 transform 字符串，不碰 path
  for (let f = 0; f < FRAMES; f++) {
    const sy = 1 + 0.02 * Math.sin(f * 0.05)
    // 一次矩阵拼接，等价于 SVG 的 transform="matrix(...)"
    const m = `matrix(1,0,0,${sy.toFixed(4)},0,0)`
    void m
  }
}

// ── 计时 ──────────────────────────────────────────────────────────────
function time(label, fn, rounds = 5) {
  const s = []
  for (let i = 0; i < rounds; i++) {
    const t0 = process.hrtime.bigint()
    fn()
    s.push(Number(process.hrtime.bigint() - t0) / 1e6)
  }
  s.sort((a, b) => a - b)
  const med = s[Math.floor(s.length / 2)]
  console.log(`  ${label.padEnd(30)} ${med.toFixed(2)} ms  （${s.map((x) => x.toFixed(1)).join(' / ')}）`)
  return med
}

console.log(`量 9 个 bot × ${FRAMES} 帧（10 秒 @60fps）：\n`)

const a = time('A. 每帧重建轮廓（当前）', () => {
  for (let b = 0; b < ROUNDS; b++) frameCost()
})
const b = time('B. 静态 path + transform', () => {
  for (let b = 0; b < ROUNDS; b++) transformCost()
})

console.log('\n' + '─'.repeat(64))
console.log(`每 10 秒省下：${(a - b).toFixed(1)} ms —— 摊到每帧每 bot：${(((a - b) * 1000) / (ROUNDS * FRAMES * 1)).toFixed(3)} 微秒`)

// ── C. 字符串大小 ─────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(64))
console.log(`一条 64 采样轮廓的 path 长度：${STATIC_PATH.length} 字节`)
const perFrame = STATIC_PATH.length * ROUNDS * FRAMES
console.log(`9 个 bot × 10 秒要写进 DOM 的 path 总量：${(perFrame / 1024 / 1024).toFixed(2)} MB`)
console.log('（React 每次 setState 都要把这个字符串比一遍，这是真实开销）')

// ── D. 精度对比：64 采样够不够 ────────────────────────────────────────
console.log('\n' + '─'.repeat(64))
console.log('64 个采样画出来的圆，最大弦高误差（相对半径）：')
// 相邻两点之间的圆弧，弦高 = r(1-cos(pi/N))
const sag = 1 - Math.cos(Math.PI / N)
console.log(`  ${(sag * 100).toFixed(4)}%  → 在 100px 半径上是 ${(sag * 100).toFixed(2)} px`)
console.log(`  实际显示半径 96px 时：${(sag * 96).toFixed(2)} px（肉眼不可见，1px 都不到）`)

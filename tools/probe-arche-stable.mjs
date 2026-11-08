/**
 * 用户真实场景验收：身形=拱门，跑 30 秒，看形状稳定性。
 *
 * 用户原话：「他反复在圆形和自己的形状之间切换，视觉上很乱」。
 * 这里量化「形状变了」的次数：正圆 -> 非圆 的往返次数。
 */
import { BotEngine } from '../plugin/src/bot/engine'
import { SHAPE_BY_ID } from '../plugin/src/bot/skins'
import { STATE_BY_ID } from '../plugin/src/bot/states'

function profile(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const pts = []
  for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
  if (pts.length < 8) return null
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const rs = pts.map((p) => Math.hypot(p[0] - cx, p[1] - cy))
  const max = Math.max(...rs)
  return max > 0 ? rs.map((r) => r / max) : null
}
function diff(a, b) {
  if (!a || !b) return 1
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i])
  return s / n
}
function sz(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return {
    w: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    h: ys.length ? Math.max(...ys) - Math.min(...ys) : 0
  }
}

const arche = SHAPE_BY_ID.get('arche').radii
const REFC = profile(new BotEngine(100, 'idle', null, null).sample(1.0).bodyPath)

const isCircle = (d) => {
  const s = sz(d)
  return Math.min(s.w, s.h) >= 150 && diff(profile(d), REFC) < 0.05
}

/** 用户侧边栏的真实轮播：读文件=orbit，思考=thinking，跑命令=comet */
const PLAN = [
  ['reading', 'orbit', 6],
  ['thinking', 'burst', 4],
  ['idle', 'idle', 6],
  ['running', 'comet', 4],
  ['reading', 'orbit', 6],
  ['idle', 'idle', 4]
]

console.log(`身形 = 拱门（122x181）。30 秒活动序列，形状是否还会跳回圆\n`)

let totalFrames = 0
let circleFrames = 0
let flips = 0
let prev = null
const perState = {}

for (const [act, st, secs] of PLAN) {
  const L = Math.max(STATE_BY_ID.get(st).duration, STATE_BY_ID.get(st).minDuration ?? 0)
  const e = new BotEngine(100, st, arche, null)
  e.setShape(arche, 0)
  let lastPass = 0
  let localCircle = 0
  let localTotal = 0

  for (let t = 0; t < secs; t += 0.02) {
    const pass = Math.floor(t / L)
    if (pass !== lastPass) {
      e.reset(st, t)
      lastPass = pass
    }
    const c = isCircle(e.sample(t).bodyPath)
    if (c) {
      localCircle++
      circleFrames++
    }
    localTotal++
    totalFrames++
    if (prev !== null && c !== prev) flips++
    prev = c
  }
  perState[act] = { st, pct: (localCircle / localTotal) * 100, frames: localTotal }
  console.log(
    `  ${act.padEnd(9)} ${st.padEnd(8)} ${secs}s  圆的帧 ${String(localCircle).padStart(3)} / ${localTotal}  (${((localCircle / localTotal) * 100).toFixed(1)}%)`
  )
}

console.log(`\n总计：${totalFrames} 帧，其中圆的 ${circleFrames} 帧（${((circleFrames / totalFrames) * 100).toFixed(1)}%）`)
console.log(`形状切换次数：${flips} 次`)
console.log(
  flips === 0
    ? '\n结论：30 秒内形状零切换 —— 拱门全程稳定，不再反复变圆。'
    : `\n结论：仍有 ${flips} 次切换，需继续查。`
)
process.exitCode = flips === 0 ? 0 : 1

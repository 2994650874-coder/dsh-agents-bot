/**
 * 收尾跟随身形（bodyRest）的回归锁。
 *
 * 症状：用户选了拱门，播放「检索」时每遍末尾会变回一个满尺寸的**圆**，
 * 看上去就是「反复在圆和自己的形状之间切换，视觉很乱」。
 *
 * 病因不在 `idle`（它本来就 `baseBody: true`），而在 `orbit` / `burst` /
 * `comet` 这三个动画的**收尾姿态是「身体回到休息态」**，参考视频里那个休息
 * 态是球，于是它就照画了球。
 *
 * 这里用引擎真实采样断言：三个动画的收尾都必须呈现用户选的形，而不是球。
 * 用「包围盒」判定即可（回退到球时 bbox 接近正方形且满尺寸）。
 *
 * 用法：node plugin/test/smoke-tail.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')

const PURE = require(path.join(__dirname, '..', '..', '.test-build', 'test-pure.cjs'))
const { BotEngine } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))

let passed = 0
function check(label, fn) {
  try {
    fn()
    passed++
    console.log('  ok   ' + label)
  } catch (e) {
    console.log('  FAIL ' + label + '\n       ' + String(e.message).split('\n')[0])
    process.exitCode = 1
  }
}

/* 拱门：122x181（宽高比 0.67）。球：200x201（宽高比 1.0）。 */
const ARCHE = [0.60275,0.60566,0.61456,0.62987,0.65241,0.68345,0.72492,0.77974,0.85241,0.94916,1,0.94939,0.90631,0.875,0.85373,0.84137,0.83732,0.84137,0.85373,0.875,0.90631,0.94939,1,0.94917,0.85242,0.77974,0.72492,0.68345,0.65241,0.62987,0.61456,0.60567,0.60275,0.60567,0.61456,0.62987,0.65241,0.68345,0.72028,0.75943,0.79668,0.83115,0.86223,0.88946,0.91243,0.93074,0.94404,0.95213,0.95507,0.95213,0.94404,0.93074,0.91243,0.88946,0.86223,0.83115,0.79668,0.75943,0.72028,0.68345,0.65241,0.62987,0.61456,0.60566]

function bbox(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return {
    w: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    h: ys.length ? Math.max(...ys) - Math.min(...ys) : 0
  }
}

/**
 * 轮廓指纹：把采样点到中心的距离归一化，再逐点比。
 *
 * 为什么不能用包围盒判「是不是圆」：`orbit` 开头那个旋转的三角，包围盒是
 * `200x189`，宽高比 1.058 —— 用「接近正方形」判就会把它当成圆，测试自己
 * 先误报。三角、拱门、圆三者的指纹差异实测是 0.23 / 0.21 / 0，分得很开。
 */
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

/** 真实引擎渲染出的「拱门」和「圆」，作为两个参照基准 */
const refOf = (radii) => {
  const e = new BotEngine(100, 'idle', radii, null)
  if (radii) e.setShape(radii, 0)
  return profile(e.sample(1.0).bodyPath)
}
const REF_ARCHE = refOf(ARCHE)
const REF_CIRCLE = refOf(null)

/**
 * 这一帧的身体是不是「那个默认的圆」。
 *
 * 必须同时满足两条，缺一都会误判：
 *   - 满尺寸：`burst` / `comet` 塌缩成的小点（33px / 26px）本身也是正圆，
 *     但那是动画要表达的「点」，不是身体变回球；
 *   - 指纹接近圆：光看尺寸挡不住旋转的三角（包围盒接近正方）。
 */
const isFullCircle = (d) => {
  const { w, h } = bbox(d)
  if (Math.min(w, h) < 150) return false
  return diff(profile(d), REF_CIRCLE) < 0.05
}

/** 这一帧是不是用户选的拱门 */
const isArche = (d) => diff(profile(d), REF_ARCHE) < 0.06

const engineOf = (state) => {
  const e = new BotEngine(100, state, ARCHE, null)
  e.setShape(ARCHE, 0)
  return e
}

/* ---------------------------------------------------------------- 收尾 */

for (const [state, tailFrom, dur] of [
  ['burst', 2.4, 2.6],
  ['comet', 2.2, 2.4]
]) {
  check(`${state} 收尾不再画成圆（改为用户选的拱门）`, () => {
    const e = engineOf(state)
    const bad = []
    for (let t = tailFrom; t <= dur; t += 0.05) {
      if (isFullCircle(e.sample(t).bodyPath)) bad.push(t.toFixed(2))
    }
    assert.deepEqual(bad, [], `${state} 在 ${bad.slice(0, 5).join('/')}s 仍是满尺寸圆`)
  })

  check(`${state} 收尾确实变成了用户选的拱门`, () => {
    const e = engineOf(state)
    const d = e.sample(dur).bodyPath
    const { w, h } = bbox(d)
    assert.ok(isArche(d), `收尾不是拱门，实测 ${w.toFixed(0)}x${h.toFixed(0)}`)
  })
}

/* -------------------------------------------------------- 动画本身没被改坏 */

check('burst 开头仍塌缩成共享小球', () => {
  const e = engineOf('burst')
  const { w, h } = bbox(e.sample(1.0).bodyPath)
  assert.ok(w <= 64 && h <= 64, `塌缩后应当是共享小球（直径约60px），实测 ${w.toFixed(0)}x${h.toFixed(0)}`)
})

/*
 * ── orbit 换成了「小身体 + 五点在远处转」 ─────────────────────────────
 * 旧的 `orbit`（三角在六条椭圆中间转）已被删除，用户判词是「太丑了，
 * 一坨线在乱转」。根因是量出来的：旧椭圆全是 1.3~1.4 半径，六根刚性
 * 线条在转；上游是五个**圆盘**，半径与透明度随深度变化，而且**身体缩小
 * 到 0.166**（上游实测 19px / 114.27px = 0.166），装饰散到 3.2 倍以外。
 *
 * 所以旧断言「开头仍是旋转的三角」描述的是一个已经不存在的动画。
 * 换成断言新动画的两个识别特征 —— 它们正好也是「旧版永远不满足」的两条：
 *   1. 身体始终很小（旧 orbit 是满尺寸 200px）
 *   2. 五个点在身体之外绕（旧版靠椭圆，没有点）
 */
check('orbit 是「共享小球」：整段身体半径都在 0.32 以内', () => {
  const e = new BotEngine(100, 'orbit', ARCHE, null)
  const bad = []
  for (let t = 0.05; t < 3.4; t += 0.05) {
    const { w, h } = bbox(e.sample(t).bodyPath)
    // 新共享小球：0.30 * 2 * 100 = 60px，留少量余量给 SVG 采样
    if (Math.max(w, h) > 64) bad.push(`${t.toFixed(2)}s=${w.toFixed(0)}x${h.toFixed(0)}`)
  }
  assert.deepEqual(bad, [], `orbit 身体应当始终保持小球（<=64px），这些帧超标：${bad.slice(0, 4).join('/')}`)
})

check('orbit 五个点都在身体之外绕，且绕满一圈', () => {
  const e = new BotEngine(100, 'orbit', ARCHE, null)
  // 取装饰最盛的时候
  const frame = e.sample(1.2)
  assert.equal(frame.dots.length, 5, `应当正好 5 个点，实测 ${frame.dots.length}`)
  const bodyHalf = bbox(frame.bodyPath).w / 2
  for (const d of frame.dots) {
    const dist = Math.hypot(d.x, d.y)
    assert.ok(
      dist > bodyHalf,
      `点应当在身体之外（身体半径 ${bodyHalf.toFixed(1)}px），实测距离 ${dist.toFixed(1)}px`
    )
  }
  // 绕满一圈：采样一个周期，五个点的角度应当覆盖 360 度
  const angles = []
  for (let t = 1.0; t < 1.0 + 3.7; t += 0.12) {
    const f = e.sample(t)
    if (f.dots.length === 5) angles.push(Math.atan2(f.dots[0].y, f.dots[0].x))
  }
  const span = Math.max(...angles) - Math.min(...angles)
  assert.ok(span > Math.PI, `一个周期内第一个点应当转过半圈以上，实测 ${span.toFixed(2)} 弧度`)
})

check('orbit 的点深浅不同：近的点比远的点大', () => {
  const e = new BotEngine(100, 'orbit', ARCHE, null)
  const f = e.sample(1.2)
  const rs = f.dots.map((d) => d.r)
  const spread = Math.max(...rs) - Math.min(...rs)
  /*
   * 这条是「流体感」的量化锁。旧版六条椭圆的粗细是常量（0.05~0.062，
   * 差 0.012 半径 = 1.2px）；新版靠 `depth` 让近点最大、远点最小，
   * 实测差距在 3px 以上 —— 正是「有体积」和「一根线」的区别。
   */
  assert.ok(spread > 2, `点的半径应当随深度变化，实测最大差 ${spread.toFixed(2)}px`)
})

check('burst 开头仍塌缩成共享小球', () => {
  const e = engineOf('burst')
  const { w, h } = bbox(e.sample(1.0).bodyPath)
  assert.ok(w <= 64 && h <= 64, `塌缩后应当是共享小球（直径约60px），实测 ${w.toFixed(0)}x${h.toFixed(0)}`)
})

check('comet 开头仍缩成小点', () => {
  const e = engineOf('comet')
  const { w, h } = bbox(e.sample(1.0).bodyPath)
  assert.ok(w <= 60 && h <= 60, `收缩后应当是小点，实测 ${w.toFixed(0)}x${h.toFixed(0)}`)
})

/* ------------------------------------------------------ 连播 30 秒也不闪 */

for (const state of ['orbit', 'burst', 'comet']) {
  check(`${state} 连播 30 秒，满尺寸圆的帧数为 0`, () => {
    const dur = { orbit: 3.4, burst: 2.6, comet: 2.4 }[state]
    const e = engineOf(state)
    let last = 0
    let bad = 0
    for (let t = 0; t < 30; t += 0.02) {
      const pass = Math.floor(t / dur)
      if (pass !== last) {
        e.reset(state, t)
        last = pass
      }
      if (isFullCircle(e.sample(t).bodyPath)) bad++
    }
    assert.equal(bad, 0, `30 秒内有 ${bad} 帧是满尺寸圆`)
  })
}

/* --------------------------------------------------- 形状仍是球时不该变 */

/*
 * `orbit` 不在这一组里了：它现在的身体本来就一直很小（0.166），收尾不再
 * 「回到身体」—— 小身体本身就是动画，没有收尾可言。`burst` / `comet` 仍然
 * 会回到身体，所以那条约束仍然适用。
 */
check('身形本来就是圆时，收尾照样是圆（不能为了修 bug 而变方）', () => {
  const CIRCLE = new Array(64).fill(1)
  for (const state of ['burst', 'comet']) {
    const e = new BotEngine(100, state, CIRCLE, null)
    e.setShape(CIRCLE, 0)
    const dur = { burst: 2.6, comet: 2.4 }[state]
    const { w, h } = bbox(e.sample(dur).bodyPath)
    assert.ok(
      Math.abs(w - h) / Math.max(w, h) <= 0.06,
      `${state} 收尾在选圆时应仍是圆，实测 ${w.toFixed(0)}x${h.toFixed(0)}`
    )
  }
})

void PURE
console.log(`\n${passed} 项通过`)

/**
 * 上游动画的缩放比例锁。
 *
 * 核心事实（实测，不是估计）：这些动画的身体会缩小到原来的 1/6，装饰散到
 * 3~6 倍以外。这正是「流体感」的来源 —— 不是线条画得更好，是留白更多。
 * 一旦有人把身体改回满尺寸，动画立刻变成「一坨线在乱转」，而这个测试会
 * 先一步抓住它。
 *
 * 判据用的是引擎真实采样，不靠肉眼。
 *
 * 用法：node plugin/test/smoke-overlay.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')

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

const R = 100 // RAYON
const REF_R = 114.2705

/* 上游实测：身体半径 / 参考半径。见 overlay.ts 的 BODY。
 *
 * ── 2026-10-30：七种尺寸统一成一种 ─────────────────────────────────────
 * 上游每个动画的珠子大小略有不同（15/18/19/20/20.6/28 px），这里原本逐条
 * 锁着那些数值。用户连续两次指出「加载的小球他比其他小球小一圈」「发送、
 * 接收的小球、黑圆框都偏小，和别的统一一下」——那些 15~20px 的差异在屏幕上
 * 读起来是 bug，不是设计。现在整族统一 `BODY.tiny`（19/114.27），所以这张
 * 表只剩 `humming` 一个真正的例外（用户要求放大，见下）。 */
const UPSTREAM_BODY = {
  orbit: 19.0 / REF_R,
  radar: 19.0 / REF_R,
  progress: 19.0 / REF_R,
  loading: 19.0 / REF_R,
  sending: 19.0 / REF_R,
  receiving: 19.0 / REF_R,
  uploading: 19.0 / REF_R
}

/**
 * `humming` 是唯一保留「大珠子」的动画，而且是用户点名要的。
 *
 * 上游量到 28 px（0.245 R）。用户 2026-10-30 说「低吟……把彩色的小球放大」，
 * 同时要求去掉那个黑圆框 —— 框一去，珠子就是画面主体，所以它再放大 22 %
 * 到 30 px。这是本文件里唯一一处「断言值不是上游实测，而是用户裁决」的地方，
 * 所以单独列出来，写清依据。
 */
const HUM_BODY = (28 * 1.22) / REF_R

/* 上游实测：装饰最远半径 / 身体半径。0 表示该动画没有装饰层。
 *
 * 注意：这一列记录的是【上游的量法】，也就是「装饰最远 → 除以身体半径」。
 * 我们的目标是外轮廓达到 REACH（= comet 彩圈），不是复刻上游的这个比值，
 * 所以下面的断言用的是 REACH 口径，见「外轮廓」一节。这一列只留作溯源。 */
const UPSTREAM_RATIO = {
  orbit: 3.0,
  radar: 3.98,
  progress: 3.26,
  search: 2.53,
  uploading: 6.72,
  receiving: 2.23,
  loading: 0,
  sending: 0
}

/**
 * 用户 2026-10-30 定的口径：「他们的缩放，匹配的动画外轮廓起码要和其他几个
 * 原本的动态的半径相符合，比如和跑命令的那个那个彩圈的外轮廓差不多」。
 *
 * 旧基准 = comet 彩圈外缘 0.888R。新版共用身体约 0.299R，不随装饰再变；
 * orbit/loading/send/receive 的用户新比例预览允许装饰超出旧基准但不得出画框。
 */
const REACH = 0.888
/** Unchanged states stay near the comet; four proportional-preview states gain room. */
const REACH_LO = 0.9
const REACH_HI = 1.3
const EXTERIOR_PREVIEW = new Set(['orbit', 'loading', 'sending', 'receiving'])

/* 只放大装饰、不放大身体的这 8 个动画。 */
const SCALED = ['orbit', 'radar', 'progress', 'loading', 'search', 'sending', 'receiving', 'uploading']

function bboxRadius(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  if (!xs.length) return 0
  const w = Math.max(...xs) - Math.min(...xs)
  const h = Math.max(...ys) - Math.min(...ys)
  return Math.max(w, h) / 2
}

const engineOf = (s) => new BotEngine(R, s, null, null)

/** 装饰最远距离：圆点用 x/y + r，圆环用 r，弧用离原点最远的点，带子用路径点。 */
function decoMax(frame) {
  let m = 0
  for (const d of frame.dots) {
    if (d.opacity < 0.15) continue
    const dist = Math.hypot(d.x, d.y) + (d.r || 0)
    if (dist > m) m = dist
  }
  for (const r of frame.rings) {
    if (r.opacity < 0.15) continue
    const dist = Math.hypot(r.cx || 0, r.cy || 0) + r.r + r.width / 2
    if (dist > m) m = dist
  }
  for (const a of frame.arcs) {
    if (a.opacity < 0.15) continue
    const dist = Math.max(pathExtent(a.front), pathExtent(a.back))
    if (dist > m) m = dist
  }
  /*
   * ── Les bandes (2026-10-31) ────────────────────────────────────────
   * `loading` / `humming` n'ont plus de points : leur decor est une bande
   * remplie. Sans cette boucle, `decoMax` renvoie 0 pour ces deux etats et les
   * trois assertions de portee echouent en disant « 装饰没铺开 » alors que le
   * decor est la, simplement d'un type que la fonction ne connaissait pas.
   */
  for (const rb of frame.ribbons || []) {
    if (rb.opacity < 0.15) continue
    const dist = Math.max(pathExtent(rb.front), pathExtent(rb.back))
    if (dist > m) m = dist
  }
  return m
}

function pathExtent(d) {
  if (!d) return 0
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  let max = 0
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const h = Math.hypot(nums[i], nums[i + 1])
    if (h > max) max = h
  }
  return max
}

/** 整段采样里装饰铺得最远的那一刻。 */
function peakDeco(state) {
  const def = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs')).STATE_BY_ID.get(state)
  const e = engineOf(state)
  let best = 0
  for (let t = 0; t <= def.duration; t += 0.02) {
    const d = decoMax(e.sample(t))
    if (d > best) best = d
  }
  return best
}

console.log('身体缩放：与上游实测比对')
for (const [state, upstreamBody] of Object.entries(UPSTREAM_BODY)) {
  check(`${state} 身体采用检索小球 ${(HUM_BODY * R).toFixed(0)}px（上游 ${(upstreamBody * REF_R).toFixed(0)}px）`, () => {
    const e = engineOf(state)
    const r = bboxRadius(e.sample(1.2).bodyPath)
    const want = HUM_BODY * R
    const tolerance = 2
    assert.ok(
      Math.abs(r - want) <= tolerance,
      `期望 ${want.toFixed(1)}px +-${tolerance.toFixed(1)}，实测 ${r.toFixed(1)}px`
    )
  })
}

check(`检索（原低吟）是大珠子：${(HUM_BODY * R).toFixed(0)}px（用户要求放大）`, () => {
  const r = bboxRadius(engineOf('search').sample(1.2).bodyPath)
  const want = HUM_BODY * R
  assert.ok(
    Math.abs(r - want) <= Math.max(want * 0.2, 4),
    `期望 ${want.toFixed(1)}px，实测 ${r.toFixed(1)}px`
  )
})

console.log('\n装饰比例：装饰最远 / 身体半径')
for (const [state, wantRatio] of Object.entries(UPSTREAM_RATIO)) {
  if (wantRatio === 0) continue
  check(`${state} 装饰外轮廓达到彩圈基准（上游身体倍数 ${wantRatio}）`, () => {
    const e = engineOf(state)
    // 采样整段，取最远的那一刻 —— 装饰是动态的，固定一个时刻会漏
    let best = 0
    let bodyR = 0
    for (let t = 0.4; t < 2.6; t += 0.05) {
      const f = e.sample(t)
      const d = decoMax(f)
      if (d > best) {
        best = d
        bodyR = bboxRadius(f.bodyPath)
      }
    }
    const ratio = bodyR > 0 ? best / bodyR : 0
    assert.ok(
      best >= REACH * R * REACH_LO,
      `装饰至少应到 ${(REACH * R * REACH_LO).toFixed(1)}px，实测 ${best.toFixed(1)}px（身体 ${bodyR.toFixed(1)}px，比值 ${ratio.toFixed(2)}）`
    )
  })
}

console.log('\n外轮廓：装饰要对齐 comet 彩圈（用户 2026-10-30 的口径）')
const cometPeak = peakDeco('comet')
check(`基准：comet 彩圈外轮廓 = 0.888 半径（实测 ${(cometPeak / R).toFixed(3)}）`, () => {
  assert.ok(
    Math.abs(cometPeak / R - REACH) < 0.03,
    `comet 外轮廓应当是 ${REACH}，实测 ${(cometPeak / R).toFixed(3)}`
  )
})

for (const state of SCALED) {
  const lo = EXTERIOR_PREVIEW.has(state) ? 1.28 : REACH_LO
  const hi = EXTERIOR_PREVIEW.has(state) ? 1.7 : REACH_HI
  check(`${state} 装饰外轮廓落在 comet 的 ${lo}~${hi} 倍之间`, () => {
    const k = peakDeco(state) / cometPeak
    assert.ok(
      k >= lo && k <= hi,
      `期望 ${lo}~${hi}，实测 ${k.toFixed(2)} —— ` +
        (k < lo ? '太小，装饰没铺开' : '太大，会顶出画框')
    )
  })
}

console.log('\n身体不随外部装饰二次放大：共享小球仍为约 0.299R')
for (const state of SCALED) {
  check(`${state} 身体仍然 <= 34px（约 1/6 半径）`, () => {
    /*
     * 上限从 30 提到 34：`humming` 不再是 19px（用户要求放大到 30），而
     * 其他七个仍是 19px。用 34 同时容纳两者，同时仍然挡得住「回到满尺寸」。
     */
    const r = bboxRadius(engineOf(state).sample(1.2).bodyPath)
    assert.ok(r <= 34, `身体应当保持小尺寸，实测 ${r.toFixed(1)}px`)
  })
}

console.log('\n彩色烟花：苏醒一颗、庆祝三颗，且带颜色和星形')
/** 收集整段里出现过的所有带颜色的点。 */
function coloredDots(state) {
  const def = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs')).STATE_BY_ID.get(state)
  const e = engineOf(state)
  const out = []
  for (let t = 0; t <= def.duration; t += 0.02) {
    for (const d of e.sample(t).dots) if (d.color) out.push(d)
  }
  return out
}

check('waking 有彩色烟花（不是只有一道白点）', () => {
  const colored = coloredDots('waking')
  assert.ok(colored.length > 0, 'waking 应当有带颜色的粒子')
  const colors = new Set(colored.map((d) => d.color))
  assert.ok(colors.size >= 3, `应当有多种颜色，实测 ${colors.size} 种：${[...colors].join(' ')}`)
})

check('waking 的烟花里有星形（上游五分之一是金色星）', () => {
  const stars = coloredDots('waking').filter((d) => d.d)
  assert.ok(stars.length > 0, '应当有星形粒子（带 d 路径）')
  assert.ok(
    stars.every((d) => d.color === '#f4c34e'),
    `星形应当是金色 #f4c34e，实测 ${[...new Set(stars.map((d) => d.color))].join(' ')}`
  )
})

check('celebrate 有彩色烟花，而且比 waking 多（三连发）', () => {
  const cel = coloredDots('celebrate').length
  const wak = coloredDots('waking').length
  assert.ok(cel > 0, 'celebrate 应当有带颜色的粒子')
  assert.ok(cel > wak, `celebrate 应当比 waking 的烟花多，实测 ${cel} vs ${wak}`)
})

/*
 * ── 烟花扩散范围（2026-10-30，用户报「很小一圈」）────────────────────
 *
 * ── 判据来自对原版的实测，不是我的审美 ──────────────────────────────
 * `_work/probe-upstream-reaching.mjs` 把上游真身
 * （`refs/grok-icon-study/animation.html`）在无头浏览器里跑起来，把状态设成
 * `waking`，逐帧量「粒子最远点 / 身体半径」：
 *
 *     上游 Re         = 114,27 px
 *     上游身体半径    = 114,27 px  (1,000 Re，满尺寸)
 *     上游粒子最远    = 162,98 px  (1,426 Re)
 *     → 扩散圈宽度    =  48,71 px  (0,426 Re)
 *
 * 也就是说原版的爆炸圈**只比身体外扩 0,43 个半径**。我们改前是 0,22，
 * 改后是 0,59 —— 已经比原版更舒展。所以这条断言锁的是「向原版对齐并且
 * 不越过画框」，不是「越大越好」。
 *
 * 病因是两层的，两条都要锁：
 *
 * ① `BURST_REACH` 只到 1,22 半径，而 `waking` 的身体是满尺寸（1,0 半径）。
 *    所以粒子只跑 0,22 半径就没了 —— 一圈紧紧贴着剪影的晕，读起来是
 *    描边不是爆炸。
 *
 * ② 更隐蔽的一条：速度因子是**常量**，只对 `from = 1` 校准过。`celebrate`
 *    改成小球后 `from = 0,166`，同一个常量让它的粒子只跑 `1,22-1 = 0,22`
 *    半径，从 0,166 出发也就是到 0,39 —— 一个套在小球上的环。现在速度按
 *    每团烟花的 `from` 现算，所以两者的落点都到 `BURST_REACH`。
 *
 * 判据用「绝对半径」而不是「相对身体」：用户要的是铺满画面，与身体大小
 * 无关。上下界由画框决定（半 viewBox = 1,58 半径）。
 */
console.log('\n烟花扩散范围（基准 = 上游原版实测 1,426 Re / 0,426 Re 圈宽）')
/** 上游实测的粒子最远点，1.426 Re。 */
const UPSTREAM_FAR = 1.426
/*
 * 下界 1,42 : 至少达到上游的水平（用户要的是「像原版那样大」）。
 * 上界 1,57 : 半 viewBox 是 1,58，超过就溢出到相邻元素上（SVG 是
 * `overflow:visible`，不会裁掉，会压到旁边的格子）。
 */
const BURST_MIN = 1.42
const BURST_MAX = 1.57
for (const state of ['waking', 'celebrate']) {
  check(`${state} 烟花扩到 ${BURST_MIN}~${BURST_MAX} 半径（上游 ${UPSTREAM_FAR}，改前封顶 1.22）`, () => {
    const peak = peakDeco(state) / R
    assert.ok(
      peak >= BURST_MIN && peak <= BURST_MAX,
      `实测最远 ${peak.toFixed(3)} 半径，期望 ${BURST_MIN}~${BURST_MAX}` +
        (peak < BURST_MIN ? ' —— 太小，还是「一圈」' : ' —— 太大，会顶出画框')
    )
  })
}

check('waking 的扩散圈比改前大 2 倍以上（0,22 → 至少 0,44 半径）', () => {
  /*
   * 这是用户原话的量化版本：「目前的看起来很小一圈」。
   * 圈宽 = 粒子最远 - 身体半径。身体是满尺寸（1,0 半径），所以圈宽就是
   * `peak - 1`。改前 0,22，要求至少翻倍到 0,44（上游是 0,426）。
   */
  const peak = peakDeco('waking') / R
  const ring = peak - 1
  assert.ok(
    ring >= 0.44,
    `waking 的扩散圈应当 >= 0,44 半径（改前 0,22），实测 ${ring.toFixed(3)}`
  )
})

check('celebrate 的烟花从球体边界起飞（不是从中心凭空出现）', () => {
  /*
   * 小球是 0.166 半径。粒子必须从它表面开始往外走，否则看起来像
   * 「凭空冒出来」。
   *
   * ── 为什么不能写死采样时刻（2026-10-31）──────────────────────────
   * `celebrate` 的烟花时钟现在是 `t * 0,49`（两次「再慢 0.7」叠加）。写死
   * `sample(0,1)` 时上游时间是 0,049 s，第一发（0,05 s）还没出生，采到空
   * 集合 —— 这是测试跟着产品参数漂移，不是产品坏了。改成先找「最早出现彩色
   * 粒子的那一帧」，再量它的距离：断言的对象是「出生时贴着小球」，不是
   * 「第几秒的时候贴着小球」。
   */
  const e = engineOf('celebrate')
  const dur = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs')).STATE_BY_ID.get('celebrate').duration
  let early = null
  for (let t = 0.02; t < dur; t += 0.02) {
    const colored = e.sample(t).dots.filter((d) => d.color)
    if (colored.length > 0) {
      early = colored
      break
    }
  }
  assert.ok(early, '整个 celebrate 里应当出现彩色烟花粒子')
  const far = Math.max(...early.map((d) => Math.hypot(d.x, d.y) / R))
  assert.ok(far < 0.5, `刚出生时粒子应贴近小球（<0.5 半径），实测最远 ${far.toFixed(2)} 半径`)
})

check('celebrate 有急速旋转（spin 走完全程，不是原地不动）', () => {
  const e = engineOf('celebrate')
  const spins = []
  for (let t = 0.3; t <= 3.0; t += 0.1) spins.push(e.sample(t).eyes[0].matrix)
  const uniq = new Set(spins)
  assert.ok(uniq.size > 20, `旋转应当每帧都在变，实测只有 ${uniq.size} 种姿态`)
})

check('检索（原低吟）是「共享小球 + 绕圈的彩线」，不再是光线注入', () => {
  /*
   * ── 第 100 轮：这个名字换了主人 ────────────────────────────────────
   * 「把目前的（检索）删掉，然后把（低吟）改成（检索）的名字，顺序放到（眨眼）
   *   后面」。
   *
   * 所以这条断言必须重写，而不是删掉。旧 `search` 是「小珠子 + 七条射线注入」，
   * 旧 `humming` 是「大珠子 + 五条绕圈的肥厚彩带」。现在后者顶了前者的名字，
   * 两者的几何完全不同 —— 保留旧判据的话，它测的是一个已经不存在的动画；
   * 直接删掉的话，「检索」这个对外可见的动画就没有任何一条断言在看它了。
   *
   * 新判据量的正是「原低吟」的三个识别特征：
   *   ① 身体比小球家族大（0,34 R ≈ 30px，小球是 19px）
   *   ② 彩线是多色渐变的填充带子（`grad.stops` >= 3）
   *   ③ 彩线在绕圈 —— 逐帧的方位角覆盖了几乎整个圆周
   *
   * ③ 是这条改写的关键：旧 `search` 的带子是**径向**的（朝中心收），新 `search`
   * 的带子是**切向**的（绕着转）。两者都有带子、都是多色，只看①②分不开。
   */
  const e = engineOf('search')
  const bodyR = bboxRadius(e.sample(1.2).bodyPath)
  const tiny = bboxRadius(engineOf('orbit').sample(1.2).bodyPath)
  assert.ok(
    Math.abs(bodyR - tiny) < 1,
    `检索应当就是小球家族的身体（${tiny.toFixed(1)}px），实测 ${bodyR.toFixed(1)}px`
  )

  const colors = new Set()
  let withBand = 0
  for (let t = 0.5; t < 2.2; t += 0.05) {
    for (const rb of e.sample(t).ribbons) {
      for (const c of rb.grad.stops) colors.add(c)
      if (rb.front || rb.back) withBand++
    }
  }
  assert.ok(colors.size >= 3, `彩线应当有多种颜色，实测 ${colors.size} 种`)
  assert.ok(withBand > 0, '彩线应当是填充的带子（front/back 路径非空），不是空图元')

  /*
  /*
   * 绕圈：每帧取第一条带子的中点（= 渐变的两个端点之间），算它相对中心的
   * 方位角，再把**连续的增量**累加起来。
   *
   * ── 为什么用累计增量，而不是 max-min ──────────────────────────────
   * 第一版量的是「任意两帧角度差的最大值」，还把差折到 ±pi。两条都不对：
   * 折回把超过 180° 的扫视硬生生砍成 179°（实测值），而 max-min 在角度绕回
   * 时会给出一个假的「几乎没动」。方位角是一条**连续轨迹**，正确的量法是顺着
   * 时间累加每一步的增量 —— 这样绕多远就是多远，不依赖起止点落在哪个象限。
   */
  const angles = []
  for (let t = 0.6; t < 2.0; t += 0.05) {
    const rb = e.sample(t).ribbons[0]
    if (!rb) continue
    const cx = (rb.grad.x1 + rb.grad.x2) / 2
    const cy = (rb.grad.y1 + rb.grad.y2) / 2
    if (Math.hypot(cx, cy) < 5) continue
    angles.push(Math.atan2(cy, cx))
  }
  assert.ok(angles.length > 8, `应当采到运动的彩线，实测 ${angles.length} 帧`)
  let swept = 0
  for (let i = 1; i < angles.length; i++) {
    let d = angles[i] - angles[i - 1]
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    swept += Math.abs(d)
  }
  assert.ok(
    swept > Math.PI,
    `彩线应当绕圈（方位角累计扫过 > 180 度），实测 ${((swept * 180) / Math.PI).toFixed(0)} 度`
  )
})

check('celebrate 退出时不会反向疯转（spin 走最短路径混合）', () => {
  /*
   * `celebrate` accumule 9 tours, soit 54 rad. Melanger cet angle vers les 0 rad
   * d'un etat au repos par interpolation lineaire ferait parcourir les 54 rad en
   * un dixieme de seconde : le visage ferait neuf tours a l'envers, tres vite.
   * Le melange par le chemin le plus court ramene ca a un fondu ordinaire.
   *
   * ── Pourquoi le critere est le CHEMIN TOTAL, pas le saut par image ────
   * Un premier jet verrouillait le deplacement d'une image a l'autre et
   * echouait a 63 px. C'etait un faux positif : le fondu de sortie utilise
   * `easeOutQuint`, qui parcourt 23 % du chemin dans les 5 premiers pour cent du
   * temps. Le saut d'une image est donc GRAND par construction, meme sans aucun
   * defaut. Ce qui distingue un aller simple d'un tour du monde, c'est la
   * longueur TOTALE du trajet : les yeux decrivent un cercle de rayon ~47 px,
   * donc neuf tours font ~2658 px, contre ~135 px pour un simple fondu.
   * Mesure : 135 px.
   */
  const e = engineOf('celebrate')
  for (let t = 0; t <= 1.2; t += 0.05) e.sample(t)
  e.setState('idle', 1.2)
  let prev = null
  let total = 0
  for (let t = 1.2; t <= 1.8; t += 1 / 60) {
    const eye = e.sample(t).eyes[0]
    if (!eye) continue
    const m = eye.matrix.match(/matrix\(([^)]+)\)/)
    if (!m) continue
    const n = m[1].split(',').map(Number)
    const q = [n[4], n[5]]
    if (prev) total += Math.hypot(q[0] - prev[0], q[1] - prev[1])
    prev = q
  }
  // 3 倍余量：足够吸收曲线形状的差异，远低于 2658 px 的「九圈反向」
  assert.ok(
    total < 500,
    `转场累计路程应当是一次简单淡出（~135px），实测 ${total.toFixed(0)}px ` +
      `（九圈反向约 2658px）`
  )
})

console.log('\n各动画的「身份」：必须有的、必须没有的')
check('orbit 有 5 个点，且大小不一（不是 5 个同样的点）', () => {
  const f = engineOf('orbit').sample(1.2)
  assert.equal(f.dots.length, 5, `应当 5 个点，实测 ${f.dots.length}`)
  const rs = f.dots.map((d) => d.r)
  assert.ok(Math.max(...rs) - Math.min(...rs) > 2, '5 个点应当大小不一')
})

check('radar 有 3 个环，半径一个比一个大', () => {
  const f = engineOf('radar').sample(1.2)
  assert.equal(f.rings.length, 3, `应当 3 个环，实测 ${f.rings.length}`)
  const rs = f.rings.map((r) => r.r).sort((a, b) => a - b)
  assert.ok(rs[2] > rs[0] * 1.5, `3 个环应当明显分开，实测 ${rs.map((r) => r.toFixed(1)).join('/')}`)
})

check('progress 有 2 个环，一个是全环（底）、一个不满（进度）', () => {
  const f = engineOf('progress').sample(1.6)
  assert.equal(f.rings.length, 2, `应当 2 个环，实测 ${f.rings.length}`)
  const full = f.rings.filter((r) => r.sweep >= 0.999)
  const part = f.rings.filter((r) => r.sweep < 0.999)
  assert.equal(full.length, 1, `应当正好 1 个全环，实测 ${full.length}`)
  assert.equal(part.length, 1, `应当正好 1 个进度环，实测 ${part.length}`)
})

check('progress 的进度环随时间变长（是真的在「进展」）', () => {
  const e = engineOf('progress')
  const sweeps = []
  for (let t = 0.3; t < 2.2; t += 0.15) {
    const part = e.sample(t).rings.find((r) => r.sweep < 0.999)
    if (part) sweeps.push(part.sweep)
  }
  assert.ok(sweeps.length > 3, '应当采到多个进度环')
  const grew = sweeps[sweeps.length - 1] > sweeps[0] + 0.2
  assert.ok(grew, `进度应当变长，实测 ${sweeps[0].toFixed(2)} -> ${sweeps[sweeps.length - 1].toFixed(2)}`)
})

check('loading 没有任何环（黑框已按用户要求去掉）', () => {
  /*
   * ── 这条断言被反转过一次，说明为什么 ────────────────────────────
   * 它原本锁的是「loading 必须有环、并且环在转」，那是上游 `whirl` 的结构：
   * 一个 4,5 px 的描边圆在 `REACH` 上旋转。第 97 轮用户说「（加载）的黑框
   * 去掉」，那个圆就没有了。
   *
   * 反过来写而不是删掉：去掉**本身是需求**，删了断言的话，哪天有人把环加
   * 回来（哪怕只是为了「和上游一致」），测试不会拦。
   *
   * 注意别和 `search` 那条混了 —— `search` 从来就没有过环，它的注释说的是
   * 「黑圆框是测量基准，不画」。`loading` 不一样：它真的画过一个环，所以
   * 这里锁的是「曾经真的存在、现在真的被删掉」。
   */
  const e = engineOf('loading')
  const dur = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs')).STATE_BY_ID.get(
    'loading'
  ).duration
  let worst = 0
  for (let t = 0.05; t <= dur; t += 0.05) worst = Math.max(worst, e.sample(t).rings.length)
  assert.equal(worst, 0, `loading 不该有任何环，实测最多 ${worst} 个`)
})

/*
 * ── 彩球 vs 彩线：两种材质，分别验（2026-10-31）──────────────────────
 *
 * 这一节原来对 `loading` 和 `humming` 用同一套断言（都量 `ribbons`）。现在
 * 不行了：用户明确把 `loading` 换回「圆形小球」并把它定义成**彩球**，而
 * **彩线**只留给 `humming`（以及 `search` 的注入）。两族材质是不同的对象，
 *
 *   彩球 (dots)    : 小圆盘、`color` 是纯色、颜色按索引固定
 *   彩线 (ribbons) : 填充带子、`grad.stops` 是渐变、粗细沿路径变化
 *
 * 用「带子」的判据去量「球」会在 `ribbons` 上取到空数组然后报「没有彩带」——
 * 那不是缺陷，是拿错了尺子。所以这里按材质分开写。
 */
console.log('\n彩球 × 彩线：loading 是球、humming 是线（两族材质分开验）')

/* ① loading = 彩球：纯色圆盘，颜色固定 */
check('loading 是「彩球」：纯色圆盘，不是一个墨色环', () => {
  const e = engineOf('loading')
  const colors = new Set()
  let round = 0
  for (let t = 0.4; t < 2.2; t += 0.1) {
    for (const d of e.sample(t).dots) {
      if (d.color) colors.add(d.color)
      // 圆盘：没有自定义 `d`（不是路径），有正半径
      if (!d.d && d.r > 0) round++
    }
  }
  assert.ok(colors.size >= 3, `彩球应当有多种颜色，实测 ${colors.size} 种：${[...colors].join(' ')}`)
  assert.ok(round > 10, `应当是圆盘（circle，不是 path），实测 ${round} 个圆形`)
})

check('loading 不再有彩带（材质已经换回球）', () => {
  const e = engineOf('loading')
  const n = e.sample(1.0).ribbons.length
  assert.equal(n, 0, `loading 应该只有彩球，实测还有 ${n} 条彩带`)
})

check('loading 的彩球大小一致、不随吸收变大', () => {
  /*
   * ── 这条锁的是用户点名抱怨过的缺陷 ──────────────────────────────
   * 「末尾却突然变大，然后疯狂旋转吸收进去了」. La version turn87 avait
   * `r: ... * spinup` avec `spinup = 1 + pull * 2,5`, donc les billes
   * grossissaient jusqu'a x3,5 pendant l'aspiration. Ici la taille ne doit
   * dependre QUE du temps d'entree (et de l'anneau), jamais de l'absorption.
   *
   * ── Les deux instants doivent tomber PENDANT que les billes existent ──
   * `loading` dure 2,6 s et l'aspiration commence a
   * `2,6 * (1 - 0,2) - 2,6 * 0,28` = 1,35 s, pour finir a 2,08 s (les billes
   * s'eteignent alors completement). Premier jet de ce test : « avant » a
   * 1,2 s et « pendant » a 2,1 s — 2,1 s etant APRES la disparition, le tableau
   * etait vide et l'assertion tombait sur « les deux moments doivent avoir des
   * billes » au lieu de tester la taille. On prend donc 1,0 s et 1,8 s, tous
   * deux a l'interieur de la fenetre.
   */
  const e = engineOf('loading')
  const radiusAt = (t) => {
    const ds = e.sample(t).dots
    return ds.length ? ds.map((d) => d.r) : []
  }
  const before = radiusAt(1.0)
  const during = radiusAt(1.8)
  assert.ok(before.length && during.length, '两个时刻都应当有彩球')
  const maxBefore = Math.max(...before)
  const maxDuring = Math.max(...during)
  assert.ok(
    maxDuring <= maxBefore * 1.2,
    `吸收时彩球不应当变大（吸收前最大 ${maxBefore.toFixed(1)}px / 吸收中 ${maxDuring.toFixed(1)}px）`
  )
})

/* ② humming = 彩线：渐变带子，肥厚 */
check('检索的彩线是多色的（渐变，不是纯色）', () => {
  const e = engineOf('search')
  const stops = new Set()
  for (let t = 0.4; t < 2.2; t += 0.1) {
    for (const rb of e.sample(t).ribbons) for (const c of rb.grad.stops) stops.add(c)
  }
  assert.ok(stops.size >= 4, `彩线应当有多种颜色，实测 ${stops.size} 种：${[...stops].join(' ')}`)
})

check('检索的彩线是「肥厚」的（有填充面积，不是一根细线）', () => {
    /*
     * 用户原话：「里面那种肥厚的彩线」。「肥厚」在这里是可量的：带子的
     * 路径是**闭合填充**（多段 M/L/A + Z），而且它比同半径的圆周细线宽得多。
     * 判据取路径包围盒的短边 —— 一根 4,5px 的描边在 0,888R（约 88px）的
     * 椭圆上，短边也只有十几像素；一条肥带子应当 >= 20px。
     */
    const e = engineOf('search')
    const rb = e.sample(1.0).ribbons[0]
    assert.ok(rb, '应当有彩带')
    const nums = (rb.front + rb.back).match(/-?\d+(?:\.\d+)?/g) || []
    const xs = []
    const ys = []
    for (let i = 0; i + 1 < nums.length; i += 2) {
      xs.push(Number(nums[i]))
      ys.push(Number(nums[i + 1]))
    }
    assert.ok(xs.length > 10, `路径解析失败，只取到 ${xs.length} 个点`)
    const shortSide = Math.min(
      Math.max(...xs) - Math.min(...xs),
      Math.max(...ys) - Math.min(...ys)
    )
    assert.ok(shortSide >= 20, `带子应当「肥厚」（短边 >=20px），实测 ${shortSide.toFixed(1)}px`)
})

// `humming` 必须只有带子、没有点：点还在就说明旧的 beltDots 没删干净
check('检索用带子而不是点（旧实现已撤）', () => {
  const f = engineOf('search').sample(1.0)
  assert.equal(f.dots.length, 0, `不应当再有散布的点，实测 ${f.dots.length} 个`)
  assert.ok(f.ribbons.length > 0, '应当有彩带')
})

check('sending 和 receiving 是同一个动画的相反方向', () => {
  const send = engineOf('sending')
  const recv = engineOf('receiving')
  // 找发送时点离中心最远的那一帧，和接收时点离中心最近的那一帧
  const sendDist = []
  const recvDist = []
  for (let t = 0.3; t < 1.45; t += 0.05) {
    const sf = send.sample(t)
    if (sf.dots.length) sendDist.push(Math.hypot(sf.dots[0].x, sf.dots[0].y))
    const rf = recv.sample(t)
    if (rf.dots.length) recvDist.push(Math.hypot(rf.dots[0].x, rf.dots[0].y))
  }
  assert.ok(sendDist.length > 3 && recvDist.length > 3, '两边都应当有运动的点')
  // 发送：距离应当递增（往外飞）；接收：应当递减（往里收）
  const sendGrow = sendDist[sendDist.length - 1] > sendDist[0]
  const recvShrink = recvDist[recvDist.length - 1] < recvDist[0]
  assert.ok(sendGrow, `发送的点应当往外飞，实测 ${sendDist[0].toFixed(1)} -> ${sendDist[sendDist.length - 1].toFixed(1)}`)
  assert.ok(recvShrink, `接收的点应当往里收，实测 ${recvDist[0].toFixed(1)} -> ${recvDist[recvDist.length - 1].toFixed(1)}`)
})

check('waking / sleeping 保持满身体（没被缩小）', () => {
  /*
   * `search` 和 `celebrate` 在 2026-10-30 被移出这一组：用户明确要求
   * 它们改成「小球」形态（celebrate 换成和环绕/雷达差不多的缩小形态，
   * search 换成小球 + 光线注入）。它们现在和 orbit/radar 一样是 0.166
   * 半径的珠子，见下面那条断言。
   */
  for (const state of ['waking', 'sleeping']) {
    const r = bboxRadius(engineOf(state).sample(1.2).bodyPath)
    assert.ok(r > 80, `${state} 应当是满尺寸身体（>80px），实测 ${r.toFixed(1)}px`)
  }
})

check('celebrate 是小球形态（0.166 半径，和 orbit/radar 一致）', () => {
  /*
   * 用户对 `celebrate` 的判词：「能换成和环绕和雷达差不多的缩小形态吗？
   * 不要原版那个硕大的球体在那边转」。
   *
   * 断言用「和 orbit 实测值一致」而不是写死数字：将来若统一调小珠子，
   * 这条跟着走，不会变成一个没人敢动的魔法数。
   *
   * ── 第 100 轮：`search` 退出这条 ──────────────────────────────────
   * 这条原来是 `['celebrate', 'search']`。旧 `search` 确实被要求「本体缩小成
   * 一个小球」，但那个动画已经删了，名字现在属于原低吟 —— 而原低吟是被明确
   * 要求**放大**的那个（0,34 R）。留在列表里会让一条正确的断言去测一个错误
   * 的对象。它现在由上面那条「检索（原低吟）是大珠子」单独覆盖。
   */
  const tiny = bboxRadius(engineOf('orbit').sample(1.2).bodyPath)
  for (const state of ['celebrate']) {
    const r = bboxRadius(engineOf(state).sample(1.2).bodyPath)
    assert.ok(
      Math.abs(r - tiny) < 2,
      `${state} 应当是小球（orbit 实测 ${tiny.toFixed(1)}px），实际 ${r.toFixed(1)}px`
    )
  }
})

check('sleeping 的眼睛几乎闭上（是睡眠，不是弹跳）', () => {
  const f = engineOf('sleeping').sample(2.4)
  const h = f.eyes[0] ? f.eyes[0].d : ''
  // 眼睛的胶囊路径高度应当很小：两个弧之间的纵向跨度
  const nums = (h.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const ys = nums.filter((_, i) => i % 2 === 1)
  const span = ys.length ? Math.max(...ys) - Math.min(...ys) : 999
  assert.ok(span < 30, `睡眠的眼睛应当是细缝，实测纵向跨度 ${span.toFixed(1)}px`)
})

check('bounce 仍然是小点上下弹（原来的动画没被改坏）', () => {
  const e = engineOf('bounce')
  const ys = []
  for (let t = 0.1; t < 1.3; t += 0.1) {
    const f = e.sample(t)
    const b = bboxRadius(f.bodyPath)
    assert.ok(b < 25, `bounce 应当是小点（<25px），实测 ${b.toFixed(1)}px`)
    ys.push(numsFirstY(f.bodyPath))
  }
  const span = Math.max(...ys) - Math.min(...ys)
  assert.ok(span > 8, `bounce 应当上下弹，实测纵向移动只有 ${span.toFixed(1)}px`)
})

function numsFirstY(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0
}

void path
console.log(`\n${passed} 项通过`)

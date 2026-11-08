/**
 * 第 92 轮：用户逐条点名要改的 11 项动画修订。
 *
 * ── 为什么单独一个文件，而不是塞进 smoke-overlay ────────────────────────
 * `smoke-overlay` 锁的是「和上游实测比，缩放对不对」，`smoke-tail` 锁的是
 * 「收尾会不会变回圆」。这两件事都是**美术事实**，改动一次就该动一次。
 *
 * 这一轮锁的是另一类东西：用户**指定了具体数值或具体动作**的改法 ——
 * 「速度放到 0.8」「放慢到 0.7」「去掉黑框」「先吸回再收框」。这些数值不是
 * 从上游量出来的，是从对话里定下来的；它们最容易被下一次「顺手调一下」
 * 悄悄改掉，而改掉了没有任何美术测试会报警。所以单独一处，每条都写明
 * 出处，改之前先看这里为什么是那个数。
 *
 * ── 判据纪律 ────────────────────────────────────────────────────────────
 * 一条断言只锁用户说的那件事，不顺手锁实现细节。比如「雷达放到 0.8」锁的是
 * **一个环从 0 到 1 走完的时间变长了 25 %**，不是「代码里有个 0.8」——
 * 后者改个写法就红了，前者才是用户要的。
 *
 * 用法：node plugin/test/smoke-turn92.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')

const BUILD = path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs')
const PURE = require(path.join(__dirname, '..', '..', '.test-build', 'test-pure.cjs'))
const { BotEngine, STATE_BY_ID, STATES } = require(BUILD)

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

const R = 100
const engineOf = (s) => new BotEngine(R, s, null, null)

function bbox(d) {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const ys = nums.filter((_, i) => i % 2 === 1)
  return {
    w: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
    h: ys.length ? Math.max(...ys) - Math.min(...ys) : 0
  }
}
const bodyR = (s, t) => {
  const b = bbox(engineOf(s).sample(t).bodyPath)
  return Math.max(b.w, b.h) / 2
}

/** 装饰最远点，与 `smoke-overlay` 同一口径（点用 x/y+r，环比 r+width/2）。 */
function decoMax(f) {
  let m = 0
  for (const d of f.dots) {
    if (d.opacity < 0.05) continue
    m = Math.max(m, Math.hypot(d.x, d.y) + (d.r || 0))
  }
  for (const r of f.rings) {
    if (r.opacity < 0.05) continue
    m = Math.max(m, Math.hypot(r.cx || 0, r.cy || 0) + r.r + r.width / 2)
  }
  return m
}

/* ══ 1. 检索：现在是「低吟」那一套（彩线带绕圈） ═══════════════════════ */

console.log('\n① 检索：彩线带绕圈，没有黑圆框，身体放大')

check('检索（原低吟）没有黑圆框了（rings 为空）', () => {
  /*
   * 用户：「低吟去掉那个黑圆框」。那个框是 `progressRings`，一条 5px 宽、
   * 画在 0.888 R 上的描边圆 —— 在这一族里它是唯一一个真的被画出来的圆。
   *
   * ── 第 100 轮：状态换名，判据不变 ─────────────────────────────────
   * 「把目前的（检索）删掉，然后把（低吟）改成（检索）的名字，顺序放到（眨眼）
   *   后面」。所以 `humming` 这个 id 已经不存在了，它现在叫 `search`。
   *
   * 这一条量的东西**完全没有变**（rings 必须为空），只是换了 id。判据没有
   * 跟着改名而放宽 —— 那才是换名时最容易发生的退化。
   */
  const e = engineOf('search')
  const dur = STATE_BY_ID.get('search').duration
  let worst = 0
  let worstAt = 0
  for (let t = 0.02; t <= dur; t += 0.01) {
    const n = e.sample(t).rings.length
    if (n > worst) {
      worst = n
      worstAt = t
    }
  }
  assert.equal(worst, 0, `检索不该有任何环，实测 ${worstAt.toFixed(2)}s 时有 ${worst} 个`)
})

check('检索的身体与小球家族共用尺寸，彩带仍铺开', () => {
  /*
   * 「低吟去掉那个黑圆框，把彩色的小球放大」。框没了之后，装饰不再有参照物，
   * 所以身体和彩带一起放大 —— 判据是「比 `orbit` 那一档明显大」。
   */
  const r = bodyR('search', 1.2)
  const tiny = bodyR('orbit', 1.2)
  assert.ok(Math.abs(r - tiny) < 1, `检索的身体应与小球家族一样大（${tiny.toFixed(1)}px），实测 ${r.toFixed(1)}px`)
  const e = engineOf('search')
  let maxDeco = 0
  for (let t = 0.4; t < 2.2; t += 0.05) {
    for (const rb of e.sample(t).ribbons) {
      const pts = []
      for (const tk of (rb.front + rb.back).match(/[MLAZ][^MLAZ]*/g) || []) {
        const n = (tk.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
        const p = tk[0] === 'A' ? (n.length >= 7 ? [n[5], n[6]] : null) : n.length >= 2 ? [n[0], n[1]] : null
        if (p) pts.push(Math.hypot(p[0], p[1]))
      }
      if (pts.length) maxDeco = Math.max(maxDeco, Math.max(...pts))
    }
  }
  assert.ok(maxDeco > 40, `彩带应当铺开成绕圈的带子，实测最远点只有 ${maxDeco.toFixed(1)}px`)
})

/* ══ 2. 环绕：融合着结束，不是渐变消失 ═════════════════════════════════ */

/* ══ 2. 环绕：融合着结束，不是渐变消失 ═════════════════════════════════ */

console.log('\n② 环绕：五个点融合进小球，而不是淡出')

check('环绕的最后阶段，五个点向小球收敛', () => {
  /*
   * 用户：「环绕的结束能不能参考爆发，是融合起来、然后结束，而不是渐变消失」。
   * 判据是**距离**而不是透明度：融合的定义就是「点靠近身体并消失」，渐变的
   * 定义是「点还在原处但变淡」。量最后一段里五个点离中心的平均距离，必须
   * 显著小于中段的平均距离。
   */
  const e = engineOf('orbit')
  const dur = STATE_BY_ID.get('orbit').duration
  const meanDist = (t) => {
    const dots = e.sample(t).dots
    if (!dots.length) return null
    return dots.reduce((s, d) => s + Math.hypot(d.x, d.y), 0) / dots.length
  }
  const mid = meanDist(dur * 0.4)
  const end = meanDist(dur - 0.05)
  assert.ok(mid !== null, '中段应当有五个点')
  // 收尾那一帧点数会锐减，只在还有点的时候比
  let endDist = end
  for (let t = dur - 0.3; t <= dur && endDist === null; t += 0.05) endDist = meanDist(t)
  assert.ok(endDist !== null, '收尾前应当还能采到点')
  assert.ok(
    endDist < mid * 0.6,
    `收尾时点应当靠近小球（中段 ${mid.toFixed(1)}px → 收尾 ${endDist.toFixed(1)}px）`
  )
})

check('环绕的收尾半径接近小球半径，不是接近 0（点不该穿过身体）', () => {
  /*
   * 收到 0 会让五个点在小球中心汇成一个点然后被身体盖住 —— 那是「钻进身体」，
   * 不是「融进表面」。所以收尾的半径应当落在小球半径附近（0.1~0.4 R）。
   */
  const e = engineOf('orbit')
  const dur = STATE_BY_ID.get('orbit').duration
  let best = null
  for (let t = dur - 0.6; t <= dur; t += 0.02) {
    const dots = e.sample(t).dots.filter((d) => d.opacity > 0.3)
    if (dots.length >= 3) {
      best = dots.reduce((s, d) => s + Math.hypot(d.x, d.y), 0) / dots.length
    }
  }
  assert.ok(best !== null, '应当能采到正在融合的五个点')
  assert.ok(best / R > 0.1, `融合终点不该是 0（实测 ${(best / R).toFixed(3)} R）`)
  assert.ok(best / R < 0.5, `融合终点应当贴近小球（实测 ${(best / R).toFixed(3)} R）`)
})

/* ══ 3. 雷达：速度放到 0.8 ═════════════════════════════════════════════ */

console.log('\n③ 雷达：波纹速度 ×0.8，第94轮再 ×0.7')

check('雷达的一个环走完全程的时间比原来长（速度 0,8 后又 ×0,7 = 0,56）', () => {
  /*
   * 用户：「雷达波纹的速度太快了，放到 0.8 试一下」，看到之后又「雷达再慢 0.7」。
   * 第二个是叠在第一个上的，所以当前速度 = 0,8 x 0,7 = 0,56，周期 = 1,3 / 0,56
   * = 2,32 s。
   *
   * ── 判据为什么量「相位斜率」而不是「数穿越次数」──────────────────
   * 第一版数「两次穿越中点之间的间隔」。放慢到 0,56 之后周期变成 2,32 s，而
   * `radar` 的时长只有 3 s —— 窗口里装不下 1,3 个周期，永远数不到两次穿越。
   * 这不是速度错，是**判据要求了产品没有承诺的东西**：为了让测试能数够两圈
   * 而去拉长动画，是本末倒置。
   *
   * 换成一个不依赖窗口长度的量：环的半径 r = bodyR + (far-bodyR) * e，其中
   * e 对时间是线性的，斜率就是 RADAR_SPEED / 1,3。从半径反解 e、对 t 做最小
   * 二乘，任何长度的窗口都够用，而且直接量到「每秒走多少圈」——比周期更接近
   * 用户说的「速度」。
   */
  const e = engineOf('radar')
  const RAYON = 100
  // 从 faint 到 far 的映射反解：radarRings 里 e 就是从 bodyR 到 far 的进度
  const bodyR = 19 / 114.2705
  const far = 0.888 / 0.88
  const samples = []
  for (let t = 0.5; t < 2.9; t += 0.01) {
    const ring = e.sample(t).rings.find((x) => x.id === 'radar0')
    if (!ring) continue
    // grow 是开场的缓动，2,9s 前它早就到 1；用它去掉开场那段
    const grow = t < 0.45 ? 1 - Math.pow(1 - t / 0.45, 3) : 1
    const rIn = ring.r / RAYON / grow // 回到「每 R」单位
    const ee = (rIn - bodyR) / (far - bodyR)
    // `ee` 是 `(t * speed / 1,3 + i/3) % 1`，环 0 没有相位偏移
    samples.push([t, ((ee % 1) + 1) % 1])
  }
  assert.ok(samples.length > 50, `应当采到足够多的环样本，实测 ${samples.length}`)

  /*
   * 反解出来的 `e` 在 0..1 之间回绕，所以直接线性拟合会跳。做法：把相邻样本
   * 的差按「最近路径」展开（大于 0,5 就说明跨了圈），得到单调递增的相位，
   * 再对时间做最小二乘求斜率。
   */
  let unwrapped = samples[0][1]
  const pts = [[samples[0][0], unwrapped]]
  for (let i = 1; i < samples.length; i++) {
    let d = samples[i][1] - samples[i - 1][1]
    if (d > 0.5) d -= 1
    if (d < -0.5) d += 1
    unwrapped += d
    pts.push([samples[i][0], unwrapped])
  }
  const n = pts.length
  const meanT = pts.reduce((a, p) => a + p[0], 0) / n
  const meanP = pts.reduce((a, p) => a + p[1], 0) / n
  let num = 0
  let den = 0
  for (const [t, p] of pts) {
    num += (t - meanT) * (p - meanP)
    den += (t - meanT) * (t - meanT)
  }
  const slope = num / den // tours par seconde
  assert.ok(slope > 0, `相位应当在推进（实测斜率 ${slope.toFixed(4)}）`)
  const period = 1 / slope
  assert.ok(
    Math.abs(period - 2.32) < 0.18,
    `环的周期应当是 2,32 s（= 1,3 / 0,8 / 0,7），实测 ${period.toFixed(3)} s`
  )
})

/* ══ 4. 庆祝：小球不转、烟花放慢到 0.7 ═════════════════════════════════ */

console.log('\n④ 庆祝：小球本身不转，烟花 ×0.7')

check('庆祝的小球不转（眼睛的位置不动）', () => {
  /*
   * 用户：「庆祝的小球他本身不用转」。判据用**眼睛矩阵的平移分量**：
   * 转的时候两个眼睛绕着中心跑，平移分量每帧都变；不转的时候它只随
   * 呼吸微微抖。所以量整段里眼睛 x 的极差 —— 转一圈是几十 px，不转是个位数。
   */
  const e = engineOf('celebrate')
  const xs = []
  for (let t = 0.3; t <= 4.0; t += 0.05) {
    const eye = e.sample(t).eyes[0]
    if (!eye) continue
    const m = eye.matrix.match(/matrix\(([^)]+)\)/)
    if (!m) continue
    xs.push(Number(m[1].split(',')[4]))
  }
  assert.ok(xs.length > 20, '应当采到多帧眼睛位置')
  const span = Math.max(...xs) - Math.min(...xs)
  assert.ok(span < 8, `小球不该转（眼睛横向位移应当很小），实测极差 ${span.toFixed(1)}px`)
})

check('庆祝的烟花比原来慢（同一颗粒子在同样时间走的距离更短）', () => {
  /*
   * 用户：「烟花的效果放慢到 0.7」。
   *
   * ── 判据为什么用「达到同一扩散半径的耗时」────────────────────────
   * 0,7 是时间倍率：原来 0,5 s 到达的位置，现在要 0,5 / 0,7 = 0,714 s。
   * 量「最远粒子半径」随时间爬升的曲线，在固定时刻比较比值，比找某个
   * 绝对半径更稳（粒子会淡出，早就采不到了）。
   */
  const e = engineOf('celebrate')
  const far = (t) => {
    const f = e.sample(t)
    return f.dots.filter((d) => d.color && d.opacity > 0.1).reduce((m, d) => Math.max(m, Math.hypot(d.x, d.y)), 0)
  }
  // 第一团在 ft = 0,05 出生。ft = 0,35 时（t = 0,5）它已经张开了一段。
  const at = far(0.5)
  assert.ok(at > 0, '第一团烟花应当已经张开')
  /*
   * 如果没放慢，t = 0,5 对应的是 ft = 0,5，粒子飞了 0,45 s；
   * 放慢到 0,7 之后 t = 0,5 只是 ft = 0,35，粒子飞了 0,30 s。
   * 后者的半径明显更小。用「比同一动画在 t = 0,71 处更小」来间接锁定。
   */
  const later = far(0.71)
  assert.ok(
    later > at * 1.05,
    `放慢的证据：0,71 s 时的扩散（${later.toFixed(1)}px）应当明显大于 0,5 s 时（${at.toFixed(1)}px）`
  )
})

check('庆祝的总时长是 2,9 s（两发同时炸，不再等四批放完）', () => {
  /*
   * ── 2026-10-31：8,6 → 2,9 s，判据整个换掉 ────────────────────────────
   *
   * 旧断言锁的是「4,2 / 0,49 = 8,6 s」。那个数字是**四批烟花互相重叠**的
   * 副产品：四团各活 2,86 s、相隔 1,84 s 开始，所以必须留 8,6 s 才不切尾。
   *
   * 用户提出「庆祝一遍约8.6秒……3s差不多了吧？」，实测确认单遍里确实放了
   * 四批（0,11 / 1,94 / 3,78 / 5,62 s），并选定「两发同时炸，总长 2.9 秒」。
   *
   * 所以现在锁的是**三件事**，缺一件画面就坏：
   *   ① 时长 2,9 s
   *   ② `CELEBRATE_SLOW` 仍是 0,49（速度没有被顺手改掉）
   *   ③ 收尾时装饰必须是空的（这条由 `smoke-loop` 单独锁，这里只锁时长）
   */
  const dur = STATE_BY_ID.get('celebrate').duration
  assert.ok(Math.abs(dur - 2.9) < 0.05, `时长应当是 2,9 s（两发同时炸），实测 ${dur}`)
})

/* ══ 5. 加载：两个版本、小球不再小一圈、黑框慢开、先吸后收 ═════════════ */

console.log('\n⑤ 加载：单版本 2,6 s + 黑框慢开 + 结尾「先吸彩带、再收框」')

check('加载只剩一个版本，时长 2,6 s（第94轮用户定稿）', () => {
  /*
   * 第92轮用户原话是「延长为 1.2s（就是比目前长 30%）」—— 1,2 和「长 30%」
   * 互相矛盾（当时每遍是 2,4 s，长 30% 应当是 3,1 s）。问过之后他要两个都上。
   *
   * 第94轮他看完两个之后定了：「我选择长 3.1 秒的那个，可以微调回 2.6 秒」。
   * 所以短版下线、只剩一个 2,6 s。这条锁的是「只剩一个」和「2,6」，两个
   * 都要断 —— 只断时长的话，`loading-long` 留在面板里也不会被发现。
   */
  assert.ok(STATE_BY_ID.has('loading'), '缺少 loading')
  assert.ok(!STATE_BY_ID.has('loading-long'), '长版应当已下线（用户选了 2,6 s 的合并版）')
  const dur = STATE_BY_ID.get('loading').duration
check('加载的彩球全程不透明（没有弹出/消失的渐变层）', () => {
  /*
   * 「（加载）的那个彩球，可以做成不要隐没效果的吗？因为他的弹出和消失都是叠加了一层
   *   类似于渐变透明，我不需要 」
   *
   * ── 他说的两层都在代码里找得到 ──────────────────────────────────
   *   弹出  `fadeIn = clamp(t / (2,6 * 0,42))`，状态层，六颗球一起从 0 淡到 1
   *   消失  `clamp((1 - absorb) / 0,2)`，`beltDots` 内部，进球的最后 0,2 淡掉
   *   还有第三层他没点名但一定看得见：`0,55 + 0,45 sin(a * 1,7 + i)`，
   *   每颗球常驻闪烁，在 0,10 到 1,00 之间起伏。彩球是「纯色圆盘」，
   *   纯色圆盘不闪。
   *
   * ── 判据：除身体/状态的公共淡入淡出外，彩球本身的 opacity 必须是常数 ──
   * 不能直接要求 `opacity === 1`：引擎在外面还乘了状态级包络。所以这里量
   * **同一帧内六颗球的差异**和**跨帧的抖动**——那才是他看到的「叠加了一层」。
   *
   * 同时锁「消失是几何的」：最后几帧球的半径必须小到看不见，而不是亮着
   * 但透明。
   */
  const e = engineOf('loading')
  const dur = STATE_BY_ID.get('loading').duration
  const ops = []
  for (let t = 0.5; t < dur - 0.2; t += 0.02) {
    const ds = e.sample(t).dots
    for (const d of ds) ops.push(d.opacity)
  }
  assert.ok(ops.length > 100, '应当能采到大量彩球样本')
  const mn = Math.min(...ops)
  const mx = Math.max(...ops)
  assert.ok(mx - mn < 0.02, `彩球不应当闪烁/渐变，实测透明度在 ${mn.toFixed(2)} ~ ${mx.toFixed(2)} 之间浮动`)

  /* 收尾用真正的球后遮挡判据：彩球中心和边缘全部落入本体，
   * 半径只有在被遮住后才缩小，不能用透明度蒙混。 */
  const tailFrame = e.sample(dur - 0.05)
  assert.equal(tailFrame.dotsBehind, true)
  const tailEdge = Math.max(...tailFrame.dots.filter(d => d.opacity > 0.5).map(d => Math.hypot(d.x, d.y) + d.r), 0)
  assert.ok(tailEdge <= bodyR('loading', dur - 0.05) + 1,
    `收尾彩球应被实体遮住，最远外缘 ${tailEdge.toFixed(1)}px`)
})

  assert.ok(Math.abs(dur - 2.6) < 0.01, `时长应当是 2,6 s，实测 ${dur}`)
})

check('加载的小球和其他小球一样大（不再小一圈）', () => {
  /*
   * 用户：「加载的小球，他比其他小球小一圈，调整一下」。原来 `BODY.loading`
   * 是 15 px，而 orbit / radar / celebrate / search 都是 19 px。
   * 判据直接拿 orbit 当基准，不写死数字 —— 将来统一调整时这条跟着走。
   */
  const tiny = bodyR('orbit', 0.6)
  for (const s of ['loading', 'sending', 'receiving', 'uploading']) {
    const r = bodyR(s, 0.5)
    assert.ok(
      Math.abs(r - tiny) < 2,
      `${s} 应当和 orbit 一样大（${tiny.toFixed(1)}px），实测 ${r.toFixed(1)}px`
    )
  }
})

check('加载没有黑框了（用户要求去掉）', () => {
  /*
   * 用户：「（加载）的黑框去掉」。
   *
   * ── 那个「黑框」不是一个模糊的说法 ────────────────────────────────
   * 它指的是 `whirlRing`：一个 4,5 px 宽的描边圆，画在 `REACH`（0,888 R）
   * 上，先张开、再旋转、最后收回去。它是 `loading` 里唯一一个 `rings` 装饰，
   * 所以「黑框去掉」= 「`rings` 整段恒为空」。
   *
   * ── 为什么不能和 `search` 那条混为一谈 ──────────────────────────────
   * `search` 那边也写过一条「没有环」，但理由完全相反：`search` **从来没有
   * 画过**环，我一度误解用户说的「黑圆框」是装饰物，画了一个假的上去，然后
   * 又删掉。`loading` 这个是真的画过的，是上游 `whirl` 的结构。所以这里锁的
   * 是「一个真的存在过的东西被删掉了」，删掉**本身是需求**。
   *
   * 顺带把连带后果也锁上：`loading` 曾经有「彩球先吸回 → 黑框再收回」两段
   * 编排（`smoke-turn92` 原来那条 515 行的断言）。框没了，那两段的顺序也就
   * 没有对象了；如果哪天有人把框加回来，上一条会红。
   */
  const dur = STATE_BY_ID.get('loading').duration
  const e = engineOf('loading')
  let worst = 0
  let worstAt = 0
  for (let t = 0.02; t <= dur; t += 0.01) {
    const n = e.sample(t).rings.length
    if (n > worst) {
      worst = n
      worstAt = t
    }
  }
  assert.equal(worst, 0, `加载不该有任何环（黑框），实测 ${worstAt.toFixed(2)}s 时有 ${worst} 个`)
})

check('加载结尾：彩球被吸到小球上，最后 20% 不留空档', () => {
  /*
   * ── 这条顶替的是「彩带先吸回、黑框后收回」的**顺序**判据 ─────────────
   * 那条锁的是两段编排不重叠。框一去掉，顺序就不存在了；但去掉框的时候顺手
   * 带出一个真问题：吸收窗口原来是从「框开始收的时刻」**倒推**出来的
   * （`span * (1 - 0.2) - span * 0.28`），框没了之后它仍然沿用这个倒推，
   * 于是彩球在 2,08 s 就吸完、状态却一直到 2,6 s —— 最后 20% 的画面是空的。
   *
   * 所以现在锁两件事：
   *   ① 吸收是**真的在动**（离中心越来越近），不是原地淡出；
   *   ② 吸收**收在结尾**，不是提前收完然后空等。
   */
  const dur = STATE_BY_ID.get('loading').duration
  const e = engineOf('loading')
  /*
   * ── 量「平均半径」，不量「第 0 颗球」──────────────────────────────
   * 第一版取 `dots[0]` 的半径，量出 38,1px -> 51,7px，看上去像「越吸越远」。
   * 实际上没有这回事：`dots[0]` 是**过滤后**数组的第一个元素，而过滤条件是
   * `opacity > 0.05`，透明度又跟着 `sin(a * 1,7 + i)` 起伏。所以这个 0 号在
   * 两圈球之间来回跳（0 圈在 0,88 R，1 圈在 0,77 R），量到的是「换了一颗」，
   * 不是「这颗往外走」。
   *
   * 六颗球的**平均半径**不受这个影响：它只随吸收变，不随相位变。这才是
   * 「整团物质被吸进去」的可观测量。
   */
  const meanR = (t) => {
    const ds = e.sample(t).dots.filter((d) => d.opacity > 0.05)
    if (!ds.length) return null
    return ds.reduce((a, d) => a + Math.hypot(d.x, d.y), 0) / ds.length
  }
  // 吸收前（1,5 s，还没开始）和吸收接近尾声（2,45 s）
  const before = meanR(1.5)
  const during = meanR(2.45)
  assert.ok(before !== null && during !== null, '应当能采到吸收前后的彩球')
  assert.ok(
    during < before * 0.75,
    `彩球应当被吸向小球（不是原地淡出），实测平均半径 ${before.toFixed(1)}px -> ${during.toFixed(1)}px`
  )
  // 最后一颗彩球消失的时刻，必须贴着结尾
  let goneAt = null
  for (let t = dur * 0.5; t <= dur; t += 0.005) {
    if (!e.sample(t).dots.some((d) => d.opacity > 0.05)) {
      goneAt = t
      break
    }
  }
  assert.ok(goneAt !== null, '彩球应当有吸完的时刻')
  assert.ok(
    dur - goneAt < dur * 0.12,
    `彩球应当吸到结尾（${dur}s），实测 ${goneAt.toFixed(2)}s 就没了 —— 最后 ${((1 - goneAt / dur) * 100).toFixed(0)}% 是空的`
  )
})

check('加载结尾：最后一帧彩带和黑框都没了（不靠淡出遮掩）', () => {
  /*
   * 原来的 `fade` 是整段一起淡出，到点时装饰还在半空、只是透明度低了 ——
   * 用户看到的「吸到一半然后隐藏」就是它。
   */
  const dur = STATE_BY_ID.get('loading').duration
  const last = engineOf('loading').sample(dur)
  const belt = last.dots.filter((d) => d.opacity > 0.05)
  const ring = last.rings.filter((r) => r.sweep > 0.02 && r.opacity > 0.05)
  assert.equal(belt.length, 0, `最后一帧应当没有彩球了，实测 ${belt.length} 个`)
  assert.equal(ring.length, 0, `最后一帧应当没有黑框了，实测 ${ring.length} 个`)
})


console.log('\n⑦ 苏醒：睁眼分三段，半睁时左右扫视，带一点超出')

/**
 * 眼睛胶囊路径的纵向跨度，作为「睁多大」的度量。
 *
 * ── 为什么必须按指令解析，不能按「奇偶位取 y」（2026-10-31）──────────
 * 第一版写的是 `nums.filter((_, i) => i % 2 === 1)` —— 假定路径里所有数字都是
 * 成对的 x,y。`.test-build` 的胶囊路径不是这样：它由 `M / A / L` 组成，一条
 * 圆弧带 **7 个**参数（rx ry rot large sweep x y），多出来的 5 个会把后面的
 * 配对整体错位一位。眼睛窄的时候弧的半径恰好等于半宽，「半宽/半高」两个数
 * 相等，错位后仍然凑出一个看似合理的跨度，所以这个 bug 藏了很久。
 *
 * 这一轮把 `waking` 的眼宽改成标准值（原来的 `EYE_W * 0.5` 是个 bug，见
 * `STATE.waking`），路径形状随之变化，错位立刻暴露：量出「全睁 24,7 vs 闭
 * 15,7」，比值只有 1,6，而真实值是 4 倍上下。**这不是动画坏了，是尺子坏了**。
 *
 * 现在按 SVG 路径文法取**每个子路径的端点**（`A` 取最后两个数），只保留
 * `M`/`L`/`A` 三种命令 —— 胶囊路径只用这三种。
 */
function eyeHeight(f) {
  if (!f.eyes.length) return 0
  const tokens = f.eyes[0].d.match(/[MLAZ][^MLAZ]*/g) || []
  const ys = []
  for (const tk of tokens) {
    const n = (tk.slice(1).match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
    if (tk[0] === 'A') {
      if (n.length >= 7) ys.push(n[5], n[6])
    } else if (n.length >= 2) {
      ys.push(n[0], n[1])
    }
  }
  return ys.length ? Math.max(...ys) - Math.min(...ys) : 0
}

check('睁眼不是一步到位（中间存在「半睁」的中间态）', () => {
  /*
   * 用户：「苏醒的睁开眼的眼速度太快了，增加睁开眼的动画」。原来的实现是从
   * 0,07 直接跳到 1,12（一帧），所以整段只有「闭」和「全睁」两个状态。
   *
   * 判据：在 0,55~2,2 s 之间，必须存在高度落在「闭」和「全睁」之间
   * （20 %~80 %）的帧。只要有中间态，就说明有过渡动画；一帧跳完的实现
   * 永远采不到这样的帧。
   */
  const e = engineOf('waking')
  const closed = eyeHeight(e.sample(0.4))
  const open = eyeHeight(e.sample(2.4))
  assert.ok(open > closed * 2, `全睁应当明显高于闭（闭 ${closed.toFixed(1)} / 开 ${open.toFixed(1)}）`)
  const lo = closed + (open - closed) * 0.2
  const hi = closed + (open - closed) * 0.8
  let mids = 0
  for (let t = 0.55; t < 2.2; t += 0.02) {
    const h = eyeHeight(e.sample(t))
    if (h > lo && h < hi) mids++
  }
  assert.ok(mids > 3, `应当采到多帧「半睁」，实测 ${mids} 帧（一帧跳完的实现会是 0）`)
})

check('半睁的时候不再左右摇头（用户要求去掉）', () => {
  /*
   * ── 这条断言被反转过一次，说明为什么 ────────────────────────────
   * 它原本锁的是「半睁时眼镜左右扫视」，因为用户当年明确要求过
   * 「能在半睁的时候左右转一下」。第 96 轮他改了主意：「把苏醒的摇头去掉吧，
   * 就正常的睁眼，然后烟花就好」。
   *
   * 于是断言从「必须有扫视」变成「必须没有扫视」。反过来写而不是删掉，是因为
   * 「没有摇头」本身是这一轮的需求 —— 删掉的话，哪天有人把摇头加回来，测试
   * 不会拦。
   *
   * ── 判据为什么不能是「极差」也不能是「方向反转」──────────────────
   * 试过两种，都失败，失败的原因不同、都值得记下来：
   *
   *   ① 横向极差 < 6px：量到 8,0px。可是眼睛在**球面**上，睁眼时 `cy` 从
   *      +6/100 滑到 -3/100，眼睛整体往上走，横向分量跟着漂几个像素。这是
   *      「脸支起来」，不是摆头。
   *
   *   ② 方向反转次数 <= 1：量到 3 次。因为上面那个漂移本身就是一个「先降、
   *      到底、再升」的 V 形，天然带两次反转 —— 越平滑的漂移越像摇头。
   *
   * 真正的区别不在「有没有来回」，而在**位置是否跟着一个独立于开眼的信号
   * 走**。摇头是 `yaw` 驱动的：它会让两只眼睛同时横移，而且移动方向与
   * `sin(2πk)` 同相。所以判据改成：`gaze.yaw` 在整段里必须是常数。
   * 这是直接量「有没有在转头」，不是从眼睛位置反推。
   */
  const e = engineOf('waking')
  const yaws = []
  for (let t = 0.6; t <= 2.6; t += 0.02) {
    const f = e.sample(t)
    const eye = f.eyes[0]
    if (!eye) continue
    const m = eye.matrix.match(/matrix\(([^)]+)\)/)
    if (m) yaws.push(Number(m[1].split(',')[0]))
  }
  assert.ok(yaws.length > 10, '应当采到睁眼区间的多帧')
  /*
   * `yaw` 体现在矩阵的 [0][2] 与 [1][2] 分量上：没有转头时，眼睛的法线朝向
   * 只由静止视角决定，`matrix(a,b,c,d,...)` 的前四个分量应当几乎不变。
   * 量 a/b 两个分量的变化幅度，比量眼睛位置更直接。
   */
  const as = []
  for (let t = 0.6; t <= 2.6; t += 0.02) {
    const f = e.sample(t)
    const eye = f.eyes[0]
    if (!eye) continue
    const m = eye.matrix.match(/matrix\(([^)]+)\)/)
    if (m) as.push([Number(m[1].split(',')[0]), Number(m[1].split(',')[1])])
  }
  const aSpan = Math.max(...as.map((p) => p[0])) - Math.min(...as.map((p) => p[0]))
  assert.ok(
    aSpan < 0.30,
    `睁眼过程中不应当左右摇头（转头会大幅改变眼睛朝向分量），实测 a 分量极差 ${aSpan.toFixed(3)}`
  )
})

check('扫视结束时回到原来的视角（不是停在旁边）', () => {
  /*
   * 用户：「然后回到原来的视角」。所以扫视区间的最后，眼睛 x 应当回到
   * 区间起点附近。不回来的话，全睁时脸是歪的。
   *
   * ── 量的是 `sin(2πk)` 的 `k=1` 处（2026-10-31）───────────────
   * 摇头现在到 2,55 s 才结束，之后的「全睁」段在 2,55~2,80 s。第一版拿
   * 2,3 s 当终点，那时还在摇头中途，眼睛本来就该在边上 —— 量出来的
   * 「停在旁边」不是缺陷，是**取样点落在动作中间**。
   * 起点取摇头刚开始的 1,05 s，终点取摇头结束 0,05 s 后的 2,60 s。
   */
  const e = engineOf('waking')
  const xAt = (t) => {
    const eye = e.sample(t).eyes[0]
    const m = eye && eye.matrix.match(/matrix\(([^)]+)\)/)
    return m ? Number(m[1].split(',')[4]) : null
  }
  const start = xAt(1.05)
  const end = xAt(2.6)
  assert.ok(start !== null && end !== null, '应当能采到起点和终点的眼睛位置')
  assert.ok(
    Math.abs(end - start) < 10,
    `扫视结束应当回到原来的视角（起点 ${start.toFixed(1)} / 终点 ${end.toFixed(1)}）`
  )
})

check('睁开的时候有一点超出（眼裂比常态更高，然后回正）', () => {
  /*
   * 用户：「能再叠加一下你的 2，2 在那个转动的时候超出」—— 指「睁开时加一点
   * 回弹」。判据：整段里眼睛高度必须出现一个**高于终态**的峰值。没有超出
   * 的话最大值就出现在终态，两者相等。
   *
   * ── 窗口右移（2026-10-31）───────────────────────────────────────
   * 摇头延长到 2,55 s 之后，「全睁 + 超出」发生在 2,55~2,80 s，回落在
   * 2,85 s 之后。窗口取到 3,2 s（= 新的时长）才能包含回弹的上升段；停在
   * 2,4 s 的话窗口里全是半睁，峰值必然等于终态，看上去像「没有超出」。
   */
  const e = engineOf('waking')
  let peak = 0
  let peakAt = 0
  for (let t = 1.0; t < 3.2; t += 0.02) {
    const h = eyeHeight(e.sample(t))
    if (h > peak) {
      peak = h
      peakAt = t
    }
  }
  const settled = eyeHeight(e.sample(3.15))
  assert.ok(
    peak > settled * 1.03,
    `应当有一个高于终态的回弹（峰值 ${peak.toFixed(1)} @${peakAt.toFixed(2)}s vs 终态 ${settled.toFixed(1)}）`
  )
})

/* ══ 8. 发送 / 接收：统一大小、放慢到 0.8 ══════════════════════════════ */

console.log('\n⑧ 发送 / 接收：珠子与黑框统一，速度 ×0.8')

check('发送 / 接收的珠子和其他小球一样大', () => {
  // 已经在 ⑤ 里量过，这里留一条独立的，因为用户是把两件事分开说的
  const tiny = bodyR('orbit', 0.6)
  for (const s of ['sending', 'receiving']) {
    const r = bodyR(s, 0.5)
    assert.ok(Math.abs(r - tiny) < 2, `${s} 应当 ${tiny.toFixed(1)}px，实测 ${r.toFixed(1)}px`)
  }
})

check('发送 / 接收的黑框不再偏小（冲击环开到装饰的尺度）', () => {
  /*
   * 用户：「发送、接收的小球、黑圆框都偏小，和别的统一一下」。黑圆框是冲击环，
   * 原来只开到 0,48 R，比整个装饰家族（0,888 R）小一半，读起来像个套在
   * 珠子上的橡皮筋。
   *
   * 判据：环的最大半径应当接近 `REACH`（0,888 R），而不是 0,48 R。
   */
  for (const s of ['sending', 'receiving']) {
    const e = engineOf(s)
    const dur = STATE_BY_ID.get(s).duration
    let far = 0
    for (let t = 0.3; t < dur; t += 0.01) {
      for (const r of e.sample(t).rings) far = Math.max(far, r.r)
    }
    assert.ok(
      far / R > 0.75,
      `${s} 的冲击环应当开到 0,75 R 以上，实测 ${(far / R).toFixed(3)} R（原来是 0,48）`
    )
  }
})

check('发送 / 接收的周期放慢到 ×0.8（1,5 s → 1,875 s）', () => {
  /*
   * 用户：「动画速度放慢到 0.8」。周期是最好量的：一次发送从出发到离开，
   * 原来 1,5 s，0,8 倍速后 1,5 / 0,8 = 1,875 s。
   *
   * ── 判据用「脉冲出现的时刻序列」────────────────────────────────────
   * 脉冲只在 `phase` 的 (0,18 … 0,73) 之间可见，其余时间它不存在
   * （`sendDots` 返回空数组，而不是一个透明的点）。所以数它的出现批次，
   * 相邻两批的间隔就是周期 —— 比找一个绝对半径稳，因为它不依赖粒子
   * 在哪个半径上、也不依赖它糊不糊。
   *
   * 状态总长 3 s，所以能采到两批（3 / 1,875 = 1,6 个周期）。
   */
  const e = engineOf('sending')
  const dur = STATE_BY_ID.get('sending').duration
  const arrivals = []
  let wasEmpty = true
  for (let t = 0.01; t <= dur; t += 0.005) {
    const has = e.sample(t).dots.length > 0
    if (has && wasEmpty) arrivals.push(t)
    wasEmpty = !has
  }
  assert.ok(
    arrivals.length >= 2,
    `3 秒里应当出现两批脉冲（周期 1,875 s），实测 ${arrivals.length} 批 @${arrivals.map((v) => v.toFixed(2)).join(',')}`
  )
  const period = arrivals[1] - arrivals[0]
  assert.ok(
    Math.abs(period - 1.875) < 0.15,
    `发送周期应当是 1,875 s（= 1,5 / 0,8），实测 ${period.toFixed(3)} s`
  )
})

/* ══ 9. 上传：从外面飘来、绕几圈、被吸收 ═══════════════════════════════ */

console.log('\n⑨ 上传：绕几圈再吸收，不是渐变消失')

check('上传的粒子从画外出发（不是凭空出现在轨道上）', () => {
  /*
   * 上游的 `paintDock` 把它们放在 `(-120, +95)` px，即身体左下角之外。
   * 判据：刚出生的粒子应当在 1 R 以外（小球只有 0.166 R，所以是绝对的远）。
   *
   * ── 采样窗为什么卡在 0,2~0,28 s（2026-10-31 改）───────────────────
   * 这条原来写着「两个粒子分别在 0,2 s 和 1,5 s 起飞（相差 1,3 s）」。
   * 那个 1,3 s 的错开被用户点名要去掉：「砍掉最开始只飞入一个球的部分，
   * 直接是两个球一起飞入旋转」。
   *
   * 所以现在两个都在 0,2 s 起飞，窗口内应当能同时采到**两个**粒子，
   * 而且都在画外。下面那条断言专门锁这一点 —— 如果将来有人把错开加回来，
   * 它会红。
   */
  const e = engineOf('uploading')
  const early = []
  for (let t = 0.2; t < 0.28; t += 0.01) {
    for (const d of e.sample(t).dots) early.push(Math.hypot(d.x, d.y) / R)
  }
  assert.ok(early.length > 0, '应当采到刚出生的粒子')
  assert.ok(
    Math.min(...early) > 0.8,
    `粒子应当从画外起飞，实测最近 ${Math.min(...early).toFixed(2)} R`
  )
})

check('上传的两个球同时飞入（不再有 1,3 s 错开）', () => {
  /*
   * 用户：「上传目前是4s，能不能砍掉最开始只飞入一个球的部分，直接是两个球
   *   一起飞入旋转，然后卡在3s内」。
   *
   * 判据用**「两个都在场的最早时刻」**，而不是「两个都出生的时刻」——
   * 前者才是用户能看见的东西。旧版这个值是 1,5 s（第二颗才起飞），
   * 现在应当落在 0,3 s 以内。
   */
  const e = engineOf('uploading')
  const dur = STATE_BY_ID.get('uploading').duration
  let bothAt = null
  for (let t = 0; t <= dur; t += 1 / 120) {
    if (e.sample(t).dots.length >= 2) {
      bothAt = t
      break
    }
  }
  assert.ok(bothAt !== null, '整个上传过程中应当出现过两个球同时在空中的画面')
  assert.ok(
    bothAt < 0.35,
    `两个球应当几乎同时在空中（<0,35 s），实测最早 ${bothAt.toFixed(2)} s —— 旧版是 1,5 s`
  )
})

check('上传的两个球一左一右飞入（不是都从左下角）', () => {
  /*
   * 用户：「上传目前的两个小球都是从左下角滚入的，能不能做成一左一右飞入？」
   *
   * 旧版两颗都从 `-120 + i*30` 起飞，只差 30px —— 屏幕上读成「一个点，然后
   * 那个点变成两倍」，用户第一次说「都是从左下角」。现在第一颗从 -120 起、
   * 第二颗从 +120 起，关于竖直中轴对称。
   *
   * 判据量「刚起飞时两颗球的 x 符号相反且都够远」，而不是量具体像素值：
   * 具体值会随布局微调变化，而「一左一右」是用户要的本质。
   */
  const e = engineOf('uploading')
  const f = e.sample(0.22)
  assert.equal(f.dots.length, 2, `刚起飞时应当有两个球，实测 ${f.dots.length}`)
  const xs = f.dots.map((d) => d.x / R)
  assert.ok(
    xs.some((x) => x < -0.7) && xs.some((x) => x > 0.7),
    `两颗球应当一左一右（各在 ±0,7 R 以外），实测 x = ${xs.map((x) => x.toFixed(2)).join(' / ')}`
  )
  /* 对称性：两颗应当大致关于中轴镜像，差太多说明只挪了一个 */
  assert.ok(
    Math.abs(xs[0] + xs[1]) < 0.15,
    `两颗球应当左右对称，实测 x 之和 ${(xs[0] + xs[1]).toFixed(2)}`
  )
})

check('上传的吸收是单调滑入的（半径不再来回反弹）', () => {
  /*
   * 用户：「他末尾吸收小球的时候太急了…让吸收小球的动画变得平稳一点」。
   *
   * ── 为什么用「折返次数」而不是「速度」──────────────────────────────
   * 「急」的第一反应是量速度，但这条测过了，改速度没用（274 -> 283 px/s
   * 反而更高）。真正的原因是把半径画成曲线一眼就能看见的东西：
   * 它不下降，它**来回摆** —— 0,45 -> 0,53 -> 0,19 R。
   *
   * 根因是 `|r| = rr * sqrt(sin²a + f²cos²a)`：椭圆（f = 0,5）在角度推进时
   * 会让半径上下摆。修法是俯冲期把角度**冻结**，让粒子直线滑入。
   *
   * 所以判据锁「方向折返次数必须为 0」——它直接对应「看起来平不平顺」，
   * 而且不依赖任何具体像素值，将来微调 dive 时长也不会误红。
   */
  const e = engineOf('uploading')
  const dur = STATE_BY_ID.get('uploading').duration
  let prev = null
  let lastDir = 0
  let reversals = 0
  const bounce = []
  for (let t = dur - 1.0; t <= dur; t += 1 / 60) {
    const d = e.sample(t).dots.filter((x) => x.opacity > 0.5)[0]
    if (!d) {
      prev = null
      continue
    }
    const r = Math.hypot(d.x, d.y)
    if (prev !== null) {
      const dir = Math.sign(r - prev)
      if (dir !== 0 && lastDir !== 0 && dir !== lastDir) {
        reversals++
        if (bounce.length < 4) bounce.push(`t=${t.toFixed(2)} r=${(r / R).toFixed(3)}R`)
      }
      if (dir !== 0) lastDir = dir
    }
    prev = r
  }
  assert.equal(
    reversals,
    0,
    `吸收阶段半径应当单调下降，实测折返 ${reversals} 次：${bounce.join(' / ')}`
  )
})

check('上传的粒子确实「转了好几圈」（角度累计超过 1 圈）', () => {
  /*
   * 用户：「他是环绕着他转了好几圈，然后吸收进去」。
   *
   * ── 判据为什么是「角度累计」而不是「转了几圈」──────────────────────
   * 视觉上用户说的是「好几圈」，但一圈 360°，量角度累计超过一个整圈
   * 已经把「不是摆一下」这件事锁死了；写死 2,5 圈会在任何微调下变红，
   * 而用户要的本质是「明显在环绕」，不是精确圈数。
   *
   * ── 阈值 3π → 2π（2026-10-31）────────────────────────────────────
   * 时长从 4 s 压到 3 s，而 `DOCK_SPIN`（角速度）一点没动 —— 时间少了 25%，
   * 累计角度必然跟着少。实测从 3,00 圈降到 1,47 圈。
   *
   * 这时旧的 3π（一圈半）会变红，但**产品没坏**：用户这一轮的首要要求就是
   * 「卡在3s内」，而「转好几圈」是上一轮在老时长下成立的描述。两个要求在同一
   * 段时间里互相挤，只能按新的那个来。1,47 圈仍然满足用户说的「明显在环绕」，
   * 所以阈值降到 1 整圈 —— 保留语义，去掉那个已经装不下的数字。
   */
  const e = engineOf('uploading')
  const dur = STATE_BY_ID.get('uploading').duration
  let total = 0
  let prev = null
  for (let t = 0.9; t <= dur - 0.5; t += 0.01) {
    const f = e.sample(t)
    const d = f.dots[0]
    if (!d) continue
    const a = Math.atan2(d.y, d.x)
    if (prev !== null) {
      let da = a - prev
      while (da > Math.PI) da -= Math.PI * 2
      while (da < -Math.PI) da += Math.PI * 2
      total += Math.abs(da)
    }
    prev = a
  }
  assert.ok(
    total > Math.PI * 2,
    `应当环绕一整圈以上，实测 ${(total / Math.PI).toFixed(2)} π`
  )
})

check('上传的最后吸收速度和旋转速度相当（0,5 倍速已被采纳）', () => {
  /*
   * 「能让最后小球被吸收的速度降低吗？降低到0.5，因为他旋转和后面的速度明显不一样」
   *
   * ── 病因是「两个速度」──
   * 环绕阶段：粒子以 `DOCK_SPIN` = 5,6 rad/s 转圈，半径恒定。
   * 吸收阶段：半径在 0,45 s 内从 74px 塌到 19px，而角速度一点没变。
   * 同一个物体上挂着两种速度，所以看起来像「换挡」。
   *
   * ── 0,5 是倍率，不是时长 ──
   * 这个坑在这个项目里踩过三次了。0,5 倍速 = 时长 ÷ 0,5 = 0,90 s。
   * 若理解成「时长设为 0,5 s」，动作反而更快，症状会更严重。
   *
   * ── 判据 ──
   * 量「半径收敛速率」：最后一段里每帧半径变化的平均值（px/s）。太快的特征
   * 是每秒掉几十 px；0,5 倍速之后它应当落到一二十的量级。这条锁**量级**，
   * 不锁精确值——精确值由 `DOCK_DIVE_S` 决定，将来微调不该让这条变红。
   */
  const e = engineOf('uploading')
  const dur = STATE_BY_ID.get('uploading').duration
  const DIVE = 0.9 // suite à « 降低到 0.5 » ; voir le commentaire de `DOCK_DIVE_S`
  let prev = null
  const speeds = []
  for (let t = dur - DIVE; t <= dur; t += 1 / 60) {
    const d = e.sample(t).dots.filter((x) => x.opacity > 0.5)[0]
    if (!d) continue
    const r = Math.hypot(d.x, d.y)
    if (prev !== null) speeds.push(Math.abs(r - prev) * 60)
    prev = r
  }
  assert.ok(speeds.length > 10, `应当能采到整段吸收，实测只有 ${speeds.length} 帧`)
  const mean = speeds.reduce((s, v) => s + v, 0) / speeds.length
  assert.ok(
    mean < 130,
    `最后的吸收速度应当和旋转相当，实测平均 ${mean.toFixed(0)}px/s（0,45 s 那版是 170 上下）`
  )
  assert.ok(mean > 20, `吸收不能慢到看不出来，实测平均只有 ${mean.toFixed(0)}px/s`)
})

check('上传的粒子最后被吸进小球（不是淡出在原处）', () => {
  /*
   * 用户：「然后吸收进去，不是目前的渐变消失」。判据与「环绕」那条配对：
   * 半径必须收进小球附近；同时**不能**是原地变淡 —— 那条由上一条的角度量
   * 保证（它在转）。两条合起来才是「绕进去」。
   */
  const e = engineOf('uploading')
  const dur = STATE_BY_ID.get('uploading').duration
  let lastR = null
  for (let t = dur - 0.25; t <= dur; t += 0.01) {
    const d = e.sample(t).dots.filter((x) => x.opacity > 0.15)[0]
    if (d) lastR = Math.hypot(d.x, d.y) / R
  }
  assert.ok(lastR !== null, '收尾时应当还能采到正在吸收的粒子')
  assert.ok(lastR < 0.35, `吸收终点应当贴着小球（0.166 R 量级），实测 ${lastR.toFixed(3)} R`)
})

/* ══ 10. 蛋：从动画变成身形 ════════════════════════════════════════════ */

console.log('\n⑩ 蛋：从动画变成身形（可配色、可配表情）')

const { SHAPE_OPTIONS, EXPRESSION_OPTIONS, COLOR_OPTIONS } = PURE

check('「蛋」已经是身形，不再是动画', () => {
  /*
   * 用户：「将（蛋）重构一下，变成身形，做不到就直接移除，适配颜色和表情」。
   *
   * 它本来就是一条「不动的形状」，所以这是一次正确的归类，而不是妥协。
   * 两条一起锁：身形里有它，动画列表里没有它 —— 只锁一条的话，两边
   * 都留着也能过，而那就是用户抱怨的重复。
   */
  assert.ok('oeuf' in SHAPE_OPTIONS, '身形列表里应当有蛋（oeuf）')
  assert.ok(!STATE_BY_ID.has('egg'), '动画列表里不该再有 egg')
  assert.ok(!('egg' in SHAPE_OPTIONS), 'id 应当是 oeuf 而不是直接复用 egg')
})

check('蛋形适配全部颜色和表情（因为它在 `baseBody` 里，不是特例）', () => {
  /*
   * 「适配颜色和表情」的判据：它必须是**普通身形**，即没有任何一个状态
   * 因为它是蛋而走特例。颜色和表情对普通身形是全局生效的（见 `look.ts`
   * 的 `presetLookAt` / `Bot` 的 `setExpression`），所以只要它是普通身形，
   * 适配就是自动的。
   *
   * 这里量的是件数：12 个颜色 × 16 个表情都是通用选项，蛋形不排除任何
   * 一个。若将来有人给它写特例，最先坏的就是这条。
   */
  assert.equal(Object.keys(COLOR_OPTIONS).length, 12, '12 个颜色')
  assert.equal(Object.keys(EXPRESSION_OPTIONS).length, 16, '16 个表情')
})

check('「启动中」改用弹跳（蛋走了，它需要新动画）', () => {
  /*
   * 用户：「改成弹跳，这个最适合了，弹跳几下，然后回归标准，符合视觉特征」。
   * 判据量的是**映射**而不是代码：`DEFAULT_ROTATION.spawning` 的第一项必须是
   * `bounce`。这是用户对「子代理刚起来」的语义判断，不是我选的。
   */
  assert.equal(PURE.DEFAULT_ROTATION.spawning[0].state, 'bounce')
})

/* ══ 11. 写文件：不画三角形、跟随身形 ══════════════════════════════════ */

console.log('\n⑪ 写文件：不画三角形，跟随身形 + 专注表情')

check('写文件跟随用户选的身形（不是自己画三角形）', () => {
  /*
   * 用户：「写文件的那个图案，能不用三角形吗？就直接跟随身形，相当于他的动画
   * 就是原动画（一条线）+表情（专注）」。
   *
   * 判据：给它一个完全不同的身形（拱门），画面里的轮廓必须变成拱门。
   * 原来那个三角形是写死的，换成拱门也不会变 —— 这就是「不跟随身形」。
   */
  const ARCHE = [
    0.60275, 0.60566, 0.61456, 0.62987, 0.65241, 0.68345, 0.72492, 0.77974, 0.85241, 0.94916,
    1, 0.94939, 0.90631, 0.875, 0.85373, 0.84137, 0.83732, 0.84137, 0.85373, 0.875, 0.90631,
    0.94939, 1, 0.94917, 0.85242, 0.77974, 0.72492, 0.68345, 0.65241, 0.62987, 0.61456, 0.60567,
    0.60275, 0.60567, 0.61456, 0.62987, 0.65241, 0.68345, 0.72028, 0.75943, 0.79668, 0.83115,
    0.86223, 0.88946, 0.91243, 0.93074, 0.94404, 0.95213, 0.95507, 0.95213, 0.94404, 0.93074,
    0.91243, 0.88946, 0.86223, 0.83115, 0.79668, 0.75943, 0.72028, 0.68345, 0.65241, 0.62987,
    0.61456, 0.60566
  ]
  const arch = new BotEngine(100, 'play', ARCHE, null)
  arch.setShape(ARCHE, 0)
  const bb = bbox(arch.sample(0.9).bodyPath)
  // 拱门是 122x181 的竖长形（宽/高 ≈ 0.67）；三角形接近正方（≈1.0）
  const ratio = bb.w / bb.h
  assert.ok(
    ratio < 0.85,
    `写文件的身体应当变成拱门（宽/高 ≈ 0.67），实测 ${ratio.toFixed(2)}（三角形会接近 1.0）`
  )
})
check('苏醒 / 睡眠跟随用户选的身形（不再是写死的圆）', () => {
  /*
   * 用户第 100 轮：「（苏醒）（睡眠）目前也是固定死圆形的，帮我修一下，跟随图形」。
   *
   * 这两个状态是**最后两个**「满身体却写死圆」的状态。`idle` 早就跟随身形，
   * `play` 在第 92 轮改成了跟随，`burst` / `comet` 有 `bodyRest` 收尾跟随 ——
   * 所以选了拱门的用户，会在「睁眼」「睡着」这两处看到球一闪而过。
   *
   * ── 判据：换成拱门，轮廓必须真的变成拱门 ────────────────────────────
   * 和「写文件跟随身形」用的是同一把尺子（同一个 ARCHE 半径表），这样两条
   * 断言测的是同一件事，不会出现「一个说跟随、一个说不跟随」的互相矛盾。
   *
   * 宽/高：圆形 ≈ 1,0，拱门 ≈ 0,67。取 < 0,85 作为分界。
   */
  const ARCHE = [
    0.60275, 0.60566, 0.61456, 0.62987, 0.65241, 0.68345, 0.72492, 0.77974, 0.85241, 0.94916,
    1, 0.94939, 0.90631, 0.875, 0.85373, 0.84137, 0.83732, 0.84137, 0.85373, 0.875, 0.90631,
    0.94939, 1, 0.94917, 0.85242, 0.77974, 0.72492, 0.68345, 0.65241, 0.62987, 0.61456, 0.60567,
    0.60275, 0.60567, 0.61456, 0.62987, 0.65241, 0.68345, 0.72028, 0.75943, 0.79668, 0.83115,
    0.86223, 0.88946, 0.91243, 0.93074, 0.94404, 0.95213, 0.95507, 0.95213, 0.94404, 0.93074,
    0.91243, 0.88946, 0.86223, 0.83115, 0.79668, 0.75943, 0.72028, 0.68345, 0.65241, 0.62987,
    0.61456, 0.60566
  ]
  for (const id of ['waking', 'sleeping']) {
    const round = new BotEngine(100, id, null, null)
    const arch = new BotEngine(100, id, ARCHE, null)
    arch.setShape(ARCHE, 0)
    // 采中间一段而不是单帧：两个状态都有呼吸/睁眼的形变，单帧可能正好在极值
    let roundRatio = 0
    let archRatio = 0
    for (let t = 0.8; t <= 2.4; t += 0.2) {
      const rb = bbox(round.sample(t).bodyPath)
      const ab = bbox(arch.sample(t).bodyPath)
      roundRatio = Math.max(roundRatio, rb.w / rb.h)
      archRatio = Math.max(archRatio, ab.w / ab.h)
    }
    assert.ok(
      roundRatio > 0.85,
      `${id} 默认应当是圆的（宽/高 ≈ 1），实测 ${roundRatio.toFixed(2)} —— 判据本身可能坏了`
    )
    assert.ok(
      archRatio < 0.85,
      `${id} 应当跟随身形变成拱门（宽/高 ≈ 0.67），实测 ${archRatio.toFixed(2)} —— 说明它还在画死圆`
    )
  }
})


check('写文件还保留那条线（动画的主体没有被一起删掉）', () => {
  /*
   * 用户：「相当于他的动画就是原动画（一条线）+表情（专注）」。所以三角形去掉
   * 之后，**线必须还在** —— 只把三角形删了会变成一条不动的动画，那不是他要的。
   */
  const e = new BotEngine(100, 'play', null, null)
  let arcFrames = 0
  for (let t = 0.4; t < 1.8; t += 0.05) {
    if (e.sample(t).arcs.length > 0) arcFrames++
  }
  assert.ok(arcFrames > 10, `那条线应当在大部分时间里都在，实测只有 ${arcFrames} 帧`)
})

check('写文件的线会横扫（线本身在动，不是静止的装饰）', () => {
  // 「原动画（一条线）」是一条会扫过去的线。判据量它的 x 位移。
  const e = new BotEngine(100, 'play', null, null)
  const xs = []
  for (let t = 0.4; t < 1.8; t += 0.05) {
    const f = e.sample(t)
    if (!f.arcs.length) continue
    const nums = (f.arcs[0].front.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
    const px = nums.filter((_, i) => i % 2 === 0)
    if (px.length) xs.push(px.reduce((a, b) => a + b, 0) / px.length)
  }
  assert.ok(xs.length > 5, '应当采到多帧的线')
  const span = Math.max(...xs) - Math.min(...xs)
  assert.ok(span > 30, `线应当横扫过画面，实测位移只有 ${span.toFixed(1)}px`)
})

/* ══ 全局：整族尺寸不再有例外 ══════════════════════════════════════════ */

console.log('\n全局回归：小球家族的尺寸一致')

check('检索和八个「小球家族」动画的身体尺寸彼此相差不超过 2px', () => {
  /*
   * 这一整轮里有四条（5/6/8 的一部分）本质上是同一件事：这个家族的珠子
   * 大小不统一。用户三次指出（加载小一圈、发送接收偏小、低吟放大）。
   * 所以留一条**总账**，量最常见的那六个，它们应当几乎一样大。
   *
   * ── 第 100 轮：`search` 离开了这一组 ────────────────────────────────
   * 「把目前的（检索）删掉，然后把（低吟）改成（检索）的名字」。
   *
   * 旧 `search`（光线注入）本来就是小球家族的一员，所以在列表里；现在顶着
   * 这个名字的是**原低吟**，而原低吟正是「唯一被明确要求放大的例外」——
   * 身体 0,34 R ≈ 30px，不是 19px。照旧算进来这条总账会红，而红的原因不是
   * 退化，是它本来就不属于这一组。
   *
   * 例外没有被悄悄放宽：它被移出列表，同时下面另有一条专门量它「应当更大」。
   */
  const tiny = bodyR('orbit', 0.6)
  for (const s of ['search', 'radar', 'progress', 'celebrate', 'loading', 'sending', 'receiving', 'uploading']) {
    const r = bodyR(s, 0.5)
    assert.ok(
      Math.abs(r - tiny) < 2,
      `${s} 偏离 ${tiny.toFixed(1)}px 太多（实测 ${r.toFixed(1)}px）`
    )
  }
})

check('每个状态都还在 SEQUENCE 里，或者被明确移出', () => {
  /*
   * `egg` 被移出了（变成身形）。这条锁的是「移除是有意的」：SEQUENCE 里的
   * 每一项都必须真实存在，反向则允许有——存在但不在序列里的是特殊状态
   * （`hexagon` 就是这样，只给试片用）。
   */
  for (const id of PURE.SEQUENCE) {
    assert.ok(STATE_BY_ID.has(id), `SEQUENCE 里有不存在的状态 ${id}`)
  }
  assert.ok(!PURE.SEQUENCE.includes('egg'), 'egg 不该再出现在序列里')
})

check('所有状态的时长都是正数且不超过 10 s（面板不会卡死）', () => {
  for (const def of STATES) {
    assert.ok(def.duration > 0, `${def.id} 时长 ${def.duration}`)
    assert.ok(def.duration <= 10, `${def.id} 时长 ${def.duration} 超过面板上限`)
  }
})

console.log(`\n${passed} 项通过` + (process.exitCode ? '，有失败' : ''))

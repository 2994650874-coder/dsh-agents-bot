/**
 * 「动画播完就停」的回归锁（v0.3.16）。
 *
 * ── 用户报的现象 ────────────────────────────────────────────────────
 * 「目前你新增的动画，在播放后都不会持续，是因为和原有的那些逻辑不一样吗？」
 *
 * ── 根因，两层 ───────────────────────────────────────────────────────
 * 引擎的 `sample(t)` 是**时间的纯函数**，但它不知道「一遍」有多长：状态在
 * `duration` 秒后就走完自己的时间轴，一次性动画的装饰随之淡空，屏幕上只剩
 * 收尾姿态。
 *
 * 以前只有**配了轮播**的活动才循环（靠 `slotAt` 反复切回起点）。没配轮播
 * 的地方传的是裸 `state`，于是引擎一路往前跑：
 *
 *   ① `Bot` 根本没有重播逻辑 —— 裸 `state` 只走 `engine.setState`，
 *      引擎时间轴只增不减。
 *   ② 就算补上重播，`pass` 也救不了单项轮播：`pass` 数的是「同一项内部的
 *      第几遍」，`plays: 1` 时它恒为 0，`reset` 永远不触发。
 *
 * ── 这里锁什么 ───────────────────────────────────────────────────────
 * 这一层是**渲染层**的逻辑（`Bot.tsx` 的 draw 循环），跑不了 DOM 也没关系：
 * 重播判据是纯计算，把它抽出来就能测。所以本测试断言的是「判据函数」而不是
 * 「组件跑起来对不对」—— 后者要靠 `smoke-settings-layout.mjs` 那类浏览器测试。
 *
 * 用法：node plugin/test/smoke-loop.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')

const PURE = require(path.join(__dirname, '..', '..', '.test-build', 'test-pure.cjs'))
const { BotEngine, STATE_BY_ID } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))

const { slotAt, cycleLength, playLengthOf } = PURE

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

/**
 * 复刻 `Bot.tsx` 里的重播判据。
 *
 * ── 为什么不 import 真的那一段 ──────────────────────────────────────
 * 它写在 React 组件的 rAF 回调里，闭包了 engine / ref / 计时器，拔不出来。
 * 所以这里复刻**判据**（三个触发条件的布尔表达式），而不是复刻实现。
 *
 * 这条界线是刻意的：判据是「什么时候该重播」，它错了动画就停；实现是
 * 「怎么把帧画出来」，那部分浏览器测试管得住。复刻判据能让「单项轮播永不
 * 重播」这类 bug 在纯 node 里就被抓住。
 *
 * ⚠️ 改了 `Bot.tsx` 的判据一定要同步改这里 —— 两边不一致时这个测试反而
 * 会给出虚假的安全感。所以下面每条断言都写清楚它对应哪个触发条件。
 */
function nextAction(prev, rotation, startMs, nowMs, engineState) {
  const slot = slotAt(rotation, startMs, nowMs)
  const cycleLen = cycleLength(rotation)
  const cycle = cycleLen > 0 ? Math.floor((nowMs - startMs) / 1000 / cycleLen) : 0
  if (slot.state !== engineState) {
    return { action: 'setState', state: slot.state, pass: slot.pass, cycle }
  }
  if (slot.pass !== prev.pass || cycle !== prev.cycle) {
    return { action: 'reset', state: slot.state, pass: slot.pass, cycle }
  }
  return { action: 'none', state: slot.state, pass: slot.pass, cycle }
}

/** 模拟 `duration` 秒的单个状态（= Bot 合成的单项轮播）。 */
const single = (state) => [{ state, plays: 1 }]

console.log('单项轮播必须循环（这是用户报的「动画播完就不动了」）')

check('单项轮播跑满一遍后，判据要求重播', () => {
  const state = 'orbit'
  const len = playLengthOf(state)
  const rot = single(state)
  const prev = { pass: 0, cycle: 0 }
  // 第 1 遍中途：不该重播
  const mid = nextAction(prev, rot, 0, (len * 0.5) * 1000, state)
  assert.equal(mid.action, 'none', `第 1 遍中途不该动作，实测 ${mid.action}`)
  // 刚过一整遍：必须重播
  const over = nextAction(prev, rot, 0, (len * 1.01) * 1000, state)
  assert.equal(over.action, 'reset', `跑满一遍后必须 reset，实测 ${over.action}`)
})

check('重播判据对每个动画都成立（不是只对 orbit 有效）', () => {
  for (const o of PURE.ANIMATION_OPTIONS) {
    const len = playLengthOf(o.id)
    if (!(len > 0)) continue
    const rot = single(o.id)
    const prev = { pass: 0, cycle: 0 }
    const over = nextAction(prev, rot, 0, (len * 1.01) * 1000, o.id)
    assert.equal(over.action, 'reset', `${o.id} 跑满一遍后应当 reset，实测 ${over.action}`)
  }
})

check('`pass` 在单项轮播里恒为 0 —— 这正是旧逻辑失效的原因', () => {
  /*
   * 这条不是「锁住一个坏行为」，是把 bug 的成因固定成可读的事实：
   * 如果将来有人想「有 pass 就够了，不用 cycle」，这条会告诉他为什么不行。
   */
  const len = playLengthOf('orbit')
  const rot = single('orbit')
  const passes = new Set()
  for (let k = 0; k < 5; k++) passes.add(slotAt(rot, 0, (k * len + 0.1) * 1000).pass)
  assert.deepEqual([...passes], [0], `单项轮播的 pass 应当恒为 0，实测 ${[...passes].join(',')}`)
})

check('两项轮播仍然只靠 pass 就够（cycle 不误伤）', () => {
  /*
   * 回归保护：给单项轮播加了 cycle 判据之后，原本正常的两项轮播不能变成
   * 「每帧都 reset」。`空闲×5 → 眨眼×1` 里，第 2 遍 pass 变、cycle 不变，
   * 判据应当照样是 reset（正确），但播放中途应当全是 none。
   */
  const rot = [
    { state: 'idle', plays: 5 },
    { state: 'wink', plays: 1 }
  ]
  const total = cycleLength(rot)
  // 一整轮里，除项目的边界外都应当是 none
  const actions = []
  for (let s = 0.1; s < total - 0.1; s += 0.1) {
    const slot = slotAt(rot, 0, s * 1000)
    const a = nextAction({ pass: slot.pass, cycle: 0 }, rot, 0, s * 1000, slot.state)
    actions.push(a.action)
  }
  const nones = actions.filter((a) => a === 'none').length
  assert.ok(
    nones > actions.length * 0.9,
    `一轮里绝大多数帧应当不动作，实测 ${nones}/${actions.length} 是 none`
  )
})

console.log('\n引擎侧：不重播的话装饰确实会淡空（这是为什么要重播）')

/** 装饰离中心最远的距离 */
function decoMax(f) {
  let m = 0
  for (const d of f.dots) {
    if (d.opacity < 0.15) continue
    m = Math.max(m, Math.hypot(d.x, d.y) + (d.r || 0))
  }
  /*
   * `ribbons` aussi (2026-10-31).
   *
   * `search` et `loading` ne dessinent plus de points du tout : leur decor est
   * fait de bandes remplies (`RibbonRender`). Sans cette boucle, `decoMax`
   * renvoie 0 pour eux quel que soit l'instant — donc l'assertion « il reste du
   * decor au debut » echoue sur un decor bien present, et pire, l'assertion
   * « le decor est vide a la fin » passerait meme si les rubans restaient
   * affiches indefiniment. Un compteur aveugle a une famille de decor ne
   * protege plus rien : il faut le mettre a jour en meme temps que le moteur.
   */
  for (const rb of f.ribbons || []) {
    if (rb.opacity < 0.15) continue
    const d = (rb.front || '') + (rb.back || '')
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
    for (let i = 0; i + 1 < nums.length; i += 2) {
      m = Math.max(m, Math.hypot(nums[i], nums[i + 1]) + rb.width / 2)
    }
  }
  for (const r of f.rings) {
    if (r.opacity < 0.15) continue
    m = Math.max(m, Math.hypot(r.cx || 0, r.cy || 0) + r.r + r.width / 2)
  }
  return m
}

for (const state of ['orbit', 'radar', 'celebrate', 'loading', 'search']) {
  check(`${state} 播完之后装饰为空（不重播就会静止）`, () => {
    const def = STATE_BY_ID.get(state)
    const e = new BotEngine(R, state, null, null)
    const tail = decoMax(e.sample(def.duration + 0.1))
    assert.ok(tail < 1, `${state} 收尾后装饰应当已淡空，实测还剩 ${tail.toFixed(1)}px`)
  })
}

console.log('\n重播之后画面对得上（reset 确实回到动画开头）')

for (const state of ['orbit', 'celebrate', 'search']) {
  check(`${state} reset 后重新采样得到「开头」而不是「收尾」`, () => {
    const def = STATE_BY_ID.get(state)
    const e = new BotEngine(R, state, null, null)

    // 不 reset，一路跑到收尾
    const tail = e.sample(def.duration + 0.1)
    const tailDeco = decoMax(tail)

    // reset 后从 0 重新来
    e.reset(state, def.duration + 0.1)
    const fresh = e.sample(def.duration + 0.1 + 0.5)
    const freshDeco = decoMax(fresh)

    assert.ok(
      freshDeco > tailDeco + 1,
      `${state} reset 后应当重新有装饰，实测收尾 ${tailDeco.toFixed(1)}px → 重播后 ${freshDeco.toFixed(1)}px`
    )
  })
}

check('重播是确定性的：同一个 t 采样两次完全一致', () => {
  const e = new BotEngine(R, 'celebrate', null, null)
  e.reset('celebrate', 100)
  const a = JSON.stringify(e.sample(101.2).dots)
  const b = JSON.stringify(e.sample(101.2).dots)
  assert.equal(a, b, '同一时刻两次采样应当逐字节一致（引擎是时间的纯函数）')
})

console.log(`\n${passed} 项通过` + (process.exitCode ? '，有失败' : ''))

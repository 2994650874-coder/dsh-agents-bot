/**
 * 轮播调度：把一个活动的「播放列表」变成当前该播哪个动画。
 *
 * ── 为什么需要它 ────────────────────────────────────────────────────
 * 用户要的效果是「空闲的时候，空闲播一会儿、眨眼播一会儿，两个交替」。
 * 引擎只会「切到某个状态」，不会自己排片；所以排片这件事必须有人做。
 *
 * ── 为什么放在渲染层，不改引擎 ──────────────────────────────────────
 * `Bot.tsx` 本来就是用 React 的 effect 驱动 `engine.setState(state)`。
 * 也就是说「当前播什么」本来就是一个 props，天然可以从外面算。
 * 改引擎反而要动美术层的状态机，那是逐帧量出来的东西，不该被业务需求带走。
 *
 * ── 为什么按「遍数」而不是「秒」─────────────────────────────────────
 * 每个动画有自己实测的长度（眨眼 1.6 秒、思考 2.6 秒、检索 3.4 秒）。
 * 按秒配的话，同一个「15 秒」在眨眼那里是 9 遍、在检索那里只有 4 遍，
 * 用户算不清自己配出来是什么样。按遍数就是「空闲播 5 遍，眨眼播 1 遍」，
 * 所见即所得；而且整遍播不会被截断（`alert` 的感叹号 2 秒才回位，
 * `orbit` 2.5 秒才收干净，截断会露馅）。
 *
 * ── 这里为什么是纯函数 ──────────────────────────────────────────────
 * `slotAt` 只吃「起始时刻 + 播放列表 + 动画时长表」，不碰 DOM、不碰
 * 定时器。这样它可以被测试直接钉死，而 React 那边只负责「每秒问它一次
 * 现在该播什么」。时间推进的活交给已有的 rAF 循环，不新开定时器 ——
 * 9 个格子各开一个 setInterval 是没必要的开销。
 *
 * @module 轮播调度
 */
import { STATE_BY_ID, type StateId } from '../bot/states'
import { ANIMATION_OPTIONS, type Rotation } from './activities'

/**
 * 动画 id → 面板上显示的中文名。
 *
 * 从 `ANIMATION_OPTIONS` 推，不另列 —— 两份表会漂移，而漂移的表现是
 * 「设置页里写的名字和下拉里选的名字对不上」。
 *
 * ── 为什么注释里要专门写这一条（2026-10-31）──────────────────────────
 * `describeRotation` 原来输出的是**引擎 id**（`idle ×5 → wink ×1`）。
 * 那个字符串以前只出现在 `title` 提示里，没人看；现在「试播」会把它摆在
 * 试片标题上（`空闲 ×5 → 眨眼 ×1`），露一眼就发现是英文 —— 用户不认识
 * `wink`。改成中文名。
 */
const LABEL = new Map(ANIMATION_OPTIONS.map((o) => [o.id as string, o.label]))

/**
 * 一个动画「播一遍」要多久。
 *
 * 取 `StateDef.duration`（参考视频里量出来的保持时长），不是 `morph`
 * （那是入场过渡）。用 `minDuration` 兜底：有几个状态短于它的最短时长
 * 会露馅（感叹号没回位、三角没收回），`duration` 本身都满足，
 * 但用户可能配出更短的组合，所以这里取两者的较大值。
 */
export function playLengthOf(state: StateId): number {
  const def = STATE_BY_ID.get(state)
  if (!def) return 2
  return Math.max(def.duration, def.minDuration ?? 0)
}

/** 一个活动轮播一轮的总时长（秒）。 */
export function cycleLength(rotation: Rotation): number {
  let sum = 0
  for (const item of rotation) sum += playLengthOf(item.state) * item.plays
  return sum
}

/**
 * 从 `startedAt` 起算，到 `now` 这一刻该播什么。
 *
 * @param rotation 播放列表，至少一项
 * @param startedAt 轮播起点（毫秒，performance.now 或 Date.now 同一时钟即可）
 * @param now 当前时刻（同一时钟）
 * @returns 该播的动画、它在当前这一遍里已播多久（秒）、当前是这一项的第几遍
 *
 * ── `pass` 是干什么的（别删）─────────────────────────────────────────
 * 「连播 N 遍每一遍都从头播」这条约定，`elapsed` 表达不了 —— 调用方拿到的
 * 只是「这一遍里的进度」，而引擎自己不会重来。`Bot.tsx` 早先只比较
 * `state`，同一个状态连播第二遍时 state 没变，于是**不调 setState**，
 * 引擎内部时间就一路往前跑：第 2 遍画的是第 1 遍的收尾姿态。
 *
 * 实测症状：`检索 ×2` 的第 2 遍，`orbit` 的收尾是一条已经淡出的球 ——
 * 屏幕上就是一个静止的圆，而用户明明选了三角身形。用户报的「读取 →（动画）
 * ×2 → 空闲（异常的圆）→ 空闲（正常形状）」就是这个。
 *
 * `pass` 从 0 起，每重播一遍 +1，一轮结束后归 0。调用方见它变了就重播。
 *
 * 「已播多久」也保留：`Bot` 的引擎在状态切换时从 0 开始算动画进度，
 * 但轮播是按真实时间推进的。
 */
export function slotAt(
  rotation: Rotation,
  startedAt: number,
  now: number
): { state: StateId; elapsed: number; pass: number } {
  if (rotation.length === 0) return { state: 'idle', elapsed: 0, pass: 0 }

  const total = cycleLength(rotation)
  if (!(total > 0)) return { state: rotation[0]!.state, elapsed: 0, pass: 0 }

  // 时间差可能是负的（时钟回拨、或者 startedAt 在未来）。取模要保证结果落在 [0,total)。
  const raw = (now - startedAt) / 1000
  const t = ((raw % total) + total) % total

  let acc = 0
  for (const item of rotation) {
    const span = playLengthOf(item.state) * item.plays
    if (t < acc + span) {
      const into = t - acc
      const one = playLengthOf(item.state)
      /*
       * 同一动画连播 N 遍：每一遍都从头播，所以取模到单遍之内。
       *
       * 为什么不「播一遍然后保持」：引擎的 `sample` 是纯时间函数，
       * 同一个状态播到第 5 秒和第 2.6 秒画出来不一样（有的状态会回到
       * 收尾姿态）。连着播两遍必须是「重来一遍」，不能是一直往前跑。
       *
       * 光算出 `elapsed` 不够 —— 必须把 `pass` 一起交出去，调用方才知道
       * 什么时候该让引擎重来。这条约定以前只写在注释里，代码没兑现。
       */
      const pass = one > 0 ? Math.floor(into / one) : 0
      return { state: item.state, elapsed: one > 0 ? into % one : 0, pass }
    }
    acc += span
  }

  // 浮点边界：落在这里说明 t 恰好等于 total 附近，回到第一项。
  return { state: rotation[0]!.state, elapsed: 0, pass: 0 }
}

/**
 * 当前处于轮播的第几轮第几项 —— 只用于界面提示（「空闲×5 / 眨眼×1」里
 * 高亮正在播的那个）。不影响渲染。
 */
export function slotIndexOf(rotation: Rotation, startedAt: number, now: number): number {
  if (rotation.length === 0) return 0
  const total = cycleLength(rotation)
  if (!(total > 0)) return 0
  const raw = (now - startedAt) / 1000
  const t = ((raw % total) + total) % total
  let acc = 0
  for (let i = 0; i < rotation.length; i++) {
    const span = playLengthOf(rotation[i]!.state) * rotation[i]!.plays
    if (t < acc + span) return i
    acc += span
  }
  return 0
}

/**
 * 把一个活动轮播压成人类可读的一行字，用于设置页摘要。
 *
 * 例：`空闲 ×5 → 眨眼 ×1（一轮约 13.6 秒）`
 */
export function describeRotation(rotation: Rotation): string {
  if (rotation.length === 0) return '未配置'
  return `${describeShort(rotation)}（一轮约 ${cycleLength(rotation).toFixed(1)} 秒）`
}

/**
 * 不长后缀的版本：`空闲 ×5 → 眨眼 ×1`。
 *
 * 给「试片标题」用 —— 那里右边已经有一个「一轮约 13.6 秒」，再带一遍
 * 就重复了。拆成两个函数而不是加参数：调用点一共两处，各自要什么很明确。
 */
export function describeShort(rotation: Rotation): string {
  if (rotation.length === 0) return '未配置'
  return rotation
    .map((r) => `${LABEL.get(r.state) ?? STATE_BY_ID.get(r.state)?.id ?? r.state} ×${r.plays}`)
    .join(' → ')
}

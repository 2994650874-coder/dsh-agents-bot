/**
 * 显示节流：让每个动画至少播够一段时间，再允许切换。
 *
 * ── 为什么需要它 ──────────────────────────────────────────────────
 *
 * 真实数据（`probe-dwell-sim.mjs`，24 条会话 / 8441 个切换点）：现状下
 * 只有 **49.3%** 的停留时间够播完一个动画。根因不是「刷新太快」，是
 * **工具调用本身极短**：
 *
 *   read 8ms → orbit 需要 3400ms
 *   write/edit 26ms → play 需要 2000ms
 *   pwsh 755ms → comet 需要 2400ms
 *
 * 一次读文件 8 毫秒就结束了，而画它要 3.4 秒 —— 动画刚起头就被顶掉。
 *
 * ── 为什么不是「批量刷新」──────────────────────────────────────────
 *
 * 也模拟过「每 3 秒合并一次」：播完率能到 99%，但 `reading` 只剩 0%、
 * `writing` 只剩 2% 被显示出来 —— 它们从面板上消失了，而它们正是
 * 「这个 agent 在干什么」的核心信息。滞后还有 1.35 秒（p90 2.7s）。
 *
 * 固定时间窗跟活动什么时候发生无关，一个在 2.9 秒发生的读文件只显示
 * 0.1 秒就被下一批顶掉 —— 问题没解决，只是从「一闪而过」变成「没出现」。
 *
 * ── 这里的做法：最短停留 + 不排队 ─────────────────────────────────
 *
 * 切到一个活动后，至少停 `dwellMs`；期间来的新活动**只更新目标**，
 * 到点直接跳到**最新的那个**。中间那些丢掉，不排队。
 *
 * 为什么不能排队：队列会积压，滞后无限增长（用户原话是「去掉没播完的」，
 * 那正是不能排队的意思）。
 *
 * 实测（`probe-dwell-sim.mjs`，dwell = 1600ms）：
 *   播完率 49.3% → 94.7%，滞后 0ms，reading 保留 93%、writing 保留 96%。
 *
 * ── 性能开销 ──────────────────────────────────────────────────────
 *
 * **零额外定时器、零额外渲染。** 它不订阅任何东西、不开 setInterval，
 * 只提供两个纯函数：
 *
 *   - `pickDisplayed(prev, want, now, dwellMs)` —— 决定这一刻该显示什么
 *   - 状态是一个普通对象，由调用方用 `useRef` 持有
 *
 * 判断只在「活动值变了」时才有意义，而活动值本来就只在 React 重渲染时
 * 才可能变。所以这个函数的调用次数 ≤ 现有渲染次数，且绝大多数时候
 * 第一行就返回（活动没变）。见 `probe-dwell-cost.mjs` 的实测。
 */
import type { Activity } from './activities'

/** 每格的显示状态。`until` = 在此之前不允许换。 */
export interface DwellState {
  /** 正在显示的活动。 */
  shown: Activity
  /** 这个活动最早可以被换掉的时刻（毫秒，与 `now` 同一时钟）。 */
  until: number
}

/**
 * 决定这一刻该显示什么活动。
 *
 * @param prev   上一帧的显示状态（首次为 undefined）
 * @param want   真实推导出来的活动
 * @param now    当前时刻（毫秒，必须与之前调用同一个时钟 —— 面板里用 `Date.now()`）
 * @param dwellMs 最短停留时长；`0` 表示不节流（= 现状行为）
 * @returns 新的显示状态
 *
 * 三种情况：
 *   1. 没节流（`dwellMs <= 0`）→ 直接跟随 `want`，与改造前完全一致
 *   2. 还没到解禁时刻 → 保持 `shown` 不动（`want` 被丢掉，不排队）
 *   3. 到了解禁时刻且 `want` 不同 → 切到 `want`，重新计时
 *
 * 注意第 2 条里 `want` 被丢弃后，到点会直接跳到「那一刻的 want」——
 * 因为调用方每帧都传最新的 `want`，不需要我们记队列。
 */
export function pickDisplayed(
  prev: DwellState | undefined,
  want: Activity,
  now: number,
  dwellMs: number
): DwellState {
  // 不节流：与改造前完全一致
  if (!(dwellMs > 0)) return { shown: want, until: 0 }

  // 首次：立刻显示，开始计时
  if (prev === undefined) return { shown: want, until: now + dwellMs }

  // 活动没变：只续期不变更（`until` 不动，否则会一直往后推、永远不换）
  if (prev.shown === want) return prev

  // 还在最短停留期内：保持不动，丢掉 want
  if (now < prev.until) return prev

  // 到期了：切到最新目标
  return { shown: want, until: now + dwellMs }
}

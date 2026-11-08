/**
 * 「最短停留时间」能不能解决动画播不完？——用真实事件流离线模拟几种策略。
 *
 * ── 背景 ──────────────────────────────────────────────────────────
 *
 * 真实数据（`probe-activity-churn.mjs`）：`read` 工具调用中位 **8ms**、
 * `write`/`edit` 26ms，而它们对应的 `orbit` 动画要 **3400ms**、`play` 要 2000ms。
 * 也就是说一次读文件事件来了，动画刚起头就被下一个事件顶掉 ——
 * **用户看到的是「跳来跳去」，不是「流畅」**。这个直觉是对的。
 *
 * ── 三种策略 ──────────────────────────────────────────────────────
 *
 * A. 现状：活动一变就切（无节流）
 * B. 用户提议：每 3 秒批量取一次，取窗口内最后一个
 * C. 另一种：最短停留时间（rate limit）—— 切过去之后至少停 N 毫秒，
 *    期间来的新活动只更新「目标」，到点直接跳到最新的那个
 *
 * 为什么 C 可能比 B 好：B 的时间窗跟活动起点无关，一个在 2.9 秒发生的
 * 读文件会只显示 0.1 秒就被下一批顶掉 —— 问题没解决。C 保证「每个显示
 * 出来的动画至少播够 N 毫秒」，与它什么时候发生无关。
 *
 * 量什么：
 *   - 显示切换次数（越少越安静）
 *   - 「播得完」比例（停留 >= 动画时长）
 *   - **丢失率**：真实发生过、但一次都没显示出来的活动
 *   - **滞后**：从活动发生到它被显示出来的延迟
 *
 * 用法：node tools/build-test.mjs && node tools/probe-dwell-sim.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { deriveActivity, DEFAULT_ROTATION } = require(resolve(ROOT, '.test-build', 'test-pure.cjs'))

const HOME = process.env.USERPROFILE
const SESS = path.join(HOME, '.dsh', 'sessions')
const ZSTD = path.join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')
const { scanZstdFrames } = await import(pathToFileURL(ZSTD).href)

const ANIM_SEC = {
  idle: 2.4, thinking: 2.6, wink: 1.6, wide: 1.8, alert: 2.4, notify: 2.2,
  exclaim: 2.4, sleep: 2.4, egg: 1.8, play: 2.0, orbit: 3.4, burst: 2.0,
  comet: 2.4, swirl: 1.3
}
/** 某活动的第一项动画多长（毫秒）。 */
const animMs = (a) => (ANIM_SEC[DEFAULT_ROTATION[a]?.[0]?.state] ?? 2) * 1000

function readEvents(p) {
  let buf
  try {
    buf = fs.readFileSync(p)
  } catch {
    return null
  }
  let text = ''
  try {
    const fr = scanZstdFrames(buf)
    const parts = []
    for (const f of fr.frames) {
      try {
        parts.push(zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8'))
      } catch {}
    }
    text = parts.join('')
  } catch {
    return null
  }
  const out = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      out.push(JSON.parse(line))
    } catch {}
  }
  return out
}

function collect(dir, acc, depth = 0) {
  if (depth > 3) return acc
  let ents
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of ents) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      collect(p, acc, depth + 1)
      continue
    }
    if (!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) continue
    const evs = readEvents(p)
    if (evs && evs.length) acc.push(evs)
  }
  return acc
}

/** 还原活动时间线（与 probe-activity-churn 同一套复刻）。 */
function activityTimeline(events) {
  const st = { running: false, pendingInteraction: false, completionUnread: false }
  const proj = { tool: null, tools: 0, errorAt: 0, compacting: false, bg: 0 }
  const openCalls = new Map()
  const jobs = new Map()
  const points = []
  let last = null

  const push = (t) => {
    const a = deriveActivity({
      row: { id: 'x', updatedAt: t },
      status: { ...st },
      proj: { ...proj },
      now: t,
      sleepMinutes: 30
    })
    if (a !== last) {
      points.push({ t, a })
      last = a
    }
  }

  for (const e of events) {
    const t = e.time
    if (typeof t !== 'number') continue
    const ty = e.type
    let touched = false

    if (ty === 'tool/call') {
      const cid = e.data?.callId
      const name = e.data?.name
      if (typeof cid === 'string' && typeof name === 'string') {
        openCalls.set(cid, name)
        proj.tool = name
        proj.tools = openCalls.size
        st.running = true
        touched = true
      }
    } else if (ty === 'tool/result') {
      const cid = e.data?.message?.toolCallId ?? e.data?.toolCallId
      if (typeof cid === 'string') {
        openCalls.delete(cid)
        proj.tools = openCalls.size
        const left = [...openCalls.values()]
        proj.tool = left.length ? left[left.length - 1] : null
        if (e.data?.message?.isError === true) proj.errorAt = t
        touched = true
      }
    } else if (ty === 'job/registered') {
      if (typeof e.data?.jobId === 'string') {
        jobs.set(e.data.jobId, e.data?.toolCall?.callId)
        proj.bg = jobs.size
        touched = true
      }
    } else if (ty === 'job/settled') {
      if (typeof e.data?.jobId === 'string') {
        jobs.delete(e.data.jobId)
        proj.bg = jobs.size
        touched = true
      }
    } else if (ty === 'compaction/start') {
      proj.compacting = true
      touched = true
    } else if (ty === 'compaction/end') {
      proj.compacting = false
      if (e.data?.error != null) proj.errorAt = t
      touched = true
    } else if (ty === 'turn/start') {
      st.running = true
      st.completionUnread = false
      touched = true
    } else if (ty === 'turn/end') {
      const k = e.data?.reason?.kind
      if (k === 'error' || k === 'aborted' || k === 'interrupted') proj.errorAt = t
      openCalls.clear()
      proj.tools = 0
      proj.tool = null
      st.running = false
      st.completionUnread = true
      touched = true
    } else if (ty === 'assistant/attempt') {
      for (const ch of e.data?.stream ?? []) {
        if (ch.chunk?.type === 'finish' && ch.chunk.reason?.kind === 'error') proj.errorAt = t
      }
      touched = true
    }

    if (touched) push(t)
  }
  return points
}

/**
 * 跑一种策略，返回显示时间线 `[{t, a}]`（t = 这个活动开始被显示的时刻）。
 *
 * @param tl 真实活动时间线
 * @param policy {kind:'raw'} | {kind:'batch', ms} | {kind:'dwell', ms}
 */
function simulate(tl, policy) {
  const shown = []
  if (tl.length === 0) return shown

  if (policy.kind === 'raw') {
    for (const p of tl) shown.push({ t: p.t, a: p.a, real: p.t })
    return shown
  }

  if (policy.kind === 'batch') {
    /*
     * 批量：把 [t0 + k*ms, t0 + (k+1)*ms) 内的所有活动合并成一个，
     * 在**批次结束时**才显示窗口内最后一个活动。
     *
     * 显示时刻必须是批次**结束**而不是开始 —— 批次开始时窗口还没走完，
     * 那时还不知道窗口里最后会发生什么，物理上不可能提前显示。
     * 第一版写成「批次开始」，结果滞后恒等于 0（因为开始时刻早于窗口内
     * 最后一条事件），是个假象。
     */
    const t0 = tl[0].t
    let bucket = -1
    let pending = null
    for (const p of tl) {
      const b = Math.floor((p.t - t0) / policy.ms)
      if (b !== bucket) {
        if (pending !== null) {
          pending.t = t0 + bucket * policy.ms + policy.ms // 上一批的结束时刻
          shown.push(pending)
        }
        bucket = b
        pending = { t: 0, a: p.a, real: p.t }
      } else {
        // 同一批里更新成最新的活动；显示时刻最后统一填
        pending.a = p.a
        pending.real = p.t
      }
    }
    if (pending !== null) {
      pending.t = t0 + bucket * policy.ms + policy.ms
      shown.push(pending)
    }
    return shown
  }

  if (policy.kind === 'dwell') {
    let cur = { t: tl[0].t, a: tl[0].a, real: tl[0].t }
    shown.push(cur)
    let target = cur
    for (let i = 1; i < tl.length; i++) {
      target = { t: tl[i].t, a: tl[i].a, real: tl[i].t }
      const elapsed = target.t - cur.t
      if (elapsed >= policy.ms) {
        // 停留够了，直接跳到最新目标
        cur = { t: target.t, a: target.a, real: target.real }
        shown.push(cur)
      }
      // 否则：不切，只更新 target（丢掉中间态，不排队）
    }
    return shown
  }
  return shown
}

/** 评价一种策略的显示结果。 */
function evaluate(tl, shown) {
  if (shown.length === 0) return null
  const spans = []
  for (let i = 1; i < shown.length; i++) spans.push(shown[i].t - shown[i - 1].t)

  const complete = spans.filter((d, i) => d >= animMs(shown[i].a)).length

  // 丢失：真实出现过的活动，一次都没被显示
  const shownSet = new Set(shown.map((s) => s.a))
  const realSet = new Set(tl.map((p) => p.a))
  const lostList = [...realSet].filter((a) => !shownSet.has(a))

  // 滞后：显示时刻 - 该活动真实发生时刻
  const lags = shown.map((s) => Math.max(0, s.t - s.real))

  return {
    switches: shown.length,
    complete,
    spanCount: spans.length,
    lostList,
    lags,
    spans
  }
}

/* ── 主流程 ──────────────────────────────────────────────────────── */
const sessions = collect(SESS, [])
console.log(`扫到 ${sessions.length} 个会话\n`)

const timelines = sessions.map(activityTimeline).filter((t) => t.length >= 3)
console.log(`有效时间线 ${timelines.length} 条，总切换点 ${timelines.reduce((a, t) => a + t.length, 0)}\n`)

const POLICIES = [
  ['A 现状（无节流）', { kind: 'raw' }],
  ['B 用户提议：3 秒批量', { kind: 'batch', ms: 3000 }],
  ['B1 1 秒批量', { kind: 'batch', ms: 1000 }],
  ['C 最短停留 800ms', { kind: 'dwell', ms: 800 }],
  ['C 最短停留 1200ms', { kind: 'dwell', ms: 1200 }],
  ['C 最短停留 1600ms', { kind: 'dwell', ms: 1600 }],
  ['C 最短停留 2400ms', { kind: 'dwell', ms: 2400 }],
  ['C 最短停留 3000ms', { kind: 'dwell', ms: 3000 }]
]

const acc = new Map()
for (const [label] of POLICIES) {
  acc.set(label, { switches: 0, complete: 0, spanCount: 0, lost: new Set(), lags: [], spans: [] })
}

for (const tl of timelines) {
  for (const [label, policy] of POLICIES) {
    const shown = simulate(tl, policy)
    const ev = evaluate(tl, shown)
    if (!ev) continue
    const a = acc.get(label)
    a.switches += ev.switches
    a.complete += ev.complete
    a.spanCount += ev.spanCount
    for (const x of ev.lostList) a.lost.add(x)
    a.lags.push(...ev.lags)
    a.spans.push(...ev.spans)
  }
}

const q = (xs, p) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(s.length * p))]
}

console.log('策略                     总切换   播完比例   丢活动种数   滞后中位   滞后p90')
console.log('─'.repeat(80))
for (const [label] of POLICIES) {
  const a = acc.get(label)
  console.log(
    `${label.padEnd(22)}  ${String(a.switches).padStart(7)}  ` +
      `${((a.complete / Math.max(1, a.spanCount)) * 100).toFixed(1).padStart(8)}%  ` +
      `${String(a.lost.size).padStart(10)}  ` +
      `${q(a.lags, 0.5).toFixed(0).padStart(8)} ms  ` +
      `${q(a.lags, 0.9).toFixed(0).padStart(7)} ms`
  )
}

console.log('\n批量策略丢掉的活动中，哪些从此永远看不到：')
for (const [label] of POLICIES) {
  if (!label.startsWith('B')) continue
  const lost = [...acc.get(label).lost]
  console.log(`  ${label}: ${lost.length === 0 ? '（无）' : lost.join(' / ')}`)
}

/* ── 按活动看：哪些会被「合并掉」 ─────────────────────────────────── */
const real = new Map()
for (const tl of timelines) for (const p of tl) real.set(p.a, (real.get(p.a) ?? 0) + 1)

const shownOf = (policy) => {
  const m = new Map()
  for (const tl of timelines) {
    for (const s of simulate(tl, policy)) m.set(s.a, (m.get(s.a) ?? 0) + 1)
  }
  return m
}

const B3 = shownOf({ kind: 'batch', ms: 3000 })
const C16 = shownOf({ kind: 'dwell', ms: 1600 })

console.log('\n各活动「被显示出来的比例」（显示次数 / 真实出现次数）：')
console.log('活动         真实次数    3秒批量    最短停留1.6s')
console.log('─'.repeat(52))
for (const [a, n] of [...real.entries()].sort((x, y) => y[1] - x[1])) {
  const b = B3.get(a) ?? 0
  const c = C16.get(a) ?? 0
  const fmt = (v) => `${((v / n) * 100).toFixed(0)}%`.padStart(7)
  const warn = (v) => (v / n < 0.1 ? '  ←' : '')
  console.log(
    `${a.padEnd(12)} ${String(n).padStart(7)}  ${fmt(b)}${warn(b).padEnd(4)}  ${fmt(c)}${warn(c)}`
  )
}
console.log('\n← 表示只剩不到 10%：那个动画基本等于从面板上消失了。')

console.log('\n注：播完比例 = 停留时间 >= 该活动首项动画时长的比例（全局）；')
console.log('    丢活动 = 真实出现过但一次都没显示出来的活动种类；')
console.log('    滞后 = 从活动真实发生到它被显示出来的时间。')

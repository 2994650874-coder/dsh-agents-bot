/**
 * agentsBot 投影单元 —— Host 半侧，唯一的职责。
 *
 * ── 它解决什么 ──────────────────────────────────────────────────────
 * 客户端本来只知道「这个会话在跑 / 没跑」，不知道**在跑什么**。所以面板
 * 只能画出空闲、思考、等待、完成四个状态，其余十个永远不亮。
 *
 * 工具级信息全在会话日志里（`tool/call` / `tool/result`），但客户端不该
 * 自己去重放日志 —— 宿主为这件事提供了正规扩展点：`sessionProjections`
 * 注册表。本文件就是往它里面注册一个折叠单元。
 *
 * ── 为什么不是「改 harness」─────────────────────────────────────────
 * app.asar 一个字节都不动。宿主只订阅一次 `session/event`，之后把每条
 * 已提交事件主动推给每个已注册单元；本单元算出当前值，注册表负责
 * 校验、推送、断线重连后的基线补齐。官方自己的 `sessionStats`、
 * `subagent`、 `userQuestions`、`tokenUsage` 都是这个形状。
 *
 * ── 三条硬规矩（违反会静默出错，不是崩溃）───────────────────────────
 *  1. **无关事件必须返回同一个 state 引用**。注册表第一道 `Object.is`
 *     闸门据此跳过全部下游工作；返回新对象等于每条事件都推一次。
 *  2. `apply` 必须同步。返回 Promise 会被 `viewSchema.parse` 拒掉。
 *  3. `stateVersion` 一旦改动语义就要 +1，否则磁盘上的旧检查点会被
 *     当成当前值读回来（`restore` 只比 `ver`，不比内容）。
 *
 * ── 常驻，不做开关 ──────────────────────────────────────────────────
 * 注册挂在插件 fiber 上，进程活着它就在，与面板开没开无关。
 * 实测折叠本机全部 16493 条事件耗时 1.0 ms（单条 0.06 µs）；
 * 无关事件连一次推送都不会发生。为这点开销加开关，只会多一条出错路径。
 *
 * ── 边界：不重复造宿主已有的数据 ────────────────────────────────────
 * 只送客户端**算不出来**的东西。三类不归本单元管：
 *
 *  · 「等待确认」「刚完成」—— 客户端从 `pendingInteraction` /
 *    `completionUnread` 判定，另一条数据通路。
 *  · 「空闲多久」—— 会话列表行的 `updatedAt` 已经是宿主从
 *    `sessionListMetadata.lastPromptAt` 算好的。这里再维护一份时间戳
 *    等于两个来源，迟早打架（第一版真的加了 `at` 字段，用真实日志
 *    对账时才发现两边的口径对不上）。休眠判据用宿主那份。
 *  · 会话名、父子关系 —— 列表行和 `agentTeam` / `subagentCatalog` 已有。
 *
 * @module dsh-agents-bot/host
 */

import {registerIsolationStatic} from './isolationStatic'

/** 注册表里的键。带插件前缀，避免与官方单元撞名（撞了注册直接抛错）。 */
const KEY = 'agentsBot'

/**
 * 语义版本。字段或折叠规则一变就要 +1。
 *
 * 1 —— 初版：任何工具、请求、压缩或回合失败都写 errorAt。
 * 2 —— errorAt 只记最终回合里的结构化模型请求失败，排除工作流内部错误。
 */
const STATE_VERSION = 2

/**
 * 一个能 `parse()` 的最小校验器。
 *
 * 注册表在三个地方调用它：检查点恢复（`stateSchema`）、每次推送前校验
 * 客户端视图（`viewSchema`）。它只需要「不合法就抛错」这一个行为。
 *
 * **不引 zod**：为了几个字段的类型判断给插件加一个运行时依赖，而插件
 * 目前的 dependencies 是空的（这是设计要求，见 package.json）。
 */
function shape(check, what) {
  return {
    parse(value) {
      if (!check(value)) throw new Error(`agentsBot ${what} failed validation`)
      return value
    }
  }
}

const isTime = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0
const isCount = (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v)

const stateSchema = shape(
  (v) =>
    isPlainObject(v) &&
    isPlainObject(v.calls) &&
    isPlainObject(v.jobs) &&
    isCount(v.bg) &&
    typeof v.compacting === 'boolean' &&
    isTime(v.errorAt),
  'state'
)

const viewSchema = shape(
  (v) =>
    isPlainObject(v) &&
    (v.tool === null || typeof v.tool === 'string') &&
    isCount(v.tools) &&
    isCount(v.bg) &&
    typeof v.compacting === 'boolean' &&
    isTime(v.errorAt),
  'view'
)

/**
 * 初始状态。
 *
 * 全部是确定值：`init` 的结果会被写进检查点，`Date.now()` 之类会让
 * 冷读和热读得到不同的折叠起点。
 */
function init() {
  return {
    /** 在跑的工具：callId → { name, at }。允许并发，所以是表不是单值。 */
    calls: {},
    /** 已登记的任务：jobId → { callId, orphaned }。 */
    jobs: {},
    /** 后台任务数：结果已返回、任务仍在跑的那些。 */
    bg: 0,
    /** 是否正在压缩上下文。 */
    compacting: false,
    /** 最近一次最终模型请求失败的日志时刻（0 = 无待提示错误）。 */
    errorAt: 0
  }
}
/**
 * 仅把终止回合的模型/传输请求错误用于「出错」动画。
 *
 * DSH 将 LlmError 的 code/status 原样写入 turn/end.reason.error；
 * 工具激活和其他工作流异常则分别折成 TOOL_ACTIVATION_FAILED / UNKNOWN。
 * HTTP 状态（如 439）也是提供方失败的独立证据，不凭错误文案猜。
 * assistant/attempt 可在同一回合重试，因此不能直接点亮错误动画。
 */
function isProviderTurnFailure(reason) {
  if (reason?.kind !== 'error') return false
  const failure = reason.error
  if (failure === null || typeof failure !== 'object') return false
  if (Number.isInteger(failure.status) && failure.status >= 400 && failure.status <= 599) return true
  return typeof failure.code === 'string' && failure.code.length > 0 &&
    failure.code !== 'TOOL_ACTIVATION_FAILED' && failure.code !== 'UNKNOWN'
}
function applyEvent(state, event) {
  switch (event.type) {
    case 'tool/call': {
      const callId = event.data?.callId
      const name = event.data?.name
      if (typeof callId !== 'string' || typeof name !== 'string') return state
      return {
        ...state,
        calls: { ...state.calls, [callId]: { name, at: event.time } }
      }
    }

    case 'tool/result': {
      const callId = event.data?.message?.toolCallId
      const calls = { ...state.calls }
      if (typeof callId === 'string') delete calls[callId]

      /*
       * 后台任务判据：结果已经返回、任务却还在跑。
       *
       * `job/registered` 对**每一次**工具调用都会发（本机 1160 次里 1135 次
       * 是同一次调用的开始/结束），所以不能一见到它就当作「后台任务」，
       * 那会把「跑命令」这一行永远点亮。真正的后台任务很少（本机 4 次），
       * 特征是 `job/settled` 明显晚于 `tool/result` —— 只有这时才计数。
       */
      let bg = state.bg
      const jobs = { ...state.jobs }
      if (typeof callId === 'string') {
        for (const [jobId, job] of Object.entries(state.jobs)) {
          if (job.callId !== callId || job.orphaned) continue
          jobs[jobId] = { ...job, orphaned: true }
          bg += 1
        }
      }

      return {
        ...state,
        calls,
        jobs,
        bg
      }
    }

    case 'job/registered': {
      const jobId = event.data?.jobId
      const callId = event.data?.toolCall?.callId
      if (typeof jobId !== 'string') return state
      if (state.jobs[jobId] !== undefined) return state
      return {
        ...state,
        jobs: { ...state.jobs, [jobId]: { callId: typeof callId === 'string' ? callId : null, orphaned: false } }
      }
    }

    case 'job/settled': {
      const jobId = event.data?.jobId
      if (typeof jobId !== 'string') return state
      const job = state.jobs[jobId]
      if (job === undefined) return state
      const jobs = { ...state.jobs }
      delete jobs[jobId]
      return { ...state, jobs, bg: job.orphaned ? Math.max(0, state.bg - 1) : state.bg }
    }

    case 'compaction/start':
      return state.compacting ? state : { ...state, compacting: true }

    case 'compaction/end':
      return state.compacting ? { ...state, compacting: false } : state

    case 'turn/end': {
      const failed = isProviderTurnFailure(event.data?.reason)
      const recovered = event.data?.reason?.kind === 'completed' && state.errorAt !== 0
      /*
       * 回合结束时清掉「还在跑的工具」：被取消的回合不会有 `tool/result`，
       * 不清的话那些 callId 会永久留在表里，「跑命令」这一行就再也不灭了。
       *
       * 后台任务分两种收尾：还没变成 orphaned 的（结果没等到）直接丢；
       * 已经 orphaned 的留着，它的 `job/settled` 可能在下一个回合才到。
       */
      const jobs = {}
      for (const [jobId, job] of Object.entries(state.jobs)) if (job.orphaned) jobs[jobId] = job
      const clean = Object.keys(state.calls).length === 0 && !state.compacting && Object.keys(jobs).length === Object.keys(state.jobs).length
      if (!failed && !recovered && clean) return state
      return {
        ...state,
        calls: {},
        jobs,
        compacting: false,
        errorAt: failed ? event.time : recovered ? 0 : state.errorAt
      }
    }

    default:
      // 其余四十几种事件与本单元无关 —— 必须原样返回，见文件头规矩 1。
      return state
  }
}

/**
 * 折叠结果 → 客户端视图。
 *
 * `calls` 是一张表，客户端要的只是「现在在跑什么、几个在跑」，所以在
 * 这里折成两个标量，避免把 callId 泄露到线上。
 *
 * `tool` 取**最近开始**的那个：并发时用户关心的是刚触发的动作，
 * 而不是最先触发的那个。
 */
function viewOf(state) {
  let tool = null
  let tools = 0
  let newest = -1
  for (const call of Object.values(state.calls)) {
    tools += 1
    if (call.at >= newest) {
      newest = call.at
      tool = call.name
    }
  }
  return {
    tool,
    tools,
    bg: state.bg,
    compacting: state.compacting,
    errorAt: state.errorAt
  }
}

/** 注册表要的那个定义对象。 */
export const agentsBotProjection = {
  key: KEY,
  stateVersion: STATE_VERSION,
  stateSchema,
  init,
  apply: applyEvent,
  wire: { viewSchema, view: viewOf }
}

/** Cordis 插件名。 */
export const name = 'dsh-agents-bot'

/**
 * 不把 `sessionProjections` 写进 inject 数组。
 *
 * 写进去等于「注册表缺席就不启动插件」—— 那样在没装注册表的部署上，
 * 连右栏面板都不会出现，且没有任何报错。用 `ctx.inject` 是「在就接上、
 * 不在就等」，与客户端半侧接 `sidebarRightTabs` 的理由完全相同。
 */
export const inject = []

/**
 * 挂载。
 *
 * 注册是挂在调用方 fiber 上的 effect：插件卸载时键自动从快照里消失，
 * 客户端读到的是「能力缺席」而不是错误值。所以不需要手工清理。
 */
export function apply(ctx) {
  // Only loopback static assets; no session API. A bind failure leaves the original sidebar usable.
  registerIsolationStatic(ctx, {onError: (error) => console.warn('[dsh-agents-bot] isolated canvas unavailable:', (error as NodeJS.ErrnoException).code ?? 'listen failed')})
  ctx.inject(['sessionProjections'], (scope) => {
    scope.sessionProjections.register(agentsBotProjection)
  })
}

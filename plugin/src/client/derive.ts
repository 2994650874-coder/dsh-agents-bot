/**
 * 活动推导：把「会话列表 + 会话状态 + agentsBot 投影」折成一个活动。
 *
 * ── 为什么单独一个文件 ──────────────────────────────────────────────
 * 优先级规则是本次改动里最容易出错、也最难在界面上发现的地方
 * （顺序错了只是「有时候状态不对」，不会报错）。把它抽成纯函数，
 * 就能用测试把每一条优先级钉死。
 *
 * ── 优先级（从高到低）────────────────────────────────────────────────
 *  1. 出错          —— 用户最需要立刻看到的东西，压过一切
 *  2. 等待确认      —— 卡住了，等人
 *  3. 启动中        —— 子代理刚创建，还没起来
 *  4. 压缩上下文    —— 会短暂占满模型，用户要知道为什么没动静
 *  5. 具体工具      —— 读 / 检索 / 跑命令 / 写文件
 *  6. 后台任务      —— 结果已返回但任务还在跑
 *  7. 刚完成        —— 完成了但还没被看过
 *  8. 思考中        —— 在跑但没有具体工具
 *  9. 休眠 / 空闲
 *
 * 为什么「出错」压过「等待确认」：出错时如果还在等确认，用户会以为是
 * 自己没点按钮，而实际上是上一轮已经挂了。
 *
 * 为什么「具体工具」压过「后台任务」：正在跑的工具是**当下**的动作，
 * 后台任务是背景噪声。反过来会让面板长期停在「后台任务」上。
 *
 * @module 活动推导
 */
import type { Activity } from './activities'
import { activityOfTool } from './activities'

/** 会话状态（来自 useSessionStatus）。 */
export interface SessionStatus {
  running?: boolean
  pendingInteraction?: unknown
  completionUnread?: boolean
}

/** 会话列表里的一行（只取本模块用到的字段）。 */
export interface SessionRow {
  id: string
  displayTitle?: string
  running?: boolean
  parentId?: string
  origin?: string
  blank?: boolean
  updatedAt?: number
}

/** `agentsBot` 投影的视图形状 —— 见 `src/host/index.ts` 的 `viewOf`。 */
export interface AvatarProjection {
  tool: string | null
  tools: number
  bg: number
  compacting: boolean
  /** 最近一次失败的日志时刻（0 = 从未）。 */
  errorAt: number
}

/** Team 成员阶段（来自 `agentTeam` 投影）。 */
export type TeamPhase = 'provisioning' | 'active' | 'failed'

export interface DeriveInput {
  row: SessionRow | undefined
  status: SessionStatus | undefined
  proj: AvatarProjection | undefined
  /** 当前时刻（毫秒，与 `errorAt` / `updatedAt` 同一基准）。 */
  now: number
  /** 空闲多少分钟算休眠。 */
  sleepMinutes: number
  /** Team 成员阶段（有的话）。`provisioning` 直接判启动中。 */
  teamPhase?: TeamPhase
}

/**
 * 出错提示的有效期。
 *
 * 出错要「留一会儿」但不能永远留着 —— 用户看到了就够，一直红着会让
 * 面板失去信息量。取 15 秒：比 `alert` 动画（2.4 秒）长得多，够看；
 * 又短于一个典型回合，不会串到下一轮。
 */
const ERROR_WINDOW_MS = 15000

/**
 * 子代理「刚创建还没起来」的判定窗口。
 *
 * 权威信号是 `team/member` 的 `phase === 'provisioning'`，但那只在
 * Team 模式下有。没有它时退化成时间判据：子代理创建后 N 秒内算启动中。
 * 取 6 秒 —— 实测子代理从创建到第一条事件通常在 2~4 秒。
 */
const SPAWN_WINDOW_MS = 6000

/** 子代理判据：`origin` 是子代理，或挂在别人名下。 */
function isChildRow(row: SessionRow | undefined): boolean {
  return row?.origin === 'subagent' || row?.parentId !== undefined
}

/**
 * 折出活动。
 *
 * 用对象参数而不是位置参数：这里已经有六个输入，位置传参错一个
 * 就是「状态偶尔不对」，排查成本远高于写这行对象的成本。
 */
export function deriveActivity({ row, status, proj, now, sleepMinutes, teamPhase }: DeriveInput): Activity {
  /* ── 1. 出错 ──────────────────────────────────────────────────────── */
  // `errorAt` 是日志时刻，宿主用同一个 Date.now 基准，所以可以直接比。
  if (proj !== undefined && proj.errorAt > 0 && now - proj.errorAt < ERROR_WINDOW_MS) {
    return 'error'
  }

  /* ── 2. 等待确认 ──────────────────────────────────────────────────── */
  if (status?.pendingInteraction) return 'waiting'

  /* ── 3. 启动中（子代理）───────────────────────────────────────────── */
  if (teamPhase === 'provisioning') return 'spawning'
  if (isChildRow(row) && row?.blank === false) {
    /*
     * 两个判据，都在「还没有任何活动」的前提下才成立：
     *
     *  · `updatedAt === 0` —— 宿主给「只在 subagentCatalog 里出现、还没
     *    产生过事件」的子代理显式写 0（见 session-controller 的
     *    `projectList()`）。这是最准的一个。
     *  · 刚创建 6 秒内 —— 兜底，覆盖 `updatedAt` 已被首条事件更新的情况。
     *
     * 都要求 `running !== true`：已经开始跑的子代理不该画成蛋。
     */
    if (status?.running !== true) {
      if ((row.updatedAt ?? 0) === 0) return 'spawning'
      if (now - (row.updatedAt ?? 0) < SPAWN_WINDOW_MS) return 'spawning'
    }
  }

  /* ── 4. 压缩上下文 ────────────────────────────────────────────────── */
  if (proj?.compacting) return 'compacting'

  /* ── 5. 具体工具 ──────────────────────────────────────────────────── */
  if (proj !== undefined && proj.tools > 0 && proj.tool !== null) {
    return activityOfTool(proj.tool)
  }

  /* ── 6. 后台任务 ──────────────────────────────────────────────────── */
  if (proj !== undefined && proj.bg > 0) return 'background'

  /* ── 7. 刚完成 ────────────────────────────────────────────────────── */
  if (status?.completionUnread) return 'done'

  /* ── 8. 思考中 ────────────────────────────────────────────────────── */
  const running = status?.running ?? row?.running ?? false
  if (running) return 'thinking'

  /* ── 9. 休眠 / 空闲 ───────────────────────────────────────────────── */
  /*
   * 休眠用**会话列表的 `updatedAt`** 判，不用投影自己维护的时间戳。
   *
   * 为什么：`updatedAt` 是宿主从 `sessionListMetadata.lastPromptAt` 算好的
   * 权威值，而且它对「用户发了消息但模型还没回」这种情况也正确。
   * 投影里再维护一份时间戳等于两个来源，第一版真的这么做了，用真实日志
   * 对账时才发现两边口径对不上 —— 所以删掉了。
   */
  const lastActive = row?.updatedAt ?? 0
  if (lastActive > 0 && now - lastActive > sleepMinutes * 60_000) return 'sleep'

  return 'idle'
}

/**
 * 把投影视图里的工具名映射成活动 —— 供测试和调试直接调用。
 * 与 `deriveActivity` 里的第 5 步是同一个函数，不是另一份逻辑。
 */
export { activityOfTool }

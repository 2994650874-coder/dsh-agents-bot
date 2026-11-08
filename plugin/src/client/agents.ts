/**
 * 面板主体的数据层：把 DSH 的 session 列表 + 状态快照 + 投影，折算成「一列 agent」。
 *
 * 数据来源（都是 root 作用域的标准 hook，面板不需要 session 绑定）：
 *   useSessions()      → { ids, byId, phase, projectionsBySession }
 *                        byId[id] = { id, displayTitle, running, parentId?, origin?, blank, ... }
 *   useSessionStatus() → Map<id, { running, pendingInteraction, completionUnread }>
 *   projectionsBySession[id].values.agentsBot  → Host 投影（工具名 / 出错 / 压缩 / 后台任务）
 *
 * 注意 `running` 有两个来源：list 行上的 `running`（Host 列表基线）与 status 的
 * `running`（含 `api-session/status` 事件）。后者更新更快，优先用它。
 *
 * ── 投影为什么从 `projectionsBySession` 读，而不是别的 hook ────────────
 * 宿主的 `useProjection(key)` 是 per-session 的（要先绑定某个 session），
 * 而本面板是**跨会话**的网格。`projectionsBySession` 是列表快照里
 * 已经按会话分好组的投影值，一次拿到全部，正好匹配「并排看多个 agent」。
 * 它的引用稳定性由宿主保证（`values()` 缓存到下一次变化），所以
 * `useMemo` 的依赖比较是有效的。
 */
import type { Activity } from './activities'
import { deriveActivity, type AvatarProjection, type SessionRow, type SessionStatus } from './derive'

export interface AgentRow {
  id: string
  name: string
  /** 是不是子 agent（subagent / teammate） */
  isChild: boolean
  parentId?: string
  activity: Activity
  /** 最近一次活动变化的时间戳，用于「刚完成」的淡出 */
  changedAt: number
  /** 这一行的 Host 投影（可能 undefined：老版本 Host 半侧没装） */
  projection?: AvatarProjection
}

interface ListRow extends SessionRow {
  retainedBy?: { mainView?: number }
}

interface ListSnapshot {
  ids: string[]
  byId: Record<string, ListRow>
  phase?: string
  projectionsBySession?: Record<string, { values?: Record<string, unknown> }>
}

/** One owner for current-window membership; a fork is not automatically a child. */
export function activeSessionOf(list: unknown): string | undefined {
  const snapshot = list as Pick<ListSnapshot, 'ids' | 'byId'> | undefined
  if (!snapshot?.byId || !Array.isArray(snapshot.ids)) return undefined
  const inIds = new Set(snapshot.ids)
  for (const id of snapshot.ids) {
    const row = snapshot.byId[id]
    if (!row || isRealChild(row, id, inIds)) continue
    if ((row.retainedBy?.mainView ?? 0) > 0) return id
  }
  return undefined
}

/** Archived and genuinely absent picked sessions are eviction candidates, not hidden cells. */
export function unavailableSessionIds(
  list: ListSnapshot | undefined, activeId: string | undefined, selected: readonly string[],
  archivedIds: readonly string[] | undefined
): Set<string> {
  const unavailable = new Set(archivedIds ?? [])
  if (list?.phase === 'ready' && activeId && list.ids.includes(activeId)) {
    for (const id of selected) {
      if (!list.ids.includes(id) && !list.byId[id]) unavailable.add(id)
    }
  }
  return unavailable
}

/** Team 投影里的一条成员。字段名取自 `TeamMemberProjection`。 */
interface TeamMember {
  id: string
  name: string
  role: 'lead' | 'teammate'
  phase: 'provisioning' | 'active' | 'failed'
}

/**
 * 从 Team 投影里捞出「id → 成员名」。
 * 投影挂在 Lead 会话下：`projectionsBySession[leadId].values.agentTeam`。
 */
export function teamNames(list: ListSnapshot | undefined): Map<string, TeamMember> {
  const out = new Map<string, TeamMember>()
  const bySession = list?.projectionsBySession
  if (!bySession) return out
  for (const projection of Object.values(bySession)) {
    const team = projection?.values?.agentTeam as { members?: TeamMember[] } | undefined
    for (const m of team?.members ?? []) {
      if (m && typeof m.id === 'string') out.set(m.id, m)
    }
  }
  return out
}

/**
 * 从列表快照里取出某个会话的 `agentsBot` 投影。
 *
 * 形状校验做在这里：投影是跨进程传来的 JSON，宿主校验的是它的 wire
 * schema（我们自己的），但客户端仍要防「字段缺失」—— 老版本 Host 半侧
 * 根本没注册这个键，读到的就是 `undefined`。缺字段一律当「没有投影」，
 * 让活动推导回落到四个基础状态，而不是崩掉。
 */
export function avatarProjectionOf(list: ListSnapshot | undefined, id: string): AvatarProjection | undefined {
  const raw = list?.projectionsBySession?.[id]?.values?.agentsBot
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as Record<string, unknown>
  const tool = v.tool
  const tools = v.tools
  const bg = v.bg
  const compacting = v.compacting
  const errorAt = v.errorAt
  if (tool !== null && typeof tool !== 'string') return undefined
  if (typeof tools !== 'number' || !Number.isFinite(tools)) return undefined
  if (typeof bg !== 'number' || !Number.isFinite(bg)) return undefined
  if (typeof compacting !== 'boolean') return undefined
  if (typeof errorAt !== 'number' || !Number.isFinite(errorAt)) return undefined
  return { tool, tools, bg, compacting, errorAt }
}

/**
 * 决定一行的显示名。
 *
 * ── 判据顺序（改之前先读，这里踩过一次坑）────────────────────────────
 *   1. **teammate 的名字** —— 只有子代理才用 Team 投影里的 `name`
 *   2. 会话标题（`displayTitle`，宿主已按 title → cwd basename → id 兜底）
 *   3. id 前 8 位
 *
 * ── 为什么 Lead 不能用 Team 的名字 ──────────────────────────────────
 * 宿主 `buildTeamProjection()` 里 Lead 的名字是**字面量常量**：
 *
 * ```js
 * const members = [{ id: rootId, name: 'lead', role: 'lead', phase: 'active' }]
 * ```
 *
 * 它不是从会话标题读出来的，每个会话都叫 `'lead'`。而 `agentTeam` 投影
 * 对**每个**会话都存在（`init` 就返回带 lead 的结构），所以只要无条件
 * 优先用 `member.name`，每一格都会被覆盖成 `lead` —— 实测就是这个现象：
 * 用户加几个对话后，格子和选择器里全是 lead，完全分不清谁是谁。
 *
 * 判据是 `role === 'teammate'`，不是「有没有 member」：Lead 也是 member，
 * 只是它的 name 没有信息量。
 */
function displayNameOf(row: ListRow, member: TeamMember | undefined, id: string): string {
  if (member !== undefined && member.role === 'teammate') {
    const n = member.name?.trim()
    if (n !== undefined && n !== '') return n
  }
  const title = row.displayTitle?.trim()
  if (title !== undefined && title !== '') return title
  return id.slice(0, 8)
}

/** 把列表 + 状态 + 投影折成一列 agent。Lead 在前，子 agent 按父级分组。 */
export function deriveAgents(
  list: ListSnapshot | undefined,
  status: Map<string, SessionStatus> | undefined,
  now: number,
  sleepMinutes: number
): AgentRow[] {
  if (!list) return []
  const names = teamNames(list)
  const inIds = new Set(list.ids ?? [])
  const rows: AgentRow[] = []
  for (const id of list.ids) {
    const row = list.byId[id]
    if (!row) continue
    const member = names.get(id)
    const st = status?.get(id)
    const projection = avatarProjectionOf(list, id)
    rows.push({
      id,
      name: displayNameOf(row, member, id),
      /**
       * 用 `isRealChild` 而不是「有 parentId」：分叉出来的会话也有 parentId，
       * 但它是普通会话，不该画「└」这个表示子代理的前缀。
       * 同一处误判也出现在子代理计数上（见 `countDescendants`）。
       */
      isChild: isRealChild(row, id, inIds) || member?.role === 'teammate',
      parentId: row.parentId,
      activity: deriveActivity({
        row,
        status: st,
        proj: projection,
        now,
        sleepMinutes,
        teamPhase: member?.phase
      }),
      changedAt: row.updatedAt ?? 0,
      projection
    })
  }
  // 子 agent 紧跟其父级；根会话按列表原序
  const byParent = new Map<string, AgentRow[]>()
  const roots: AgentRow[] = []
  for (const r of rows) {
    if (r.parentId && rows.some((p) => p.id === r.parentId)) {
      const arr = byParent.get(r.parentId) ?? []
      arr.push(r)
      byParent.set(r.parentId, arr)
    } else roots.push(r)
  }
  const out: AgentRow[] = []
  for (const root of roots) {
    out.push(root)
    for (const kid of byParent.get(root.id) ?? []) out.push(kid)
  }
  return out
}

/**
 * 判定一行是不是「真的子代理」。
 *
 * ── 为什么不能只看 `parentId` ──────────────────────────────────────
 * 「有父会话」的不止子代理。**分叉（fork）出来的会话也有 `parentId`** ——
 * 它是普通会话，在 DSH 的会话列表里正常出现、可以勾选、可以继续对话。
 *
 * 实测形态（本机 `~/.dsh/sessions` 同一父会话名下）：
 *
 *   b34be41d…  origin=subagent            ← 真子代理
 *   18a3bd73…  origin=subagent            ← 真子代理
 *   session-74eb1f1d…  origin=(无) seeded ← fork 副本，标题「… (1)」
 *
 * 只看 parentId 会数成 3，而用户眼里只有 2 个子代理 —— 就是这个 bug。
 *
 * ── 判据 ────────────────────────────────────────────────────────────
 *   1. `origin === 'subagent'` → 是。宿主给子代理显式打这个标记。
 *   2. `origin` 缺失且**不在 `ids` 里** → 是。这是 `subagentCatalog`
 *      投影专属、只写进 `byId` 的那种子代理（见 `projectList()`）。
 *      fork 出来的会话是普通会话，一定在 `ids` 里，会被这一条排除。
 *   3. 其余 → 不是。这包括「origin 是将来新增的别的值」——
 *      宁可少数，也不把普通会话算成子代理。
 */
export function isRealChild(
  row: { parentId?: string; origin?: string } | undefined,
  id: string,
  inIds: Set<string>
): boolean {
  if (row?.parentId === undefined) return false
  if (row.origin === 'subagent') return true
  if (row.origin === undefined) return !inIds.has(id)
  return false
}

/**
 * 数某个会话名下有几个子代理。
 *
 * **不能只遍历 `list.ids`** —— 这是踩过的坑。
 * 宿主 `dsh-api-session-controller/lib/client.js` 的 `projectList()` 里，
 * `subagentCatalog` 投影里的子代理只写进 `byId`，**不写进 `ids`**：
 *
 * ```js
 * for (const entry of items) { ids.push(entry.sessionId); byId[...] = {...} }
 * for (const [parentId, projection] of Object.entries(projectionsBySession))
 *   for (const child of projection.values.subagentCatalog ?? []) {
 *     if (child.mode === 'external') continue
 *     if (summary === void 0) byId[childId] = { id: childId, parentId, origin: 'subagent', ... }
 *   }
 * ```
 *
 * 所以「子代理在 byId 里、但不在 ids 里」是常态。只扫 ids 会一个都数不到，
 * 表现为「明明有子代理，小框不出现」。
 *
 * 但**扫全部 byId 又会多算** —— 分叉会话也带 parentId。两头都要挡，
 * 用 `isRealChild` 统一判据。递归：子代理还能派子代理，都算根会话名下。
 */
export function countDescendants(list: ListSnapshot | undefined, rootId: string | undefined): number {
  if (!list || !rootId) return 0
  const byId = list.byId ?? {}
  const inIds = new Set(list.ids ?? [])

  /** 建立 parentId → 子 id 的反向索引。扫描**全部** byId，不只 ids。 */
  const byParent = new Map<string, string[]>()
  const add = (childId: string, parentId: string | undefined) => {
    if (!parentId) return
    const arr = byParent.get(parentId) ?? []
    if (!arr.includes(childId)) arr.push(childId)
    byParent.set(parentId, arr)
  }

  // 1) 先扫 ids（覆盖普通会话，它们一定有 parentId 才是子级）
  for (const id of list.ids ?? []) {
    if (isRealChild(byId[id], id, inIds)) add(id, byId[id]?.parentId)
  }
  // 2) 再扫全部 byId —— 这一遍才捞得到只在投影里出现的子代理
  for (const [id, row] of Object.entries(byId)) {
    if (isRealChild(row, id, inIds)) add(id, row?.parentId)
  }

  let n = 0
  const seen = new Set<string>()
  const walk = (id: string) => {
    for (const kid of byParent.get(id) ?? []) {
      if (seen.has(kid)) continue
      seen.add(kid)
      n++
      walk(kid)
    }
  }
  walk(rootId)
  return n
}

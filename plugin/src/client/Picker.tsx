/**
 * 对话选择器：从「当前所有对话」里勾选哪几个显示成格子。
 *
 * 结构按用户要的三级：先选工作区 → 再选该工作区下的对话。
 * 工作区是天然的分组维度（DSH 的会话列表本来就按工作区分组），
 * 所以不是「先对话后工作区」，而是「工作区列表 → 展开该工作区的对话」。
 *
 * 两个数据来源都是 root 标准 hook，不需要 session 绑定：
 *   useWorkspaces(sel) → { items: [{ workspaceId, path, title, sessionIds }] }
 *   useSessions(sel)   → { ids, byId, ... }
 *
 * 「当前窗口」不出现在可勾选列表里 —— 它永远在第一位，不用选。
 */
import { useEffect, useMemo, useState } from 'react'
import type { AgentRow } from './agents'
import { deriveAgents } from './agents'
import { ACTIVITY_LABEL } from './activities'
import { MAX_MONITORED, togglePicked, useUi } from './store'

interface WorkspaceItem {
  workspaceId?: string
  path?: string
  title?: string
  sessionIds?: string[]
}

interface WorkspaceSnapshot {
  items?: WorkspaceItem[]
}

export interface PickerProps {
  useSessions: (sel: (s: unknown) => unknown) => unknown
  useSessionStatus: (sel: (m: unknown) => unknown) => unknown
  useWorkspaces: (sel: (s: unknown) => unknown) => unknown
  /** 当前窗口的会话 id —— 它不参与勾选，列表里要标出来 */
  activeId?: string
}

/** 工作区显示名：优先 title，其次目录名，最后兜底。 */
function workspaceLabel(w: WorkspaceItem): string {
  const t = w.title?.trim()
  if (t) return t
  const p = w.path ?? ''
  const base = p.split(/[\\/]/).filter(Boolean).pop()
  return base || p || '未分组'
}

export function MonitorPicker({ useSessions, useSessionStatus, useWorkspaces, activeId }: PickerProps) {
  const list = useSessions((s) => s) as Parameters<typeof deriveAgents>[0]
  const status = useSessionStatus((m) => m) as Parameters<typeof deriveAgents>[1]
  const wsSnap = useWorkspaces((s) => s) as WorkspaceSnapshot | undefined

  const picked = useUi('picked')
  const sleepMinutes = useUi('sleepMinutes')
  /**
   * 展开中的工作区集合。用 Set 而不是单值 —— 跨工作区挑监控时必须能同时展开多个，
   * 单值的话展开第二个就会把第一个收起来，勾过的对话看不见了。
   */
  const [openWs, setOpenWs] = useState<Set<string> | null>(null)

  /**
   * 低频时钟，只为让「休眠」这类按时间判定的活动能更新。
   *
   * 不能直接写 `Date.now()` 塞进 `useMemo` 的返回值里 —— 依赖数组只有
   * `[list, status]`，时间过去了但这两者没变，memo 不会重算，于是
   * 「休眠」永远停在打开面板那一刻的判断上。
   *
   * 5 秒一次足够：选择器里的活动只是辅助信息，不需要和格子一样实时。
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(id)
  }, [])

  /** 会话 id → agent 行，用来在列表里显示「它在干什么」。 */
  const agents: AgentRow[] = useMemo(
    () => deriveAgents(list, status, now, sleepMinutes),
    [list, status, now, sleepMinutes]
  )
  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents])

  /** 把工作区分组，并剔除空组与已归档会话。 */
  const groups = useMemo(() => {
    const items = wsSnap?.items ?? []
    const byId = list?.byId ?? {}
    const out: { key: string; label: string; ids: string[] }[] = []
    const claimed = new Set<string>()

    for (const w of items) {
      const ids = (w.sessionIds ?? []).filter((id) => {
        const row = byId[id]
        // blank 是「新建但还没说话的会话」，勾它没有意义
        return row !== undefined && !row.blank
      })
      if (ids.length === 0) continue
      for (const id of ids) claimed.add(id)
      out.push({
        key: w.workspaceId ?? w.path ?? 'ws-' + out.length,
        label: workspaceLabel(w),
        ids
      })
    }

    // 没归入任何工作区的会话（DSH 叫 ungrouped）单独成组
    const stray = (list?.ids ?? []).filter((id) => {
      const row = byId[id]
      return row !== undefined && !row.blank && !claimed.has(id)
    })
    if (stray.length > 0) out.push({ key: '', label: '未分组', ids: stray })

    return out
  }, [wsSnap, list])

  // 默认只展开「当前窗口所在的工作区」，其余收起 —— 一进来就全展开太长
  const activeGroup = useMemo(() => {
    if (activeId === undefined) return null
    return groups.find((g) => g.ids.includes(activeId))?.key ?? null
  }, [groups, activeId])

  /** 用户手动改过就用用户的；没改过就跟随当前窗口所在工作区。 */
  const expanded = useMemo(() => {
    if (openWs) return openWs
    const init = new Set<string>()
    if (activeGroup !== null) init.add(activeGroup)
    return init
  }, [openWs, activeGroup])

  const toggleWs = (key: string) => {
    const next = new Set(expanded)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOpenWs(next)
  }

  const total = (activeId === undefined ? 0 : 1) + picked.length
  const full = picked.length >= MAX_MONITORED - 1

  return (
    <div className="davf-picker">
      <div className="davf-picker-head">
        <span>选择要显示的对话</span>
        <span className="davf-picker-hint">
          已选 {total}/{MAX_MONITORED}（当前窗口自动在内，不用勾）
        </span>
      </div>

      <div className="davf-picker-body">
        {groups.length === 0 ? (
          <div className="davf-picker-empty">还没有可显示的对话。</div>
        ) : (
          groups.map((g) => {
            const isOpen = expanded.has(g.key)
            const chosenCount = g.ids.filter((id) => picked.includes(id)).length
            return (
              <div className="davf-ws" key={g.key || 'stray'}>
                <button
                  className={`davf-ws-head${isOpen ? ' is-open' : ''}`}
                  onClick={() => toggleWs(g.key)}
                >
                  <span className="davf-ws-caret">{isOpen ? '▾' : '▸'}</span>
                  <span className="davf-ws-name" title={g.label}>
                    {g.label}
                  </span>
                  <span className="davf-ws-count">
                    {chosenCount > 0 ? `${chosenCount}/` : ''}
                    {g.ids.length}
                  </span>
                </button>

                {isOpen ? (
                  <div className="davf-ws-body">
                    {g.ids.map((id) => {
                      const a = agentById.get(id)
                      const isActive = id === activeId
                      const isPicked = picked.includes(id)
                      const disabled = !isActive && !isPicked && full
                      return (
                        <button
                          key={id}
                          className={`davf-pick-row${isPicked ? ' is-on' : ''}${isActive ? ' is-active' : ''}`}
                          disabled={disabled}
                          title={disabled ? `最多显示 ${MAX_MONITORED} 个` : a?.name ?? id}
                          onClick={() => {
                            if (isActive) return // 当前窗口不可取消
                            togglePicked(id)
                          }}
                        >
                          <span className={`davf-pick-box${isPicked ? ' is-on' : ''}${isActive ? ' is-active' : ''}`}>
                            {isActive ? '·' : isPicked ? '✓' : ''}
                          </span>
                          <span className="davf-pick-name">{a?.name ?? id.slice(0, 10)}</span>
                          {isActive ? <span className="davf-pick-tag">当前</span> : null}
                          {a ? (
                            <span className="davf-pick-act">{ACTIVITY_LABEL[a.activity]}</span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

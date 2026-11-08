/** Parent-origin G3 projection for the two floating Bot labels. Never sent to the isolated child. */
import { activeSessionOf, unavailableSessionIds, deriveAgents, countDescendants } from './agents'
import { monitoredList } from './store'
import type { Activity } from './activities'
import type { SessionStatus } from './derive'

type Sessions = Parameters<typeof deriveAgents>[0]
type Statuses = Map<string, SessionStatus> | undefined
export interface Reminder { id: string; name: string }
export interface OverlaySessionData {
  ready: boolean
  activeId?: string
  main?: { name: string; activity: Activity; childCount: number }
  otherCount: number
  otherChildCount: number
  pending: Reminder[]
}
const EMPTY: OverlaySessionData = { ready: false, otherCount: 0, otherChildCount: 0, pending: [] }

/** Match the sidebar monitor queue, but fail closed before a complete Host list arrives. */
export function deriveOverlaySessionData(
  list: Sessions, statuses: Statuses, picked: readonly string[], archivedIds: readonly string[] | undefined,
  now: number, sleepMinutes: number
): OverlaySessionData {
  if (!list || list.phase !== 'ready' || !Array.isArray(list.ids) || !list.byId || !statuses || typeof statuses.get !== 'function') return EMPTY
  const activeId = activeSessionOf(list)
  if (!activeId || !list.ids.includes(activeId)) return { ...EMPTY, ready: true }
  const unavailable = unavailableSessionIds(list, activeId, monitoredList(undefined, [...picked]), archivedIds)
  const shown = monitoredList(activeId, [...picked], unavailable)
  const others = shown.filter(id => id !== activeId && !!list.byId[id] && !unavailable.has(id))
  const agents = deriveAgents(list, statuses, now, sleepMinutes)
  const byId = new Map(agents.map(a => [a.id, a]))
  const row = byId.get(activeId)
  const pending = others.filter(id => !!statuses?.get(id)?.pendingInteraction)
    .map(id => ({ id, name: byId.get(id)?.name ?? list.byId[id]?.displayTitle?.trim() ?? id.slice(0, 8) }))
  return {
    ready: true, activeId,
    main: row ? { name: row.name, activity: row.activity, childCount: countDescendants(list, activeId) } : undefined,
    otherCount: others.length,
    otherChildCount: others.reduce((sum, id) => sum + countDescendants(list, id), 0),
    pending
  }
}

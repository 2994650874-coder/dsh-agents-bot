/** Pure, bounded MRU list for the right-panel monitoring cells.
 * Head = most recently active; tail = least recently active. No DSH/React imports.
 */
export interface QueueState {
  order: string[]
  capacity: number
}

const bounded = (n: number): number => Math.max(1, Math.min(9, Number.isFinite(n) ? Math.trunc(n) : 9))
const distinct = (ids: readonly string[]): string[] => [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]

/** Keep the persisted picked order on initial migration; only actual visits change recency. */
export function seedMonitorQueue(picked: string[], activeId: string | undefined, max = 9): QueueState {
  const limit = bounded(max)
  const active = activeId || undefined
  const extra = distinct(picked).filter((id) => id !== active).slice(0, active ? limit - 1 : limit)
  return { order: active ? [active, ...extra] : extra, capacity: Math.min(limit, 1 + extra.length) }
}

/** Only a new visit at full capacity can displace a cell; absent entries have priority. */
export function visitMonitorQueue(state: QueueState, id: string, unavailable: ReadonlySet<string>): QueueState {
  if (typeof id !== 'string' || !id) return { order: [...state.order], capacity: state.capacity }
  const capacity = bounded(state.capacity)
  const order = distinct(state.order)
  if (order.includes(id)) return { order: [id, ...order.filter((entry) => entry !== id)].slice(0, capacity), capacity }
  if (order.length >= capacity) {
    const victim = [...order].reverse().find((entry) => unavailable.has(entry)) ?? order[order.length - 1]
    order.splice(order.indexOf(victim), 1)
  }
  return { order: [id, ...order].slice(0, capacity), capacity }
}

/** Called for a genuinely new manual pick, including an already auto-visited cell. */
export function addMonitorQueue(state: QueueState, id: string, max = 9): QueueState {
  const limit = bounded(max)
  const capacity = Math.min(limit, bounded(state.capacity) + 1)
  const order = distinct(state.order)
  if (typeof id !== 'string' || !id || (bounded(state.capacity) >= limit && !order.includes(id))) {
    return { order: order.slice(0, bounded(state.capacity)), capacity: bounded(state.capacity) }
  }
  return { order: (order.includes(id) ? order : [...order, id]).slice(0, capacity), capacity }
}

/** Removing a manual pick frees one slot, even if that pick was already evicted. */
export function removeMonitorQueue(state: QueueState, id: string, activeId: string | undefined): QueueState {
  const capacity = Math.max(1, bounded(state.capacity) - 1)
  const active = activeId || undefined
  const remaining = distinct(state.order).filter((entry) => entry !== id && entry !== active)
  return { order: (active ? [active, ...remaining] : remaining).slice(0, capacity), capacity }
}

/** Clearing manual selections retains only the current active cell, if known. */
export function clearMonitorQueue(_state: QueueState, activeId: string | undefined): QueueState {
  return { order: activeId ? [activeId] : [], capacity: 1 }
}

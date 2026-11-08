/** One opt-in animation wakeup and pointer source for the two Bots in one overlay.
 * Other Bot call sites keep their existing per-instance scheduling unchanged.
 */
export interface PointerPosition { x: number; y: number; seen: boolean }
type Draw = { fps?: number; step: (now: number) => void }
interface ClockGroup {
  draws: Map<symbol, Draw>
  pointers: Map<symbol, (pointer: PointerPosition) => void>
  pointer: PointerPosition
  nextDraw: number
  raf: number
  timer: number
  onMove?: (event: PointerEvent) => void
  onLeave?: () => void
}
const groups = new Map<string, ClockGroup>()
function groupFor(key: string): ClockGroup {
  let group = groups.get(key)
  if (!group) {
    group = { draws: new Map(), pointers: new Map(), pointer: { x: 0, y: 0, seen: false }, nextDraw: 0, raf: 0, timer: 0 }
    groups.set(key, group)
  }
  return group
}
function forgetIfUnused(key: string, group: ClockGroup) {
  if (group.draws.size === 0 && group.pointers.size === 0 && groups.get(key) === group) groups.delete(key)
}
function intervalOf(group: ClockGroup): number {
  const draws = [...group.draws.values()]
  if (draws.some(item => !item.fps || item.fps <= 0)) return 0
  return 1000 / Math.max(...draws.map(item => item.fps!))
}
function cancelWake(group: ClockGroup) {
  if (group.raf) cancelAnimationFrame(group.raf)
  if (group.timer) window.clearTimeout(group.timer)
  group.raf = 0
  group.timer = 0
}
function schedule(key: string, group: ClockGroup, now: number) {
  if (groups.get(key) !== group || group.draws.size === 0 || group.raf || group.timer) return
  const interval = intervalOf(group)
  const frame = (at: number) => {
    group.raf = 0
    if (groups.get(key) !== group || group.draws.size === 0) return
    const rate = intervalOf(group)
    if (rate > 0) {
      group.nextDraw += rate
      // A paused tab or a long task skips lost frames instead of replaying them.
      if (group.nextDraw < at - rate) group.nextDraw = at + rate
    }
    for (const [id, item] of [...group.draws]) if (group.draws.has(id)) item.step(at)
    schedule(key, group, at)
  }
  if (interval === 0 || group.nextDraw - now <= 1) {
    group.raf = requestAnimationFrame(frame)
  } else {
    group.timer = window.setTimeout(() => {
      group.timer = 0
      if (groups.get(key) === group && group.draws.size > 0) group.raf = requestAnimationFrame(frame)
    }, group.nextDraw - now - 1)
  }
}
/** Shared fps wakeup; each Bot still owns its engine, rotation phase and SVG frame. */
export function subscribeSharedFrames(key: string, fps: number | undefined, step: (now: number) => void): () => void {
  const group = groupFor(key)
  const id = Symbol(key)
  const previousRate = group.draws.size ? intervalOf(group) : null
  group.draws.set(id, { fps, step })
  if (previousRate === null) group.nextDraw = performance.now()
  if (previousRate === null || previousRate !== intervalOf(group)) {
    cancelWake(group)
    schedule(key, group, performance.now())
  }
  return () => {
    if (!group.draws.has(id)) return
    const priorRate = intervalOf(group)
    group.draws.delete(id)
    const nextRate = group.draws.size ? intervalOf(group) : null
    if (nextRate === null || nextRate !== priorRate) {
      cancelWake(group)
      if (nextRate !== null) schedule(key, group, performance.now())
    }
    forgetIfUnused(key, group)
  }
}
/** One window pointermove listener feeds each Bot's own gaze origin. */
export function subscribeSharedPointer(key: string, update: (pointer: PointerPosition) => void): () => void {
  const group = groupFor(key)
  const id = Symbol(key)
  group.pointers.set(id, update)
  update(group.pointer)
  if (group.pointers.size === 1) {
    group.onMove = event => {
      if (event.pointerType === 'touch') return
      group.pointer = { x: event.clientX, y: event.clientY, seen: true }
      for (const listener of group.pointers.values()) listener(group.pointer)
    }
    group.onLeave = () => {
      group.pointer = { ...group.pointer, seen: false }
      for (const listener of group.pointers.values()) listener(group.pointer)
    }
    window.addEventListener('pointermove', group.onMove)
    document.addEventListener('pointerleave', group.onLeave)
  }
  return () => {
    if (!group.pointers.delete(id)) return
    if (group.pointers.size === 0) {
      if (group.onMove) window.removeEventListener('pointermove', group.onMove)
      if (group.onLeave) document.removeEventListener('pointerleave', group.onLeave)
      group.onMove = undefined
      group.onLeave = undefined
      group.pointer = { ...group.pointer, seen: false }
    }
    forgetIfUnused(key, group)
  }
}

/** Explicit G2 placement switch shared by the sidebar and the frame-level slot. */
import { useSyncExternalStore } from 'react'

export type Point = { x: number; y: number }
type Mode = { place: 'sidebar' | 'main'; origin: Point | null; paneId?: string; openTab?: (kind: string, options?: { paneId?: string }) => void; returnError?: string }
let current: Mode = { place: 'sidebar', origin: null }
let navigate: Mode['openTab']
export function setSidebarNavigator(fn?: Mode['openTab']) { navigate = fn }
const listeners = new Set<() => void>()
const subscribe = (notify: () => void) => { listeners.add(notify); return () => { listeners.delete(notify) } }
const emit = (next: Mode) => { current = next; for (const listener of listeners) listener() }
export const useMainOverlayMode = () => useSyncExternalStore(subscribe, () => current, () => current)
export function switchToMain(origin: Point, paneId?: string, openTab?: Mode['openTab']) {
  if (current.place === 'main') return
  emit({ place: 'main', origin, paneId, openTab })
}
export function switchToSidebar(): boolean {
  if (current.place !== 'main') return false
  const previous = current
  const { paneId, openTab } = previous
  const open = navigate ?? openTab
  if (!open) { emit({ ...previous, returnError: '侧栏导航暂不可用，请稍后重试' }); return false }
  // Stop the frame canvas first. No replaceTab: unrelated tabs must survive.
  emit({ place: 'sidebar', origin: null })
  try {
    if (paneId) open('agentsBot', { paneId })
    else open('agentsBot')
  } catch {
    try { open('agentsBot') } catch { emit({ ...previous, returnError: '当前没有可用的侧栏会话，请打开对话后重试' }); return false }
  }
  return true
}

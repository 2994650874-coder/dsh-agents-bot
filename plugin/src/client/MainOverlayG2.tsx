/** G2 frame Bot: explicit placement, local geometry, no session snapshot (G3). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot } from './Bot'
import { useUi } from './store'
import { deriveOverlaySessionData, type OverlaySessionData } from './overlaySessionData'
import { MainBotMeta, MessageBotMeta } from './OverlayBotMeta'
import { ACTIVITY_STATE } from './activities'
import type { deriveAgents } from './agents'
import { useMainOverlayMode, type Point } from './mainOverlayMode'
import { clampOverlay, safeOverlayTop } from './MainOverlayG1'

export const POSITION_KEY = 'dsh-agents-bot:main-position-v1'
export const SECONDARY_RATIO = 0.6
const SECONDARY_GAP = 8 * 0.7 // 30% less than the G2.3 box gap
const VISIBLE_BOTTOM = 0.85 // Bot silhouettes sit inside their SVG viewports

type Bounds = { x: number; y: number; width: number; height: number }
const overlaps = (a: Bounds, b: Bounds) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
// Mirror the isolated sidebar's 18px title + 16px centered pill rows (4px row spacing).
const MAIN_META_FOOTER = 64 // 3px offset + 18px title + 4 + 16 + 4 + 16 + 3px bottom
const messageMetaFooter = (pending: number) => pending > 1 ? 64 : pending > 0 ? 44 : 24
const mainMetaWidthOf = (size: number) => Math.max(112, size - 8)
const messageMetaWidthOf = (small: number) => Math.max(86, Math.min(96, small))
const isLateral = (main: Point, p: Point, size: number, small: number) => p.x >= main.x + size || p.x + small <= main.x
// Keep collision geometry and title centering in sync with the drawn (translated) SVG.
const smallVisualShiftOf = (main: Point, p: Point, size: number, small: number): Point => {
  const inward = size * 0.095
  return p.x >= main.x + size ? { x: -inward, y: 0 }
    : p.x + small <= main.x ? { x: inward, y: 0 }
      : p.y >= main.y + size ? { x: 0, y: -inward } : { x: 0, y: inward }
}
const messageMetaLeftOf = (main: Point, p: Point, size: number, small: number, width: number) =>
  p.x + small / 2 + smallVisualShiftOf(main, p, size, small).x - width / 2
/** Prefer visible-bottom-aligned lateral Bots, with both metadata columns centered and nonoverlapping. */
export function secondaryPosition(main: Point, size: number, viewport: Bounds, top: number, inputs: Bounds[] = [], withMeta = false, pendingCount = 0): Point {
  const small = size * SECONDARY_RATIO
  const gap = SECONDARY_GAP
  const mainInfoWidth = mainMetaWidthOf(size), smallInfoWidth = messageMetaWidthOf(small)
  const smallFooter = messageMetaFooter(pendingCount)
  const mainInfo = { x: main.x + (size - mainInfoWidth) / 2, y: main.y + size + 3, width: mainInfoWidth, height: MAIN_META_FOOTER - 3 }
  const smallInfo = (p: Point) => ({ x: messageMetaLeftOf(main, p, size, small, smallInfoWidth),
    y: (isLateral(main, p, size, small) ? main.y + size : p.y + small) + 3,
    width: smallInfoWidth, height: smallFooter - 3 })
  const verticalX = Math.max((smallInfoWidth - small) / 2,
    Math.min(main.x + (size - small) / 2, viewport.width - (smallInfoWidth + small) / 2))
  const choices: Point[] = [
    { x: main.x + size + gap, y: main.y + (size - small) * VISIBLE_BOTTOM },
    { x: main.x - small - gap, y: main.y + (size - small) * VISIBLE_BOTTOM },
    { x: verticalX, y: main.y - small - (withMeta ? smallFooter : 0) - gap },
    { x: verticalX, y: main.y + size + (withMeta ? MAIN_META_FOOTER + size * 0.095 : 0) + gap }
  ]
  const within = (p: Point) => {
    const info = smallInfo(p)
    return p.x >= 0 && p.y >= top && p.x + small <= viewport.width &&
      (!withMeta || (info.x >= 0 && info.x + info.width <= viewport.width && info.y >= top && info.y + info.height <= viewport.height)) &&
      (!withMeta || p.y + small <= viewport.height)
  }
  const separated = (p: Point) => {
    const mainBot = { ...main, width: size, height: size }, smallBot = { ...p, width: small, height: small }
    const shift = smallVisualShiftOf(main, p, size, small)
    const drawnSmall = { x: p.x + shift.x, y: p.y + shift.y, width: small, height: small }
    return !overlaps(mainBot, smallBot) && (!withMeta ||
      !overlaps(mainInfo, drawnSmall) && !overlaps(mainBot, smallInfo(p)) && !overlaps(mainInfo, smallInfo(p)))
  }
  const clear = (p: Point) => inputs.every(input => !overlaps({ ...p, width: small, height: small }, input))
  const viable = choices.filter(p => within(p) && separated(p))
  const chosen = viable.find(clear) ?? viable[0]
  if (chosen) return chosen
  // An impossible tiny viewport cannot fit both Bot+label columns; preserve Bot hit and bounds first.
  const fallback = choices.map(p => ({ x: Math.max(0, Math.min(p.x, viewport.width - small)),
    y: Math.max(top, Math.min(p.y, viewport.height - small - (withMeta ? smallFooter : 0))) }))
  return fallback.find(p => within(p) && separated(p) && clear(p)) ??
    fallback.find(p => within(p) && separated(p)) ?? fallback.find(p => !overlaps({ ...p, width: small, height: small }, { ...main, width: size, height: size })) ?? fallback[0]
}
export function readPosition(raw: string | null): Point | null {
  if (!raw) return null
  try {
    const v = JSON.parse(raw)
    return v && typeof v === 'object' && !Array.isArray(v) &&
      typeof v.x === 'number' && Number.isFinite(v.x) &&
      typeof v.y === 'number' && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null
  } catch { return null }
}
function storedPosition(): Point | null {
  try { return readPosition(localStorage.getItem(POSITION_KEY)) } catch { return null }
}
function savePosition(p: Point) {
  try { localStorage.setItem(POSITION_KEY, JSON.stringify(p)) } catch { /* private storage: remain movable */ }
}
type Hook = (selector: (state: unknown) => unknown) => unknown
interface OverlaySlotProps { useSessions?: Hook; useSessionStatus?: Hook; useWorkspaces?: Hook }
/** Standard all-scope Slot hooks remain mounted even when the sidebar Bot tab unmounts. */
export function MainOverlayG2({ useSessions, useSessionStatus, useWorkspaces }: OverlaySlotProps = {}) {
  const mode = useMainOverlayMode()
  if (mode.place !== 'main') return null
  if (useSessions && useSessionStatus && useWorkspaces) return <LiveOverlayBot origin={mode.origin} returnError={mode.returnError}
    useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces} />
  return <ActiveBot origin={mode.origin} returnError={mode.returnError} data={null} />
}
function LiveOverlayBot({ origin, returnError, useSessions, useSessionStatus, useWorkspaces }: Required<OverlaySlotProps> & { origin: Point | null; returnError?: string }) {
  const list = useSessions(s => s) as Parameters<typeof deriveAgents>[0]
  const status = useSessionStatus(s => s) as Parameters<typeof deriveOverlaySessionData>[1]
  const archived = useWorkspaces(s => (s as { archivedSessionIds?: string[] } | undefined)?.archivedSessionIds) as string[] | undefined
  const picked = useUi('picked')
  const sleepMinutes = useUi('sleepMinutes')
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 5000); return () => window.clearInterval(timer) }, [])
  const data = useMemo(() => deriveOverlaySessionData(list, status, picked, archived, now, sleepMinutes),
    [list, status, picked, archived, now, sleepMinutes])
  return <ActiveBot origin={origin} returnError={returnError} data={data} />
}
function ActiveBot({ origin, returnError, data }: { origin: Point | null; returnError?: string; data: OverlaySessionData | null }) {
  const look = useUi('look')
  const messageLook = useUi('messageLook')
  const rotation = useUi('rotation')
  const fps = useUi('fps')
  const size = useUi('mainBotSize')
  const [position, setPosition] = useState<Point>(() => clampOverlay(storedPosition() ?? origin ?? { x: window.innerWidth - 152, y: 96 }, size))
  const [reduceMotion, setReduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const drag = useRef<{ id: number; start: Point; origin: Point; moved: boolean } | null>(null)
  const dragInputs = useRef<Bounds[] | null>(null)
  const clampMain = useCallback((p: Point) => {
    const next = clampOverlay(p, size)
    if (!data?.ready) return next
    const inset = Math.max(0, (mainMetaWidthOf(size) - size) / 2)
    return { x: Math.max(inset, Math.min(next.x, Math.max(inset, window.innerWidth - size - inset))),
      y: Math.min(next.y, Math.max(safeOverlayTop(), window.innerHeight - size - MAIN_META_FOOTER)) }
  }, [size, data?.ready])
  const clamp = useCallback(() => setPosition(p => ({ ...clampMain(p) })), [clampMain])
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduceMotion(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    clamp()
    const frame = requestAnimationFrame(clamp)
    const short = window.setTimeout(clamp, 120)
    const long = window.setTimeout(clamp, 600)
    window.addEventListener('resize', clamp)
    document.addEventListener('DOMContentLoaded', clamp)
    window.addEventListener('load', clamp)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(short); clearTimeout(long)
      window.removeEventListener('resize', clamp)
      document.removeEventListener('DOMContentLoaded', clamp)
      window.removeEventListener('load', clamp)
    }
  }, [clamp])
  const commit = (p: Point) => { const next = clampMain(p); setPosition(next); savePosition(next) }
  // During a pointer drag, reuse the input geometry sampled at its start; refresh on release.
  // Outside a drag, read each render so layout/settings changes never need polling or another rAF.
  const inputBounds = dragInputs.current ?? Array.from(document.querySelectorAll<HTMLElement>('textarea, input, [contenteditable="true"], [role="textbox"]'))
    .filter(el => el.getClientRects().length > 0 && !el.closest('.davf-g1-shell'))
    .map(el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
  const smallSize = size * SECONDARY_RATIO
  const small = secondaryPosition(position, size, { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, safeOverlayTop(), inputBounds, !!data?.ready, data?.pending.length ?? 0)
  // The drawing has padding inside the SVG. Nudge only its visible silhouette inward,
  // keeping the non-overlapping layout and the main Bot's circular hit box unchanged.
  const smallVisualShift = smallVisualShiftOf(position, small, size, smallSize)
  const activity = data?.main?.activity ?? 'idle'
  const mainRotation = rotation[activity]
  const messageRotation = rotation.idle // The aggregate monitor is idle unless a session-specific activity exists.
  // Appearance can be edited from the sidebar; panel visibility never counts as an edit gesture.
  const mainState = mainRotation?.[0]?.state ?? ACTIVITY_STATE[activity]
  const mainMetaWidth = mainMetaWidthOf(size)
  const smallMetaWidth = messageMetaWidthOf(smallSize)
  const smallMetaLeft = messageMetaLeftOf(position, small, size, smallSize, smallMetaWidth)
  const smallMetaTop = (isLateral(position, small, size, smallSize) ? position.y + size : small.y + smallSize) + 3
  return <div className="davf-g1-shell" data-testid="main-overlay-g2">
    <div className="davf-g1-entity" style={{ left: position.x, top: position.y, width: size, height: size, ['--davf-main-size' as string]: `${size}px` }} data-x={position.x} data-y={position.y}>
      <Bot state={mainState} rotation={mainRotation} look={{ ...look, size }} fps={fps}
        frameGroup="main-overlay" frozenAt={reduceMotion ? 1.1 : undefined} follow={!reduceMotion} />
      <button type="button" className="davf-g1-hit" aria-label="主 Bot，拖动或用方向键移动，Esc 退出焦点"
        data-testid="main-overlay-g2-hit"
        onKeyDown={e => {
          if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur(); return }
          const step = e.shiftKey ? 24 : 8
          const move: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } }
          const delta = move[e.key]
          if (delta) { e.preventDefault(); commit({ x: position.x + delta.x, y: position.y + delta.y }) }
        }}
        onPointerDown={e => {
          if (e.button !== 0) return
          drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: position, moved: false }
          dragInputs.current = inputBounds
          e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault()
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const dx = e.clientX - d.start.x, dy = e.clientY - d.start.y
          if (Math.hypot(dx, dy) > 4) d.moved = true
          setPosition(clampMain({ x: d.origin.x + dx, y: d.origin.y + dy }))
        }}
        onPointerUp={e => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          drag.current = null
          dragInputs.current = null
          setPosition(p => ({ ...p })) // refresh input collision layout after the gesture
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
          if (d.moved) savePosition(clampMain({ x: d.origin.x + e.clientX - d.start.x, y: d.origin.y + e.clientY - d.start.y }))
        }}
        onPointerCancel={() => { drag.current = null; dragInputs.current = null; setPosition(p => ({ ...p })) }}
      />
      
      {returnError ? <span className="davf-g2-error" role="status">{returnError}</span> : null}
    </div>
    <div data-testid="main-overlay-g2-small" aria-hidden="true" style={{ position: 'absolute', left: small.x, top: small.y, width: smallSize, height: smallSize, pointerEvents: 'none' }}>
      <div style={{ transform: `translate(${smallVisualShift.x}px, ${smallVisualShift.y}px)` }}>
        <Bot state={messageRotation?.[0]?.state ?? ACTIVITY_STATE.idle} rotation={messageRotation}
          look={{ ...messageLook, size: smallSize }} fps={fps} frameGroup="main-overlay"
          frozenAt={reduceMotion ? 1.1 : undefined} follow={!reduceMotion} />
      </div>
    </div>
    {data?.ready ? <div style={{ position: 'absolute', left: Math.max(0, Math.min(position.x + (size - mainMetaWidth) / 2, window.innerWidth - mainMetaWidth)),
      top: position.y + size + 3, width: mainMetaWidth, pointerEvents: 'none' }}><MainBotMeta data={data} /></div> : null}
    {data?.ready ? <div style={{ position: 'absolute', left: Math.max(0, Math.min(smallMetaLeft, window.innerWidth - smallMetaWidth)),
      top: smallMetaTop, width: smallMetaWidth, pointerEvents: 'none' }}><MessageBotMeta data={data} reduceMotion={reduceMotion} compact={smallMetaWidth < 96} /></div> : null}
  </div>
}

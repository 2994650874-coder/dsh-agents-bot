/** G1 only: parent-side inline hit prototype; no snapshot, persistence, or placement switch. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot } from './Bot'
import { DEFAULT_LOOK } from './look'

const SIZE = 96

type Point = { x: number; y: number }

/** Windows frame clearance can arrive after the initial plugin mount. */
export function safeOverlayTop(): number {
  const css = getComputedStyle(document.documentElement)
  const value = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0
  return Math.max(40, value('--dsh-frame-top-clearance'), value('--dsh-frame-overlay-top'), value('--dsh-frame-chrome-top')) + 8
}

export function clampOverlay(point: Point, size = SIZE): Point {
  return {
    x: Math.max(0, Math.min(point.x, Math.max(0, window.innerWidth - size))),
    y: Math.max(safeOverlayTop(), Math.min(point.y, Math.max(safeOverlayTop(), window.innerHeight - size)))
  }
}

export function MainOverlayG1() {
  const [position, setPosition] = useState<Point>(() => ({ x: Math.max(0, window.innerWidth - 152), y: 96 }))
  const [clicks, setClicks] = useState(0)
  const drag = useRef<{ id: number; start: Point; origin: Point; moved: boolean } | null>(null)
  const swallowClick = useRef(false)
  const clamp = useCallback(() => setPosition(p => clampOverlay(p)), [])

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
      clearTimeout(short)
      clearTimeout(long)
      window.removeEventListener('resize', clamp)
      document.removeEventListener('DOMContentLoaded', clamp)
      window.removeEventListener('load', clamp)
    }
  }, [clamp])

  return <div className="davf-g1-shell" data-testid="main-overlay-g1">
    <div className="davf-g1-entity" style={{ left: position.x, top: position.y }} data-x={position.x} data-y={position.y}>
      <Bot state="idle" look={DEFAULT_LOOK} frozenAt={1.1} follow={false} />
      <button type="button" className="davf-g1-hit" aria-label="模块2 Bot：拖动或点击"
        data-testid="main-overlay-g1-hit" data-clicks={clicks}
        onPointerDown={e => {
          if (e.button !== 0) return
          drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: position, moved: false }
          e.currentTarget.setPointerCapture(e.pointerId)
          e.preventDefault()
        }}
        onPointerMove={e => {
          const d = drag.current
          if (!d || d.id !== e.pointerId) return
          const dx = e.clientX - d.start.x
          const dy = e.clientY - d.start.y
          if (Math.hypot(dx, dy) > 4) d.moved = true
          setPosition(clampOverlay({ x: d.origin.x + dx, y: d.origin.y + dy }))
        }}
        onPointerUp={e => {
          if (!drag.current || drag.current.id !== e.pointerId) return
          swallowClick.current = drag.current.moved
          drag.current = null
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        }}
        onPointerCancel={() => { drag.current = null; swallowClick.current = true }}
        onClick={() => {
          if (swallowClick.current) { swallowClick.current = false; return }
          setClicks(n => n + 1)
        }}
      />
      {clicks > 0 ? <span className="davf-g1-feedback" aria-live="polite">Bot 已点 {clicks}</span> : null}
    </div>
  </div>
}

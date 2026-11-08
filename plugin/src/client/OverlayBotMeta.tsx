/** Parent-only labels for the two floating Bots; never enter the cross-origin child. */
import { useLayoutEffect, useRef } from 'react'
import { ACTIVITY_PRESENTATION, type Activity } from './activities'
import type { OverlaySessionData, Reminder } from './overlaySessionData'

const base = { color: 'var(--dsw-alias-label-primary,#242424)',
  fontFamily: 'inherit', textShadow: '0 1px 1px var(--dsw-alias-bg-layer-1,#fff)',
  pointerEvents: 'none' as const, textAlign: 'center' as const, paddingBottom: 3 }
const pill = { boxSizing: 'border-box' as const, width: 'min(82px, calc(100% - 8px))',
  minWidth: 0, height: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  borderRadius: 999, border: '1px solid var(--dsw-alias-border-subtle,#d6d8dd)',
  background: 'var(--dsw-alias-bg-layer-1,rgba(255,255,255,.92))', padding: '0 3px',
  fontSize: 9, lineHeight: '14px', textAlign: 'center' as const }

function Title({ text, fullTitle = text }: { text: string; fullTitle?: string }) {
  return <strong title={fullTitle} style={{ display: 'block', width: 'calc(100% - 8px)', margin: '0 auto',
    fontSize: 12.5, fontWeight: 600, lineHeight: '18px', height: 18, textAlign: 'center',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{text}</strong>
}
function Status({ label, activity }: { label: string; activity: Activity }) {
  return <span style={{ ...pill, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 2 }} title={label}>
    <span aria-hidden="true" style={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%',
      background: ACTIVITY_PRESENTATION[activity].color }} />{label}
  </span>
}
function MetaRow({ label, activity, children }: { label: string; activity: Activity; children: number }) {
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 4 }}>
    <Status label={label} activity={activity} />
    {children > 0 ? <span style={{ ...pill, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} title={'子代理：'+children}>×{children} 子代理</span> : null}
  </div>
}

/** Stable two-slot queue: disappearing waits let the next one slide upward once. */
function PendingRow({ items, reduceMotion }: { items: readonly Reminder[]; reduceMotion: boolean }) {
  const nodes = useRef(new Map<string, HTMLSpanElement>())
  const previous = useRef<{ id: string; top: number }[] | null>(null)
  const visible = items.slice(0, 2)
  const ids = visible.map(item => item.id).join('|')
  useLayoutEffect(() => {
    const next = visible.map(item => ({ id: item.id, top: nodes.current.get(item.id)?.getBoundingClientRect().top ?? 0 }))
    const prior = previous.current
    if (prior && !reduceMotion && prior.some(item => !next.some(row => row.id === item.id))) {
      for (const row of next) {
        const el = nodes.current.get(row.id)
        if (!el || typeof el.animate !== 'function') continue
        const before = prior.find(item => item.id === row.id)
        const from = before ? before.top - row.top : 20
        if (Math.abs(from) > 0.5) el.animate([
          { transform: 'translateY('+from+'px)', opacity: before ? 1 : 0.25 },
          { transform: 'translateY(0)', opacity: 1 }
        ], { duration: 250, easing: 'ease-out' })
      }
    }
    previous.current = next
  }, [ids, reduceMotion])
  if (visible.length === 0) return null
  return <div data-testid="overlay-message-pending" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 4 }}>
    {visible.map(item => <span key={item.id} ref={node => {
      if (node) nodes.current.set(item.id, node); else nodes.current.delete(item.id)
    }} data-session={item.id} style={{ ...pill, display: 'block' }}
      title={item.name+' · 等待你处理'} aria-label={item.name+' 等待你处理'}>
      {item.name.slice(0, 6)}
    </span>)}
  </div>
}

export function MainBotMeta({ data }: { data: OverlaySessionData }) {
  if (!data.main) return null
  return <div data-testid="overlay-main-meta" style={base}>
    <Title text={data.main.name} />
    <MetaRow label={ACTIVITY_PRESENTATION[data.main.activity].label} activity={data.main.activity} children={data.main.childCount} />
  </div>
}
export function MessageBotMeta({ data, reduceMotion, compact = false }: { data: OverlaySessionData; reduceMotion: boolean; compact?: boolean }) {
  if (!data.ready || !data.activeId) return null
  const fullTitle = '监控其他窗口 '+data.otherCount
  return <div data-testid="overlay-message-meta" style={base}>
    <Title text={compact ? '监控 '+data.otherCount : fullTitle} fullTitle={fullTitle} />
    <PendingRow items={data.pending} reduceMotion={reduceMotion} />
  </div>
}

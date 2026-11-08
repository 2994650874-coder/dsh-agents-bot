/**
 * 面板的视觉：左列 agent 头像 + 右侧自定义区。
 *
 * 布局刻意用 flex + 一条可拖拽的分隔条，而不是固定宽 —— 面板本身随窗口拉伸，
 * 内部再给一条可调的界线，是用户明确要的「可以拉伸的窗口」。
 */
import { useEffect, useRef, useState } from 'react'
import { Bot } from './Bot'
import { ACTIVITY_LABEL, ACTIVITY_STATE, PREVIEW_STATES, type Activity } from './activities'
import { COLOR_OPTIONS, SHAPE_OPTIONS, EXPRESSION_OPTIONS, COLORS, EXPRESSIONS, type AvatarLook } from './look'
import type { AgentRow } from './agents'
import type { StateId } from '../bot/states'

/** 活动 → 卡片左边那条状态色。与头像状态同源，避免两处各写一份。 */
const ACTIVITY_COLOR: Record<Activity, string> = {
  idle: '#8db6a0',
  thinking: '#8c9eb9',
  reading: '#7aa7d8',
  searching: '#7aa7d8',
  running: '#d8a76a',
  writing: '#b98fd0',
  waiting: '#e0b34e',
  done: '#5aa9e6',
  error: '#e0563f',
  spawning: '#a3a3a3'
}

export interface PanelProps {
  agents: AgentRow[]
  look: AvatarLook
  onLook: (next: AvatarLook) => void
  /** 试片：手动把某个头像钉在某个状态，不跟真实数据。 */
  previewState: StateId | null
  onPreviewState: (s: StateId | null) => void
  /** 面板宽度小于这个值时收成单列（自定义区折叠成抽屉）。 */
  compact: boolean
  empty: boolean
}

export function AvatarPanel(props: PanelProps) {
  const { agents, look, onLook, previewState, onPreviewState, compact, empty } = props
  const [split, setSplit] = useState(58) // 左列占比 %
  const hostRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return
      const box = hostRef.current?.getBoundingClientRect()
      if (!box || box.width === 0) return
      const pct = ((e.clientX - box.left) / box.width) * 100
      setSplit(Math.min(78, Math.max(28, pct)))
    }
    const onUp = () => {
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div className="dav-root" ref={hostRef}>
      <div className="dav-stage" style={compact ? undefined : { flexBasis: `${split}%` }}>
        <div className="dav-stage-head">
          <span className="dav-stage-title">活动 AI</span>
          <span className="dav-stage-count">{agents.length}</span>
        </div>
        {empty ? (
          <div className="dav-empty">
            <div className="dav-empty-bot">
              <Bot state="sleep" look={{ ...look, size: 120 }} paper="transparent" />
            </div>
            <p>还没有会话。开一个对话，或者派出一个 teammate，头像就会出现在这里。</p>
          </div>
        ) : (
          <div className="dav-grid">
            {agents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                look={look}
                previewState={previewState}
              />
            ))}
          </div>
        )}
      </div>

      {!compact && (
        <div
          className="dav-split"
          role="separator"
          aria-orientation="vertical"
          onMouseDown={() => {
            draggingRef.current = true
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        />
      )}

      <div className="dav-side">
        <Customizer look={look} onLook={onLook} previewState={previewState} onPreviewState={onPreviewState} />
      </div>
    </div>
  )
}

function AgentCard({ agent, look, previewState }: { agent: AgentRow; look: AvatarLook; previewState: StateId | null }) {
  const state = previewState ?? ACTIVITY_STATE[agent.activity]
  const color = ACTIVITY_COLOR[agent.activity]
  return (
    <div className="dav-card" data-activity={agent.activity}>
      <div className="dav-card-bar" style={{ background: color }} />
      <div className="dav-card-bot">
        <Bot state={state} look={{ ...look, size: 92 }} paper="transparent" />
      </div>
      <div className="dav-card-meta">
        <div className="dav-card-name" title={agent.name}>
          {agent.isChild ? <span className="dav-caret">└</span> : null}
          {agent.name}
        </div>
        <div className="dav-card-act">
          <span className="dav-dot" style={{ background: color }} />
          {ACTIVITY_LABEL[agent.activity]}
        </div>
      </div>
    </div>
  )
}

function Customizer({
  look,
  onLook,
  previewState,
  onPreviewState
}: {
  look: AvatarLook
  onLook: (n: AvatarLook) => void
  previewState: StateId | null
  onPreviewState: (s: StateId | null) => void
}) {
  return (
    <div className="dav-cust">
      <div className="dav-cust-head">自定义</div>

      <Section title="试片">
        <div className="dav-chips">
          <Chip active={previewState === null} onClick={() => onPreviewState(null)}>
            跟随真实状态
          </Chip>
          {PREVIEW_STATES.map((s) => (
            <Chip key={s.id} active={previewState === s.id} onClick={() => onPreviewState(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="身形">
        <div className="dav-shapes">
          {Object.entries(SHAPE_OPTIONS).map(([id, label]) => (
            <button
              key={id}
              className={`dav-shape${look.shape === id ? ' is-on' : ''}`}
              onClick={() => onLook({ ...look, shape: id })}
              title={label}
            >
              <Bot state="idle" look={{ ...look, shape: id, size: 34 }} frozenAt={1.1} paper="transparent" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="配色">
        <div className="dav-colors">
          {Object.entries(COLOR_OPTIONS).map(([id, label]) => (
            <button
              key={id}
              className={`dav-color${look.color === id ? ' is-on' : ''}`}
              onClick={() => onLook({ ...look, color: id })}
              title={label}
              style={{ background: COLORS.find((c) => c.id === id)?.hex ?? '#000' }}
            />
          ))}
        </div>
      </Section>

      <Section title="静息表情">
        <div className="dav-chips">
          {Object.entries(EXPRESSION_OPTIONS).map(([id, label]) => (
            <Chip key={id} active={look.expression === id} onClick={() => onLook({ ...look, expression: id })}>
              {label}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="尺寸">
        <input
          className="dav-range"
          type="range"
          min={48}
          max={140}
          value={look.size}
          onChange={(e) => onLook({ ...look, size: Number(e.target.value) })}
        />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="dav-sec">
      <div className="dav-sec-title">{title}</div>
      {children}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`dav-chip${active ? ' is-on' : ''}`} onClick={onClick}>
      {children}
    </button>
  )
}

export { EXPRESSIONS }

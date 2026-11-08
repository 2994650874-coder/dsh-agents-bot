/** Parent-origin controls aligned above the display-only child. Never transferred by postMessage. */
export interface IsolationControlsProps {
  shownIds: readonly string[]
  displayNames: readonly { name: string; isChild: boolean }[]
  portraitSizes: readonly number[]
  cols: number
  rows: number
  customizer: boolean
  editTarget?: string
  onEdit: (id: string | undefined) => void
  onRemove: (id: string) => void
}

export function IsolationControls({ shownIds, displayNames, portraitSizes, cols, rows, customizer, editTarget, onEdit, onRemove }: IsolationControlsProps) {
  return <div aria-label="隔离画面操作" style={{ position: 'absolute', inset: 8, zIndex: 1, display: 'grid', gap: 6,
    gridTemplateColumns: 'repeat(' + cols + ',minmax(0,1fr))', gridTemplateRows: 'repeat(' + rows + ',minmax(0,1fr))',
    pointerEvents: 'none' }}>
    {shownIds.map((id, index) => {
      const editing = customizer && editTarget === id
      const target = customizer && (editing || (editTarget === undefined && index === 0))
      return <div key={id} className={'davf-isolated-cell' + (shownIds.length === 1 ? ' is-single' : shownIds.length === 2 && (portraitSizes[index] ?? 0) >= 80 ? ' is-pair' : shownIds.length >= 3 && shownIds.length <= 8 && (portraitSizes[index] ?? 0) >= 120 ? ' is-spacious' : shownIds.length === 9 ? ' is-dense' : '')} style={{ pointerEvents: 'none' }}>
         <span className="davf-isolated-portrait-space" style={{ height: portraitSizes[index] ?? 48, marginBottom: shownIds.length === 1 ? -Math.min(36, Math.round((portraitSizes[index] ?? 48) * .2)) : undefined }} aria-hidden="true" />
        <span className="davf-isolated-name" title={displayNames[index]?.name ?? '已关闭的对话'}>
          {displayNames[index]?.isChild ? <span className="davf-caret">└ </span> : null}
          {displayNames[index]?.name ?? '已关闭的对话'}
        </span>
        <span className="davf-isolated-meta-space" aria-hidden="true" />
        <span className="davf-isolated-meta-space" aria-hidden="true" />
        {customizer ? <button type="button" className={'davf-cell-tag' + (target ? ' is-on' : '')} style={{ pointerEvents: 'auto' }}
          title={editing ? '正在修改这个 agent 的外观（只改这一个）' : target ? '没选具体 agent 时，改的是全局外观' : '点它只修改这个 agent 的外观'}
          aria-label={'修改第' + (index + 1) + '格外观'}
          onClick={() => onEdit(editing ? undefined : id)}>
          {editing ? '修改中' : target ? '默认' : '改它'}
        </button> : index > 0 ? <button type="button" className="davf-cell-remove" style={{ pointerEvents: 'auto', opacity: 0.85 }}
          title="取消监视" aria-label={'取消第' + (index + 1) + '格监视'} onClick={() => onRemove(id)}>✕</button> : null}
      </div>
    })}
  </div>
}

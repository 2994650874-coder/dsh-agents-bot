/**
 * 独立预览入口：把 `AvatarPanel` 原样挂到页面上，喂假数据。
 *
 * 目的只有一个 —— 在没有 DSH 外壳的情况下验证「引擎 + React 渲染 + 面板布局」
 * 这条路通不通、帧率够不够。它不打进插件包，只是 tools/ 下的验证工具。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-preview.mjs
 *   然后用浏览器打开 preview/index.html
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AvatarPanel } from '../plugin/src/client/Panel'
import { DEFAULT_LOOK, type AvatarLook } from '../plugin/src/client/look'
import type { AgentRow } from '../plugin/src/client/agents'
import type { StateId } from '../plugin/src/bot/states'
import { STYLE } from '../plugin/src/client/style'

const FAKE: AgentRow[] = [
  { id: 'a1', name: 'Lead · 总控', isChild: false, activity: 'thinking', changedAt: 0 },
  { id: 'a2', name: '检索手', isChild: true, parentId: 'a1', activity: 'reading', changedAt: 0 },
  { id: 'a3', name: '命令行工', isChild: true, parentId: 'a1', activity: 'running', changedAt: 0 },
  { id: 'a4', name: '写手', isChild: true, parentId: 'a1', activity: 'writing', changedAt: 0 },
  { id: 'a5', name: '审查员', isChild: true, parentId: 'a1', activity: 'waiting', changedAt: 0 },
  { id: 'a6', name: '仲裁', isChild: false, activity: 'done', changedAt: 0 },
  { id: 'a7', name: '空转的', isChild: false, activity: 'idle', changedAt: 0 },
  { id: 'a8', name: '崩了的', isChild: false, activity: 'error', changedAt: 0 }
]

function App() {
  const [look, setLook] = useState<AvatarLook>(DEFAULT_LOOK)
  const [preview, setPreview] = useState<StateId | null>(null)
  return (
    <div className="dav-host" style={{ height: '100vh' }}>
      <AvatarPanel
        agents={FAKE}
        look={look}
        onLook={setLook}
        previewState={preview}
        onPreviewState={setPreview}
        compact={false}
        empty={false}
      />
    </div>
  )
}

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;height:100%;background:var(--dsw-alias-bg-layer-1,#fff);font-family:-apple-system,"Segoe UI",sans-serif}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
  `
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

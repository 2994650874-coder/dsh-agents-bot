/**
 * 重渲染成本探针：面板订阅的是**整份会话快照**（`useSessions((s) => s)`），
 * 那么「快照被无关地更新」会不会让整棵面板重渲染、吃掉主线程？
 *
 * 这是回答「对话流式输出时 bot 为什么偶尔卡一下」的关键一问：流式期间
 * 会话快照会高频变化（running / tokenUsage / contextPressure …），而面板
 * 只关心其中 `agentsBot` 那一个字段。若每次快照更新都触发全量重渲染，
 * 那 6 个 bot 的 rAF 循环就会和它抢同一条主线程。
 *
 * 做法：同一个面板、同一份假数据，**只改「多久推一次新快照」**这一个变量：
 *   ?hz=0   快照恒定（对照）
 *   ?hz=20  模拟流式期间的高频更新（只变面板不读的字段）
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-rerender.mjs
 *   node tools/probe-rerender.mjs
 */
import { useState, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { AvatarPanel } from '../plugin/src/client/AvatarPanel'
import { STYLE } from '../plugin/src/client/style'

const NOW = Date.now()
const HZ = Number(new URLSearchParams(location.search).get('hz') ?? 0)

const ROWS = [
  { id: 'a1', displayTitle: '总控 · Lead', updatedAt: NOW, retainedBy: { mainView: 1 } },
  { id: 'a2', displayTitle: '检索手', updatedAt: NOW - 1000, retainedBy: {} },
  { id: 'a3', displayTitle: '命令行工', updatedAt: NOW - 2000, retainedBy: {} },
  { id: 'a4', displayTitle: '写手', updatedAt: NOW - 3000, retainedBy: {} },
  { id: 'a5', displayTitle: '审查员', updatedAt: NOW - 4000, retainedBy: {} },
  { id: 'a6', displayTitle: '仲裁', updatedAt: NOW - 5000, retainedBy: {} }
]

/** 一份快照。`tick` 只改一个**面板不读**的字段（模拟流式 token 计量）。 */
function snapshotOf(tick) {
  const byId = {}
  const projectionsBySession = {}
  for (const r of ROWS) {
    byId[r.id] = { ...r, running: true }
    projectionsBySession[r.id] = {
      values: {
        tokenUsage: { outputTokens: tick }, // ← 面板不读
        agentsBot: { tool: 'pwsh', tools: 1, bg: 0, compacting: false, errorAt: 0 }
      }
    }
  }
  return { ids: ROWS.map((r) => r.id), byId, phase: 'ready', projectionsBySession }
}

function statusOf(tick) {
  const m = new Map()
  for (const r of ROWS) m.set(r.id, { running: true, lastSeen: tick }) // lastSeen 面板不读
  return m
}

/** 外部 store：按 hz 推新快照。 */
function makeStore(hz) {
  const listeners = new Set()
  let tick = 0
  let snap = snapshotOf(0)
  let status = statusOf(0)

  if (hz > 0) {
    setInterval(() => {
      tick += 1
      snap = snapshotOf(tick)
      status = statusOf(tick)
      for (const l of listeners) l()
    }, 1000 / hz)
  }

  return {
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getSnap: () => snap,
    getStatus: () => status
  }
}

const STORE = makeStore(HZ)

/* 传给面板的三个 hook。面板内部会调它们，所以必须是 hook 形状。 */
const useSessions = (sel) => sel(useSyncExternalStore(STORE.subscribe, STORE.getSnap, STORE.getSnap))
const useSessionStatus = (sel) => sel(useSyncExternalStore(STORE.subscribe, STORE.getStatus, STORE.getStatus))
const useWorkspaces = (sel) => sel({ list: [] })

function App() {
  const [, force] = useState(0)
  // 让页面能通过 window.__force 触发一次手动重渲染（用于对照）
  ;(window as unknown as { __force?: () => void }).__force = () => force((n) => n + 1)
  return (
    <div className="fake-right" style={{ width: 360, height: 760 }}>
      <AvatarPanel useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces} />
    </div>
  )
}

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;
    --dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;
    --dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;
    --dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;
    --dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}
  `
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

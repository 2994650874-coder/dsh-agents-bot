/**
 * 帧预算争用探针：**同一条 JS 主线程上，两个活一起跑时谁会掉帧。**
 *
 * 这是回答「流式输出时 bot 偶尔卡一下、LLM 说完就恢复」的直接实验：
 *
 *   ?mode=bot    只有头像面板在跑（6 个 bot 的 rAF 循环）
 *   ?mode=chat   只有一段「流式正文」在跑（模拟对话区高频追加文本）
 *   ?mode=both   两个一起跑
 *
 * 量的不是平均 CPU，而是**帧间隔分布** —— 卡顿是「个别帧超过一帧预算」，
 * 平均值再低也照样看得见。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-contention.mjs
 *   node tools/probe-contention.mjs
 */
import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AvatarPanel } from '../plugin/src/client/AvatarPanel'
import { STYLE } from '../plugin/src/client/style'

const NOW = Date.now()
const MODE = new URLSearchParams(location.search).get('mode') ?? 'both'

const ROWS = [
  { id: 'a1', displayTitle: '总控 · Lead', updatedAt: NOW, retainedBy: { mainView: 1 } },
  { id: 'a2', displayTitle: '检索手', updatedAt: NOW - 1000, retainedBy: {} },
  { id: 'a3', displayTitle: '命令行工', updatedAt: NOW - 2000, retainedBy: {} },
  { id: 'a4', displayTitle: '写手', updatedAt: NOW - 3000, retainedBy: {} },
  { id: 'a5', displayTitle: '审查员', updatedAt: NOW - 4000, retainedBy: {} },
  { id: 'a6', displayTitle: '仲裁', updatedAt: NOW - 5000, retainedBy: {} }
]

function snapshotOf(tick) {
  const byId = {}
  const projectionsBySession = {}
  for (const r of ROWS) {
    byId[r.id] = { ...r, running: true }
    projectionsBySession[r.id] = {
      values: {
        tokenUsage: { outputTokens: tick },
        agentsBot: { tool: 'pwsh', tools: 1, bg: 0, compacting: false, errorAt: 0 }
      }
    }
  }
  return { ids: ROWS.map((r) => r.id), byId, phase: 'ready', projectionsBySession }
}

const SNAP = snapshotOf(0)
const STATUS = new Map(ROWS.map((r) => [r.id, { running: true }]))
const useSessions = (sel) => sel(SNAP)
const useSessionStatus = (sel) => sel(STATUS)
const useWorkspaces = (sel) => sel({ list: [] })

/** 正文一次吐多少字 —— 约等于一个 token 的中文长度，贴近真实流式粒度。 */
const CHUNK = '模型正在把这一段正文一个字一个字地吐出来，每个片段都要让对话区重新排版。'

/**
 * 模拟 DSH 对话区的流式渲染。
 *
 * 用**真实的 layout 压力**而不是假的空循环：每 16ms 往正文尾部追加一段文字，
 * 正文是会自动换行的段落，容器限高且滚到底。这正是官方文档点名的形态 ——
 * 「每个 chunk 全量重算并立即发布，等于把整个节点集合压进帧预算」。
 */
function ChatColumn() {
  const [text, setText] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    const id = window.setInterval(() => {
      setText((t) => (t.length > 2400 ? t.slice(1200) : t + CHUNK))
    }, 16)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])

  return (
    <div className="chat">
      <div className="chat-inner" ref={ref}>
        <p className="chat-p">{text}</p>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="host">
      {MODE === 'chat' || MODE === 'both' ? <ChatColumn /> : null}
      {MODE === 'bot' || MODE === 'both' ? (
        <div className="side">
          <AvatarPanel useSessions={useSessions} useSessionStatus={useSessionStatus} useWorkspaces={useWorkspaces} />
        </div>
      ) : null}
    </div>
  )
}

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif}
  .host{display:flex;width:1200px;height:800px}
  .chat{flex:1;min-width:0;display:flex;flex-direction:column;border-right:1px solid #e6e9ef}
  .chat-inner{flex:1;overflow:hidden;padding:16px 20px;font-size:14px;line-height:1.75;color:#1c1f24}
  .chat-p{margin:0;white-space:pre-wrap;word-break:break-word}
  .side{width:360px;flex-shrink:0;height:800px;display:flex}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;
    --dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;
    --dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;
    --dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;
    --dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}
  `
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

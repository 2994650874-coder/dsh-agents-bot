import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { ParentBridge } from '../isolation/protocol.mjs'
import type { snapshotForChild } from './bridgeSnapshot'
import { canvasColorBehind, labelColorForCanvas } from './canvasColor'
import { Bot } from './Bot'

// Only a reviewed combined build may substitute this owner capability.
declare const __BOT_ISOLATION_CAPABILITY__: string
declare const __BOT_ISOLATION_PARENT_ORIGIN__: string
const CHILD_ORIGIN = 'http://127.0.0.1:49383'
// Compile-time pin, never derived from messages, query strings or the child page.
const PARENT_ORIGIN = typeof __BOT_ISOLATION_PARENT_ORIGIN__ === 'string' ? __BOT_ISOLATION_PARENT_ORIGIN__ : 'dsh-app://app'
const HEARTBEAT_MS = 3000
const ACK_MAX_AGE_MS = 10000

type Snapshot = NonNullable<ReturnType<typeof snapshotForChild>>

/** One bounded parent-origin startup animation; real activity and controls stay in the hidden child until ACK. */
function StartupPlaceholder({ look }: { look: Snapshot['rows'][number]['look'] }) {
  const [animating, setAnimating] = useState(true)
  useEffect(() => {
    const timer = setTimeout(() => setAnimating(false), 2400)
    return () => clearTimeout(timer)
  }, [])
  const size = Math.min(110, look.size)
  return <div className="davf-isolation-startup" role="status">
    <div className="davf-isolation-startup-portrait">
      <Bot state={animating ? 'bounce' : 'idle'} frozenAt={animating ? undefined : 1.1}
        look={{ ...look, size }} fps={15} paper="transparent" />
    </div>
    <span className="davf-isolation-startup-note">正在验证独立画面…</span>
    <span className="davf-isolation-startup-pill"><span className="davf-isolation-startup-dot" aria-hidden="true" />启动中</span>
  </div>
}
export interface IsolatedGridProps {
  snapshot: Snapshot
  containerRef?: Ref<HTMLDivElement>
  controls?: ReactNode // parent-origin overlay; never sent to or rendered inside the child document
  onUnavailable: (reason: string, recoverable?: boolean) => void
  onConnected?: () => void
}

/** A validated snapshot ACK, not READY alone, opens the independent canvas. */
export function IsolatedGrid({ snapshot, containerRef, controls, onUnavailable, onConnected }: IsolatedGridProps) {
  const frame = useRef<HTMLIFrameElement | null>(null)
  const latest = useRef(snapshot)
  const bridgeRef = useRef<InstanceType<typeof ParentBridge> | null>(null)
  const [ready, setReady] = useState(false)
  latest.current = snapshot
  const sampleCanvas = () => {
    const root = frame.current?.parentElement
    const canvas = canvasColorBehind(root ?? null)
    root?.style.setProperty('--davf-isolated-canvas', canvas)
    root?.style.setProperty('--davf-isolated-label', labelColorForCanvas(canvas))
    return canvas
  }
  // Paint the preview with the sampled sidebar color before the iframe load/owner beacon can finish.
  useLayoutEffect(() => { sampleCanvas() }, [snapshot])
  const currentUi = (ui: Snapshot['ui']) => ({ ...ui, canvas: sampleCanvas() })

  useEffect(() => {
    const bridge = bridgeRef.current
    if (bridge?.phase === 'ready' && bridge.publish(snapshot.rows, currentUi(snapshot.ui)) === false) {
      onUnavailable('活动快照未通过白名单验证')
    }
  }, [snapshot, onUnavailable])

  useEffect(() => {
    const target = frame.current
    const capability = typeof __BOT_ISOLATION_CAPABILITY__ === 'string' ? __BOT_ISOLATION_CAPABILITY__ : ''
    if (!target || window.location.origin !== PARENT_ORIGIN || !/^[a-f0-9]{64}$/.test(capability)) {
      onUnavailable('独立画面入口未通过验证')
      return
    }
    let live = true, owned = false, unavailable = false, acknowledged = false
    let loadedAt = 0
    let handshakeTimeout: ReturnType<typeof setTimeout> | undefined
    let staleAckTimeout: ReturnType<typeof setTimeout> | undefined
    const awake = () => document.visibilityState === 'visible' && document.hasFocus()
    const fail = (reason: string, recoverable = false) => {
      if (!live || unavailable) return
      unavailable = true
      clearTimeout(handshakeTimeout)
      clearTimeout(staleAckTimeout)
      bridgeRef.current = null
      setReady(false)
      onUnavailable(reason, recoverable)
    }
    const sendFresh = () => {
      const bridge = bridgeRef.current
      if (!live || unavailable || !owned || !bridge || bridge.phase !== 'ready') return
      try { if (!bridge.publish(latest.current.rows, currentUi(latest.current.ui))) { fail('隔离快照校验失败'); return } }
      catch { fail('隔离数据发送失败', true); return }
      if (bridge.lastAckSeq < 1 || Date.now() - bridge.lastAckAt <= ACK_MAX_AGE_MS || staleAckTimeout || !awake()) return
      const lastAckAt = bridge.lastAckAt
      staleAckTimeout = setTimeout(() => {
        staleAckTimeout = undefined
        if (bridgeRef.current === bridge && bridge.lastAckAt <= lastAckAt && awake()) fail('隔离画面失联', true)
      }, 8000)
    }
    const onLoad = () => {
      if (!live || unavailable) return
      const source = target.contentWindow
      if (!source) { fail('隔离子页没有可用窗口'); return }
      owned = false
      acknowledged = false
      loadedAt = Date.now()
      clearTimeout(staleAckTimeout)
      staleAckTimeout = undefined
      setReady(false)
      try {
        const bridge = new ParentBridge({ childSource: source, childOrigin: CHILD_ORIGIN, send: (to: Window, data: unknown, origin: string) => to.postMessage(data, origin) })
        bridgeRef.current = bridge
        if (!bridge.publish(latest.current.rows, currentUi(latest.current.ui))) { fail('隔离快照校验失败'); return }
      } catch { fail('隔离通道初始化失败'); return }
      clearTimeout(handshakeTimeout)
      handshakeTimeout = setTimeout(() => { if ((bridgeRef.current?.lastAckSeq ?? 0) < 1 && awake()) fail('隔离握手超时', true) }, 8000)
    }
    const onMessage = (event: MessageEvent) => {
      if (!live || unavailable || event.source !== target.contentWindow || event.origin !== CHILD_ORIGIN) return
      const data = event.data
      if (data && typeof data === 'object' && !Array.isArray(data) && data.kind === 'G2_OWNER') {
        if (Object.keys(data).length !== 3 || data.v !== 1 || data.capability !== capability) { fail('隔离资源归属标记不匹配'); return }
        owned = true
        return
      }
      if (!owned || !bridgeRef.current) return
      try {
        const bridge = bridgeRef.current
        if (!bridge.receive(event)) return
        if (bridge.lastAckSeq >= 1) {
          clearTimeout(handshakeTimeout)
          clearTimeout(staleAckTimeout)
          staleAckTimeout = undefined
          if (!acknowledged) { acknowledged = true; onConnected?.() }
          setReady(true)
        }
        else {
          setReady(false)
          if (bridge.phase === 'init') {
            // A lost-sequence RESYNC resets the ACK counter: fail back if the fresh epoch stalls.
            loadedAt = Date.now()
            clearTimeout(handshakeTimeout)
            handshakeTimeout = setTimeout(() => { if ((bridgeRef.current?.lastAckSeq ?? 0) < 1 && awake()) fail('隔离重同步超时', true) }, 8000)
          }
        }
      } catch { fail('隔离通信失败') }
    }
    const onError = () => fail('隔离资源加载失败', true)
    const onResume = () => {
      if (!live || unavailable || !awake()) return
      const bridge = bridgeRef.current
      if (bridge?.phase === 'ready') sendFresh()
      else if (loadedAt > 0 && Date.now() - loadedAt >= 8000) fail('隔离握手超时', true)
    }
    window.addEventListener('message', onMessage)
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    document.addEventListener('visibilitychange', onResume)
    target.addEventListener('load', onLoad)
    target.addEventListener('error', onError)
    target.src = CHILD_ORIGIN + '/'
    const heartbeat = setInterval(sendFresh, HEARTBEAT_MS)
    return () => {
      live = false
      clearInterval(heartbeat)
      clearTimeout(handshakeTimeout)
      clearTimeout(staleAckTimeout)
      window.removeEventListener('message', onMessage)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      document.removeEventListener('visibilitychange', onResume)
      target.removeEventListener('load', onLoad)
      target.removeEventListener('error', onError)
      bridgeRef.current = null
    }
  }, [onUnavailable, onConnected])

  return <div ref={containerRef} style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
    <iframe ref={frame} title="隔离活动 AI" sandbox="allow-scripts allow-same-origin" style={{ display: ready ? 'block' : 'none', width: '100%', height: '100%', border: 0 }} />
    {ready ? controls : null}
    {!ready && snapshot.rows[0] ? <StartupPlaceholder look={snapshot.rows[0].look} /> : null}
  </div>
}

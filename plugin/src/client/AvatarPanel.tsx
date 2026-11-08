/**
 * 面板正文：右栏 tab 里的那块内容。
 *
 * ── 它现在只管「个体」────────────────────────────────────────────────
 * 这里只剩**外观**（身形 / 配色 / 表情）和**监视集合**。通用配置
 * （帧率、每个活动配哪个动画、休眠阈值）和试片都搬到设置页了 ——
 * 见 `Settings.tsx`。
 *
 * 分界线一句话：**设置页是对整个通用的，右栏留下的是针对个体的。**
 *  · 帧率、动画映射 = 「这台机器上所有 agent 都这样反应」→ 配置
 *  · 身形、配色、表情 = 「我喜欢这个 bot 长这样」→ 审美
 *
 * 试片跟着控件走：它服务于「动画映射」，所以和动画映射一起在设置页。
 * 右栏的格子本身就在实时显示真实状态，不需要另一个预览位。
 *
 * ── 为什么不再是浮窗 ────────────────────────────────────────────────
 * 旧形态是 `shell.overlay` 上的一个可拖动/可拉伸的浮窗。它有两个毛病：
 *   1. 盖住对话区（视觉上「多出来一层」，和 DSH 自己的界面不像一套东西）
 *   2. 位置和尺寸是本插件自己维护的一份状态，和宿主布局无关
 * 现在改成右侧栏的一个 tab 页：宿主给轨道宽度，本组件只负责填满它。
 *
 * 浮窗那份实现（拖动、八向拉伸、几何持久化、顶栏安全区）已完整封存在
 * `archive/float-window/`，需要时可复活 —— 见 `archive/README.md`。
 *
 * ── 三条来自宿主的约束（改动前先确认） ───────────────────────────────
 *   1. 右栏正文的容器是 `.tabBody`：`height:100%;display:flex;flex-direction:column;
 *      overflow:hidden`。所以本组件根节点只要 `flex:1;min-height:0` 就能填满，
 *      不要自己写 100vh 或绝对定位。
 *   2. 右栏宽度由框架算：默认视口 45%，上限 70%，下限 300px（中栏保 400px）。
 *      也就是说**面板可能只有 300px 宽**，布局必须在这个宽度下不塌。
 *   3. 面板高度 = 会话区高度，可能很矮（笔记本 768 高时正文约 600px）。
 *      所以竖向要能挤：格子区吃满剩余高度，子代理小框是覆盖层不参与分配。
 *
 * ── 监控集合怎么决定格子 ─────────────────────────────────────────────
 * 不是用户选规格，是集合大小推出来的：
 *   监控列表 = 固定容量的内存队列；用户增减格数，访问会话只换位或满额替换。
 * 第一位永远是当前窗口；归档或缺席只在满额替换时有优先级。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bot } from './Bot'
import { switchToMain, switchToSidebar, useMainOverlayMode } from './mainOverlayMode'
import { IsolatedGrid } from './IsolatedGrid'
import { IsolationControls } from './IsolationControls'
import { snapshotForChild } from './bridgeSnapshot'
import { createOpaqueIds } from '../isolation/protocol.mjs'
import { activeSessionOf, unavailableSessionIds, deriveAgents, countDescendants, type AgentRow } from './agents'
import { COLORS, COLOR_OPTIONS, EXPRESSION_OPTIONS, SHAPE_OPTIONS, inShapePreset, presetLookAt, type AvatarLook } from './look'
import { MonitorPicker } from './Picker'
import {
  MAX_MONITORED,
  MIN_MAIN_BOT_SIZE,
  MAX_MAIN_BOT_SIZE,
  clearPicked,
  gridOf,
  monitoredList,
  orientationOf,
  presetPositionFor,
  visitMonitored,
  patchUi,
  removePicked,
  resetLook,
  setLook,
  setMessageLook,
  setMainBotSize,
  togglePanel,
  useUi,
  type Orientation
} from './store'

export interface AvatarPanelProps {
  useTabInfo?: () => { panel: { id: string }; tab: { actions: { openTab: (kind: string, options?: { paneId?: string }) => void } } }
  useSessions: (sel: (s: unknown) => unknown) => unknown
  useSessionStatus: (sel: (m: unknown) => unknown) => unknown
  useWorkspaces: (sel: (s: unknown) => unknown) => unknown
}

interface RecoverablePanelProps extends AvatarPanelProps {
  mode: 'sidebar' | 'main'
  paneId?: string
  openTab?: (kind: string, options?: { paneId?: string }) => void
  onTransientDisconnect: () => void
  onBridgeReady: () => void
}

/** Remount only the Bot tab content (including DSH hook subscriptions), never the chat window. */
export function AvatarPanel(props: AvatarPanelProps) {
  const tabInfo = props.useTabInfo?.()
  const mode = useMainOverlayMode()
  const [generation, setGeneration] = useState(0)
  const retryDelay = useRef(1000)
  const retryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pending = useRef(false)
  const retry = useCallback(() => {
    if (!pending.current) return
    pending.current = false
    clearTimeout(retryTimer.current)
    retryTimer.current = undefined
    setGeneration((old) => old + 1)
  }, [])
  const onTransientDisconnect = useCallback(() => {
    if (pending.current) return
    pending.current = true
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      retryTimer.current = setTimeout(retry, retryDelay.current)
    }
    retryDelay.current = Math.min(30000, retryDelay.current * 2)
  }, [retry])
  const onBridgeReady = useCallback(() => {
    retryDelay.current = 1000
    pending.current = false
    clearTimeout(retryTimer.current)
    retryTimer.current = undefined
  }, [])
  useEffect(() => {
    const onResume = () => {
      if (pending.current && document.visibilityState === 'visible' && document.hasFocus()) retry()
    }
    window.addEventListener('focus', onResume)
    window.addEventListener('pageshow', onResume)
    document.addEventListener('visibilitychange', onResume)
    return () => {
      clearTimeout(retryTimer.current)
      window.removeEventListener('focus', onResume)
      window.removeEventListener('pageshow', onResume)
      document.removeEventListener('visibilitychange', onResume)
    }
  }, [retry])
  return <AvatarPanelBody key={generation} {...props} mode={mode.place} paneId={tabInfo?.panel.id} openTab={tabInfo?.tab.actions.openTab} onTransientDisconnect={onTransientDisconnect} onBridgeReady={onBridgeReady} />
}

function AvatarPanelBody({ useSessions, useSessionStatus, useWorkspaces, mode, paneId, openTab, onTransientDisconnect, onBridgeReady }: RecoverablePanelProps) {
  const overlayMode = useMainOverlayMode()
  const mainBotSize = useUi('mainBotSize')
  const picked = useUi('picked')
  const look = useUi('look')
  const messageLook = useUi('messageLook')
  const [mainLookTarget, setMainLookTarget] = useState<'main' | 'message'>('main')
  const looks = useUi('looks')
  const customizer = useUi('customizer')
  const picker = useUi('picker')
  const editTarget = useUi('editTarget')
  const fps = useUi('fps')
  const dwellMs = useUi('dwellMs')
  const rotation = useUi('rotation')
  const preset = useUi('preset')
  const sleepMinutes = useUi('sleepMinutes')
  const [isolationError, setIsolationError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const opaqueIds = useRef<ReturnType<typeof createOpaqueIds> | null>(null)
  if (opaqueIds.current === null) opaqueIds.current = createOpaqueIds()
  const onIsolationUnavailable = useCallback((reason: string, recoverable = false) => {
    if (recoverable) { onTransientDisconnect(); return }
    setIsolationError(reason)
  }, [onTransientDisconnect])

  const list = useSessions((s) => s) as Parameters<typeof deriveAgents>[0]
  const status = useSessionStatus((m) => m) as Parameters<typeof deriveAgents>[1]
  const archivedIds = useWorkspaces((s) => (s as { archivedSessionIds?: string[] } | undefined)?.archivedSessionIds) as string[] | undefined

  const gridRef = useRef<HTMLDivElement | null>(null)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })

  /** 当前窗口的会话 id。第一位永远是它。 */
  const activeId = useMemo(() => activeSessionOf(list), [list])

  /** 归档是明确标记；缺席只有在完整且有当前会话的列表里才作满额淘汰提示。 */
  const unavailable = useMemo(() => unavailableSessionIds(list, activeId, monitoredList(undefined, picked), archivedIds),
    [activeId, archivedIds, list, picked])

  /** 切换先在内存计算候选顺序，提交放在 layout effect，不在渲染时写 store。 */
  const shownIds = useMemo(() => activeId ? monitoredList(activeId, picked, unavailable) : [], [activeId, picked, unavailable])
  useLayoutEffect(() => visitMonitored(activeId, unavailable), [activeId, unavailable])

  /**
   * agent 行。活动由 `derive` 统一推导 —— 它把「会话在跑」「工具名」
   * 「出错」「压缩」「后台任务」这些信号按优先级折成一个活动。
   *
   * 依赖里带 `now` 是不行的（每次渲染都是新值，等于每帧重算）。
   * 时间相关的判据（休眠、出错保留期、刚完成）本来就需要定期刷新，
   * 所以用一个低频 tick 驱动：每 5 秒一次。面板上这些都是「秒级」
   * 语义，5 秒的精度完全够，而 5 秒一次的 setState 开销可以忽略。
   */
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(id)
  }, [])

  const agents: AgentRow[] = useMemo(
    () => deriveAgents(list, status, now, sleepMinutes),
    [list, status, now, sleepMinutes]
  )
  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents])

  const count = shownIds.length

  /**
   * 某个会话**实际生效**的外观。
   *
   * 三档，优先级从高到低：
   *   1. `looks[id]` —— 手动调过这个格子，冻结成它自己的
   *   2. 自动顺位首次按对话 id 认领；换格仍用原顺位（修改预设仍生效）
   *   3. 全局外观（首次认领第 1 顺位的外观，也是配色和尺寸的来源）
   *
   * 外观面板必须用这一份、而不是全局 `look`：否则「点第 2 格的『改它』」
   * 打开的是圆+中性，和眼前那一格的圆角方+好奇对不上；此时只要动一下
   * 配色，整份外观（含身形表情）就被冻结成圆+中性，格子会突然跳回去。
   */
  const lookFor = useCallback(
    (id: string): AvatarLook =>
      looks[id] ?? presetLookAt(presetPositionFor(id, shownIds.indexOf(id)), look, preset),
    [looks, look, shownIds, preset]
  )

  /**
   * 朝向由**内容区**（`.davf-body`）的宽高比决定，不由格子区决定。
   *
   * 为什么不能测格子区自己：格子区的宽高比**取决于它按哪个朝向排**——
   * 竖排时它又窄又高、横排时它又宽又矮，于是「测出来的比例」和
   * 「据此选出的朝向」互为因果，会自我锁定。
   *
   * 实测踩到的形态：打开监视面板时格子区被压成矮宽形 → 判成横排 →
   * 关掉面板后朝向不回来（要等下一次尺寸变化）。2 格时就表现为
   * 「竖右栏里排成了 1×2」。
   *
   * `.davf-body` 的高度只由面板高度减去标题行决定，与内部怎么排无关；
   * 面板开合也不改它的尺寸（面板在它内部）。所以它是稳定的判据。
   */
  const [orientation, setOrientation] = useState<Orientation>('landscape')
  const grid = useMemo(() => gridOf(count, orientation), [count, orientation])

  useEffect(() => {
    const el = bodyRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      setOrientation((prev) => orientationOf(r.width, r.height, prev))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /**
   * 格子区的实测尺寸 —— 只用于算头像大小，不参与朝向判断。
   * 单独一个 observer：它随朝向/格数/面板开合变化，正是「当前真实可用空间」。
   */
  useEffect(() => {
    const el = gridRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (r) setBox({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [customizer, picker, count, isolationError, retryKey])

  /**
   * 每格自己名下有几个子代理。
   *
   * ── 为什么从「只算当前窗口」改成「每格各算各的」────────────────────
   * 指示器现在嵌在**各自格子内部**（左下角那个小框），归属天然明确，
   * 于是旧横条那三条限制全都不需要了：
   *
   *   1. 「只监视 1 个窗口才显示」—— 旧横条占整块内容区的 1/3，多格时
   *      它到底属于哪一格说不清。内嵌之后每格各带各的，不用猜。
   *   2. 「该窗口有子代理」—— 依然成立，只是判据落到每一格上。
   *   3. 「面板开着就不显示」—— 那条限制存在的唯一理由是横条会把格子
   *      挤到只剩几十像素（实测 91px 时胶囊已经很难点）。小框是覆盖层，
   *      不参与布局，挤不到任何东西，所以面板开着也照常显示。
   *
   * 一次算完整张表：`countDescendants` 每次调用都要重建 parentId 索引，
   * 9 格逐个在 render 里算就是 9 次全量扫描。放 `useMemo` 里只在
   * `list` / `shownIds` 变化时算一遍。
   */
  const kidsCount = useMemo(() => {
    const out = new Map<string, number>()
    for (const id of shownIds) {
      const n = countDescendants(list, id)
      if (n > 0) out.set(id, n)
    }
    return out
  }, [list, shownIds])

  // 格子内可用尺寸
  const gap = 8
  const cellW = Math.max(40, (box.w || 320) / grid.cols - gap)
  const cellH = Math.max(40, (box.h || 480) / grid.rows - gap)
  const botSize = Math.round(Math.max(40, Math.min(260, Math.min(cellW, cellH - 34) * 0.92)))
  const isolatedSnapshot = useMemo(() => {
    if (count === 0 || !opaqueIds.current) return null
    return snapshotForChild({
      shownIds, agentById, kidsCount,
      tokenFor: (id) => opaqueIds.current!.get(id), lookFor, botSize,
      customizer, editTarget, fps, dwellMs, rotation, cols: grid.cols, rows: grid.rows
    })
  }, [retryKey, count, shownIds, agentById, kidsCount, lookFor, botSize, customizer, editTarget, fps, dwellMs, rotation, grid])

  useEffect(() => {
    if (count > 0 && isolatedSnapshot === null) onIsolationUnavailable('隔离显示数据不可用')
  }, [count, isolatedSnapshot, onIsolationUnavailable])

  /* ── 面板主体 ──────────────────────────────────────────────────────
     顺序很重要：两个面板都在格子**之前**（上方），且互斥 ——
     这样无论点监视还是外观，都是「从上面滑下来盖住格子顶部」，
     方向一致。之前外观写在格子之后，于是它从下往上长，和监视反着。 */
  return (
    <div className="davf-panel">
      <div className="davf-bar">
        <span className="davf-title">活动 AI</span>
        <span className="davf-count">
          {count}
          <span className="davf-count-total">/{MAX_MONITORED}</span>
        </span>

        <button type="button" role="switch" aria-label="Bot 展示位置" aria-checked={mode === 'main'}
          title={mode === 'main' ? '切回侧栏 Bot' : '切到 DSH 主窗口'}
          className="davf-g2-switch" data-testid="g2-placement-switch" onClick={() => {
            if (mode === 'main') { if (switchToSidebar()) { setMainLookTarget('main'); patchUi({ customizer: false }) } return }
            const rect = gridRef.current?.getBoundingClientRect()
            const size = mainBotSize
            const x = rect ? rect.left + rect.width / (2 * grid.cols) - size / 2 : window.innerWidth - 152
            const y = rect ? rect.top + rect.height / (2 * grid.rows) - size / 2 : 96
            switchToMain({ x, y }, paneId, openTab)
            setMainLookTarget('main')
            patchUi({ customizer: false, picker: false, editTarget: undefined })
          }}>
          <span className="davf-g2-switch-track"><span className="davf-g2-switch-thumb" /></span>
          <span className="davf-g2-switch-text">{mode === 'main' ? '回侧栏' : '主窗口'}</span>
        </button>
        <div className="davf-capsule">
          <button
            className={`davf-cap${picker ? ' is-on' : ''}`}
            title="选择要显示在格子里的对话"
            onClick={() => togglePanel('picker')}
          >
            对话…
          </button>
          <button
            className={`davf-cap${customizer ? ' is-on' : ''}`}
            title="自定义外观"
            onClick={() => togglePanel('customizer')}
          >
            外观
          </button>
          {picked.length > 0 ? (
            <button className="davf-cap davf-cap-quiet" title="取消全部额外对话" onClick={clearPicked}>
              清空
            </button>
          ) : null}
        </div>
      </div>
      {mode === 'main' && overlayMode.returnError ? <span role="status" className="davf-g2-switch-error">{overlayMode.returnError}</span> : null}

      <div className="davf-body" ref={bodyRef}>
        {picker ? (
          <MonitorPicker
            useSessions={useSessions}
            useSessionStatus={useSessionStatus}
            useWorkspaces={useWorkspaces}
            activeId={activeId}
          />
        ) : null}

        {/* 外观面板也在格子之前（上方），和监视面板同一个位置、同一个方向 */}
        {customizer ? (
          <Customizer
            look={mode === 'main' && mainLookTarget === 'message' ? messageLook : editTarget === undefined ? look : lookFor(editTarget)}
            target={editTarget}
            targetName={editTarget === undefined ? undefined : agentById.get(editTarget)?.name}
            targetIndex={editTarget === undefined ? 0 : shownIds.indexOf(editTarget)}
            overridden={Object.keys(looks).length > 0}
            mainBotSize={mainBotSize}
            showMainSize={mode === 'main'}
            mainLookTarget={mainLookTarget}
            onMainLookTarget={setMainLookTarget}
            onLook={(next) => mode === 'main' && mainLookTarget === 'message' ? setMessageLook(next) : setLook(editTarget, next)}
            onReset={editTarget !== undefined && looks[editTarget] ? () => resetLook(editTarget) : undefined}
          />
        ) : null}

        {mode === 'main' ? (
          <div className={'davf-g2-placeholder'+(customizer || picker ? ' is-compact' : '')} role="status"><svg className="davf-g2-still" width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><rect x="23" y="30" width="50" height="38" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="60" cy="40" r="3" fill="currentColor" /><path d="M29 61 41 49l8 8 8-7 10 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg><div className="davf-g2-placeholder-copy"><strong className="davf-g2-placeholder-title">我在 DSH 桌面活动</strong><span className="davf-g2-placeholder-subtitle">侧边栏可以关闭</span><span className="davf-g2-placeholder-hint">调整大小或外观，请点击上方「外观」</span></div></div>
        ) : isolationError ? (
          <div className="davf-isolation-error" role="status">
            <span>独立画面暂不可用：{isolationError}</span>
            <button type="button" onClick={() => { opaqueIds.current?.clear(); setIsolationError(null); setRetryKey((n) => n + 1) }}>重试</button>
          </div>
        ) : isolatedSnapshot ? (
          <IsolatedGrid key={retryKey} snapshot={isolatedSnapshot} containerRef={gridRef} onUnavailable={onIsolationUnavailable} onConnected={onBridgeReady}
            controls={<IsolationControls shownIds={shownIds} displayNames={shownIds.map((id) => ({ name: agentById.get(id)?.name ?? '已关闭的对话', isChild: agentById.get(id)?.isChild ?? false }))} portraitSizes={isolatedSnapshot.rows.map((row) => row.look.size)} cols={grid.cols} rows={grid.rows} customizer={customizer}
              editTarget={editTarget} onEdit={(target) => patchUi({ editTarget: target })} onRemove={removePicked} />} />
        ) : <div className="davf-isolation-empty" role="status">{activeId === undefined ? '当前窗口未识别到对话，正在等待…' : count === 0 ? '暂无可显示的会话' : '正在准备独立画面…'}</div>}
      </div>
    </div>
  )
}

/**
 * 外观面板：只放**个体**的东西。
 *
 * 帧率和试片已搬去设置页（它们是通用配置，不是某个 bot 的样子）。
 * 搬走的理由不只是「分层好看」：试片要预览的是「动画映射」，
 * 而映射在设置页 —— 配置和预览必须挨着，否则配完要来回切。
 */
function Customizer({
  look,
  target,
  targetName,
  targetIndex,
  overridden,
  mainBotSize,
  showMainSize,
  mainLookTarget,
  onMainLookTarget,
  onLook,
  onReset
}: {
  look: AvatarLook
  /** undefined = 编辑全局外观 */
  target: string | undefined
  targetName?: string
  /** 这一格在格子里的位置（0 = 当前窗口）。只在编辑单个 agent 时有意义。 */
  targetIndex: number
  overridden: boolean
  mainBotSize: number
  showMainSize: boolean
  mainLookTarget: 'main' | 'message'
  onMainLookTarget: (target: 'main' | 'message') => void
  onLook: (next: AvatarLook) => void
  onReset?: () => void
}) {
  const editingGlobal = target === undefined
  const editingMessage = showMainSize && mainLookTarget === 'message'
  /**
   * 顺位表要在**这里**读，不能用 `inShapePreset` 的默认参数 ——
   * 默认值是出厂表，用户改过之后就会标错：他手动加进顺位的图案仍显示
   * 「不参与顺位」，实际却在参与。
   */
  const preset = useUi('preset')
  return (
    /* 和监视选择器用同一个大矩形框：视觉上两个面板是一对，
       而不是「一个框里一个裸列表」。 */
    <div className="davf-picker davf-custbox">
      <div className="davf-picker-head">
        <span>{editingMessage ? '外观 · 消息 Bot' : editingGlobal ? '外观 · 全局' : `外观 · ${targetName ?? '这个 agent'}`}</span>
        <span className="davf-picker-hint">
          {editingMessage
            ? '仅编辑消息 Bot 外观'
            : editingGlobal
            ? overridden
              ? '已单独设置的 agent 不受影响'
              : '整排按顺位自动分配'
            : targetIndex > 0
              ? `第 ${targetIndex + 1} 格顺位 · 只改这一个`
              : '只改这一个'}
        </span>
        {!editingMessage && onReset ? (
          <button className="davf-cap davf-cap-quiet" title="恢复成顺位预设" onClick={onReset}>
            恢复顺位
          </button>
        ) : null}
      </div>

      <div className="davf-picker-body davf-custbody">
        {showMainSize ? (
          <>
            <section className="davf-main-size" data-block="main-bot-size" aria-label="主窗口 Bot 尺寸设置">
              <label className="davf-main-size-label" htmlFor="davf-main-bot-size">尺寸 · 仅主窗口 Bot</label>
              <div className="davf-main-size-control">
                <input id="davf-main-bot-size" type="range" min={MIN_MAIN_BOT_SIZE} max={MAX_MAIN_BOT_SIZE}
                  step="1" value={mainBotSize} aria-valuetext={`${mainBotSize} 像素`}
                  onChange={(e) => setMainBotSize(Number(e.currentTarget.value))} />
                <span className="davf-cust-note">{MIN_MAIN_BOT_SIZE}–{MAX_MAIN_BOT_SIZE} px · 默认 96；侧栏自动适配</span>
              </div>
            </section>
            <div className="davf-look-target" role="group" aria-label="外观编辑目标" data-testid="g3-look-target">
              <button type="button" className="davf-look-target-choice" aria-pressed={mainLookTarget === 'main'}
                onClick={() => onMainLookTarget('main')}>
                <strong>主 Bot</strong><small>当前监控窗口</small>
              </button>
              <button type="button" className="davf-look-target-choice" aria-pressed={mainLookTarget === 'message'}
                onClick={() => onMainLookTarget('message')}>
                <strong>消息 Bot</strong><small>监控其他窗口</small>
              </button>
            </div>
          </>
        ) : null}
        <div className="davf-cust-row">
          <span className="davf-cust-label">形状</span>
          <div className="davf-shapes">
            {Object.entries(SHAPE_OPTIONS).map(([id, label]) => (
              <button
                key={id}
                className={`davf-shape${look.shape === id ? ' is-on' : ''}`}
                title={inShapePreset(id, preset) ? label : `${label}（不参与顺位，只能手动选）`}
                onClick={() => onLook({ ...look, shape: id })}
              >
                <Bot state="idle" look={{ ...look, shape: id, size: 30 }} frozenAt={1.1} paper="transparent" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="davf-cust-row">
          <span className="davf-cust-label">配色</span>
          <div className="davf-colors">
            {Object.entries(COLOR_OPTIONS).map(([id, label]) => (
              <button
                key={id}
                className={`davf-color${look.color === id ? ' is-on' : ''}`}
                title={label}
                style={{ background: COLORS.find((c) => c.id === id)?.hex ?? '#000' }}
                onClick={() => onLook({ ...look, color: id })}
              />
            ))}
          </div>
        </div>

        <div className="davf-cust-row">
          <span className="davf-cust-label">表情</span>
          <div className="davf-chips davf-expressions">
            {Object.entries(EXPRESSION_OPTIONS).map(([id, label]) => (
              <button
                key={id}
                className={`davf-chip${look.expression === id ? ' is-on' : ''}`}
                title={label}
                onClick={() => onLook({ ...look, expression: id })}
              >
                {label}
              </button>
            ))}
            {/* 必须写出来：表情平时只在空闲时看得见。
                这是引擎的硬约束（只有 idle 是 baseFace），不是 bug。
                注意措辞：调外观时作用对象被强制静止，所以此刻**看得见**变化；
                「平时」二字把这两件事分开，否则会和眼前的即时反馈打架。 */}
            <span className="davf-cust-note" title="其余状态的表情是逐帧量出来的动画，不能被覆盖">
              平时仅空闲时可见
            </span>
          </div>
        </div>

        {/* 身形同理：只有「静止轮廓」的状态才能换形状。
            放在面板最底部一行，把这两条约束一次讲清楚。 */}
        <div className="davf-cust-note davf-cust-foot">
          调外观时作用对象会切到静止姿态，否则看不出变化；其余格子照常反映真实状态。
          <br />
          帧率和动画轮播在「设置 → 插件 → 活动 AI」。
        </div>
      </div>
    </div>
  )
}

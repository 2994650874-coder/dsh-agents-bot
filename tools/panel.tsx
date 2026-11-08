/**
 * 右栏面板预览：在没有 DSH 外壳的情况下看面板长什么样、格子排布对不对。
 *
 * 关键：**容器尺寸必须可调**，因为面板现在不自己定位，它的宽高由宿主给。
 * 所以这里搭一个「假右栏」：宽度、高度都能从 URL 参数指定，
 * 面板就嵌在里面。测横/竖两种阶梯、测 300px 极窄宽度，都靠这个。
 *
 * 用假数据喂 `AvatarPanel` —— 它只依赖三个 root 标准 hook，
 * 所以这里给三个返回假快照的函数就够了，不需要整个 DSH。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-panel.mjs
 *   然后用浏览器打开 preview/panel.html
 *
 *   带参数（测竖排 / 极窄）：
 *   preview/panel.html?w=360&h=760
 *   preview/panel.html?w=300&h=600
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AvatarPanel } from '../plugin/src/client/AvatarPanel'
import { SettingsPage } from '../plugin/src/client/Settings'
import { STYLE } from '../plugin/src/client/style'

/* ── 假数据：三个工作区、若干会话，覆盖全部活动 ──────────────────────
 *
 * 关键：**子代理的摆放方式必须和宿主一致**，否则测不出「小框不出现」这类 bug。
 *
 * 宿主的 `projectList()`（`dsh-api-session-controller/lib/client.js`）里：
 *   - 普通会话：`ids.push(sessionId)` + `byId[sessionId] = {...}`
 *   - `subagentCatalog` 投影里的子代理：**只写 byId，不写 ids**
 *
 * 所以这里 s1/s2/s3/s4 故意只出现在 byId 里，不在 ids 里 —— 这就是真实形态。
 * 早期版本把它们都放进 ids，于是「只扫 ids」的 bug 在测试里完全隐形。
 */
const NOW = Date.now()

/**
 * URL 参数。必须在假数据之前解析 —— `FAKE_LIST` 要用 `PLAIN` 决定给不给投影，
 * 而 `const` 在模块作用域里是 TDZ：放到后面会直接抛 "Cannot access before
 * initialization"。
 */
const params = new URLSearchParams(location.search)
const PANEL_W = Number(params.get('w') ?? 360)
const PANEL_H = Number(params.get('h') ?? 760)
/** `?plain=1`：清空所有投影和运行态 → 每格都判成空闲 → 看得到身形/表情。 */
const PLAIN = params.get('plain') === '1'

/** 只在 byId 里、不在 ids 里的子代理（模拟 subagentCatalog 投影）。 */
const PROJECTION_KIDS = [
  { id: 's1', displayTitle: '检索手', running: true, parentId: 'a1', origin: 'subagent', updatedAt: NOW - 1000, retainedBy: {} },
  { id: 's2', displayTitle: '命令行工', running: true, parentId: 'a1', origin: 'subagent', updatedAt: NOW - 2000, retainedBy: {} },
  { id: 's3', displayTitle: '写手', running: true, parentId: 'a1', origin: 'subagent', updatedAt: NOW - 3000, retainedBy: {} },
  { id: 's4', displayTitle: '审查员', running: false, parentId: 'a1', origin: 'subagent', updatedAt: NOW - 4000, retainedBy: {} }
]

const FAKE_ROWS = [
  // 当前窗口（retainedBy.mainView > 0）—— 它永远在第一位
  { id: 'a1', displayTitle: '总控 · Lead', running: true, cwd: '/workspace', updatedAt: NOW, retainedBy: { mainView: 1 } },
  /*
   * 分叉（fork）出来的会话：**带 parentId，但不是子代理**。
   *
   * 为什么假数据里必须有它：实机上报过「小框写 ×3，但页面上只有 2 个子代理」。
   * 根因是 `countDescendants` 只判 `parentId !== undefined`，而 fork 的会话
   * 也有父会话 id，于是被算成第 3 个子代理。
   *
   * 它必须和真子代理一样挂在 a1 名下，且**必须在 ids 里**（fork 是普通会话，
   * 会出现在会话列表里）—— 这两条正是区分它与 s1~s4 的判据。
   * 没有这一行，这个 bug 在测试里完全隐形。
   */
  { id: 'a8', displayTitle: '总控 · Lead (1)', running: false, parentId: 'a1', cwd: '/workspace', updatedAt: NOW - 400, retainedBy: {} },
  // 同一工作区下的其它普通会话（给选择器足够的可勾选行）
  { id: 'a6', displayTitle: '文档整理', running: false, cwd: '/workspace', updatedAt: NOW - 500, retainedBy: {} },
  { id: 'a7', displayTitle: '索引核对', running: false, cwd: '/workspace', updatedAt: NOW - 600, retainedBy: {} },
  // 第二个工作区（这些是普通会话，正常在 ids 里）
  { id: 'b1', displayTitle: '翻译插件 · 重构', running: false, cwd: '/workspace/demo', updatedAt: NOW - 5000, retainedBy: {} },
  { id: 'b2', displayTitle: '词典抽样核对', running: true, cwd: '/workspace/demo', updatedAt: NOW - 6000, retainedBy: {} },
  { id: 'b3', displayTitle: '空的新对话', running: false, blank: true, cwd: '/workspace/demo', updatedAt: NOW - 7000, retainedBy: {} },
  // 第三个工作区
  { id: 'c1', displayTitle: 'Mnemon 记忆库', running: false, cwd: '/workspace/notes', updatedAt: NOW - 8000, retainedBy: {} },
  { id: 'c2', displayTitle: '记忆注入分析', running: false, cwd: '/workspace/notes', updatedAt: NOW - 9000, retainedBy: {} },
  // 再补两个，让「勾满 9 格」的场景测得到（9 格是上限，3×3 要能填满）
  { id: 'c3', displayTitle: '术语一致性', running: false, cwd: '/workspace/notes', updatedAt: NOW - 10000, retainedBy: {} },
  { id: 'c4', displayTitle: '旧稿归档', running: false, cwd: '/workspace/notes', updatedAt: NOW - 11000, retainedBy: {} }
]

/**
 * 假投影：模拟 Host 半侧 `agentsBot` 单元的输出。
 *
 * **必须和 `src/host/index.ts` 的 `viewOf` 字段完全一致**，否则测试
 * 测的是一个不存在的形状 —— 这个项目上 fake fixture 已经掩盖过两次真 bug。
 * `verify-tool-states.mjs` 会从 Host 源码抽字段名来比对。
 *
 * ── 场景配在谁身上 ──────────────────────────────────────────────────
 * 全部配在**可勾选的普通会话**上（a1/a6/a7/b1/b2/b3/c1）。
 *
 * 不能配在子代理（s1~s4）上：子代理只存在于 `byId` 里、不在 `ids` 里，
 * 也没有勾选入口，所以它们永远显示不成格子。第一版把场景配在 s1~s3 上，
 * 结果「读文件/检索中/写文件」三条断言永远失败 —— 不是投影没接通，
 * 是那些场景根本画不出来。
 */
const P = (over: Partial<{ tool: string | null; tools: number; bg: number; compacting: boolean; errorAt: number }>) => ({
  tool: null,
  tools: 0,
  bg: 0,
  compacting: false,
  errorAt: 0,
  ...over
})

const FAKE_PROJECTIONS: Record<string, { values: Record<string, unknown> }> = {
  // 当前窗口：在跑命令
  a1: { values: { agentsBot: P({ tool: 'pwsh', tools: 1 }) } },
  // 检索
  a6: { values: { agentsBot: P({ tool: 'grep', tools: 1 }) } },
  // 写文件
  a7: { values: { agentsBot: P({ tool: 'write', tools: 1 }) } },
  // 读文件
  b1: { values: { agentsBot: P({ tool: 'read', tools: 1 }) } },
  // 后台任务（结果已返回、任务还在跑）
  b2: { values: { agentsBot: P({ bg: 1 }) } },
  /*
   * 出错。
   *
   * `errorAt` 用 **getter** 而不是固定值，因为它模拟的是「这个 agent
   * 刚刚出过错」这个**持续为真**的状态。面板只在出错后 15 秒内显示
   * 「出错」，而测试从加载到读断言要十几秒 —— 写死一个时间戳，
   * 断言时就已过期，表现为「出错时有时无」（第一版就是这么失败的）。
   *
   * getter 每次读都返回「5 秒前」，所以它在整个测试期间都成立。
   * 面板每 5 秒重算一次活动，正好会读到新值。
   */
  b3: {
    values: {
      get agentsBot() {
        return P({ errorAt: Date.now() - 5000 })
      }
    }
  },
  // 压缩上下文
  c1: { values: { agentsBot: P({ compacting: true }) } },
  /*
   * 出错。
   *
   * 为什么配在 c2 而不是 b3：`b3` 是 `blank: true` 的空会话，
   * 而空会话**不能被勾选成格子**（它没有内容可看）—— 场景配在那儿
   * 就永远画不出来。第一版配在 b3 上，于是「出错」断言一直失败，
   * 看着像实现坏了，其实是场景放错了地方。
   *
   * `errorAt` 用 **getter** 而不是固定值：它模拟「这个 agent 刚刚出过
   * 错」这个持续为真的状态。面板只在出错后 15 秒内显示「出错」，
   * 而测试从加载到读断言要十几秒 —— 写死时间戳会在断言时过期，
   * 表现为「出错时有时无」。
   */
  c2: {
    values: {
      get agentsBot() {
        return P({ errorAt: Date.now() - 5000 })
      }
    }
  }
  // c3/c4 刻意不给投影 —— 模拟老版本 Host 半侧，验降级
}

const FAKE_LIST = {
  // 注意：ids 里**没有** s1~s4 —— 和宿主行为一致
  ids: FAKE_ROWS.map((r) => r.id),
  byId: Object.fromEntries(
    [...FAKE_ROWS.map((r) => (PLAIN ? { ...r, running: false } : r)), ...PROJECTION_KIDS].map((r) => [r.id, r])
  ),
  phase: 'ready',
  projectionsBySession: PLAIN
    ? /**
       * `?plain=1`：把所有投影清空，于是每格都判成「空闲」。
       *
       * 为什么需要这个开关：**身形和表情只在 idle 生效**（引擎的 baseBody /
       * baseFace 约束，见 README《技术要点 4》）。假数据里大多数格子在跑
       * 工具，画的是那个活动的动画轮廓 —— 于是顺位预设的截图看起来「全都
       * 一样」，容易被误判成实现坏了。要看顺位就得让它们都静止。
       */
      {}
    : {
        ...FAKE_PROJECTIONS,
        a1: {
          values: {
            ...FAKE_PROJECTIONS.a1!.values,
            // 真实宿主就是这么给的：a1 的目录下挂着 4 个子代理
            subagentCatalog: PROJECTION_KIDS.map((k) => ({
              id: k.id,
              label: k.displayTitle,
              mode: 'in-process'
            })),
            agentTeam: {
              members: [
                { id: 'a1', name: '总控 · Lead', role: 'lead', phase: 'active' },
                { id: 's1', name: '检索手', role: 'teammate', phase: 'active' },
                { id: 's2', name: '命令行工', role: 'teammate', phase: 'active' },
                { id: 's3', name: '写手', role: 'teammate', phase: 'active' },
                { id: 's4', name: '审查员', role: 'teammate', phase: 'provisioning' }
              ]
            }
          }
        }
      }
}

const FAKE_STATUS = new Map(
  (
    [
      ['a1', { running: true }],
      ['s1', { running: true }],
      ['s2', { running: true }],
      ['s3', { running: true }],
      ['s4', { pendingInteraction: true }],
      ['b1', { completionUnread: true }],
      ['b2', { running: true }],
      ['b3', {}],
      ['c1', {}],
      ['c2', { completionUnread: true }],
      ['c3', {}],
      ['c4', {}]
    ] as [string, Record<string, boolean>][]
  ).map(([id, st]) => [id, PLAIN ? {} : st])
)

const FAKE_WORKSPACES = {
  items: [
    {
      workspaceId: 'w1',
      path: '/workspace',
      title: '示例工作区',
      // 只列普通会话 —— 子代理（s1~s4）不在 ids 里，也就不该出现在勾选列表
      sessionIds: ['a1', 'a6', 'a7']
    },
    {
      workspaceId: 'w2',
      path: '/workspace/demo',
      title: '示例项目',
      sessionIds: ['b1', 'b2', 'b3']
    },
    {
      workspaceId: 'w3',
      path: '/workspace/notes',
      title: '知识库',
      sessionIds: ['c1', 'c2', 'c3', 'c4']
    }
  ]
}

const useSessions = (sel: (s: unknown) => unknown) => sel(FAKE_LIST)
const useSessionStatus = (sel: (m: unknown) => unknown) => sel(FAKE_STATUS)
const useWorkspaces = (sel: (s: unknown) => unknown) => sel(FAKE_WORKSPACES)

/* ── 假右栏 ──────────────────────────────────────────────────────────
 * 面板嵌在一个固定宽高的容器里，模拟宿主右栏的轨道。
 * 宽度/高度从 URL 参数取，默认 360×760 —— 那是「视口 1440 时右栏 45%」附近的
 * 真实值，也是竖排阶梯的典型场景。
 *
 * 容器里刻意复刻了宿主 `.tabBody` 的三条关键样式：
 *   height:100%; display:flex; flex-direction:column; overflow:hidden
 * 这样面板的 flex:1 才会像在真实右栏里一样被正确约束。
 */

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;height:100%;background:var(--dsw-alias-bg-layer-3,#eef1f6);font-family:-apple-system,"Segoe UI",sans-serif}
  #root{position:relative;height:100%}
  .fake-bg{position:absolute;inset:0;display:grid;place-items:center;color:#b3bac6;font-size:13px}
  /* 假右栏：宿主给轨道宽度，正文容器撑满它 */
  .fake-right{position:absolute;right:0;top:0;bottom:0;width:${PANEL_W}px;
    display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);
    border-left:1px solid var(--dsw-alias-border-l2)}
  /* 复刻宿主 .tabBody 的约束 —— 面板能不能正确填满全靠这几条 */
  .fake-tabbody{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
  .fake-tabstrip{height:34px;flex-shrink:0;display:flex;align-items:center;gap:6px;
    padding:0 8px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:11px;
    color:var(--dsw-alias-label-secondary)}
  .fake-chip{height:22px;display:inline-flex;align-items:center;padding:0 8px;border-radius:6px;
    background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);font-size:11px}
  .fake-chip.is-on{background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff;
    border-color:var(--dsw-alias-state-business-primary,#3964fe)}
  /* ?settings=1：左边并排挂设置页，用来验「设置页改了、右栏跟不跟」 */
  .fake-both{display:flex;height:100%;gap:12px;padding:12px;box-sizing:border-box;background:#eef1f6}
  .fake-settings{flex:0 0 440px;background:var(--dsw-alias-bg-layer-1);border-radius:10px;
    display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--dsw-alias-border-l2)}
  .fake-settings-label{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:8px 14px 4px;font-weight:600}
  .fake-settings-scroll{flex:1;overflow:auto;padding:0 14px 20px}
  .fake-both .fake-right{position:static;flex:1;height:auto;border-radius:10px;overflow:hidden}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}
  `
document.head.appendChild(style)

/* ── 卸载开关 ────────────────────────────────────────────────────────
 * 宿主切走 tab 时是**卸载**正文（本插件没声明 keepMounted），不是隐藏它。
 * 所以测「切走后还烧不烧 CPU」必须真的卸载 —— 用 display:none 测不出来：
 * 组件还挂着，rAF 循环照样跑。
 *
 * 暴露成全局函数，测试脚本用 tab.evaluate 调它。
 */
function Root() {
  const [mounted, setMounted] = useState(true)
  useEffect(() => {
    ;(window as unknown as { __setPanelMounted?: (v: boolean) => void }).__setPanelMounted = setMounted
  }, [])

  /**
   * `?settings=1`：左边再挂一个设置页。
   *
   * 为什么要这个开关：设置页和右栏在真 DSH 里是**两个 slot**，各渲染各的。
   * 「设置页改了顺位、右栏跟不跟上」只能在两者同时在场时验。而这个页面的
   * 假数据已经被 6 个验证脚本依赖 —— 另起一页抄一份 fixture 是这类验证
   * 最常见的坑（抄错一处就测了个不存在的东西，且失败信息指向错误方向）。
   * 所以用开关复用同一份假数据，不复制。
   */
  const withSettings = new URLSearchParams(location.search).get('settings') === '1'

  const panel = (
    <div className="fake-right" style={{ height: PANEL_H }}>
      <div className="fake-tabstrip">
        <span className="fake-chip">文件</span>
        <span className="fake-chip is-on">活动 AI</span>
        <span className="fake-chip">上下文</span>
      </div>
      <div className="fake-tabbody">
        {mounted ? (
          <AvatarPanel
            useSessions={useSessions}
            useSessionStatus={useSessionStatus}
            useWorkspaces={useWorkspaces}
          />
        ) : null}
      </div>
    </div>
  )

  if (!withSettings) {
    return (
      <div style={{ position: 'relative', height: '100%' }}>
        <div className="fake-bg" style={{ right: PANEL_W }}>
          （这里是 DSH 对话区；右栏是真实轨道，中栏为它让出 {PANEL_W}px）
        </div>
        {panel}
      </div>
    )
  }

  return (
    <div className="fake-both">
      <div className="fake-settings">
        <div className="fake-settings-label">设置页（插件详情）</div>
        <div className="fake-settings-scroll">
          <SettingsPage />
        </div>
      </div>
      {panel}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)

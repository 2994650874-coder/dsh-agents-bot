/**
 * dsh-agents-bot —— 浏览器半侧入口
 *
 * 四处注册：
 *   1. `ctx.sidebarRightTabs`          —— 声明一个右栏页类型（kind `agentsBot`）
 *   2. `sidebar.right.pane.tab`        —— 该类型的正文（keyed，键 = 类型 id）
 *   3. `sidebar.right.pane.tab.title`  —— 该类型 tab 的标题
 *   4. `plugins.bundle.config`         —— 设置页里的通用配置（keyed，键 = 包名）
 * 另加一个 `guide` 入口，让用户能从右栏引导页直接打开。
 *
 * ── 为什么是右栏 tab，不是左侧栏浮窗 ────────────────────────────────
 * 旧形态：左侧栏一个图标 → 点开 `shell.overlay` 上的可拖动浮窗。
 * 用户要求改成并入宿主布局：右栏本来就是「每会话一份的停靠面」，
 * 文件、浏览器、终端、上下文都在那儿，头像面板放进去就不再是
 * 界面上多出来的一层浮游物。
 *
 * 代价（已知并接受）：
 *   - 右栏是 tab 面，切到别的 tab 就看不见头像了 → 需要「实时观看」时
 *     就把这一格停在头像 tab 上，或分栏（右栏最多两格）。
 *   - 没有会话（开始页）时右栏不渲染，头像面板也就没有。
 *
 * ── 设置页为什么是 `plugins.bundle.config` 而不是 `plugins.item` ──────
 * 后者是「官方插件」分组里加一张卡片，只有官方那四个页面用。
 * 前者是「组合包自己的配置」，渲染在组合包详情页的描述与组件列表之间 ——
 * 就是用户截图里 dsh-connect-workbuddy 那个位置。我们的插件是第三方
 * 组合包，走这条。
 *
 * 两个从 workbuddy 源码里学到的坑，这里都躲开了：
 *   - **键要注册两种写法**（裸包名 + `include:` 前缀）。宿主是精确匹配
 *     包名，装法不同名字就不同；只注册一种会「页面空白且不报错」。
 *   - **`ctx.slots.inject` 是等 slot 被声明后才跑**，所以注册不会因为
 *     设置页还没挂载而丢失 —— 这一点和我们接 `sidebar.right.pane.tab`
 *     是同一个机制。
 *
 * ── 注册写法照抄宿主自己的 `dsh-context`（活的样板，别自创）──────────
 * `inject` 只声明 `slots`，其余服务用 `ctx.inject([...], scope => ...)`
 * 现取。为什么不能把它们写进 `inject` 数组：那样插件要等该服务存在才
 * 启动，而右栏可能整块没启用 —— 服务缺席时插件会一直不生效，且没有
 * 任何报错。`ctx.inject` 是「服务在就接上、不在就等」，注册随服务生命
 * 周期自动重跑。
 */
import type { Context } from '@deepseek-ai/cordis'
import { AvatarPanel } from './AvatarPanel'
import { GuideIcon } from './GuideIcon'
import { MainOverlayG2 } from './MainOverlayG2'
import { setSidebarNavigator } from './mainOverlayMode'
import { SettingsPage } from './Settings'
import { STYLE } from './style'

/**
 * tab 类型 id。
 *
 * 必须全局唯一；包名是宿主的自然取值。这个 id 同时也是正文与标题
 * 注册时用的 key —— 三处必须一致，否则正文找不到席位。
 */
const TAB_ID = 'dsh-agents-bot'

/** kind：`openTab('agentsBot')` 用它点名。同一 kind 只能有一份 builtin。 */
const TAB_KIND = 'agentsBot'

/** 引导页入口与 tab 标题的文案。 */
const TITLE = '活动 AI'
const DESC = '把每个 agent 正在做什么画成会呼吸的形象，并排看。'

/**
 * 设置页在 `plugins.bundle.config` 上的注册键。
 *
 * 两种写法都注册：宿主按**包名精确匹配**，而 profile 里可能写成裸包名，
 * 也可能被 Desktop 挂成 `include:<包名>`。只注册一种的话，另一种装法下
 * 设置页会静默不出现（workbuddy 的 issue #55 就是这个）。
 *
 * 同一 key 重复注册在宿主那边是「按 key 分格的」，不会互相覆盖。
 */
const SETTINGS_KEYS = ['dsh-agents-bot', 'include:dsh-agents-bot']

export const inject = ['slots']

/** 样式只注入一次，靠 data 标记去重。 */
function installStyle(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('style[data-plugin-css="dsh-agents-bot"]')) return
  const tag = document.createElement('style')
  tag.dataset.plugin = 'dsh-agents-bot'
  tag.dataset.pluginCss = 'dsh-agents-bot'
  tag.textContent = STYLE
  document.head.appendChild(tag)
}

export function apply(ctx: Context): void {
  installStyle()

  // G2 frame slot stays registered; only explicit placement activates its Bot canvas.
  const disposeOverlay = ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      { name: 'shell.overlay', id: 'dsh-agents-bot.main-overlay-g0' },
      MainOverlayG2 as never
    )
  )
  ctx.effect(() => () => {
    if (typeof disposeOverlay === 'function') disposeOverlay()
  }, 'agent-avatar: G2 explicit main overlay registration')

  // Public navigation service survives the sidebar body being hidden or destroyed.
  ctx.inject(['sidebarRight'], (scope: Context) => {
    const service = (scope as unknown as { sidebarRight?: { openTab: (kind: string, options?: { paneId?: string }) => void } }).sidebarRight
    if (!service) return
    setSidebarNavigator((kind, options) => service.openTab(kind, options))
    return () => setSidebarNavigator(undefined)
  })

  /**
   * 右栏注册。
   *
   * 里面每一步都单独 try/catch 收集 disposer：宿主在注册表/席位还没就绪时
   * 会抛错，这时要能把已经成功的部分收回去，而不是留下半截注册。
   */
  const disposeRight = ctx.inject(['sidebarRightTabs'], (scope: Context) => {
    const registered: (() => void)[] = []
    const track = (d: unknown): void => {
      if (typeof d === 'function') registered.push(d as () => void)
    }

    try {
      const tabs = (scope as unknown as {
        sidebarRightTabs?: {
          register?: (def: Record<string, unknown>) => () => void
        }
      }).sidebarRightTabs
      if (tabs === undefined || typeof tabs.register !== 'function') return

      // 1) 类型定义。没有 `patterns` —— 这是「页类型」而不是「资源类型」，
      //    它不对应 `dsh-resource://` 地址，只能按 kind 打开。
      track(
        tabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          title: () => TITLE,
          guide: [
            {
              order: 30,
              title: () => TITLE,
              description: () => DESC,
              /*
               * 入口卡片的图标。不给的话宿主用内置立方体占位符，
               * 跟「活动 AI」毫无关系。`GuideIcon` 是一个只收
               * `{ size, className }` 的 React 组件，契约见那个文件。
               */
              icon: GuideIcon
            }
          ]
        })
      )

      // 2) 正文。用 slots.inject：席位由别的包声明，声明没出现时直接
      //    register 会失败；inject 会在每次声明生命周期内重跑。
      //    面板要的三个数据 hook 都是该席位的标准注入属性，不用自己接。
      track(
        scope.slots.inject('sidebar.right.pane.tab', () =>
          scope.slots.register(
            { name: 'sidebar.right.pane.tab', key: TAB_ID },
            AvatarPanel as never
          )
        )
      )

      // 3) tab 标题。不给也能显示打开时捕获的 title()；显式注册是为了
      //    和正文共用同一个 key，并留一个将来加图标的位置。
      track(
        scope.slots.inject('sidebar.right.pane.tab.title', () =>
          scope.slots.register(
            { name: 'sidebar.right.pane.tab.title', key: TAB_ID },
            function AvatarTitle() {
              return <span>{TITLE}</span>
            } as never
          )
        )
      )
    } catch {
      // 半截注册必须收回，否则下次重跑会撞「同一 id 第二次注册抛错」
      for (const d of registered) d()
      return
    }

    return () => {
      for (const d of registered) d()
    }
  })

  /**
   * 设置页注册。
   *
   * 不用 `ctx.inject`：`slots` 已经在 `inject` 数组里声明过了，`apply`
   * 跑起来的时候它一定在。设置页和右栏是两件独立的事 —— 右栏没启用时
   * 设置页照样该出现（用户在设置里就能配动画，不需要先开右栏）。
   *
   * `plugins.bundle.config` 的条目渲染成 `({ view }) => ...`，
   * `view === 'page'` 是详情页里那块表单，`'summary'` 是一句话摘要。
   */
  const settingsRegistered: (() => void)[] = []
  try {
    for (const key of SETTINGS_KEYS) {
      const d = ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register(
          { name: 'plugins.bundle.config', key },
          function AgentAvatarSettings({ view }: { view?: string }) {
            // summary 是组合包卡片下面那一行字；我们只提供正式表单。
            if (view === 'summary') return null
            return <SettingsPage />
          } as never
        )
      )
      if (typeof d === 'function') settingsRegistered.push(d as () => void)
    }
  } catch {
    for (const d of settingsRegistered) d()
  }

  ctx.effect(() => () => {
    const d1 = disposeRight as unknown as { dispose?: () => void }
    if (typeof d1?.dispose === 'function') d1.dispose()
  }, 'agent-avatar: right sidebar registration')

  ctx.effect(() => () => {
    for (const d of settingsRegistered) d()
  }, 'agent-avatar: settings page registration')
}

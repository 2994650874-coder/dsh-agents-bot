/**
 * 无宿主冒烟测试：用假的 ModuleLoader / react / cordis ctx 执行 lib/client.js。
 *
 * 检查五件事：
 *   1. bundle 能被 ModuleLoader 正常工厂化，导出 apply/inject
 *   2. apply() 之后**右栏三处**都有注册：
 *      类型（sidebarRightTabs.register）、正文（sidebar.right.pane.tab）、
 *      标题（sidebar.right.pane.tab.title）
 *   3. **三处的 id/key 完全一致** —— 正文与标题是按类型 id 的 keyed slot，
 *      不一致就找不到席位（表现为 tab 出现了但正文空白）
 *   4. **只有 G2 显式切换组件注册**，没有旧 sidebar.panellist / main 注册
 *   5. `sidebarRightTabs` 没被写进 inject 数组 —— 写进去的话右栏缺席时
 *      插件会静默不启动
 *
 * 这个测试不碰 DSH 进程，可以随便跑：node plugin/test/smoke-client.cjs
 */
const fs = require('fs')
const path = require('path')
const vm = require('vm')

const BUNDLE = process.env.GROKBOT_TEST_CLIENT_LIB || path.join(__dirname, '..', 'lib', 'client.js')
const src = fs.readFileSync(BUNDLE, 'utf8')

/* ── 假 react ─────────────────────────────────────────────────────── */
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  Fragment: 'Fragment',
  useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef: (init) => ({ current: init }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useSyncExternalStore: (_sub, get) => get()
}
const jsxRuntimeStub = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
  Fragment: 'Fragment'
}

/* ── 假 ModuleLoader ──────────────────────────────────────────────── */
let registered = null
const sandbox = {
  window: {
    __ModuleLoader__: {
      load: (def) => {
        registered = def
      }
    }
  },
  document: {
    querySelector: () => null,
    createElement: () => ({ dataset: {}, style: {}, textContent: '', appendChild() {} }),
    head: { appendChild() {} }
  },
  localStorage: {
    getItem: () => null,
    setItem: () => {}
  },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  clearTimeout: () => {},
  console,
  ResizeObserver: class {
    observe() {}
    disconnect() {}
  }
}
sandbox.globalThis = sandbox
sandbox.self = sandbox

const ctxObj = vm.createContext(sandbox)
vm.runInContext(src, ctxObj, { filename: 'lib/client.js' })

const fails = []
const ok = (msg) => console.log('  ok   ' + msg)
const bad = (msg) => {
  console.log('  FAIL ' + msg)
  fails.push(msg)
}

if (!registered) {
  console.error('ModuleLoader.load 没有被调用 —— bundle 根本没执行')
  process.exit(1)
}

console.log('bundle id:', registered.id)
if (registered.id !== 'dsh-agents-bot') bad('bundle id 与包名不一致: ' + registered.id)
else ok('bundle id 等于包名')

const requireStub = (name) => {
  if (name === 'react') return reactStub
  if (name === 'react/jsx-runtime') return jsxRuntimeStub
  if (name === 'react-dom') return { createPortal: (children) => children }
  throw new Error('未预期的外部依赖: ' + name)
}

let mod
try {
  mod = registered.factory(requireStub)
  ok('factory 执行成功')
} catch (e) {
  console.error('factory 抛错:', e)
  process.exit(1)
}

if (typeof mod.apply !== 'function') bad('导出里没有 apply')
else ok('导出 apply')

if (!Array.isArray(mod.inject) || !mod.inject.includes('slots')) bad('inject 里没有 slots: ' + JSON.stringify(mod.inject))
else ok('inject 含 slots')

/**
 * `sidebarRightTabs` 不能写进 `inject` 数组。
 * 写进去的话，右栏没启用时插件会一直不启动，而且不报错 —— 静默失效最难查。
 * 正确写法是 `ctx.inject(['sidebarRightTabs'], …)`：服务在就接上、不在就等。
 */
if (Array.isArray(mod.inject) && mod.inject.includes('sidebarRightTabs')) {
  bad('sidebarRightTabs 被写进了 inject 数组 —— 右栏缺席时插件会静默不启动')
} else {
  ok('sidebarRightTabs 没有写进 inject（走 ctx.inject 现取）')
}

/* ── 假 cordis ctx：记录所有注册 ───────────────────────────────────── */
const slotRegistrations = []
const tabTypes = []
let navDisposer
let navigationRegistered = false
let navigationDisposed = false

const fakeSlots = {
  inject(key, cb) {
    return cb()
  },
  register(spec, component) {
    slotRegistrations.push({ spec, component })
    return () => {}
  }
}

const ctx = {
  effect(fn) {
    const dispose = fn()
    return () => {
      if (typeof dispose === 'function') dispose()
    }
  },
  /**
   * 模拟 `ctx.inject(['sidebarRightTabs'], scope => …)`。
   * 真实 cordis 的返回值是可 dispose 的对象；这里返回一个带 dispose 的对象，
   * 因为 apply 里会去读 `.dispose`。
   */
  inject(deps, cb) {
    if (deps.includes('sidebarRight')) {
      navigationRegistered = true
      const cleanup = cb({ sidebarRight: { openTab() {} }, slots: fakeSlots })
      navDisposer = () => { cleanup?.(); navigationDisposed = true }
      return { dispose: navDisposer }
    }
    function register(def) {
      tabTypes.push(def)
      return () => {}
    }
    const scope = { slots: fakeSlots, sidebarRightTabs: { register } }
    const out = cb(scope)
    return { dispose: typeof out === 'function' ? out : () => {} }
  },
  slots: fakeSlots
}

try {
  mod.apply(ctx)
  ok('apply 执行成功')
} catch (e) {
  console.error('apply 抛错:', e)
  process.exit(1)
}

if (navigationRegistered && typeof navDisposer === 'function') {
  navDisposer()
  if (navigationDisposed) ok('sidebarRight 公开导航按 ctx.inject 生命周期清理')
} else bad('sidebarRight 公开导航缺少注册/清理')

/* ── 1. 类型定义 ──────────────────────────────────────────────────── */
const type = tabTypes[0]
if (!type) bad('没有注册右栏 tab 类型（sidebarRightTabs.register 没被调用）')
else {
  ok(`注册了 tab 类型（id=${type.id}, kind=${type.kind}）`)
  if (typeof type.id !== 'string' || type.id === '') bad('类型 id 为空')
  if (typeof type.kind !== 'string' || type.kind === '') bad('kind 为空')
  if (typeof type.title !== 'function') bad('title 不是函数 —— 宿主会在打开 tab 时调用它')
  else {
    const t = type.title('')
    if (typeof t === 'string' && t.length > 0) ok(`title() 返回「${t}」`)
    else bad('title() 没返回非空字符串: ' + JSON.stringify(t))
  }
  if (!Array.isArray(type.guide) || type.guide.length === 0) {
    bad('没有 guide 入口 —— 用户没法从右栏引导页打开')
  } else {
    const g = type.guide[0]
    if (typeof g.order !== 'number') bad('guide 条目缺 order')
    else ok(`有 guide 入口（order=${g.order}）`)
    if (typeof g.title !== 'function' || typeof g.description !== 'function') {
      bad('guide 的 title/description 不是函数')
    }
    /*
     * 图标必须是组件（函数）。
     *
     * 不给的话宿主用内置 `CubeGlyph` 立方体占位符 —— 那是「还没配图标」
     * 的默认脸，跟本插件是干什么的毫无关系。这条断言锁住「我们给过图标」，
     * 免得以后重构注册项时静默退回到占位符。
     */
    if (typeof g.icon !== 'function') {
      bad('guide 条目没有 icon —— 宿主会退回内置立方体占位符')
    } else {
      ok('guide 有自定义 icon（不再用宿主的立方体占位符）')
    }
  }
}

/* ── 2. 正文与标题 ────────────────────────────────────────────────── */
const body = slotRegistrations.find((r) => r.spec.name === 'sidebar.right.pane.tab')
const title = slotRegistrations.find((r) => r.spec.name === 'sidebar.right.pane.tab.title')

if (!body) bad('没有注册正文（sidebar.right.pane.tab）')
else ok(`注册了正文（key=${body.spec.key}）`)
if (!title) bad('没有注册标题（sidebar.right.pane.tab.title）')
else ok(`注册了标题（key=${title.spec.key}）`)

/* ── 3. 三处 id/key 必须一致 ──────────────────────────────────────── */
if (type && body && title) {
  if (type.id === body.spec.key && type.id === title.spec.key) {
    ok('三处 id/key 完全一致 —— 正文和标题都能找到席位')
  } else {
    bad(
      `三处 id/key 不一致：类型 id=${type.id}，正文 key=${body.spec.key}，标题 key=${title.spec.key}` +
        ' —— 会表现为 tab 出现但正文空白'
    )
  }
}

/* ── 4. 组件形态 ──────────────────────────────────────────────────── */
if (body && typeof body.component !== 'function') bad('正文不是组件')
if (title && typeof title.component !== 'function') bad('标题不是组件')

/* ── 5. G2 工厂注册，且旧浮窗入口不能复活 ──────────────────── */
const overlays = slotRegistrations.filter((r) => r.spec.name === 'shell.overlay')
// G0 id 保持稳定，不让热重载时产生第二个全局注册；G2 只换组件。
if (overlays.length === 1 && overlays[0].spec.id === 'dsh-agents-bot.main-overlay-g0') {
  ok('只注册唯一、带包名前缀的 shell.overlay id')
} else {
  bad('shell.overlay 注册数量或 id 错误: ' + JSON.stringify(overlays.map((r) => r.spec.id)))
}
// 这里只检查注册工厂/组件的静态形态；React Hook 组件绝不能像普通函数一样直接调用。
if (overlays.length === 1 && typeof overlays[0].component === 'function' && overlays[0].component.name === 'MainOverlayG2') {
  ok('G2 注册了 MainOverlayG2 React 组件（不调用 Hook 组件）')
} else {
  bad('shell.overlay 未注册预期的 MainOverlayG2 组件')
}
const legacy = slotRegistrations.filter((r) => ['sidebar.panellist', 'main'].includes(r.spec.name))
if (legacy.length === 0) ok('没有复活旧 sidebar.panellist / main 入口')
else bad('旧浮窗入口被意外复活: ' + legacy.map((r) => r.spec.name).join(', '))

// 注册冲突必须显式失败，不能假装 G2 已成功。
const failingCtx = {
  ...ctx,
  slots: {
    ...fakeSlots,
    register(spec, component) {
      if (spec.name === 'shell.overlay') throw new Error('overlay id conflict')
      return fakeSlots.register(spec, component)
    }
  }
}
try {
  mod.apply(failingCtx)
  bad('overlay 注册冲突被静默吞掉')
} catch (e) {
  if (e.message === 'overlay id conflict') ok('overlay 注册冲突显式失败')
  else bad('overlay 冲突错误被替换: ' + e.message)
}

/* ── 6. 设置页 ────────────────────────────────────────────────────────
   `plugins.bundle.config` 是 keyed slot，键 = **包名精确匹配**。
   profile 里可能写裸包名，也可能被 Desktop 挂成 `include:<包名>`，
   所以两种都要注册 —— 只注册一种的话，另一种装法下设置页会静默
   不出现（workbuddy 的 issue #55 就是这个形态）。 */
const settings = slotRegistrations.filter((r) => r.spec.name === 'plugins.bundle.config')
const settingsKeys = settings.map((r) => r.spec.key)

if (settingsKeys.includes('dsh-agents-bot')) {
  ok('注册了设置页（key=dsh-agents-bot）')
} else {
  bad('没有注册设置页（plugins.bundle.config key=dsh-agents-bot）')
}

if (settingsKeys.includes('include:dsh-agents-bot')) {
  ok('注册了 include: 前缀的写法（换装法也能显示）')
} else {
  bad('没有注册 include:dsh-agents-bot —— Desktop 那种装法下设置页会静默不出现')
}

if (settings.length && settings.every((r) => typeof r.component === 'function')) {
  ok('设置页组件是函数')
} else if (settings.length) {
  bad('设置页组件不是函数')
}

// summary 视图必须返回 null（那一行字是组合包卡片用的，我们没有内容可说）
const summaryProbe = settings[0]?.component
if (typeof summaryProbe === 'function') {
  let out
  try {
    out = summaryProbe({ view: 'summary' })
  } catch (e) {
    bad('设置页在 summary 视图下抛错: ' + e.message)
  }
  if (out === null || out === undefined) ok('summary 视图返回空（不污染组合包卡片）')
  else bad('summary 视图应该返回 null，实际是 ' + typeof out)
}

try {
  mod.apply({ ...ctx, inject: (deps, cb) => deps.includes('sidebarRight')
    ? (cb({ slots: fakeSlots }), { dispose() {} })
    : ctx.inject(deps, cb) })
  ok('缺失 sidebarRight 服务时仍正常注册 overlay 和右栏')
} catch (e) { bad('缺失 sidebarRight 服务时崩溃: ' + e.message) }

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  process.exit(1)
}
console.log('全部通过')

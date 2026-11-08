/**
 * 加载**发布产物** `plugin/lib/client.js`，在真浏览器里执行并调用 `apply`，
 * 看它会不会炸。
 *
 * ── 为什么必须做这一步 ────────────────────────────────────────────────
 * `verify-settings.mjs` 等探针加载的是 `preview/settings.js`
 * （由 `tools/settings.tsx` 单独打包），**不是 DSH 真正加载的那个文件**。
 * 「预览页全绿」证明不了「插件装进 DSH 不炸」—— 它们是两个不同的包。
 *
 * ── 两个必须补的环境 ───────────────────────────────────────────────────
 * ① 产物是 DSH 的 ModuleLoader 形态 `window.__ModuleLoader__.load({id, factory})`，
 *    直接 eval 会报 `Cannot read properties of undefined (reading 'load')`。
 * ② `factory(require)` 要 `require("react")` 等，由宿主模块表提供，探针自己兜。
 *
 * 判据（三条都要过）：
 *   1. ModuleLoader 收到 id = dsh-agents-bot
 *   2. apply 不抛异常
 *   3. 三个 slot 都注册出来了
 */
import { chromium } from 'playwright-core'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BUNDLE = readFileSync(resolve(ROOT, 'plugin/lib/client.js'), 'utf8')
const REACT = readFileSync(resolve(ROOT, 'node_modules/react/umd/react.production.min.js'), 'utf8')
const REACT_DOM = readFileSync(
  resolve(ROOT, 'node_modules/react-dom/umd/react-dom.production.min.js'),
  'utf8'
)

let pass = 0
let fail = 0
const ok = (m) => {
  console.log('  ok   ' + m)
  pass++
}
const bad = (m) => {
  console.log('  FAIL ' + m)
  fail++
}

const browser = await chromium.launch({
  executablePath: 'D:/百分/CentBrowser/Application/chrome.exe',
  headless: true
})
const page = await browser.newPage()

const pageErrors = []
page.on('pageerror', (e) => pageErrors.push('pageerror: ' + e.message))
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push('console.error: ' + m.text())
})

await page.setContent('<!doctype html><html><body><div id="root"></div></body></html>')
await page.addScriptTag({ content: REACT })
await page.addScriptTag({ content: REACT_DOM })

const result = await page.evaluate(({ src }) => {
  const log = []
  const registered = []
  const loadedIds = []
  /** ModuleLoader 交回来的插件导出（apply / inject / name / 投影函数）。 */
  let pluginExports = null

  const jsxRuntime = {
    jsx: (t, p, k) => window.React.createElement(t, p, k),
    jsxs: (t, p, k) => window.React.createElement(t, p, k),
    Fragment: window.React.Fragment
  }
  const moduleTable = {
    react: window.React,
    'react/jsx-runtime': jsxRuntime,
    'react/jsx-dev-runtime': jsxRuntime,
    'react-dom': window.ReactDOM,
    'react-dom/client': window.ReactDOM
  }

  /* ── 造宿主 ModuleLoader ── */
  window.__ModuleLoader__ = {
    load(def) {
      loadedIds.push(def.id)
      try {
        pluginExports = def.factory((name) => {
          if (!(name in moduleTable)) log.push('require 未提供: ' + name)
          return moduleTable[name]
        })
      } catch (e) {
        log.push('factory 抛异常: ' + e.message)
      }
    }
  }

  const out = { registered, log, loadedIds, error: null, exportKeys: null, applied: false }

  try {
    new Function(src)()
    if (pluginExports && typeof pluginExports === 'object') {
      out.exportKeys = Object.keys(pluginExports)
    }

    /* ── 假 ctx：只提供插件真用到的那几样 ──
     *
     * ⚠️ `ctx.inject` 的真实签名是 **`inject(deps: string[], cb: (scope) => void)`**
     * —— 注意第一个参数是**数组**，回调收到一个 scope 对象，
     * 通过 `scope.sidebarRightTabs` 这种属性名去拿服务。
     *
     * 我第一版写成了 `inject(name, fn)`（字符串），结果报
     * 「ctx.inject is not a function」—— 那是**探针写错了**，不是插件坏了。
     * 这个区别很重要：报错信息长得像产品缺陷，实际是尺子不对。
     */
    /*
     * `sidebarRightTabs` 服务本身只有 `register`，但**回调拿到的 scope 里还有一个
     * `slots`** —— 页签正文和标题是通过 `scope.slots.inject(...)` /
     * `scope.slots.register(...)` 注册的，不是通过 tabs.register。
     *
     * 少了这一层，正文和标题两处都注册不出来，现象是「只注册了设置页」——
     * 又是探针缺件，不是插件缺件。
     */
    const slotsApi = {
      inject: (name, fn) => {
        try {
          return fn()
        } catch (e) {
          log.push('slots.inject(' + name + ') 抛异常: ' + e.message)
        }
      },
      register: (opts, comp) => {
        registered.push({ name: opts?.name, key: opts?.key, kind: typeof comp })
        return () => {}
      }
    }

    const services = {
      sidebarRightTabs: {
        register: (opts) => {
          registered.push({
            name: 'tabs.register',
            key: opts?.id,
            kind: typeof opts?.title
          })
          return () => {}
        }
      }
    }
    /*
     * ⚠️ 这里**不能**把 `pluginExports` 整个 Object.assign 进 ctx。
     *
     * 插件的导出里有三个键：`apply` / `inject` / 投影函数。其中
     * `inject: ["slots"]` 是**依赖声明**，不是函数。整个 assign 进去会把
     * 我刚写好的 `ctx.inject` 函数覆盖成一个数组 —— 于是报
     * 「ctx.inject is not a function」，看起来像插件炸了，其实是探针自己
     * 把 ctx 弄坏了。
     *
     * 宿主真实的行为是：只把 `apply` 和投影函数挂到 ctx 上，`inject` 用来
     * 声明依赖。所以这里显式只取 apply。
     */
    const ctx = Object.assign(
      {
        logger: () => ({
          debug: () => {},
          info: () => {},
          warn: (...a) => log.push('warn ' + a.join(' ')),
          error: (...a) => log.push('error ' + a.join(' '))
        }),
        effect: (fn) => {
          try {
            return fn()
          } catch (e) {
            log.push('effect 抛异常: ' + e.message)
          }
        },
        inject: (deps, cb) => {
          const scope = { slots: slotsApi }
          for (const d of deps) scope[d] = services[d]
          try {
            return cb(scope)
          } catch (e) {
            log.push('inject([' + deps.join(',') + ']) 回调抛异常: ' + e.message)
          }
        },
        slots: slotsApi
      },
      /* 只挂 apply，**不要**挂 pluginExports.inject（那是数组） */
      pluginExports && typeof pluginExports.apply === 'function'
        ? { apply: pluginExports.apply }
        : {}
    )

    if (typeof ctx.apply !== 'function') {
      out.error = 'apply 不是函数；导出键 = ' + JSON.stringify(out.exportKeys)
      return out
    }
    ctx.apply(ctx)
    out.applied = true
  } catch (e) {
    out.error = e.message
  }
  return out
}, { src: BUNDLE })

console.log('=== 发布产物 plugin/lib/client.js ===\n')
console.log('ModuleLoader 收到的 id:', JSON.stringify(result.loadedIds))
console.log('导出键:', JSON.stringify(result.exportKeys))
if (result.log.length) {
  console.log('执行日志:')
  for (const l of result.log) console.log('   ', l)
}
console.log('')

result.loadedIds.includes('dsh-agents-bot')
  ? ok('ModuleLoader 收到 id = dsh-agents-bot')
  : bad('ModuleLoader 没收到正确 id：' + JSON.stringify(result.loadedIds))

result.error === null ? ok('apply 执行没有抛异常') : bad('apply 抛异常：' + result.error)

const NAMES = [
  ['sidebar.right.pane.tab', '右栏页签正文'],
  ['sidebar.right.pane.tab.title', '右栏页签标题'],
  ['plugins.bundle.config', '设置页']
]
for (const [name, label] of NAMES) {
  const got = result.registered.filter((r) => r.name === name)
  if (got.length > 0) ok(`注册了 ${label}（${name}，${got.length} 个）`)
  else bad(`没注册 ${label}（${name}）`)
}

/* 设置页必须同时注册普通键和 include: 键，否则换装法下它不显示。 */
const cfgKeys = result.registered
  .filter((r) => r.name === 'plugins.bundle.config')
  .map((r) => r.key)
if (cfgKeys.length === 2) ok('设置页注册了两种 key：' + cfgKeys.join(' / '))
else bad('设置页 key 数量不对：' + JSON.stringify(cfgKeys))

if (pageErrors.length === 0) ok('页面级零报错')
else {
  bad('页面有报错：')
  for (const e of pageErrors) console.log('        ' + e)
}

await browser.close()
console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
process.exitCode = fail === 0 ? 0 : 1

/**
 * 两条已停用的路线 —— 这个脚本验证「确实停用干净了」。
 *
 * 1. 独立窗口（Document PiP）：以前验证能不能开出来，现在路线终止、
 *    代码封存到 archive/，验证目标反过来 —— 确认运行时和构建产物里
 *    没有 PiP 痕迹，避免哪天有人恢复了一半、留下一堆点了没反应的按钮。
 * 2. 浮窗（shell.overlay 上的可拖动窗口）：现在面板是右栏的一个 tab。
 *    浮窗代码完整封存在 archive/float-window/，验证目标是确认它**没有**
 *    半复活 —— 比如还留着左侧栏图标、还挂着 shell.overlay、
 *    还有拖动条和拉伸边。那种半截状态最坑：看起来能用，实际点了没反应。
 *
 * 复活流程分别见 grokbot/archive/README.md 与 grokbot/archive/float-window/README.md。
 *
 * 用法（在 grokbot 目录下）：node tools/verify-pip.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

console.log('独立窗口（PiP）：验证已彻底移除\n')

/* 1. 源码里不能还有 pip.tsx */
if (!existsSync(resolve(ROOT, 'plugin/src/client/pip.tsx'))) ok('源码里没有 pip.tsx')
else bad('plugin/src/client/pip.tsx 还在')

/* 2. 封存件必须在 —— 否则等于删掉而不是封存 */
if (existsSync(resolve(ROOT, 'archive/pip.tsx.frozen'))) ok('封存件 archive/pip.tsx.frozen 在位')
else bad('封存件不见了（被删掉而不是封存）')

/* 3. 构建产物里不能出现 PiP 相关标识 */
const bundle = readFileSync(resolve(ROOT, 'plugin/lib/client.js'), 'utf8')
const leaks = ['documentPictureInPicture', 'davf-pip-shell', 'davf-pip-note', 'PipPortal', 'requestWindow'].filter(
  (k) => bundle.includes(k)
)
if (leaks.length === 0) ok('构建产物里没有任何 PiP 标识')
else bad('构建产物里残留 PiP 代码：' + leaks.join(', '))

console.log('\n浮窗形态：验证已停用干净\n')

/* 4. 源码里不能还有 FloatWindow.tsx */
if (!existsSync(resolve(ROOT, 'plugin/src/client/FloatWindow.tsx'))) ok('源码里没有 FloatWindow.tsx')
else bad('plugin/src/client/FloatWindow.tsx 还在')

/* 5. 封存件必须齐全（八件） */
const FROZEN = [
  'archive/float-window/FloatWindow.tsx.frozen',
  'archive/float-window/float-preview.tsx.frozen',
  'archive/float-window/build-float.mjs.frozen',
  'archive/float-window/float.html.frozen',
  'archive/float-window/float-shell.css.frozen',
  'archive/float-window/verify-interact.mjs.frozen',
  'archive/float-window/verify-top-clamp.mjs.frozen',
  'archive/float-window/shoot-top-clamp.mjs.frozen'
]
const missing = FROZEN.filter((p) => !existsSync(resolve(ROOT, p)))
if (missing.length === 0) ok(`封存件齐全（${FROZEN.length} 件）`)
else bad('封存件缺失：' + missing.join(', '))

/* 6. 浮窗文档必须在 —— 用户明确要求「留出来放到另外新建的文档下」 */
if (existsSync(resolve(ROOT, 'archive/float-window/README.md'))) ok('封存文档 archive/float-window/README.md 在位')
else bad('封存文档不见了 —— 光有代码没说明等于没留')

/* 7. 构建产物里不能出现浮窗专属标识 */
const floatLeaks = ['shell.overlay', 'sidebar.panellist', 'davf-edge', 'data-dragging'].filter((k) =>
  bundle.includes(k)
)
if (floatLeaks.length === 0) ok('构建产物里没有浮窗专属标识')
else bad('构建产物里残留浮窗代码：' + floatLeaks.join(', '))

/* 8. 构建产物里必须有右栏注册 —— 否则「搬过去」这件事没真发生 */
const rightSignals = ['sidebarRightTabs', 'sidebar.right.pane.tab'].filter((k) => bundle.includes(k))
if (rightSignals.length === 2) ok('构建产物里有右栏注册（sidebarRightTabs + pane.tab）')
else bad('构建产物里缺少右栏注册：只找到 ' + JSON.stringify(rightSignals))

/* 9. 运行时界面：不该有拖动条、拉伸边、关闭按钮 */
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(target).href)
await tab.waitForTimeout(800)

const ui = await tab.evaluate(() => ({
  pipBtn: document.querySelectorAll('.davf-pip-btn').length,
  pipShell: document.querySelectorAll('.davf-pip-shell').length,
  pipNote: document.querySelectorAll('.davf-pip-note').length,
  edges: document.querySelectorAll('.davf-edge').length,
  iconBtns: document.querySelectorAll('.davf-iconbtn').length,
  panel: document.querySelectorAll('.davf-panel').length,
  cells: document.querySelectorAll('.davf-cell').length,
  // 面板根节点必须是「撑满容器」，不是「绝对定位的浮窗」
  position: (() => {
    const el = document.querySelector('.davf-panel')
    return el ? getComputedStyle(el).position : null
  })()
}))
if (ui.pipBtn === 0) ok('界面里没有 ⧉ 按钮')
else bad(`界面里还有 ${ui.pipBtn} 个 ⧉ 按钮`)
if (ui.pipShell === 0 && ui.pipNote === 0) ok('界面里没有 PiP 外壳 / 提示条')
else bad(`界面残留 PiP 元素：shell=${ui.pipShell} note=${ui.pipNote}`)
if (ui.edges === 0) ok('界面里没有拉伸边')
else bad(`界面里还有 ${ui.edges} 条拉伸边`)
if (ui.iconBtns === 0) ok('界面里没有关闭按钮（右栏 tab 由宿主管关闭）')
else bad(`界面里还有 ${ui.iconBtns} 个标题栏按钮`)
if (ui.panel === 1 && ui.cells >= 1) ok(`面板本身正常渲染（${ui.cells} 格）`)
else bad(`面板没渲染：panel=${ui.panel} cells=${ui.cells}`)
if (ui.position === 'static' || ui.position === 'relative') ok(`面板根节点不是绝对定位（position=${ui.position}）`)
else bad(`面板根节点仍是定位元素：position=${ui.position} —— 浮窗残留`)

/* 10. 标题栏必须仍有胶囊（确认搬迁没误伤交互） */
const caps = await tab.locator('.davf-cap').count()
if (caps >= 2) ok(`标题栏胶囊还在（${caps} 个）`)
else bad(`标题栏胶囊丢了：${caps}`)

await browser.close()

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  process.exit(1)
}
console.log('全部通过（PiP 与浮窗均已停用干净，封存件与文档在位）')

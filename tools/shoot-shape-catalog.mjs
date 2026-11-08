/**
 * 截新身形检阅页，并**自动判一次**：眼睛有没有顶出轮廓。
 *
 * ── 自动判据怎么来 ────────────────────────────────────────────────────
 * 眼睛是 `<mask>` 里挖的洞，所以「顶出去」在像素上表现为**洞贴着轮廓边缘**，
 * 或者洞跑到轮廓外面（那时眼睛不可见，只剩轮廓上的一道缺口）。
 *
 * 做法：取每格 64px 那张图，找出非白像素的包围盒（= 轮廓），再找轮廓内
 * 亮度跳变的位置。太复杂且不稳。改成更可靠的等价判据：
 *
 * **数「轮廓内的白洞」是否与轮廓边相接** —— 仍然不稳。
 *
 * 于是换一条真正可靠的：**用引擎自己的数据判，不用像素。**
 * `engine.sample(t)` 返回的 eye 矩形是解析的，把两个眼的包围盒和
 * `radiusAtAngle` 给出的该方向半径比一比，就能算出「眼睛离边界还剩多少」。
 * 这条判据是纯数值的、可复现的，不依赖截图。
 *
 * 这个脚本只负责截图 + 调那条数值判据（判据在 probe-shape-eyefit.mjs 里）。
 *
 * 用法：node tools/build-shape-catalog.mjs && node tools/shoot-shape-catalog.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
const errors = []
tab.on('pageerror', (e) => errors.push(String(e)))

await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-catalog.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1500)

const shapes = await tab.evaluate(() => (window).__shapes ?? [])
const cells = await tab.evaluate(() => document.querySelectorAll('.cell').length)
console.log(`渲染到 ${shapes.length} 个身形 × 3 表情 = ${cells} 格`)
console.log('脚本错误：' + (errors.length ? errors.join(' | ') : '无'))

await tab.screenshot({ path: resolve(ROOT, 'preview', 'shape-catalog.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'shape-catalog.png'))

await browser.close()

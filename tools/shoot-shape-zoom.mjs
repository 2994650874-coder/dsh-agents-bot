/**
 * 放大看几个可疑的身形 —— 全图看不清眼睛到底有没有顶出去。
 *
 * 挑这三个：
 *   · `coin`（参考仓库叫 wedge，三角形）—— 上尖下宽，眼睛余量最紧
 *   · `dome`（半圆）—— 参考仓库给了 y+4 的面上偏移，我们的引擎没有这个概念
 *   · `comprime`（tablet，横长）—— 宽高比 2:1，眼睛容易横着顶出去
 *
 * 每格给 3 个表情 × 2 个尺寸，并且**在图上标出轮廓半径**：
 * 用引擎的 `radiusAtAngle` 画一圈虚线，眼睛越线就是顶出去了。
 *
 * 用法：node tools/build-shape-zoom.mjs && node tools/shoot-shape-zoom.mjs
 */
import { chromium } from 'playwright-core'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = resolve(ROOT, 'preview', 'shape-zoom.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 3 })
const tab = await ctx.newPage()
await tab.goto('file:///' + PAGE.replace(/\\/g, '/'))
await tab.waitForTimeout(1200)
await tab.screenshot({ path: resolve(ROOT, 'preview', 'shape-zoom.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'shape-zoom.png'))
await browser.close()

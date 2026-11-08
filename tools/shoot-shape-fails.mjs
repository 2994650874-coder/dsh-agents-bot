/**
 * 把报错的那几格放大画出来 —— 判据说有眼睛被咬掉，必须亲眼确认。
 *
 * ── 为什么不能直接信判据 ──────────────────────────────────────────────
 * 相对判据（和圆比洞数）已经排除了装饰，但仍有别的可能误判：
 *   · 眼睛被咬穿 → 真问题
 *   · 眼睛小到抗锯齿吃掉了 → 假问题（放大后能看清）
 *   · 两个洞连成一个 → 真问题（眼睛和外面通了）
 *
 * 所以必须看图。判据负责「找出可疑的」，眼睛负责「确认是不是真的」。
 *
 * 用法：node tools/build-shape-fails.mjs && node tools/shoot-shape-fails.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1240, height: 900 }, deviceScaleFactor: 4 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-fails.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1200)
await tab.screenshot({ path: resolve(ROOT, 'preview', 'shape-fails.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'shape-fails.png'))
await browser.close()

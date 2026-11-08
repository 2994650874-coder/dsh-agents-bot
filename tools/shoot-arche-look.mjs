/**
 * arche 在真实格子尺寸（96px）下到底有多难看？和已有的水滴比。
 *
 * ── 为什么要看这一张 ──────────────────────────────────────────────────
 * 判据（数白洞）在 44px 上判 arche 和 goutte 都「糊了」。但判据只回答
 * 「有没有连通」，不回答「看起来有多糟」。用户真正看到的是格子里 96px
 * 的 bot，所以要在这个尺寸上看一眼再决定要不要修。
 *
 * 三档尺寸 × 三种身形 × 最挑的那个表情（surpris）：
 *   30px（外观面板缩略图）· 96px（格子里的主图）· 200px（放大看细节）
 *
 * 用法：node tools/build-arche-look.mjs && node tools/shoot-arche-look.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 3 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'arche-look.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1200)
await tab.screenshot({ path: resolve(ROOT, 'preview', 'arche-look.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'arche-look.png'))
await browser.close()

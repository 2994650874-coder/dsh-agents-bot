/**
 * 用百分浏览器（Chromium 134）给预览页截图。
 *
 * 为什么不用 Playwright 自带 Chromium：本机没下，且用户日常浏览器就在手边。
 * 走 playwright-core + executablePath，不依赖浏览器下载。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/shoot.mjs float            → preview/float.png
 *   node tools/shoot.mjs float 2x2        → 先点 2×2 再截
 *   node tools/shoot.mjs board            → preview/board.png
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

if (!existsSync(CHROME)) {
  console.error('找不到百分浏览器:', CHROME)
  process.exit(1)
}

const page = process.argv[2] || 'float'
const action = process.argv[3] || ''

const target = resolve(ROOT, 'preview', page + '.html')
if (!existsSync(target)) {
  console.error('没有这个预览页:', target)
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 })
const tab = await ctx.newPage()
await tab.goto(pathToFileURL(target).href)
await tab.waitForTimeout(900)

if (action) {
  // 按胶囊上的文字点，不依赖类名顺序
  const btn = tab.locator(`.davf-cap`, { hasText: new RegExp('^' + action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }).first()
  if ((await btn.count()) > 0) {
    await btn.click()
    await tab.waitForTimeout(1100)
  } else {
    console.warn('没找到胶囊:', action)
  }
}

const out = resolve(ROOT, 'preview', page + (action ? '-' + action.replace(/[^\w]/g, '') : '') + '.png')
await tab.locator('.davf').screenshot({ path: out })
report(out, 'grokbot-' + out.split(/[\\/]/).pop())

await browser.close()

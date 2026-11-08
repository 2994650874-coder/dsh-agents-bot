/**
 * 给「两个六边形」对照页截图。
 * 用法：node tools/shoot-hex-compare.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const page = resolve(ROOT, 'preview', 'hex-compare.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 960, height: 900 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
await tab.goto(pathToFileURL(page).href)
await tab.waitForTimeout(900)

const out = resolve(ROOT, 'preview', 'hex-compare.png')
await tab.locator('.cmp').screenshot({ path: out })
report(out, 'grokbot-hex-compare.png')

await ctx.close()
await browser.close()

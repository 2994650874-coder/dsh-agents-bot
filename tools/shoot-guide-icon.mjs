import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'guide-icon.html')).href
const b = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await b.newContext({ viewport: { width: 760, height: 620 }, deviceScaleFactor: 3 })
const t = await ctx.newPage()
await t.goto(PAGE)
await t.waitForTimeout(900)
await t.screenshot({ path: resolve(ROOT, 'preview', 'guide-icon.png'), fullPage: true })
console.log('shot preview/guide-icon.png')
await b.close()

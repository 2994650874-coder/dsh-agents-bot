/**
 * 设置页截图：确认试片那一排少了「六边形」。
 * 用法（在 grokbot 目录下）：node tools/shoot-settings.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'settings.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => { try { localStorage.clear() } catch {} })
await tab.goto(PAGE)
await tab.waitForTimeout(900)

const chips = await tab.evaluate(() =>
  Array.from(document.querySelectorAll('.davs-preview-chips .davs-chip')).map((b) => b.textContent.trim())
)
console.log('试片按钮：' + chips.join(' / '))
console.log('共 ' + chips.length + ' 项，含六边形：' + (chips.includes('六边形') ? '是 ✗' : '否 ✓'))

await tab.screenshot({ path: resolve(ROOT, 'preview', 'settings-preview.png'), fullPage: true })
console.log('已截图 preview/settings-preview.png')
await browser.close()

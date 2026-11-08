/**
 * 把 turn94.html 拍成 PNG，好贴进回复里。
 *
 * 只拍一次整页，不做逐行拼接 —— 用户要的是「一眼看到五条」，
 * 分五张图反而要多点五次。
 *
 * 用法：node tools/shoot-board.mjs
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
await page.goto(pathToFileURL(resolve(ROOT, 'preview/turn94.html')).href)
await page.waitForFunction('window.__ready === true', null, { timeout: 20000 })
await page.waitForTimeout(400)

// 数每一行真的画出了几格 —— 空行会是 0，那是渲染挂了，不是「动画就是这样」
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('.row')].map((r) => ({
    title: r.querySelector('.hd').childNodes[0].textContent.trim(),
    cells: r.querySelectorAll('.fr').length,
    hasPaths: r.querySelectorAll('svg path, svg circle').length
  }))
)
for (const r of rows) console.log(`${r.title}: ${r.cells} 格, ${r.hasPaths} 个图元`)

const body = await page.locator('body').boundingBox()
await page.screenshot({
  path: resolve(ROOT, '_work/turn94-board.png'),
  fullPage: true
})
console.log(`shot _work/turn94-board.png  ${Math.round(body.width)}x${Math.round(body.height)}`)

await browser.close()

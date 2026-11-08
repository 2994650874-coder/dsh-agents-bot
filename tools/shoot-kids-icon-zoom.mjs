/**
 * 把子代理图标放大 8 倍截图，用来和用户给的参考图逐一对照。
 * 用法：node tools/shoot-kids-icon-zoom.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const page = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 8 })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(page).href + '?w=562&h=760')
await tab.waitForTimeout(800)

const box = await tab.locator('.davf-kids').boundingBox()
if (box) {
  await tab.screenshot({
    path: resolve(ROOT, 'preview', 'kids-icon-zoom.png'),
    clip: { x: box.x - 2, y: box.y - 2, width: box.width + 4, height: box.height + 4 }
  })
  console.log('kids-icon-zoom.png')
}

// 同时把整行（名字/状态/子代理）截下来看纵向节奏
const meta = await tab.locator('.davf-cell-meta').boundingBox()
if (meta) {
  await tab.screenshot({
    path: resolve(ROOT, 'preview', 'kids-meta-zoom.png'),
    clip: { x: meta.x - 4, y: meta.y - 4, width: meta.width + 8, height: meta.height + 8 }
  })
  console.log('kids-meta-zoom.png')
}

await ctx.close()
await browser.close()

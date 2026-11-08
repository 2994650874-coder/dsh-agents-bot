/**
 * 给子代理小框在几个真实右栏宽度下拍对照图。
 *
 * 用法（在 grokbot 目录下）：node tools/shoot-kids-size.mjs
 * 产物：preview/kids-w116.png / kids-w360.png / kids-w562.png
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

for (const w of [116, 360, 562]) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(pathToFileURL(target).href + `?w=${w}&h=760`)
  await tab.waitForTimeout(800)
  // 只截格子，不截整个右栏 —— 细节要看得清
  const cell = tab.locator('.davf-cell').first()
  await cell.screenshot({ path: resolve(ROOT, 'preview', `kids-w${w}.png`) })
  // 再给左下角来一张近景
  const b = await cell.locator('.davf-kids').boundingBox()
  const cb = await cell.boundingBox()
  if (b && cb) {
    const pad = 14
    await tab.screenshot({
      path: resolve(ROOT, 'preview', `kids-w${w}-zoom.png`),
      clip: {
        x: Math.max(0, b.x - pad),
        y: Math.max(0, b.y - pad),
        width: Math.min(1400, b.width + pad * 2),
        height: Math.min(900, b.height + pad * 2)
      }
    })
  }
  console.log(`kids-w${w}.png + zoom`)
  await ctx.close()
}

await browser.close()

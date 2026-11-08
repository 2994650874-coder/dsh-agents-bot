/**
 * 9 格密排下的子代理小框截图 —— 验证「变大之后不压文字」。
 *
 * 用法（在 grokbot 目录下）：node tools/shoot-kids-dense.mjs
 * 产物：preview/kids-dense-9.png
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(target).href + '?w=562&h=760')
await tab.waitForTimeout(800)

// 勾满 9 格
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
for (const h of await tab.locator('.davf-ws-head').all()) {
  if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
    await h.click()
    await tab.waitForTimeout(120)
  }
}
const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
const n = await rows.count()
for (let i = 0; i < n && (await tab.locator('.davf-cell').count()) < 9; i++) {
  const row = rows.nth(i)
  if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
  await row.click()
  await tab.waitForTimeout(120)
}
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(700)

const cells = await tab.locator('.davf-cell').count()
const badges = await tab.locator('.davf-kids').count()
console.log(`格数 ${cells}，小框 ${badges}`)

await tab.screenshot({ path: resolve(ROOT, 'preview', 'kids-dense-9.png') })

// 近景：第一格
const first = tab.locator('.davf-cell').first()
await first.screenshot({ path: resolve(ROOT, 'preview', 'kids-dense-cell.png') })
console.log('kids-dense-9.png + kids-dense-cell.png')

await ctx.close()
await browser.close()

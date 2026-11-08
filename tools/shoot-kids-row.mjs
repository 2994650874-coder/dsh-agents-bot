/**
 * 子代理计数行截图。
 * 用法：node tools/shoot-kids-row.mjs
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
  const cell = tab.locator('.davf-cell').first()
  await cell.screenshot({ path: resolve(ROOT, 'preview', `kidsrow-w${w}.png`) })
  console.log(`kidsrow-w${w}.png`)
  await ctx.close()
}

// 9 格密排
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(target).href + '?w=562&h=760')
await tab.waitForTimeout(800)
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
for (const h of await tab.locator('.davf-ws-head').all()) {
  if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
    await h.click()
    await tab.waitForTimeout(120)
  }
}
const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
const c = await rows.count()
for (let i = 0; i < c && (await tab.locator('.davf-cell').count()) < 9; i++) {
  const row = rows.nth(i)
  if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
  await row.click()
  await tab.waitForTimeout(120)
}
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(700)
await tab.screenshot({ path: resolve(ROOT, 'preview', 'kidsrow-dense9.png') })
console.log('kidsrow-dense9.png')
await ctx.close()
await browser.close()

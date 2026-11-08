/**
 * 顺位预设截图：加 9 格，看每格身形/表情是不是真的分开了。
 *
 * **必须带 `?plain=1`**：身形和表情只在 idle 生效（引擎的 baseBody/baseFace
 * 约束），而默认假数据里大多数格子在跑工具、画的是那个活动的动画轮廓 ——
 * 不带这个开关截出来的图「每格长得都不一样」，但那是活动不同，不是顺位生效。
 *
 * 用法（在 grokbot 目录下）：node tools/shoot-preset.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(PAGE + '?w=360&h=760&plain=1')
await tab.waitForTimeout(700)

/** 勾到 n 格。 */
async function fillTo(n) {
  const now = await tab.locator('.davf-cell').count()
  let need = n - now
  if (need <= 0) return
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(350)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(150)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const c = await rows.count()
  for (let i = 0; i < c && need > 0; i++) {
    const row = rows.nth(i)
    if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
    await row.click()
    await tab.waitForTimeout(120)
    need--
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(600)
}

const right = tab.locator('.fake-right')

/* 1. 9 格（3×3）—— 顺位排满，看循环 */
await fillTo(9)
await tab.waitForTimeout(900)
await right.screenshot({ path: resolve(ROOT, 'preview', 'preset-9cells.png') })
report(resolve(ROOT, 'preview', 'preset-9cells.png'))

/* 2. 4 格 + 外观面板 —— 看选项顺序和顺位高亮 */
await tab.locator('.davf-cap', { hasText: /^清空/ }).click()
await tab.waitForTimeout(600)
await fillTo(4)
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(700)
await tab.locator('.davf-cell-tag').nth(2).click()
await tab.waitForTimeout(400)
await right.screenshot({ path: resolve(ROOT, 'preview', 'preset-panel.png') })
report(resolve(ROOT, 'preview', 'preset-panel.png'))

await browser.close()

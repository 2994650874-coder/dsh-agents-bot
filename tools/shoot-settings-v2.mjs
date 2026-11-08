/**
 * 出「默认状态」的设置页截图：不点任何下拉，只看出厂样子。
 *
 * 上一个探针会把第 2 格改成三角并落盘，截图因此不是默认态 —— 这张单独出。
 *
 * 用法：node tools/shoot-settings-v2.mjs
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve('preview/panel.html')).href + '?settings=1&plain=1'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1150 } })
// 每次都是全新 context，localStorage 本来就是空的
await page.goto(PAGE)
await page.waitForSelector('.davs', { timeout: 15000 })
await page.waitForTimeout(1000)

// 展开顺位（默认是收起的）
const presetSection = page.locator('.davs-section').filter({ hasText: '自动分配顺位' })
await presetSection.locator('.davs-chip').first().click()
await page.waitForTimeout(400)

await page.screenshot({ path: 'preview/settings-v2-default.png', fullPage: true })
console.log('截图 → preview/settings-v2-default.png')

await presetSection.screenshot({ path: 'preview/preset-rows-default.png' })
console.log('截图 → preview/preset-rows-default.png')

// 也抓一下收起的动画映射，看胶囊形态
const card = page.locator('.davs-card').first()
await card.locator('.davs-chip').first().click()
await page.waitForTimeout(300)
await card.screenshot({ path: 'preview/map-collapsed.png' })
console.log('截图 → preview/map-collapsed.png')

await browser.close()

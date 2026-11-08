/**
 * 排查：顺位行缩略图换图案后到底变没变。
 *
 * 前一个探针用「命令数:长度量级」当 fingerprint，两个值完全一样（66:122）——
 * 要么缩略图真的没跟着变（React 没重渲染），要么 fingerprint 太粗。
 * 这里直接把 body path 打出来对比，并单独比较 x 跨度。
 *
 * 用法：node tools/probe-thumb-change.mjs
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve('preview/panel.html')).href + '?settings=1&plain=1'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
await page.goto(PAGE)
await page.waitForSelector('.davs', { timeout: 15000 })

const presetSection = page.locator('.davs-section').filter({ hasText: '自动分配顺位' })
await presetSection.locator('.davs-chip').first().click()
await page.waitForTimeout(400)

const row = presetSection.locator('.davs-rows-preset .davs-row').first()

/** 取最长 path + 其 x 跨度（viewBox 单位粗算）。 */
async function snapshot() {
  return row.locator('.davs-preset-thumb svg').evaluate((svg) => {
    const ps = Array.from(svg.querySelectorAll('path'))
      .map((p) => p.getAttribute('d') || '')
      .sort((a, b) => b.length - a.length)
    const d = ps[0] || ''
    const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
    const xs = nums.filter((_, i) => i % 2 === 0)
    return {
      len: d.length,
      cmds: (d.match(/[MLCQZ]/g) || []).length,
      head: d.slice(0, 90),
      xSpan: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
      shapeAttr: svg.parentElement?.parentElement?.querySelector('select')?.value ?? '?'
    }
  })
}

const before = await snapshot()
console.log('改之前：', JSON.stringify(before, null, 2))

await row.locator('select').first().selectOption('triangle')
await page.waitForTimeout(600)
const mid = await snapshot()
console.log('\n改成三角后：', JSON.stringify(mid, null, 2))

await row.locator('select').first().selectOption('gemme')
await page.waitForTimeout(600)
const gem = await snapshot()
console.log('\n改成宝石后：', JSON.stringify(gem, null, 2))

// 对照：右栏外观面板里同样是 30px 的缩略图，换形状一定变（已知成立）
console.log('\n判定：')
console.log('  path 长度 ' + before.len + ' → ' + mid.len + ' → ' + gem.len)
console.log('  x 跨度   ' + before.xSpan.toFixed(1) + ' → ' + mid.xSpan.toFixed(1) + ' → ' + gem.xSpan.toFixed(1))
console.log('  d 字节是否相同（三角 vs 改前）:', before.head === mid.head)
console.log('  d 字节是否相同（宝石 vs 三角）:', mid.head === gem.head)

await browser.close()

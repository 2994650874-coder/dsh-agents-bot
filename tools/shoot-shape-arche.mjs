/**
 * arche（拱门）单独放大：两只眼睛是不是真的并到一起了？
 *
 * 判据报「arche / idle / surpris 只有 1 个洞，圆是 2」—— 唯一解释是两只眼
 * 合成了一只。这不是「眼睛被轮廓咬掉」，是**眼睛互相重叠**，同样难看，
 * 而且成因不同（是宽度不够导致两眼间距被压缩，不是眼位偏移不够）。
 *
 * 这一页把 arche 在 4 个表情下按 4 档尺寸并排画，并标出两眼之间的间隙。
 *
 * 用法：node tools/build-shape-arche.mjs && node tools/shoot-shape-arche.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1300, height: 760 }, deviceScaleFactor: 4 })
const tab = await ctx.newPage()
await tab.goto('file:///' + resolve(ROOT, 'preview', 'shape-arche.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1200)

// 顺便量一下「两只眼睛的横向间隙」
const gaps = await tab.evaluate(() => {
  const out = []
  for (const box of document.querySelectorAll('.box[data-gap]')) {
    out.push({ label: box.dataset.gap, gap: Number(box.dataset.gapPx) })
  }
  return out
})
console.log('两眼横向间隙（px，负 = 重叠）：')
for (const g of gaps) console.log(`  ${g.label.padEnd(24)} ${g.gap.toFixed(1)}`)

await tab.screenshot({ path: resolve(ROOT, 'preview', 'shape-arche.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'shape-arche.png'))
await browser.close()

/**
 * 子代理图标在各档尺寸下「眼睛是否看得见」的实测 + 对照图。
 *
 * 判据不是「图标多大」，而是**眼睛在屏幕上占几个像素** —— 眼睛比图标
 * 先失效（眼睛本身很窄，宽/高约 1.7），所以按图标大小定尺寸会定大。
 *
 * 用法：
 *   node tools/build-icon-sizes.mjs
 *   node tools/probe-kids-icon.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'icon-sizes.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 900, height: 200 }, deviceScaleFactor: 4 })
const tab = await ctx.newPage()
await tab.goto(pathToFileURL(target).href)
await tab.waitForTimeout(700)

const rows = await tab.evaluate(() => {
  const out = []
  for (const box of document.querySelectorAll('.box')) {
    const size = Number(box.dataset.size)
    const eye = box.querySelector('path[transform^="matrix"]')
    if (!eye) {
      out.push({ size, eyeW: 0, eyeH: 0 })
      continue
    }
    const r = eye.getBoundingClientRect()
    out.push({ size, eyeW: +r.width.toFixed(2), eyeH: +r.height.toFixed(2) })
  }
  return out
})

console.log('图标尺寸   眼睛宽    眼睛高    判定')
console.log('─'.repeat(46))
for (const d of rows) {
  const verdict =
    d.eyeH >= 2.5 ? '看得见' : d.eyeH >= 1.8 ? '勉强' : d.eyeH > 0 ? '看不见（黑点）' : '(无量)'
  console.log(
    `${String(d.size + 'px').padEnd(10)}${String(d.eyeW).padEnd(10)}${String(d.eyeH).padEnd(10)}${verdict}`
  )
}

await tab.screenshot({ path: resolve(ROOT, 'preview', 'kids-icon-sizes.png') })
console.log('\npreview/kids-icon-sizes.png')

await ctx.close()
await browser.close()

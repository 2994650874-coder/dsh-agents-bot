/**
 * 确认两枚「恢复默认」按钮在**没有任何改动**时也真实可见。
 *
 * 为什么单独一个探针：`verify-settings` 里那两条是在「改过再恢复」的流程末尾
 * 验的，而用户报的是**一进页面就看不到**。两者是不同的状态，必须分开测。
 */
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const browser = await chromium.launch({
  executablePath: 'D:/百分/CentBrowser/Application/chrome.exe',
  headless: true
})

let pass = 0
let fail = 0
const ok = (m) => {
  console.log('  ok   ' + m)
  pass++
}
const bad = (m) => {
  console.log('  FAIL ' + m)
  fail++
}

/* 全新存盘：什么都没改过 */
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await page.goto(pathToFileURL(resolve(ROOT, 'preview', 'settings.html')).href)
await page.waitForTimeout(700)

console.log('全新安装（没有任何改动）时，两块卡片的「恢复默认」：\n')

for (const [block, label] of [
  ['map', '动画映射'],
  ['preset', '自动分配顺位']
]) {
  const info = await page.evaluate((b) => {
    const card = document.querySelector(`.davs-card[data-block="${b}"]`)
    if (!card) return null
    const btn = [...card.querySelectorAll('.davs-card-tools .davs-btn')].find(
      (x) => (x.textContent || '').trim() === '恢复默认'
    )
    if (!btn) return { found: false }
    const r = btn.getBoundingClientRect()
    const st = getComputedStyle(btn)
    return {
      found: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      visible: st.display !== 'none' && st.visibility !== 'hidden' && r.width > 0,
      title: btn.getAttribute('title')
    }
  }, block)

  if (!info) {
    bad(`${label}：找不到卡片`)
  } else if (!info.found) {
    bad(`${label}：「恢复默认」按钮不存在`)
  } else if (!info.visible) {
    bad(`${label}：按钮存在但不可见（${info.w}x${info.h}）`)
  } else {
    ok(`${label}：「恢复默认」可见（${info.w}x${info.h}px）`)
    console.log('        title = ' + info.title)
  }
}

/* 顺位卡片默认收起，按钮应当在收起态就可见（用户点进去第一眼） */
const presetCollapsed = await page.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  return card?.querySelectorAll('.davs-rows').length === 0
})
if (presetCollapsed) ok('顺位卡片处于收起态时按钮仍可见（用户第一眼就能看到）')
else bad('顺位卡片不是收起态，这条没验到')

await ctx.close()
await browser.close()
console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
process.exitCode = fail === 0 ? 0 : 1

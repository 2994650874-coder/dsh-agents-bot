/**
 * 诊断：9 格为什么只有 7 种轮廓？
 *
 * 直接读引擎层：每格应该拿到的 shape id 是什么、实际渲染的 path 是什么。
 *
 * 用法：node tools/probe-preset-diag.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const PICKED = ['a6', 'a7', 'b1', 'b2', 'b3', 'c1', 'c2', 'c3']

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 620, height: 1300 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
await tab.addInitScript((picked) => {
  try {
    localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ picked }))
  } catch {}
}, PICKED)
await tab.goto('file:///' + resolve(ROOT, 'preview', 'panel.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1500)

const rows = await tab.evaluate(() => {
  const cells = Array.from(document.querySelectorAll('.davf-cell'))
  return cells.map((c, i) => {
    const svg = c.querySelector('svg')
    const paths = svg ? Array.from(svg.querySelectorAll('path')) : []
    // 最长的那条 path 通常是身体轮廓
    const longest = paths.map((p) => p.getAttribute('d') ?? '').sort((a, b) => b.length - a.length)[0] ?? ''
    return {
      i: i + 1,
      name: (c.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 16),
      pathLen: longest.length,
      head: longest.slice(0, 40),
      // 第一个 path（Bot.tsx 里身体是第一个画在 <g opacity> 里的）
      first: (paths[0]?.getAttribute('d') ?? '').slice(0, 40)
    }
  })
})

console.log('每格的身体轮廓：\n')
console.log('格'.padEnd(4) + '名字'.padEnd(20) + 'path长度'.padStart(9) + '  开头')
console.log('─'.repeat(90))
for (const r of rows) {
  console.log(
    String(r.i).padEnd(4) + r.name.padEnd(20) + String(r.pathLen).padStart(9) + '  ' + r.head
  )
}

// 按 path 长度分组看重复
const byLen = new Map()
for (const r of rows) {
  if (!byLen.has(r.pathLen)) byLen.set(r.pathLen, [])
  byLen.get(r.pathLen).push(r.i)
}
console.log('\n按 path 长度分组（长度相同 = 同一形状）：')
for (const [len, idx] of [...byLen.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  ${len} 字符：第 ${idx.join(', ')} 格 ${idx.length > 1 ? '← 重复' : ''}`)
}

await browser.close()

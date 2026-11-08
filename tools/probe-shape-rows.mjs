/**
 * 身形是 7+7 两行吗？—— 量每行几个、两行对不对齐。
 *
 * ── 判据 ──────────────────────────────────────────────────────────────
 * 14 个身形排两行，每行 7 个。量法：按按钮的 `offsetTop` 分组（同一行的
 * top 相同），数每行几个。
 *
 * 顺带量三件事，因为改成固定 7 列可能引入新问题：
 *   1. 两行的第一格左边缘是否对齐（grid 天然对齐，但要确认）
 *   2. 窄容器下会不会横向溢出（minmax(0,1fr) 就是为了这个）
 *   3. 格子宽度够不够放下中文名（最长是「六边形」3 个字）
 *
 * 用法：node tools/build-panel.mjs && node tools/probe-shape-rows.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

/** 三档宽度：正常 360 面板 · 窄 300 · 极窄 260。 */
const WIDTHS = [560, 480, 420]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
  const tab = await ctx.newPage()
  await tab.goto('file:///' + resolve(ROOT, 'preview', 'panel.html').replace(/\\/g, '/'))
  await tab.waitForTimeout(900)
  await tab.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(
      (x) => (x.textContent || '').trim() === '外观'
    )
    b?.click()
  })
  await tab.waitForTimeout(600)

  const info = await tab.evaluate(() => {
    const shapes = Array.from(document.querySelectorAll('.davf-shape'))
    // 按 offsetTop 分行
    const rows = new Map()
    for (const s of shapes) {
      const top = Math.round(s.offsetTop)
      if (!rows.has(top)) rows.set(top, [])
      rows.get(top).push({
        label: (s.textContent || '').trim(),
        left: Math.round(s.offsetLeft),
        width: Math.round(s.getBoundingClientRect().width),
        scrollW: s.scrollWidth,
        clientW: s.clientWidth
      })
    }
    const box = document.querySelector('.davf-shapes')
    return {
      rows: Array.from(rows.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([top, items]) => ({ top, items })),
      boxOverflow: box ? { scrollW: box.scrollWidth, clientW: box.clientWidth } : null
    }
  })

  console.log(`\n容器宽 ${w}px`)
  console.log(`  行数：${info.rows.length}`)
  for (const [i, r] of info.rows.entries()) {
    console.log(`    第 ${i + 1} 行：${r.items.length} 个 · 左起 ${r.items[0].left}px · 宽 ${r.items[0].width}px`)
    console.log(`      ${r.items.map((x) => x.label).join(' / ')}`)
  }
  if (info.boxOverflow) {
    const o = info.boxOverflow
    console.log(`  容器横向溢出：${o.scrollW > o.clientW ? `有（${o.scrollW} > ${o.clientW}）✗` : `无（${o.scrollW} ≤ ${o.clientW}）✓`}`)
  }
  // 格子内文字有没有被挤到溢出
  const squeezed = info.rows.flatMap((r) => r.items).filter((x) => x.scrollW > x.clientW + 1)
  console.log(`  文字被挤出格子：${squeezed.length ? squeezed.map((s) => s.label).join(', ') + ' ✗' : '无 ✓'}`)

  if (w === WIDTHS[0]) {
    await tab.screenshot({ path: resolve(ROOT, 'preview', 'panel-7x2.png'), fullPage: true })
  }
  await ctx.close()
}

await browser.close()

/**
 * 子代理小框在**真实右栏尺寸**下的几何实测（含裁剪检测）。
 *
 * 为什么要有这个探针：verify-kids 一直跑在默认 360px 的假右栏上，
 * 而用户实际右栏窄到 ~110px、宽到 ~560px，两端都没覆盖过。
 * 结果就是「小框在真实右栏里不长个」这类问题在测试里完全隐形。
 *
 * 用法（在 grokbot 目录下）：node tools/probe-kids-size.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const page = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

/** 只测 1 格（用户报的场景就是单格大窗口） */
const widths = [116, 160, 240, 360, 480, 562, 640]

const rows = []
for (const w of widths) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(pathToFileURL(page).href + `?w=${w}&h=760`)
  await tab.waitForTimeout(700)
  const m = await tab.evaluate(() => {
    const cell = document.querySelector('.davf-cell')
    const botArea = cell?.querySelector('.davf-cell-bot')
    const k = cell?.querySelector('.davf-kids')
    const botSvg = botArea?.querySelector(':scope > svg')
    const faceSvg = k?.querySelector('svg')
    const meta = cell?.querySelector('.davf-cell-meta')
    const R = (e) => (e ? e.getBoundingClientRect() : null)
    const c = R(cell)
    const ba = R(botArea)
    const b = R(k)
    const f = R(faceSvg)
    const bs = R(botSvg)
    const mt = R(meta)
    return {
      cellW: c ? Math.round(c.width) : 0,
      cellH: c ? Math.round(c.height) : 0,
      botAreaW: ba ? Math.round(ba.width) : 0,
      botAreaH: ba ? Math.round(ba.height) : 0,
      metaH: mt ? Math.round(mt.height) : 0,
      bot: bs ? Math.round(bs.width) : 0,
      // 脸的**布局**尺寸（去掉 transform:scale 的视觉放大）
      faceLayout: f ? Math.round(f.width / 1.58) : 0,
      faceVisual: f ? Math.round(f.width) : 0,
      badgeW: b ? Math.round(b.width) : 0,
      badgeH: b ? Math.round(b.height) : 0,
      text: k ? k.textContent.trim() : '',
      // 小框有没有被 .davf-cell-bot 的 overflow:hidden 切掉
      clippedTop: b && ba ? Math.round(ba.top - b.top) : 0,
      // 小框有没有溢出格子
      overCellX: b && c ? Math.round(b.right - c.right) : 0
    }
  })
  rows.push({ w, ...m })
  await ctx.close()
}

console.log('栏宽  格子        头像区       头像  脸(布/视)  小框        宽高比  文字  裁剪')
console.log('─'.repeat(96))
for (const r of rows) {
  const ratio = r.badgeH ? (r.badgeW / r.badgeH).toFixed(2) : '?'
  console.log(
    `${String(r.w).padEnd(5)}${String(r.cellW + '×' + r.cellH).padEnd(12)}` +
      `${String(r.botAreaW + '×' + r.botAreaH).padEnd(13)}` +
      `${String(r.bot).padEnd(6)}` +
      `${String(r.faceLayout + '/' + r.faceVisual).padEnd(10)}` +
      `${String(r.badgeW + '×' + r.badgeH).padEnd(12)}` +
      `${ratio.padEnd(8)}${JSON.stringify(r.text).padEnd(6)}` +
      (r.clippedTop > 0 ? `顶被切 ${r.clippedTop}px` : '完整') +
      (r.overCellX > 0 ? ` 溢出格 ${r.overCellX}px` : '')
  )
}

console.log('\n脸 / 头像 比例（越大越显眼）:')
for (const r of rows) {
  console.log(`  栏宽 ${String(r.w).padEnd(4)} 头像 ${String(r.bot).padEnd(4)} 脸 ${String(r.faceLayout).padEnd(4)} → ${(r.faceLayout / r.bot).toFixed(3)}`)
}

await browser.close()

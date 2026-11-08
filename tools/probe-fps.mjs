/**
 * 真实帧率探针：数两秒内实际帧数与掉帧情况。
 *
 * 引擎单次采样已测过（tools/bench.mjs，约 0.055ms/帧），但那不含
 * React 重渲染与 SVG 重绘。这个探针量的是端到端 —— 用户能感知的那一层。
 *
 * 规格不再由胶囊选择，改为「勾选 N 个监控」来达到对应格数。
 *
 * 用法（在 grokbot 目录下）：node tools/probe-fps.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })

/** 勾到 target 格（含当前窗口那 1 个）。需要先展开所有工作区 —— 默认只展开当前那个。 */
async function fillTo(tab, target) {
  const need = target - 1
  if (need <= 0) return
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(300)

  // 展开所有折叠的工作区，否则可勾的行数不够
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    const cls = (await h.getAttribute('class')) ?? ''
    if (!cls.includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(150)
    }
  }

  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const n = await rows.count()
  for (let i = 0; i < Math.min(need, n); i++) {
    await rows.nth(i).click()
    await tab.waitForTimeout(120)
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(500)
}

async function measure(cells) {
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(pathToFileURL(target).href)
  await tab.waitForTimeout(600)
  await fillTo(tab, cells)

  const actual = await tab.locator('.davf-cell').count()
  /**
   * 规格不再从界面读 —— 标题栏那枚 `.davf-spec` 已移除（只是当初验证格子逻辑用的）。
   * 现在直接量 CSS grid 的实际行列，比读文本更硬：文本可能和布局不一致。
   */
  const spec = await tab.evaluate(() => {
    const g = document.querySelector('.davf-grid')
    if (!g) return '?'
    const cs = getComputedStyle(g)
    const cols = cs.gridTemplateColumns.split(' ').filter(Boolean).length
    const rows = cs.gridTemplateRows.split(' ').filter(Boolean).length
    return rows === 1 && cols === 1 ? '1' : `${rows}×${cols}`
  })

  const result = await tab.evaluate(async () => {
    const stamps = []
    const t0 = performance.now()
    await new Promise((done) => {
      const tick = (now) => {
        stamps.push(now)
        if (now - t0 < 2000) requestAnimationFrame(tick)
        else done()
      }
      requestAnimationFrame(tick)
    })
    const deltas = []
    for (let i = 1; i < stamps.length; i++) deltas.push(stamps[i] - stamps[i - 1])
    deltas.sort((a, b) => a - b)
    const avg = deltas.reduce((a, b) => a + b, 0) / deltas.length
    const p95 = deltas[Math.floor(deltas.length * 0.95)]
    const worst = deltas[deltas.length - 1]
    const janky = deltas.filter((d) => d > 33).length
    return { fps: 1000 / avg, avg, p95, worst, janky, jankRate: janky / deltas.length }
  })

  await tab.close()
  return { actual, spec, ...result }
}

console.log('端到端帧率（2 秒采样，无头 Chromium）\n')
const rows = []
for (const n of [1, 4, 9]) {
  const r = await measure(n)
  rows.push(r)
  console.log(
    `  ${String(r.actual).padStart(2)} 格（${r.spec}）  ${r.fps.toFixed(1)} fps  ` +
      `平均帧间隔 ${r.avg.toFixed(2)}ms  p95 ${r.p95.toFixed(1)}ms  ` +
      `最差 ${r.worst.toFixed(1)}ms  卡顿 ${r.janky} 次(${(r.jankRate * 100).toFixed(1)}%)`
  )
}

console.log('')
const worst = rows.reduce((a, b) => (b.fps < a.fps ? b : a))
console.log(`  最低帧率出现在 ${worst.actual} 格：${worst.fps.toFixed(1)} fps`)
console.log(worst.fps >= 50 ? '  结论：流畅，性能不是瓶颈' : '  结论：有可感知的掉帧，需要优化')

await browser.close()

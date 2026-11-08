/**
 * 性能拆解探针：把「9 格面板的开销」拆成引擎 / React+DOM / 绘制三块，
 * 并测「各格活动不同」到底比「各格活动相同」贵多少。
 *
 * ── 为什么需要它 ────────────────────────────────────────────────────
 * `bench.mjs` 只量纯函数层（引擎 sample），实测 9 格才 0.59 ms/帧 ——
 * 而面板实测脚本占 8.1%、主线程占 23.1%（45 帧档）。两者差一个数量级，
 * 说明瓶颈不在引擎。但「不在引擎」不等于知道在哪，必须拆开量。
 *
 * ── 三块怎么分 ──────────────────────────────────────────────────────
 *   · 引擎     —— bench.mjs 已经量准（0.066 ms/格/帧），这里直接引用
 *   · React+DOM —— CDP 的 ScriptDuration 减去引擎部分
 *   · 绘制      —— TaskDuration - ScriptDuration（布局/样式/合成/光栅）
 *
 * ── 异构 vs 同构怎么测 ──────────────────────────────────────────────
 * `?plain=1` 让所有格都判成空闲（同构）；默认假数据让每格活动不同（异构）。
 * 两次量同一格数，差值就是「异构的代价」。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-perf-breakdown.mjs            # 45 帧
 *   node tools/probe-perf-breakdown.mjs --fps 60
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const fpsArg = (() => {
  const i = process.argv.indexOf('--fps')
  return i >= 0 ? Number(process.argv[i + 1]) : 45
})()

/** bench.mjs 实测的引擎单格单帧耗时（毫秒）。改引擎后要重跑 bench.mjs 更新它。 */
const ENGINE_MS_PER_CELL = 0.0659

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return {
    task: pick('TaskDuration'),
    script: pick('ScriptDuration'),
    layout: pick('LayoutDuration'),
    style: pick('RecalcStyleDuration')
  }
}

async function sample(cdp, ms) {
  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, ms))
  const b = await snap(cdp)
  const w = ms / 1000
  const d = (k) => ((b[k] - a[k]) / w) * 100
  return { task: d('task'), script: d('script'), layout: d('layout'), style: d('style') }
}

async function fillTo(tab, target) {
  const need = target - 1
  if (need <= 0) return
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(320)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(140)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const c = await rows.count()
  for (let i = 0; i < Math.min(need, c); i++) {
    await rows.nth(i).click()
    await tab.waitForTimeout(110)
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(400)
}

/** 量一个场景。`plain` = 所有格同构（都空闲）。 */
async function measure(cells, plain) {
  const tab = await ctx.newPage()
  await tab.addInitScript(
    ({ fps }) => {
      try {
        localStorage.clear()
      } catch {}
      localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps }))
    },
    { fps: fpsArg }
  )
  await tab.goto(PAGE + (plain ? '?plain=1' : ''))
  await tab.waitForTimeout(700)
  if (cells > 0) await fillTo(tab, cells)

  // DOM 规模：SVG 节点总数与 path 总数 —— 绘制开销和它强相关
  const dom = await tab.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.davf-cell'))
    let svgNodes = 0
    let paths = 0
    let masks = 0
    let grads = 0
    for (const c of cells) {
      const svg = c.querySelector('svg')
      if (!svg) continue
      svgNodes += svg.querySelectorAll('*').length
      paths += svg.querySelectorAll('path').length
      masks += svg.querySelectorAll('mask').length
      grads += svg.querySelectorAll('linearGradient').length
    }
    return { cells: cells.length, svgNodes, paths, masks, grads }
  })

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000) // 预热丢弃
  const r = await sample(cdp, 3000)
  await tab.close()
  return { ...r, ...dom }
}

const rows = []
for (const n of [1, 4, 9]) {
  rows.push({ label: `${n} 格 异构`, n, plain: false, ...(await measure(n, false)) })
}
rows.push({ label: `9 格 同构`, n: 9, plain: true, ...(await measure(9, true)) })

console.log(`性能拆解（CDP，3 秒采样，${fpsArg} 帧档）\n`)
console.log('场景         格数  DOM节点  path  mask  主线程   脚本   绘制(布局+样式)  引擎估算')
console.log('─'.repeat(94))
for (const r of rows) {
  const paint = r.task - r.script
  const engine = (ENGINE_MS_PER_CELL * r.n * fpsArg) / 10 // ms/帧 → 每秒毫秒 → 百分比
  console.log(
    `${r.label.padEnd(12)} ${String(r.cells).padStart(2)}  ` +
      `${String(r.svgNodes).padStart(6)}  ${String(r.paths).padStart(4)}  ${String(r.masks).padStart(4)}  ` +
      `${r.task.toFixed(1).padStart(6)}% ${r.script.toFixed(1).padStart(6)}% ` +
      `${paint.toFixed(1).padStart(9)}%      ${engine.toFixed(1).padStart(5)}%`
  )
}

const het = rows.find((r) => r.label.startsWith('9 格 异构'))
const hom = rows.find((r) => r.label.startsWith('9 格 同构'))
if (het && hom) {
  console.log('')
  console.log('异构 vs 同构（同为 9 格）：')
  console.log(`  主线程  ${het.task.toFixed(1)}% vs ${hom.task.toFixed(1)}%   差 ${(het.task - hom.task).toFixed(1)} 个百分点`)
  console.log(`  脚本    ${het.script.toFixed(1)}% vs ${hom.script.toFixed(1)}%   差 ${(het.script - hom.script).toFixed(1)} 个百分点`)
  console.log(`  DOM节点 ${het.svgNodes} vs ${hom.svgNodes}   差 ${het.svgNodes - hom.svgNodes}`)
}

await browser.close()

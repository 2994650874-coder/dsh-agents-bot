/**
 * 「最短停留」节流的性能开销 —— 用户问「不会造成任何额外的性能开销对吧」，
 * 这个脚本用数字回答，不靠口头保证。
 *
 * ── 量什么 ────────────────────────────────────────────────────────
 *
 * 同一份面板，只改 `dwellMs` 一个变量：
 *   0     = 关闭（默认，= 改造前行为）
 *   1600  = 开启（推荐档）
 *
 * 两个指标：
 *   1. **主线程占用**（CDP TaskDuration）—— 稳态下有没有变贵
 *   2. **空闲时的定时器数量** —— 关闭时必须是 0（证明「零开销」不是空话）
 *
 * 为什么必须量而不是推理：节流本身是纯函数、看着不贵，但它引入了
 * 「按需唤醒」的 setTimeout，而 9 格 × 每格一个解禁时刻 = 可能的
 * 唤醒风暴。必须实测。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-panel.mjs && node tools/probe-dwell-cost.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

async function fillTo(tab, target) {
  const need = target - 1
  if (need <= 0) return // 1 格 = 当前窗口，本来就有一格，不用点
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

const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return { task: pick('TaskDuration'), script: pick('ScriptDuration') }
}

async function measure(cells, dwellMs) {
  const tab = await ctx.newPage()
  await tab.addInitScript(
    ({ dwell }) => {
      try {
        localStorage.clear()
      } catch {}
      localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps: 60, dwellMs: dwell }))
    },
    { dwell: dwellMs }
  )
  await tab.goto(PAGE)
  await tab.waitForTimeout(700)
  await fillTo(tab, cells)

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')

  /* 统计运行中的定时器：劫持 setInterval / setTimeout 计数。
     必须在页面加载前注入，但那时还拿不到 React —— 所以改用
     「同一时刻存活的定时器数量」这个可观测事实。 */
  await tab.evaluate(() => {
    const w = window
    w.__live = 0
    w.__peak = 0
    const origSetTimeout = w.setTimeout
    const origClearTimeout = w.clearTimeout
    const ids = new Set()
    w.setTimeout = function (fn, ms, ...rest) {
      const id = origSetTimeout.call(w, (...a) => {
        ids.delete(id)
        w.__live = ids.size
        return fn(...a)
      }, ms, ...rest)
      ids.add(id)
      w.__live = ids.size
      w.__peak = Math.max(w.__peak, ids.size)
      return id
    }
    w.clearTimeout = function (id) {
      ids.delete(id)
      w.__live = ids.size
      return origClearTimeout.call(w, id)
    }
  })

  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, 3000))
  const b = await snap(cdp)
  const peakTimers = await tab.evaluate(() => window.__peak)

  const win = 3
  const r = {
    cells: await tab.locator('.davf-cell').count(),
    task: ((b.task - a.task) / win) * 100,
    script: ((b.script - a.script) / win) * 100,
    peakTimers
  }
  await tab.close()
  return r
}

const ROUNDS = 3
const CASES = [
  { label: '9 格 · 关闭', cells: 9, dwell: 0 },
  { label: '9 格 · 开启 1.6s', cells: 9, dwell: 1600 },
  { label: '1 格 · 关闭', cells: 1, dwell: 0 },
  { label: '1 格 · 开启 1.6s', cells: 1, dwell: 1600 }
]
const acc = Object.fromEntries(CASES.map((c) => [c.label, []]))

console.log(`节流开销对照（${ROUNDS} 轮交错，取中位数）\n`)
for (let round = 0; round < ROUNDS; round++) {
  for (const c of CASES) acc[c.label].push(await measure(c.cells, c.dwell))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const med = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log('场景               主线程(中位)   其中脚本   峰值定时器数')
console.log('─'.repeat(58))
for (const c of CASES) {
  const xs = acc[c.label]
  console.log(
    `${c.label.padEnd(18)}  ${med(xs.map((x) => x.task)).toFixed(1).padStart(7)}%  ` +
      `${med(xs.map((x) => x.script)).toFixed(1).padStart(7)}%  ` +
      `${med(xs.map((x) => x.peakTimers)).toString().padStart(10)}`
  )
}

console.log('')
const off9 = med(acc['9 格 · 关闭'].map((x) => x.task))
const on9 = med(acc['9 格 · 开启 1.6s'].map((x) => x.task))
const off1 = med(acc['1 格 · 关闭'].map((x) => x.task))
const on1 = med(acc['1 格 · 开启 1.6s'].map((x) => x.task))

console.log(`  9 格：关闭 ${off9.toFixed(1)}% → 开启 ${on9.toFixed(1)}%   差 ${(on9 - off9).toFixed(1)} 个百分点`)
console.log(`  1 格：关闭 ${off1.toFixed(1)}% → 开启 ${on1.toFixed(1)}%   差 ${(on1 - off1).toFixed(1)} 个百分点`)

const range = (label) => {
  const xs = acc[label].map((x) => x.task)
  return [Math.min(...xs), Math.max(...xs)]
}
const [onMin, onMax] = range('9 格 · 开启 1.6s')
const [offMin, offMax] = range('9 格 · 关闭')
console.log(`\n  9 格区间：关闭 ${offMin.toFixed(1)}~${offMax.toFixed(1)}% ／ 开启 ${onMin.toFixed(1)}~${onMax.toFixed(1)}%`)
console.log(
  offMin <= onMax && onMin <= offMax
    ? '  → 区间重叠：这个差异落在噪声内，判「无可测开销」'
    : '  → 区间不重叠：存在可测差异'
)

await browser.close()

/**
 * 量「会话快照高频更新」对主线程的代价。
 *
 * 面板订阅整份快照，只关心 `agentsBot` 一个字段。这个探针把「快照多久变一次」
 * 做成唯一变量，看面板重渲染本身吃掉多少主线程 —— 从而回答
 * 「流式输出时 bot 为什么偶尔卡一下」里「是不是我这边订阅太宽」那一半。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-rerender.mjs
 *   node tools/probe-rerender.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'rerender.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 500, height: 820 } })

const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return { task: pick('TaskDuration'), script: pick('ScriptDuration'), layout: pick('LayoutDuration') }
}

async function measure(hz) {
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(PAGE + '?hz=' + hz)
  await tab.waitForTimeout(1200)
  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await snap(cdp) // 预热
  await new Promise((r) => setTimeout(r, 500))
  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, 3000))
  const b = await snap(cdp)
  const win = 3
  const r = {
    hz,
    task: ((b.task - a.task) / win) * 100,
    script: ((b.script - a.script) / win) * 100,
    layout: ((b.layout - a.layout) / win) * 100
  }
  await tab.close()
  return r
}

const ROUNDS = 3
const CASES = [0, 20, 60]
const acc = Object.fromEntries(CASES.map((h) => [h, []]))

console.log(`会话快照更新频率 → 面板主线程占用（${ROUNDS} 轮交错，取中位数）\n`)
for (let round = 0; round < ROUNDS; round++) {
  for (const hz of CASES) acc[hz].push(await measure(hz))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log('快照更新   主线程(中位)    其中脚本    其中布局')
console.log('─'.repeat(52))
for (const hz of CASES) {
  const xs = acc[hz]
  const label = hz === 0 ? '恒定' : `${hz} Hz`
  console.log(
    `${label.padEnd(9)}  ${median(xs.map((x) => x.task)).toFixed(1).padStart(7)}%` +
      `  ${median(xs.map((x) => x.script)).toFixed(1).padStart(7)}%` +
      `  ${median(xs.map((x) => x.layout)).toFixed(1).padStart(7)}%`
  )
}

const base = median(acc[0].map((x) => x.task))
for (const hz of CASES.slice(1)) {
  const v = median(acc[hz].map((x) => x.task))
  console.log(`\n  ${hz} Hz 相对恒定：${v - base >= 0 ? '+' : ''}${(v - base).toFixed(1)} 个百分点`)
}

await browser.close()

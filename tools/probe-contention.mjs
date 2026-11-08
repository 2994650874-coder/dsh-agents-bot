/**
 * 帧预算争用探针。
 *
 * 回答的是「为什么 CPU 没吃满、bot 却偶尔卡一下」：
 * **主线程是一条队列，不是一块算力。** 平均占用 60% 也可能有个别帧被挤到 30ms，
 * 那一帧就是肉眼可见的一顿。
 *
 * 三个场景（同一页面，只换 ?mode=）：
 *   bot    只有头像面板
 *   chat   只有流式正文
 *   both   两个一起
 *
 * 指标：
 *   fps        平均帧率
 *   p95 / p99  帧间隔分位数
 *   jank       帧间隔 > 1.5 帧预算 的次数占比  ← 这才是「卡」的量化
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-contention.mjs
 *   node tools/probe-contention.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'contention.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } })

async function measure(mode, throttle) {
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(PAGE + '?mode=' + mode)
  await tab.waitForTimeout(1500) // 让面板与流式都进入稳态

  /**
   * CPU 降速：无头 Chromium 不锁刷新率（rAF 能跑到 180fps，每帧 5.6ms），
   * 所以「余量充足」是测试环境给的假象，不是真机状态。降速把同样的
   * 相对紧张度复现出来 —— rate=4 表示 JS 慢 4 倍。
   */
  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  if (throttle > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle })
  await tab.waitForTimeout(600)

  /* ── 一、帧间隔分布（回答「卡不卡」）────────────────────────────── */
  const frames = await tab.evaluate(async () => {
    const stamps = []
    const t0 = performance.now()
    await new Promise((done) => {
      const tick = (now) => {
        stamps.push(now)
        if (now - t0 < 3000) requestAnimationFrame(tick)
        else done()
      }
      requestAnimationFrame(tick)
    })
    const d = []
    for (let i = 1; i < stamps.length; i++) d.push(stamps[i] - stamps[i - 1])
    d.sort((a, b) => a - b)
    const at = (q) => d[Math.min(d.length - 1, Math.floor(d.length * q))]
    const avg = d.reduce((a, b) => a + b, 0) / d.length
    const JANK = 16.7 * 1.5
    const jank = d.filter((x) => x > JANK).length
    return {
      n: d.length,
      fps: 1000 / avg,
      p50: at(0.5),
      p95: at(0.95),
      p99: at(0.99),
      worst: d[d.length - 1],
      jank,
      jankRate: jank / d.length
    }
  })

  /* ── 二、主线程时间去哪了（回答「谁在吃线程」）───────────────────── */
  const pick = async () => {
    const m = await cdp.send('Performance.getMetrics')
    const g = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
    return {
      task: g('TaskDuration'),
      script: g('ScriptDuration'),
      layout: g('LayoutDuration'),
      style: g('RecalcStyleDuration')
    }
  }
  await pick() // 丢弃预热
  const a = await pick()
  await new Promise((r) => setTimeout(r, 3000))
  const b = await pick()
  const W = 3
  const cpu = {
    task: ((b.task - a.task) / W) * 100,
    script: ((b.script - a.script) / W) * 100,
    layout: ((b.layout - a.layout) / W) * 100,
    style: ((b.style - a.style) / W) * 100
  }

  await tab.close()
  return { ...frames, ...cpu }
}

const ROUNDS = 3
const MODES = [
  ['bot', '只开头像面板'],
  ['chat', '只开流式正文'],
  ['both', '两个一起']
]
const THROTTLE = Number(process.argv[2] ?? 4)
const acc = Object.fromEntries(MODES.map(([m]) => [m, []]))

console.log(`帧间隔分布（3 秒采样 × ${ROUNDS} 轮，取中位数，CPU 降速 ${THROTTLE}×）\n`)
for (let round = 0; round < ROUNDS; round++) {
  for (const [m] of MODES) acc[m].push(await measure(m, THROTTLE))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

console.log('场景            fps      p95      p99     最差   卡顿帧   主线程   其中脚本   布局   样式')
console.log('─'.repeat(96))
for (const [m, label] of MODES) {
  const xs = acc[m]
  console.log(
    `${label.padEnd(13)}  ${median(xs.map((x) => x.fps)).toFixed(1).padStart(5)}  ` +
      `${median(xs.map((x) => x.p95)).toFixed(1).padStart(6)}ms  ` +
      `${median(xs.map((x) => x.p99)).toFixed(1).padStart(6)}ms  ` +
      `${median(xs.map((x) => x.worst)).toFixed(1).padStart(5)}ms  ` +
      `${median(xs.map((x) => x.jank)).toString().padStart(4)}/${median(xs.map((x) => x.n))}  ` +
      `${median(xs.map((x) => x.task)).toFixed(1).padStart(5)}%  ` +
      `${median(xs.map((x) => x.script)).toFixed(1).padStart(7)}%  ` +
      `${median(xs.map((x) => x.layout)).toFixed(1).padStart(5)}%  ` +
      `${median(xs.map((x) => x.style)).toFixed(1).padStart(5)}%`
  )
}

console.log('')
const b = median(acc.bot.map((x) => x.p95))
const c = median(acc.chat.map((x) => x.p95))
const both = median(acc.both.map((x) => x.p95))
console.log(`  p95 帧间隔：bot ${b.toFixed(1)}ms ／ chat ${c.toFixed(1)}ms ／ both ${both.toFixed(1)}ms`)
console.log(
  both > Math.max(b, c) + 2
    ? '  → both 明显比两者都差：这是**同线程争用**，不是某一方自己慢'
    : '  → both 与单独跑接近：争用不明显'
)

await browser.close()

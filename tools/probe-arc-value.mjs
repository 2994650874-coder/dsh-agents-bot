/**
 * 弧数 → 性能：严格 A/B（回答「再砍 arc 值不值」）。
 *
 * ── 为什么需要这个脚本 ──────────────────────────────────────────────
 * 前面的实测出现一个反直觉结果：`comet` 从 4 条弧砍到 1 条，
 * 主线程 18.6% → 18.5%，**没有变化**；而 `idle`（0 条弧）是 17.9%。
 *
 * 也就是说「4 条弧只值 0.6pp」。如果这个结论成立，那么继续砍弧
 * （orbit 6→4）的收益会远小于按元素数比例的估算。
 *
 * 这个脚本用**同一次进程、交错采样**验证：把弧数从 0 递增到 6，
 * 其余全部固定，看主线程占用是不是真的随弧数线性上升。
 *
 * ── 怎么控制弧数 ────────────────────────────────────────────────────
 * 不重新构建。`Bot.tsx` 从 `pose.arcs` 拿弧，而弧由状态定义。
 * 这里用「注入轮播把所有活动钉在同一个状态」来选状态，
 * 各状态的弧数是固定的：sleep 0 / idle 0 / swirl 3 / play 1 / comet 4 / orbit 6。
 * 于是「弧数」这个变量被映射成「选哪个状态」。
 *
 * 但各状态的**其他**开销也不同（身体路径复杂度、眼睛数、粒子数），
 * 所以不能直接比。判据是：**同弧数不同状态**之间差异大不大 ——
 * 如果 0 弧的 sleep 和 0 弧的 idle 差很多，说明身体本身才是主因。
 *
 * 用法（在 grokbot 下）：node tools/probe-arc-value.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const argOf = (n, d) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? Number(process.argv[i + 1]) : d
}
const FPS = argOf('--fps', 45)
const ROUNDS = argOf('--rounds', 5)

/** 按弧数排序的状态。arcs 数来自 probe-frame-peak 的实测。 */
const CASES = [
  { state: 'sleep', arcs: 0, label: '0 弧 · sleep' },
  { state: 'idle', arcs: 0, label: '0 弧 · idle' },
  { state: 'play', arcs: 1, label: '1 弧 · play（已改）' },
  { state: 'swirl', arcs: 3, label: '3 弧 · swirl' },
  { state: 'comet', arcs: 4, label: '4 弧 · comet' },
  { state: 'orbit', arcs: 6, label: '6 弧 · orbit' }
]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return { task: pick('TaskDuration'), script: pick('ScriptDuration') }
}

async function sample(cdp, ms) {
  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, ms))
  const b = await snap(cdp)
  const w = ms / 1000
  return { task: ((b.task - a.task) / w) * 100, script: ((b.script - a.script) / w) * 100 }
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

async function once(state) {
  const acts = [
    'idle', 'thinking', 'reading', 'searching', 'running', 'writing',
    'compacting', 'background', 'waiting', 'done', 'error', 'spawning', 'sleep'
  ]
  const rotation = {}
  for (const a of acts) rotation[a] = [{ state, plays: 1 }]

  const tab = await ctx.newPage()
  await tab.addInitScript(
    ({ fps, rotation }) => {
      try {
        localStorage.clear()
      } catch {}
      localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps, rotation }))
    },
    { fps: FPS, rotation }
  )
  await tab.goto(PAGE)
  await tab.waitForTimeout(700)
  await fillTo(tab, 9)

  const dom = await tab.evaluate(() => {
    const svg = document.querySelector('.davf-cell svg')
    return svg
      ? {
          nodes: svg.querySelectorAll('*').length,
          paths: svg.querySelectorAll('path').length,
          grads: svg.querySelectorAll('linearGradient').length,
          stops: svg.querySelectorAll('stop').length
        }
      : null
  })

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000)
  const r = await sample(cdp, 2500)
  await tab.close()
  return { ...r, dom }
}

const results = Object.fromEntries(CASES.map((c) => [c.state, []]))
for (let round = 0; round < ROUNDS; round++) {
  for (const c of CASES) results[c.state].push(await once(c.state))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

console.log(`弧数 → 主线程占用（9 格同构，${FPS} 帧，${ROUNDS} 轮交错）\n`)
console.log('场景              弧数  元素  渐变  stop   主线程(中位)   范围           脚本')
console.log('─'.repeat(88))

const rows = CASES.map((c) => {
  const xs = results[c.state]
  const tasks = xs.map((r) => r.task)
  const dom = xs[0].dom ?? {}
  return {
    ...c,
    task: median(tasks),
    script: median(xs.map((r) => r.script)),
    min: Math.min(...tasks),
    max: Math.max(...tasks),
    dom
  }
})

for (const r of rows) {
  console.log(
    `${r.label.padEnd(20)} ${String(r.arcs).padStart(3)} ${String(r.dom.nodes ?? 0).padStart(5)} ` +
      `${String(r.dom.grads ?? 0).padStart(5)} ${String(r.dom.stops ?? 0).padStart(5)}  ` +
      `${r.task.toFixed(1).padStart(10)}%   ${`${r.min.toFixed(1)}~${r.max.toFixed(1)}%`.padEnd(14)}` +
      ` ${r.script.toFixed(1).padStart(5)}%`
  )
}

/* ── 判读 ─────────────────────────────────────────────────────────── */

const base = rows.find((r) => r.state === 'idle')
console.log('\n相对 idle（0 弧）的增量：')
for (const r of rows) {
  if (r.state === 'idle') continue
  const d = r.task - base.task
  const overlap = r.min <= base.max && base.min <= r.max
  console.log(
    `  ${r.label.padEnd(20)} ${d >= 0 ? '+' : ''}${d.toFixed(1)} pp` +
      (overlap ? '   ← 与 idle 区间重叠，分不出' : '')
  )
}

/* 每多一条弧值多少 */
const arcRows = rows.filter((r) => r.arcs > 0)
const zero = rows.filter((r) => r.arcs === 0)
const avgZero = zero.reduce((a, r) => a + r.task, 0) / zero.length
const perArc = arcRows.map((r) => ({ arcs: r.arcs, cost: r.task - avgZero }))

console.log('\n每多一条弧的成本（相对 0 弧均值 ' + avgZero.toFixed(1) + '%）：')
for (const p of perArc) {
  console.log(`  ${String(p.arcs).padStart(2)} 条弧 → +${p.cost.toFixed(1)} pp`)
}

console.log('\n判读：')
console.log('  · 若「弧数」与「成本」不同向，说明瓶颈不是弧本身，而是元素总数/绘制面积。')
console.log('  · orbit（6 弧）明显更高，可能因为它的**身体是旋转的三角形**，')
console.log('    每帧路径完全不同，光栅化面积也大 —— 这部分和弧数无关。')

await browser.close()

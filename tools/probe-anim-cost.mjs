/**
 * 逐动画状态的绘制成本：9 格全部钉在同一个动画上，量主线程。
 *
 * ── 怎么钉住 ────────────────────────────────────────────────────────
 * 不用改插件。每个格子播什么由 `rotation[activity][0].state` 决定，
 * 而 `rotation` 是落盘字段（localStorage）。所以直接注入一份「所有活动都播
 * 同一个动画」的配置，9 格就全部渲染同一个状态了。
 *
 * `readRotation` 会校验动画名在 `ANIMATION_IDS` 里，所以注入的名字必须真实存在。
 *
 * ── 为什么这个测法是对的 ────────────────────────────────────────────
 * 格数固定 9、容器固定、帧率固定，**唯一变量是动画状态**。于是差异只能来自
 * 「这个状态画出来的东西有多重」。之前量「异构 vs 同构」时变量有两个
 * （状态不同 + 节点数不同），分不清是哪一项起作用。
 *
 * ── 已知的坑（写在前面，避免下次重踩）────────────────────────────────
 * **帧率只有 45 和 60 两档。** `readFps()` 只认 `FPS_OPTIONS` 里的值，
 * 注入 15/20/30 会静默回落到默认 60 —— 测出来三条线一模一样，不是线性关系
 * 不成立，是三次都在测 60。要测更低帧率必须先在代码里加档位。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-anim-cost.mjs              # 45 帧，3 轮
 *   node tools/probe-anim-cost.mjs --fps 60
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
const ROUNDS = argOf('--rounds', 3)

/** 要测的动画。挑的是 DOM 差异最大的几个 + 两个基线。 */
const ANIMS = [
  { id: 'idle', label: '空闲（基线，无弧）' },
  { id: 'sleep', label: '休眠（最简）' },
  { id: 'thinking', label: '思考（3 点）' },
  { id: 'alert', label: '出错（!）' },
  { id: 'swirl', label: '漩涡（3 弧）' },
  { id: 'play', label: '写文件（4 弧）' },
  { id: 'comet', label: '跑命令（4 弧）' },
  { id: 'orbit', label: '检索（6 弧，最重）' },
  { id: 'burst', label: '爆发（粒子）' }
]

/** 所有活动都播同一个动画 —— 这样 9 格全部同构。 */
function rotationFor(state) {
  const acts = [
    'idle', 'thinking', 'reading', 'searching', 'running', 'writing',
    'compacting', 'background', 'waiting', 'done', 'error', 'spawning', 'sleep'
  ]
  const out = {}
  for (const a of acts) out[a] = [{ state, plays: 1 }]
  return out
}

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

/** 量一个动画：9 格全播它。 */
async function once(state) {
  const tab = await ctx.newPage()
  await tab.addInitScript(
    ({ fps, rotation }) => {
      try {
        localStorage.clear()
      } catch {}
      localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps, rotation }))
    },
    { fps: FPS, rotation: rotationFor(state) }
  )
  await tab.goto(PAGE)
  await tab.waitForTimeout(700)
  await fillTo(tab, 9)

  // 确认真的钉住了：读第一格的 data-activity 不够（那是活动不是动画），
  // 直接数 SVG 元素 —— 各动画的元素数不同，能反证状态确实换了。
  const dom = await tab.evaluate(() => {
    const cells = Array.from(document.querySelectorAll('.davf-cell'))
    const first = cells[0]?.querySelector('svg')
    if (!first) return null
    return {
      cells: cells.length,
      nodes: first.querySelectorAll('*').length,
      paths: first.querySelectorAll('path').length,
      grads: first.querySelectorAll('linearGradient').length,
      stops: first.querySelectorAll('stop').length
    }
  })

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000) // 预热丢弃
  const r = await sample(cdp, 2500)
  await tab.close()
  return { ...r, dom }
}

const results = Object.fromEntries(ANIMS.map((a) => [a.id, []]))
for (let round = 0; round < ROUNDS; round++) {
  for (const a of ANIMS) results[a.id].push(await once(a.id))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

console.log(`9 格全部播同一动画 · ${FPS} 帧档 · ${ROUNDS} 轮取中位数\n`)
console.log('动画              每格节点  path  渐变  stop   主线程    脚本    绘制    范围')
console.log('─'.repeat(88))

const rows = ANIMS.map((a) => {
  const xs = results[a.id]
  const tasks = xs.map((r) => r.task)
  const dom = xs[0].dom ?? {}
  return {
    ...a,
    task: median(tasks),
    script: median(xs.map((r) => r.script)),
    min: Math.min(...tasks),
    max: Math.max(...tasks),
    dom
  }
})

for (const r of rows) {
  const paint = r.task - r.script
  console.log(
    `${r.label.padEnd(18)} ${String(r.dom.nodes ?? 0).padStart(6)} ${String(r.dom.paths ?? 0).padStart(5)} ` +
      `${String(r.dom.grads ?? 0).padStart(4)} ${String(r.dom.stops ?? 0).padStart(5)} ` +
      `${r.task.toFixed(1).padStart(6)}% ${r.script.toFixed(1).padStart(6)}% ${paint.toFixed(1).padStart(6)}%  ` +
      `${r.min.toFixed(1)}~${r.max.toFixed(1)}%`
  )
}

/* ── 关键对比：有弧 vs 无弧 ──────────────────────────────────────── */

const idle = rows.find((r) => r.id === 'idle')
const orbit = rows.find((r) => r.id === 'orbit')
const withArcs = rows.filter((r) => ['swirl', 'play', 'comet', 'orbit'].includes(r.id))
const noArcs = rows.filter((r) => ['idle', 'sleep', 'thinking', 'alert'].includes(r.id))

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const arcMed = avg(withArcs.map((r) => r.task))
const plainMed = avg(noArcs.map((r) => r.task))

console.log('\n有弧 vs 无弧（都是 9 格同构）：')
console.log(`  无弧 ${noArcs.map((r) => r.id).join('/')}   平均 ${plainMed.toFixed(1)}%`)
console.log(`  有弧 ${withArcs.map((r) => r.id).join('/')}  平均 ${arcMed.toFixed(1)}%`)
console.log(`  差 ${(arcMed - plainMed).toFixed(1)} 个百分点 —— 这就是弧的代价`)

if (idle && orbit) {
  console.log('')
  console.log(`最轻 ${idle.label.split('（')[0]} ${idle.task.toFixed(1)}%  →  最重 orbit ${orbit.task.toFixed(1)}%`)
  console.log(`倍数 ${(orbit.task / idle.task).toFixed(1)}×   节点 ${idle.dom.nodes} → ${orbit.dom.nodes}`)
}

await browser.close()

/**
 * orbit 为什么贵：拆开「弧数」与「身体旋转」两个变量。
 *
 * ── 为什么要拆 ──────────────────────────────────────────────────────
 * `probe-arc-value` 实测：1~4 条弧的成本全落在噪声内（差 ≤2pp 且区间重叠），
 * 只有 `orbit`（6 弧）明显高 +4.3pp。但 `orbit` 和别的状态有两处不同：
 *   1. 弧数最多（6）
 *   2. **身体每帧在旋转**（`spinningTriangle` + 1.25 转/秒），
 *      而其它状态的身体要么静止要么只是轻微呼吸
 * 所以「+4.3pp 是弧造成的」这个推断还没被证明。
 *
 * ── 怎么拆 ──────────────────────────────────────────────────────────
 * 给 `?state=` 之外加一个实验维度：在页面里用 CSS 把弧的 `<path>` 全部隐藏
 * （visibility:hidden，仍参与布局与合成，但不必光栅化描边），
 * 对比「orbit 有弧」vs「orbit 隐藏弧」。身体照常旋转。
 *
 * 若隐藏弧后成本大降 → 弧是主因。
 * 若几乎不变 → 主因是身体旋转（每帧路径完全不同）。
 *
 * 用法（在 grokbot 下）：node tools/probe-orbit-split.mjs
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

/**
 * 场景：
 *   idle                 基准
 *   orbit 正常           6 弧 + 旋转身体
 *   orbit 隐藏弧         只旋转身体（弧仍在 DOM，只是 visibility:hidden）
 *   orbit 冻结身体       弧照常，身体不转（用 CSS animation 无法冻，所以不测）
 */
const SCENES = [
  { id: 'idle', state: 'idle', hideArcs: false, label: 'idle（0 弧，静止身体）' },
  { id: 'orbit', state: 'orbit', hideArcs: false, label: 'orbit（6 弧 + 旋转身体）' },
  { id: 'orbit-noarc', state: 'orbit', hideArcs: true, label: 'orbit 隐藏弧（只旋转身体）' }
]

async function once(scene) {
  const acts = [
    'idle', 'thinking', 'reading', 'searching', 'running', 'writing',
    'compacting', 'background', 'waiting', 'done', 'error', 'spawning', 'sleep'
  ]
  const rotation = {}
  for (const a of acts) rotation[a] = [{ state: scene.state, plays: 1 }]

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

  if (scene.hideArcs) {
    // 弧是 <g fill="none"> 里的 <path stroke=...>；身体是 <g opacity> 里的 path[fill]
    await tab.addStyleTag({
      content: `.davf-cell svg g[fill="none"] path{visibility:hidden}`
    })
    await tab.waitForTimeout(400)
  }

  const dom = await tab.evaluate(() => {
    const svg = document.querySelector('.davf-cell svg')
    if (!svg) return null
    const arcPaths = Array.from(svg.querySelectorAll('g[fill="none"] path'))
    return {
      nodes: svg.querySelectorAll('*').length,
      arcPaths: arcPaths.length,
      visibleArcPaths: arcPaths.filter((p) => getComputedStyle(p).visibility !== 'hidden').length
    }
  })

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000)
  const r = await sample(cdp, 2500)
  await tab.close()
  return { ...r, dom }
}

const results = Object.fromEntries(SCENES.map((s) => [s.id, []]))
for (let round = 0; round < ROUNDS; round++) {
  for (const s of SCENES) results[s.id].push(await once(s))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

console.log(`orbit 成本拆解（9 格同构，${FPS} 帧，${ROUNDS} 轮交错）\n`)
console.log('场景                            可见弧  主线程(中位)   范围           脚本')
console.log('─'.repeat(80))

const rows = SCENES.map((s) => {
  const xs = results[s.id]
  const tasks = xs.map((r) => r.task)
  return {
    ...s,
    task: median(tasks),
    script: median(xs.map((r) => r.script)),
    min: Math.min(...tasks),
    max: Math.max(...tasks),
    dom: xs[0].dom
  }
})

for (const r of rows) {
  console.log(
    `${r.label.padEnd(30)} ${String(r.dom?.visibleArcPaths ?? 0).padStart(5)}  ` +
      `${r.task.toFixed(1).padStart(9)}%   ${`${r.min.toFixed(1)}~${r.max.toFixed(1)}%`.padEnd(14)} ` +
      `${r.script.toFixed(1).padStart(5)}%`
  )
}

const idle = rows.find((r) => r.id === 'idle')
const full = rows.find((r) => r.id === 'orbit')
const noArc = rows.find((r) => r.id === 'orbit-noarc')

console.log('\n拆解：')
console.log(`  idle → orbit 总计          +${(full.task - idle.task).toFixed(1)} pp`)
console.log(`  其中「旋转身体」贡献        +${(noArc.task - idle.task).toFixed(1)} pp（隐藏弧后仍存在）`)
console.log(`  其中「6 条弧」贡献          +${(full.task - noArc.task).toFixed(1)} pp`)

const overlapArc = full.min <= noArc.max && noArc.min <= full.max
console.log('')
if (overlapArc) {
  console.log('  ⚠️ 「有弧」与「隐藏弧」区间重叠 → 弧的贡献分不出来。')
  console.log('     那么 orbit 贵的原因是**身体每帧旋转**（路径完全不同，光栅化面积大），')
  console.log('     继续砍弧数不会有用。')
} else {
  console.log('  两者区间不重叠 → 弧确实是 orbit 变贵的主要原因。')
}

await browser.close()

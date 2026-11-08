/**
 * 优化候选实测 —— 严格版：交错重复采样，取中位数。
 *
 * ── 为什么必须有这个脚本 ────────────────────────────────────────────
 * 第一版每个候选只量一次 3 秒窗口，结果两次运行完全相反：
 *   第一次：基线 22.0%，contain:layout paint 17.9%（「省 19%」）
 *   第二次：基线 16.9%，contain:layout paint 21.0%（「反而更贵」）
 * 也就是说**单次采样的噪声（±5pp）比要测的差异（~4pp）还大**。
 * 拿这种数字做决策等于掷骰子。
 *
 * ── 怎么修 ──────────────────────────────────────────────────────────
 *   1. **交错（interleaved）**：每轮把全部候选各量一次，而不是量完 A 再量 B。
 *      这样机器状态的缓慢漂移（后台进程、温度）会平均分给所有候选，
 *      不会系统性偏向某一个。
 *   2. **重复取中位数**：默认 5 轮，取中位数。中位数比均值抗离群。
 *   3. **同时报范围**：给出 min~max。范围重叠的差异一律判「无结论」。
 *
 * ── 判读规则（写在输出里，避免下次又拿噪声当结论）────────────────────
 *   两个候选的 min~max 区间**重叠** → 分不出高下，不许说谁更好。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-optimize.mjs                 # 45 帧，5 轮
 *   node tools/probe-optimize.mjs --fps 60 --rounds 7
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const fpsArg = argOf('--fps', 45)
const ROUNDS = argOf('--rounds', 5)

/** 候选清单。`css` 为 null 表示基线。 */
const CANDIDATES = [
  { label: 'A 基线', css: null },
  { label: 'B contain:layout paint', css: '.davf-cell{contain:layout paint}' },
  { label: 'C contain:strict', css: '.davf-cell{contain:strict}' },
  { label: 'D will-change:transform', css: '.davf-cell svg{will-change:transform}' },
  { label: 'E content-visibility:auto', css: '.davf-cell{content-visibility:auto}' },
  {
    label: 'F B+D 叠加',
    css: '.davf-cell{contain:layout paint}.davf-cell svg{will-change:transform}'
  }
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

/** 量一个候选，返回一次采样。每次开新页，避免互相污染。 */
async function once(cand, cells) {
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
  await tab.goto(PAGE)
  await tab.waitForTimeout(700)
  await fillTo(tab, cells)
  if (cand.css) {
    await tab.addStyleTag({ content: cand.css })
    await tab.waitForTimeout(300)
  }
  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1200) // 预热丢弃
  const r = await sample(cdp, 2500)
  await tab.close()
  return r.task
}

const CELLS = 9
/** results[label] = number[] */
const results = Object.fromEntries(CANDIDATES.map((c) => [c.label, []]))

for (let round = 0; round < ROUNDS; round++) {
  for (const cand of CANDIDATES) {
    results[cand.label].push(await once(cand, CELLS))
  }
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const stats = CANDIDATES.map((c) => {
  const xs = results[c.label]
  return { label: c.label, med: median(xs), min: Math.min(...xs), max: Math.max(...xs), xs }
})

const base = stats[0]
console.log(`${CELLS} 格异构 · ${fpsArg} 帧档 · ${ROUNDS} 轮交错采样 · 每轮 2.5 秒\n`)
console.log('候选                        中位数   最小   最大    相对基线（中位数）')
console.log('─'.repeat(76))
for (const s of stats) {
  const d = s.med - base.med
  const rel = s === base ? '—' : `${d > 0 ? '+' : ''}${d.toFixed(1)} pp`
  console.log(
    `${s.label.padEnd(26)} ${s.med.toFixed(1).padStart(5)}% ${s.min.toFixed(1).padStart(5)}% ` +
      `${s.max.toFixed(1).padStart(5)}%   ${rel.padStart(8)}`
  )
}

/**
 * 判读：区间重叠 = 无结论。
 *
 * 这是本脚本最重要的输出。没有它，下一个人会像第一版那样拿单次采样
 * 的 4pp 差异当「省了 19%」。
 */
console.log('\n判读（区间重叠即无结论）：')
let anyWinner = false
for (const s of stats.slice(1)) {
  const overlap = s.min <= base.max && base.min <= s.max
  if (overlap) {
    console.log(`  ${s.label.padEnd(26)} 与基线区间重叠 → 分不出高下`)
  } else if (s.med < base.med) {
    console.log(`  ${s.label.padEnd(26)} 稳定优于基线 ${(base.med - s.med).toFixed(1)} pp`)
    anyWinner = true
  } else {
    console.log(`  ${s.label.padEnd(26)} 稳定劣于基线 ${(s.med - base.med).toFixed(1)} pp`)
  }
}
if (!anyWinner) {
  console.log('\n结论：这批 CSS 候选没有一个是稳定有效的。')
  console.log('      说明瓶颈不在合成/重绘隔离 —— 别再加这类样式。')
}

await browser.close()

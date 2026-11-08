/**
 * 主线程占用探针：量「面板开着到底占多少 CPU」。
 *
 * 为什么需要它：README 里那张「主线程占用」表之前是**一次性探针**测的，
 * 脚本没留下 —— 数据真实但无法复现，等于不可验证的断言。这个脚本把那次测量固化下来。
 *
 * 量的是 CDP `Performance` 指标：
 *   - `TaskDuration`  主线程忙碌总时长（含脚本、布局、样式、绘制）
 *   - `ScriptDuration` 其中纯 JS 执行
 *
 * 注意基线：面板现在是右栏的一个 tab，没有「关掉」这个动作了 ——
 * 卸载就等于切走 tab。所以基线改成「容器在、但面板不渲染」：
 * 用 CSS 把面板隐藏（`display:none`），rAF 循环随之停下，
 * 量到的就是「右栏里有这个 tab 但不看它」的开销。
 *
 * ── 为什么默认跑 3 轮并报区间，而不是单次 ──────────────────────────
 * **单次 3 秒采样的波动可达 ±5 个百分点。** 实测过同一个脚本连跑两次，
 * 9 格基线从 22.0% 变成 16.9%，据此得出的「某个优化省了 19%」完全是假的。
 *
 * 所以这里改成：每轮把全部场景各量一次（**交错**，让机器漂移平均分给所有
 * 场景），跑 N 轮后取中位数并报 min~max。**区间重叠的场景分不出高下。**
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-cpu.mjs                    # 默认 1 / 4 / 9 格 + 隐藏基线，3 轮
 *   node tools/probe-cpu.mjs --fps 45           # 指定帧率档位
 *   node tools/probe-cpu.mjs --rounds 5         # 更多轮次，区间更可靠
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const fpsArg = argOf('--fps', 60)
const ROUNDS = argOf('--rounds', 3)

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

/** 展开所有工作区并勾到 target 格（含当前窗口那 1 个）。 */
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

/** 取一次 Performance 指标快照。 */
const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return { task: pick('TaskDuration'), script: pick('ScriptDuration') }
}

/** 在 ms 窗口内采样，返回主线程占用百分比。 */
async function sample(cdp, ms) {
  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, ms))
  const b = await snap(cdp)
  const win = ms / 1000
  return {
    task: ((b.task - a.task) / win) * 100,
    script: ((b.script - a.script) / win) * 100,
    win
  }
}

async function measure(cells, closed) {
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
  await tab.goto(pathToFileURL(target).href)
  await tab.waitForTimeout(700)
  if (closed) {
    // 基线：面板不渲染。用 display:none 而不是卸载 React —— 卸载会连
    // ResizeObserver 一起停，量到的就不是「tab 在但不看」的真实开销。
    await tab.evaluate(() => {
      const el = document.querySelector('.davf-panel')
      if (el) el.style.display = 'none'
    })
    await tab.waitForTimeout(400)
  } else {
    await fillTo(tab, cells)
  }
  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000) // 预热，丢弃
  const r = await sample(cdp, 3000)
  const n = await tab.locator('.davf-cell').count()
  await tab.close()
  return { cells: n, ...r }
}

console.log(`主线程占用（CDP Performance，${ROUNDS} 轮交错，取中位数，帧率档位 ${fpsArg}）\n`)

const SCENES = [
  { label: '面板隐藏', cells: 0, closed: true },
  { label: '1 格', cells: 1, closed: false },
  { label: '4 格', cells: 4, closed: false },
  { label: '9 格', cells: 9, closed: false }
]

/** results[label] = [{task,script,cells}] */
const results = Object.fromEntries(SCENES.map((s) => [s.label, []]))

for (let round = 0; round < ROUNDS; round++) {
  for (const s of SCENES) {
    results[s.label].push(await measure(s.cells, s.closed))
  }
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const rows = SCENES.map((s) => {
  const xs = results[s.label]
  const tasks = xs.map((r) => r.task)
  return {
    label: s.label,
    cells: xs[0].cells,
    task: median(tasks),
    script: median(xs.map((r) => r.script)),
    min: Math.min(...tasks),
    max: Math.max(...tasks)
  }
})

console.log('场景        格数   主线程(中位)    范围            其中脚本')
console.log('─'.repeat(66))
for (const r of rows) {
  console.log(
    `${r.label.padEnd(10)}  ${String(r.cells).padStart(2)}   ` +
      `${r.task.toFixed(1).padStart(8)}%   ` +
      `${r.min.toFixed(1)}~${r.max.toFixed(1)}%`.padEnd(14) +
      `   ${r.script.toFixed(1).padStart(5)}%`
  )
}

const base = rows[0]
console.log('')
for (const r of rows.slice(1)) {
  console.log(`  ${r.label}：相对关闭状态多占 ${(r.task - base.task).toFixed(1)} 个百分点`)
}

/**
 * 区间重叠提醒。
 *
 * 这是本脚本最重要的输出 —— 没有它，下一个人会拿两个重叠的区间当
 * 「A 比 B 省」。基线自身的波动（±5pp）通常比 1 格与 4 格之间的差异还大。
 */
console.log('\n判读提示：')
for (const r of rows.slice(1)) {
  const overlap = r.min <= base.max && base.min <= r.max
  if (overlap) {
    console.log(`  ${r.label} 与基线区间重叠 —— 这个格数下的差异分不出来，别当结论`)
  }
}
console.log('  单次采样波动可达 ±5pp，比较不同版本请用 --rounds 5 以上，并看区间是否重叠。')

await browser.close()

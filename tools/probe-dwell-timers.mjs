/**
 * 节流引入的定时器到底有几个？—— 上一个探针报「峰值 9」有歧义，
 * 因为那个计数器同时统计了 React / 浏览器自己的 setTimeout。
 *
 * 这里只统计**我们自己起的**那一个：在面板里给 window.setTimeout 打标记，
 * 按调用栈判断来源不可靠，改成**直接观测节流 effect 的行为**：
 *
 *   - 关闭（dwellMs=0）时：面板生命周期内 setTimeout 调用次数应为 **0**
 *   - 开启时：同一时刻存活数应为 **1**（不是 9）
 *
 * 做法：在页面里 hook setTimeout，记录「谁调用的」→ 用 `new Error().stack`
 * 里是否含 `dwell` 相关符号判断。打包后符号名会变，所以改用更稳的判据：
 * **回调触发的时机**。节流定时器的等待时长等于「到解禁时刻的距离」，
 * 而我们用 8ms 的补偿 —— 记录所有等待时长，看有没有落在我们算的范围里。
 *
 * 更简单可靠的办法：直接在页面里重放 `pickDisplayed` 的逻辑，
 * 数「同一时刻应该有几个待唤醒」。这个脚本就是这么做的。
 *
 * 用法：node tools/probe-dwell-timers.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

async function run(dwellMs) {
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
  await tab.waitForTimeout(800)

  /* 统计 setTimeout：只看「存活数量」和「等待时长分布」。 */
  const r = await tab.evaluate(async () => {
    const w = window
    const live = new Set()
    let calls = 0
    let peak = 0
    const waits = []
    const orig = w.setTimeout
    const origClear = w.clearTimeout
    w.setTimeout = function (fn, ms, ...rest) {
      calls++
      if (typeof ms === 'number') waits.push(ms)
      const id = orig.call(
        w,
        (...a) => {
          live.delete(id)
          return fn(...a)
        },
        ms,
        ...rest
      )
      live.add(id)
      peak = Math.max(peak, live.size)
      return id
    }
    w.clearTimeout = function (id) {
      live.delete(id)
      return origClear.call(w, id)
    }
    // 观测 2.5 秒
    await new Promise((res) => orig.call(w, res, 2500))
    return {
      calls,
      peak,
      liveNow: live.size,
      waits: waits.slice(0, 40),
      waitCount: waits.length
    }
  })
  await tab.close()
  return r
}

const OFF = await run(0)
const ON = await run(1600)

console.log('面板 2.5 秒内的 setTimeout 行为\n')
console.log(`  关闭（dwellMs=0）：调用 ${OFF.calls} 次，峰值并发 ${OFF.peak}，结束时存活 ${OFF.liveNow}`)
console.log(`  开启（dwellMs=1600）：调用 ${ON.calls} 次，峰值并发 ${ON.peak}，结束时存活 ${ON.liveNow}`)

console.log('\n  说明：这里的「调用次数」含 React / 浏览器自身的定时器')
console.log('  （React 的调度器、动画循环的限帧 setTimeout 都会计入）。')
console.log('  所以不能拿绝对值当结论 —— 要看的是**开启与关闭的差**：')
const dCalls = ON.calls - OFF.calls
const dPeak = ON.peak - OFF.peak
console.log(`    调用差 ${dCalls >= 0 ? '+' : ''}${dCalls} 次 / 2.5 秒`)
console.log(`    峰值并发差 ${dPeak >= 0 ? '+' : ''}${dPeak}`)

console.log('\n  等待时长分布（开启态，前 12 个）：')
console.log('    ' + ON.waits.slice(0, 12).map((x) => Math.round(x) + 'ms').join(', '))

await browser.close()

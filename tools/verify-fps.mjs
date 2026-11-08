/**
 * 帧率验证：45 / 60 两档真的改变了重画频率。
 *
 * ── 这一版测什么 ────────────────────────────────────────────────────
 * 帧率控件已经搬到设置页（见 `verify-settings.mjs` 验它「在不在、存不存」），
 * 这里只验**它真的生效**：改档位 → 重画频率跟着变。
 *
 * 为什么还要单独一份：设置页的测试只能验「值存进去了」，验不了
 * 「这个值真的传到了 rAF 循环」。这两件事之间隔着一层 store → props →
 * effect 的传递，断在任何一处，设置页测试都是绿的。
 *
 * 做法：先打开设置页改档位（写 localStorage），再打开面板页读同一个
 * localStorage —— 两个页面同源，配置共享。这比在面板页里造一个假
 * 设置页更接近真实：真实用户就是这么操作的。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-panel.mjs && node tools/build-settings.mjs
 *   node tools/verify-fps.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PANEL = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href
const SETTINGS = pathToFileURL(resolve(ROOT, 'preview', 'settings.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const tab = await ctx.newPage()
/**
 * 只清一次配置，**不能每次导航都清**。
 *
 * `addInitScript` 在每一次页面加载时都会执行 —— 本测试的核心手法正是
 * 「在设置页写配置、导航到面板页读它」，每次导航都清空就把要传的东西
 * 抹掉了，表现为「45 档量出 60 次/秒」这种假失败（第一版就栽在这里）。
 *
 * 用一个 sessionStorage 标记做成一次性的：sessionStorage 在同一次
 * 浏览器会话内跨导航保留。
 */
await tab.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('fps-test-cleared')) {
      localStorage.clear()
      sessionStorage.setItem('fps-test-cleared', '1')
    }
  } catch {}
})

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/** 在设置页把帧率改成 hz，然后回到面板页。 */
async function setFpsViaSettings(hz) {
  await tab.goto(SETTINGS)
  await tab.waitForTimeout(400)
  await tab.locator('.davs-section', { hasText: '帧率' }).locator('.davs-chip', { hasText: new RegExp(`^${hz}$`) }).click()
  await tab.waitForTimeout(250)
  const saved = await tab.evaluate(() => {
    const raw = localStorage.getItem('dsh-agents-bot:ui')
    return raw ? JSON.parse(raw).fps : null
  })
  await tab.goto(PANEL)
  await tab.waitForTimeout(600)
  return saved
}

/**
 * 数实际重画次数。
 *
 * 做法：每帧比一次身体路径的 `d` 字符串，变了就记一帧。
 * 为什么不用 MutationObserver：它需要去抖（一帧内可能有多条变更），
 * 而「用 rAF 去抖」在高频时会漏掉一半 —— 首版就栽在这里，
 * 90 档和 120 档都数出 71 次/秒，那是测量的天花板不是真实值。
 */
async function countRedraws(ms) {
  return tab.evaluate(async (ms) => {
    const svg = document.querySelector('.davf-cell svg')
    const bodyPath = svg?.querySelector('path[fill]')
    if (!bodyPath) return 0
    let prev = bodyPath.getAttribute('d')
    let frames = 0
    const t0 = performance.now()
    await new Promise((done) => {
      const tick = () => {
        const cur = bodyPath.getAttribute('d')
        if (cur !== prev) {
          frames++
          prev = cur
        }
        if (performance.now() - t0 < ms) requestAnimationFrame(tick)
        else done()
      }
      requestAnimationFrame(tick)
    })
    return frames
  }, ms)
}

console.log('帧率真的生效（设置页改 → 面板跟着变）')

const measured = {}
for (const hz of [45, 60]) {
  const saved = await setFpsViaSettings(hz)
  if (saved !== hz) bad(`${hz} 档没写进 localStorage（存的是 ${saved}）`)
  else ok(`${hz} 档已写入配置`)

  // 预热 300ms 再数 1.5 秒
  await countRedraws(300)
  const n = await countRedraws(1500)
  measured[hz] = n / 1.5
  console.log(`  ${hz} 档：实测 ${measured[hz].toFixed(1)} 次重画/秒`)
  if (Math.abs(measured[hz] - hz) <= 4) ok(`${hz} 档精确命中 ${measured[hz].toFixed(1)} 次/秒`)
  else bad(`${hz} 档偏离目标：${measured[hz].toFixed(1)} 次/秒（应为 ${hz}）`)
}

if (measured[45] < measured[60] * 0.9) {
  ok(`45 档确实低于 60 档：${measured[45].toFixed(1)} vs ${measured[60].toFixed(1)}`)
} else {
  bad(`45 与 60 没有拉开：${measured[45].toFixed(1)} vs ${measured[60].toFixed(1)}`)
}

/* ── 帧率是整窗通用，不按 agent 分 ─────────────────────────────── */

console.log('\n帧率只存一份（不按 agent 分）')

await tab.goto(SETTINGS)
await tab.waitForTimeout(400)
await tab.locator('.davs-section', { hasText: '帧率' }).locator('.davs-chip', { hasText: /^60$/ }).click()
await tab.waitForTimeout(250)
await tab.goto(PANEL)
await tab.waitForTimeout(600)

// 加到 2 格，确认两格同频
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
const pickRows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
if ((await pickRows.count()) > 0) {
  await pickRows.nth(0).click()
  await tab.waitForTimeout(200)
}
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(500)

const perCell = await tab.evaluate(async () => {
  const cells = Array.from(document.querySelectorAll('.davf-cell'))
  const paths = cells.map((c) => c.querySelector('svg path[fill]')).filter(Boolean)
  const prevs = paths.map((p) => p.getAttribute('d'))
  const counts = paths.map(() => 0)
  const t0 = performance.now()
  await new Promise((done) => {
    const tick = () => {
      paths.forEach((p, i) => {
        const cur = p.getAttribute('d')
        if (cur !== prevs[i]) {
          counts[i]++
          prevs[i] = cur
        }
      })
      if (performance.now() - t0 < 1500) requestAnimationFrame(tick)
      else done()
    }
    requestAnimationFrame(tick)
  })
  return counts
})
const spread = perCell.length ? Math.max(...perCell) - Math.min(...perCell) : 0
if (perCell.length >= 2 && spread <= 4) ok(`所有格子同频重画（各格次数 ${JSON.stringify(perCell)}）`)
else bad(`格子之间帧率不一致：${JSON.stringify(perCell)}`)

// 落盘里不能出现按 agent 的帧率
const shape = await tab.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  const v = raw ? JSON.parse(raw) : {}
  return {
    topFps: typeof v.fps === 'number' ? v.fps : null,
    looksHasFps: Object.values(v.looks ?? {}).some((l) => l && 'fps' in l)
  }
})
if (shape.topFps !== null && !shape.looksHasFps) {
  ok(`帧率只存一份（顶层 fps=${shape.topFps}，looks 里没有 fps 字段）`)
} else {
  bad('帧率被按 agent 存了：' + JSON.stringify(shape))
}

/* ── 切走 tab 后不该还在画 ───────────────────────────────────────── */

console.log('\n卸载后不再重画')
const unmounted = await tab.evaluate(() => {
  const fn = window.__setPanelMounted
  if (typeof fn !== 'function') return false
  fn(false)
  return true
})
if (!unmounted) bad('预览页没有卸载开关 —— 这条断言失效，先修 tools/panel.tsx')
else {
  await tab.waitForTimeout(400)
  const stillThere = await tab.locator('.davf-panel').count()
  if (stillThere === 0) ok('面板已卸载（DOM 里没有了）')
  else bad(`卸载开关没生效：还有 ${stillThere} 个面板`)
  const afterClose = await countRedraws(800)
  if (afterClose <= 1) ok(`卸载后重画 ${afterClose} 次（应为 0~1）`)
  else bad(`卸载后仍在重画：${afterClose} 次`)
}

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

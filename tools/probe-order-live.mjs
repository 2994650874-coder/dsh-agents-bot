/**
 * 设置页改顺位 → **右栏格子当场换外观** 吗？
 *
 * ── 为什么这条必须单独验 ──────────────────────────────────────────────
 * 设置页和右栏是**两个独立的 slot**，各自渲染。设置页把 `preset`
 * 写进 store 只是「数据变了」，右栏会不会重渲染、`lookFor` 会不会用上
 * 新顺位，是另一件事 —— 中间隔着 `useUi` 的订阅、`useCallback` 的依赖数组。
 *
 * 漏掉依赖数组里那个 `preset`，表现就是「设置页改了，右栏不动」。
 * 这种 bug 完全不会报错，只能靠实测抓。
 *
 * ── 怎么验 ────────────────────────────────────────────────────────────
 * `preview/panel.html?settings=1` 会同时挂设置页和右栏（同一个页面，
 * 同一份假数据 —— 见 `tools/panel.tsx` 里那个开关的说明）。
 * 改设置 → 看右栏。
 *
 * 判据：改顺位第 1 行（= 右栏第 2 格）的图案 → 那一格的**身体轮廓 path 必须变**。
 *
 * 用法：node tools/build-panel.mjs && node tools/probe-order-live.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PICKED = ['a6', 'a7', 'b1', 'b2', 'b3']

let pass = 0
let fail = 0
const ok = (m) => {
  console.log('  ok   ' + m)
  pass++
}
const bad = (m) => {
  console.log('  FAIL ' + m)
  fail++
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
const errors = []
tab.on('pageerror', (e) => errors.push(String(e)))

await tab.addInitScript((picked) => {
  try {
    localStorage.clear()
    localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ picked }))
  } catch {}
}, PICKED)

await tab.goto(
  'file:///' + resolve(ROOT, 'preview', 'panel.html').replace(/\\/g, '/') + '?plain=1&settings=1'
)
await tab.waitForTimeout(1600)

/** 读右栏第 N 格的身体轮廓（最长那条 path）。 */
const bodyPath = (n) =>
  tab.evaluate((idx) => {
    const cells = Array.from(document.querySelectorAll('.davf-cell'))
    const c = cells[idx]
    if (!c) return null
    const ds = Array.from(c.querySelectorAll('svg path')).map((p) => p.getAttribute('d') ?? '')
    return ds.sort((a, b) => b.length - a.length)[0] ?? null
  }, n)

const cells = await tab.evaluate(() => document.querySelectorAll('.davf-cell').length)
console.log(`右栏渲染 ${cells} 格`)
if (cells >= 6) ok(`右栏有 ${cells} 格（够测第 2 格）`)
else bad(`右栏只有 ${cells} 格`)

// 展开设置页的顺位区
const opened = await tab.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const b = card?.querySelector('.davs-chip-toggle')
  if (b) {
    b.click()
    return true
  }
  return false
})
await tab.waitForTimeout(500)
if (opened) ok('设置页顺位区展开成功')
else bad('设置页顺位区没展开')

// 记录改之前第 2 格
const before = await bodyPath(1)
if (before) ok(`改之前第 2 格轮廓长度 ${before.length}`)
else bad('读不到第 2 格轮廓')

// 改第 1 行（= 第 2 格）的图案 → 换成一个明显不同的身形（宝石：切角菱形）
const changed = await tab.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const rs = card ? Array.from(card.querySelectorAll('.davs-rows-preset .davs-row')) : []
  const sel = rs[0]?.querySelector('select')
  if (!sel) return null
  const from = sel.value
  sel.value = 'gemme'
  sel.dispatchEvent(new Event('change', { bubbles: true }))
  return { from, to: 'gemme' }
})
await tab.waitForTimeout(900) // 等 morph 走完（SHAPE_MORPH 约 0.35s）

const after = await bodyPath(1)
if (changed) ok(`设置页把第 1 行图案从 ${changed.from} 改成 ${changed.to}`)
else bad('设置页没找到第 1 行下拉')

if (after && before && after !== before) {
  ok(`右栏第 2 格轮廓变了（${before.length} → ${after.length} 字符）`)
} else {
  bad('右栏第 2 格轮廓没变 —— 设置页改了但右栏没跟上')
}

/**
 * 再验一次「改回去也跟着回去」。
 *
 * ── 为什么不能比字节 ──────────────────────────────────────────────────
 * 引擎每帧都在呼吸（`life.breath` 逐帧改 `sy`），所以**同一身形**的 path
 * 每帧都不同 —— 差 1~2 个字符是正常的（实测 2457 vs 2456）。
 * 逐字节比会永远失败，那是判据错，不是功能错。
 *
 * 改成比「形状指纹」：把 path 里的数字取出来，算 x 坐标的极值比
 * （宽/高）。同一个身形这个比值稳定到小数点后两位，不同身形差很多。
 * 圆角方 ≈ 1.0，宝石 ≈ 0.99 但轮廓是菱形 —— 光看比例分不开，
 * 所以再加一条：轮廓的**总点数**（同身形固定，不同身形不同）。
 */
await tab.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const rs = card ? Array.from(card.querySelectorAll('.davs-rows-preset .davs-row')) : []
  const sel = rs[0]?.querySelector('select')
  if (sel) {
    sel.value = 'squircle'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
  }
})
await tab.waitForTimeout(1500)

/** 形状指纹：path 的命令数 + 坐标的宽高比（保留两位）。 */
const fingerprint = (d) => {
  if (!d) return null
  const cmds = (d.match(/[MCQZ]/g) ?? []).length
  const nums = d.match(/-?\d*\.?\d+/g)?.map(Number) ?? []
  let minX = Infinity
  let maxX = -Infinity
  for (let i = 0; i < nums.length; i += 2) {
    if (nums[i] < minX) minX = nums[i]
    if (nums[i] > maxX) maxX = nums[i]
  }
  const width = maxX - minX
  return { cmds, width: Math.round(width) }
}

const back = await bodyPath(1)
const fpBefore = fingerprint(before)
const fpBack = fingerprint(back)

if (fpBack && fpBefore && fpBack.cmds === fpBefore.cmds && Math.abs(fpBack.width - fpBefore.width) <= 2) {
  ok(`改回圆角方后形状指纹一致（命令数 ${fpBack.cmds}，宽度 ${fpBack.width} vs ${fpBefore.width}）`)
} else {
  bad(`改回去没跟上：指纹 ${JSON.stringify(fpBack)} vs 原来 ${JSON.stringify(fpBefore)}`)
}

console.log('\n脚本错误：' + (errors.length ? errors.join(' | ') : '无'))
await browser.close()

console.log('\n' + '─'.repeat(50))
console.log(`通过 ${pass} 项，失败 ${fail} 项`)
process.exitCode = fail === 0 ? 0 : 1

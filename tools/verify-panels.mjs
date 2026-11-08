/**
 * 面板互斥 + 按 agent 单独外观 的验证。
 *
 * 对应本轮需求第 2、4 条：
 *   2. 监视 / 外观必须互斥 —— 点哪个就切到哪个，不能「点外观盖不住监视」
 *   4. 多格时每格顶部有「改它」胶囊，点哪个改哪个，改完互不影响
 *
 * 用法（在 grokbot 目录下）：node tools/verify-panels.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(target).href)
await tab.waitForTimeout(800)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

const pickerOpen = async () => (await tab.locator('.davf-picker:not(.davf-custbox)').count()) > 0
const custOpen = async () => (await tab.locator('.davf-custbox').count()) > 0

/* ── 第 2 条：互斥 ───────────────────────────────────────────────── */

console.log('第 2 条：面板互斥')
if (!(await pickerOpen()) && !(await custOpen())) ok('初始两个面板都关着')
else bad('初始状态不对')

await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
if ((await pickerOpen()) && !(await custOpen())) ok('点「监视」→ 只有监视开着')
else bad('点监视后状态不对')

// 关键：监视开着时点外观，必须切过去
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(350)
if ((await custOpen()) && !(await pickerOpen())) ok('监视开着时点「外观」→ 切到外观（监视自动关）')
else bad(`点外观没切过去：监视=${await pickerOpen()} 外观=${await custOpen()}`)

// 反向也要成立
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
if ((await pickerOpen()) && !(await custOpen())) ok('外观开着时点「监视」→ 切回监视')
else bad(`点监视没切回去：监视=${await pickerOpen()} 外观=${await custOpen()}`)

// 再点一次同一个按钮应该关掉
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
if (!(await pickerOpen()) && !(await custOpen())) ok('再点同一个按钮 → 收起')
else bad('再点没收起')

/* ── 第 4 条：按 agent 单独外观 ─────────────────────────────────── */

console.log('\n第 4 条：按 agent 单独外观')
// 先加到 3 格
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
const heads = tab.locator('.davf-ws-head')
const hn = await heads.count()
for (let i = 0; i < hn; i++) {
  const h = heads.nth(i)
  if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
    await h.click()
    await tab.waitForTimeout(150)
  }
}
const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
await rows.nth(0).click()
await tab.waitForTimeout(250)
await rows.nth(1).click()
await tab.waitForTimeout(350)
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)

const cells = await tab.locator('.davf-cell').count()
if (cells === 3) ok(`已加到 ${cells} 格`)
else bad(`格数不对：${cells}`)

// 开外观面板
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(450)

// 每格顶部都该有「改它」
const tags = await tab.locator('.davf-cell-tag').count()
if (tags === cells) ok(`每格顶部都有「改它」胶囊（${tags} 个）`)
else bad(`胶囊数量不对：${tags} / ${cells}`)

// 标题初始应为全局
let headText = await tab.locator('.davf-custbox .davf-picker-head').innerText()
if (headText.includes('全局')) ok('初始标题是「外观 · 全局」')
else bad('初始标题不对：' + headText.replace(/\n/g, ' '))

// 点第 2 格的胶囊 → 标题应切到那个 agent
await tab.locator('.davf-cell-tag').nth(1).click()
await tab.waitForTimeout(350)
headText = await tab.locator('.davf-custbox .davf-picker-head').innerText()
if (!headText.includes('全局')) ok('点第 2 格胶囊后标题切到该 agent：' + headText.split('\n')[0])
else bad('标题没切过去：' + headText.replace(/\n/g, ' '))

const onTag = await tab.locator('.davf-cell-tag.is-on').count()
if (onTag === 1) ok('只有被选中的那格胶囊高亮')
else bad(`高亮胶囊数量不对：${onTag}`)

// 改配色（选红色）→ 只有那一格变，其他两格不变。
// 注意：墨色是画在 mask 里的 <rect fill>，不是 path —— 别按 path 取。
const readInk = () =>
  tab.evaluate(() => {
    const out = []
    document.querySelectorAll('.davf-cell').forEach((c) => {
      const rect = c.querySelector('svg mask ~ g rect, svg rect[fill]')
      out.push(rect ? rect.getAttribute('fill') : null)
    })
    return out
  })
const colorBefore = await readInk()
// 配色按钮：第 3 个是红
await tab.locator('.davf-color').nth(2).click()
await tab.waitForTimeout(600)
const colorAfter = await readInk()
const changed = colorAfter.filter((c, i) => c !== colorBefore[i]).length
if (changed === 1) ok(`改配色只影响选中的那一个 agent（${colorBefore.find((c, i) => c !== colorAfter[i])} → ${colorAfter.find((c, i) => c !== colorBefore[i])}）`)
else bad(`改配色影响了 ${changed} 格（应该只 1 格）：${JSON.stringify(colorBefore)} → ${JSON.stringify(colorAfter)}`)

// 「自定」标记应出现在那一格
const ownMark = await tab.locator('.davf-cell-own').count()
if (ownMark === 1) ok('该格出现「·自定」标记')
else bad(`「·自定」标记数量不对：${ownMark}`)

// 落盘里应该有 looks 记录
const saved = await tab.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  return raw ? JSON.parse(raw) : null
})
if (saved && saved.looks && Object.keys(saved.looks).length === 1) {
  ok('单独外观已落盘（looks 有 1 条）')
} else {
  bad('单独外观没落盘：' + JSON.stringify(saved?.looks))
}

// 点「恢复顺位」→ 标记消失、回到顺位预设
const resetBtn = tab.locator('.davf-custbox .davf-cap-quiet')
if ((await resetBtn.count()) > 0) {
  await resetBtn.click()
  await tab.waitForTimeout(450)
  const ownAfter = await tab.locator('.davf-cell-own').count()
  if (ownAfter === 0) ok('「恢复顺位」清掉了单独设置')
  else bad(`恢复后仍有 ${ownAfter} 个自定标记`)
} else {
  bad('没有「恢复顺位」按钮')
}

// 点已选中的胶囊应该取消选中，回到全局。
// 注意：前面「恢复顺位」之后 editTarget 已重置，所以这里从头选一次。
await tab.locator('.davf-cell-tag').nth(0).click()
await tab.waitForTimeout(400)
headText = await tab.locator('.davf-custbox .davf-picker-head').innerText()
if (!headText.includes('全局')) ok('重新选中第 1 格：' + headText.split('\n')[0])
else bad('重新选中失败')

await tab.locator('.davf-cell-tag').nth(0).click()
await tab.waitForTimeout(400)
headText = await tab.locator('.davf-custbox .davf-picker-head').innerText()
if (headText.includes('全局')) ok('再点同一枚胶囊 → 回到全局')
else bad('再点胶囊没回到全局：' + headText.split('\n')[0])

/* ── 第 3 条：两个面板都在上方 ─────────────────────────────────── */

console.log('\n第 3 条：面板位置')
const pickerTop = await tab.evaluate(() => {
  const grid = document.querySelector('.davf-grid')
  return grid ? Math.round(grid.getBoundingClientRect().top) : null
})
// 外观开着时，grid 的 top 应该 > 外观框的 top（即外观在上、格子在下）
const custBox = await tab.locator('.davf-custbox').boundingBox()
const gridBox = await tab.locator('.davf-grid').boundingBox()
if (custBox && gridBox && custBox.y < gridBox.y) {
  ok(`外观框在格子上方（外观 y=${Math.round(custBox.y)} < 格子 y=${Math.round(gridBox.y)}）`)
} else {
  bad('外观框不在格子上方')
}

// 两个面板的动画都应该是「从上滑下」
const anims = await tab.evaluate(() => {
  const pick = document.querySelector('.davf-picker:not(.davf-custbox)')
  const cust = document.querySelector('.davf-custbox')
  const read = (el) => (el ? el.getAnimations().map((a) => a.animationName ?? '(waapi)') : [])
  return { picker: read(pick), cust: read(cust) }
})
console.log('  外观面板动画:', JSON.stringify(anims.cust))

/* ── 第 1 条：PiP 按钮应该消失 ──────────────────────────────────── */

console.log('\n第 1 条：独立窗口已暂停')
const pipBtn = await tab.locator('.davf-pip-btn').count()
if (pipBtn === 0) ok('⧉ 独立窗口按钮已隐藏（路线暂停）')
else bad('⧉ 按钮还在，应该已隐藏')

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

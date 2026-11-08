/**
 * 设置页的「自动分配顺位」真的能改吗？—— 功能验证，不只是看截图。
 *
 * ── 判据（都是行为，不是「控件画出来了」）────────────────────────────
 * 1. 区块存在，位置在「动画映射」和「休眠」之间
 * 2. 展开后是 8 行数据，每行「第 N 格」+ **三个下拉**（图案 / 配色 / 表情）
 * 3. 每行最前面有一张缩略图（画的是这一行的真实组合）
 * 4. 改某行 → 存储里成套变了 → **右栏那格当场换**（跨 slot，见 probe-order-live）
 * 5. 「恢复默认」能把它改回去
 *
 * ── 2026-10-31：两个下拉变三个 ──────────────────────────────────────
 * 用户要求「自动分配顺位需要增加颜色的可选槽」。下拉顺序固定为
 * [图案, 配色, 表情]，所以断言按下标取，不按文字找。
 *
 * 用法：node tools/build-settings.mjs && node tools/probe-shape-order-ui.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

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
const ctx = await browser.newContext({ viewport: { width: 900, height: 1100 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
const errors = []
tab.on('pageerror', (e) => errors.push(String(e)))

await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto('file:///' + resolve(ROOT, 'preview', 'settings.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1000)

/* ── 1. 区块存在且在正确位置 ─────────────────────────────────────────── */
console.log('区块位置')
const order = await tab.evaluate(() => {
  const titles = Array.from(document.querySelectorAll('.davs-title')).map((t) =>
    (t.textContent || '').trim()
  )
  return titles
})
console.log('  设置页区块顺序：' + order.join(' / '))
const iAnim = order.indexOf('动画映射')
const iOrder = order.indexOf('自动分配顺位')
const iSleep = order.indexOf('休眠')
if (iOrder >= 0) ok('有「自动分配顺位」区块')
else bad('没有「自动分配顺位」区块')
if (iAnim >= 0 && iOrder === iAnim + 1) ok('它紧跟「动画映射」')
else bad(`它不在动画映射之后（动画映射=${iAnim}，顺位=${iOrder}）`)
if (iSleep > iOrder) ok('它在「休眠」之前')
else bad(`它不在休眠之前（顺位=${iOrder}，休眠=${iSleep}）`)

/* ── 2. 展开后 8 行、每行两个下拉 ───────────────────────────────────── */
console.log('\n展开后的行')
await tab.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const b = card?.querySelector('.davs-chip-toggle')
  b?.click()
})
await tab.waitForTimeout(400)

const rows = await tab.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const rs = card ? Array.from(card.querySelectorAll('.davs-rows-preset .davs-row')) : []
  // 最后一行可能是「＋」占位行（没有下拉），要分开
  const dataRows = rs.filter((r) => r.querySelectorAll('select').length > 0)
  return {
    count: dataRows.length,
    total: rs.length,
    labels: dataRows.map((r) => (r.querySelector('.davs-row-label')?.textContent || '').trim()),
    selectsPerRow: dataRows.map((r) => r.querySelectorAll('select').length),
    shapes: dataRows.map((r) => r.querySelectorAll('select')[0]?.value ?? ''),
    colors: dataRows.map((r) => r.querySelectorAll('select')[1]?.value ?? ''),
    exprs: dataRows.map((r) => r.querySelectorAll('select')[2]?.value ?? ''),
    thumbs: dataRows.filter((r) => r.querySelector('.davs-preset-thumb svg')).length,
    tryButtons: dataRows.filter((r) => r.querySelector('.davs-btn-try')).length,
    optionCounts: dataRows.map((r) => {
      const sels = r.querySelectorAll('select')
      return [sels[0]?.options.length ?? 0, sels[1]?.options.length ?? 0, sels[2]?.options.length ?? 0]
    })
  }
})

if (rows.count === 8) ok('展开后有 8 行数据（+ 第 1 格 = 9 格）')
else bad(`展开后有 ${rows.count} 行数据，应为 8`)

if (rows.labels.join(',') === '第 2 格,第 3 格,第 4 格,第 5 格,第 6 格,第 7 格,第 8 格,第 9 格')
  ok('行首标签从「第 2 格」连续到「第 9 格」')
else bad('行标签不对：' + rows.labels.join(','))

if (rows.selectsPerRow.every((n) => n === 3)) ok('每行 3 个下拉（图案 + 配色 + 表情）')
else bad('有的行不是 3 个下拉：' + [...new Set(rows.selectsPerRow)].join(','))

if (rows.optionCounts.every(([a, b, c]) => a === 15 && b === 12 && c === 16))
  ok('图案 15 项 / 配色 12 项 / 表情 16 项，每行一致')
else bad('下拉选项数不一致：' + JSON.stringify(rows.optionCounts))

if (rows.thumbs === rows.count) ok(`每行都有缩略图（${rows.thumbs} 张）`)
else bad(`只有 ${rows.thumbs}/${rows.count} 行有缩略图`)

if (rows.tryButtons === rows.count) ok(`每行都有「试播」（${rows.tryButtons} 枚）`)
else bad(`只有 ${rows.tryButtons}/${rows.count} 行有「试播」`)

console.log('  默认图案：' + rows.shapes.join(' → '))
console.log('  默认配色：' + rows.colors.join(' → '))
console.log('  默认表情：' + rows.exprs.join(' → '))

/* 配色默认值必须是 8 个不同的（用户要求「按配色面板顺序下去」） */
if (new Set(rows.colors).size === rows.colors.length)
  ok('默认配色 8 行互不相同')
else bad('默认配色有重复：' + rows.colors.join(','))

/* ── 3. 改第 1 行 → 存储成套变化 ────────────────────────────────────── */
console.log('\n改第 1 行')
const before = rows.shapes[0]
await tab.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const rs = card ? Array.from(card.querySelectorAll('.davs-rows-preset .davs-row')) : []
  const row = rs.find((r) => r.querySelectorAll('select').length > 0)
  const [shapeSel, colorSel, exprSel] = row.querySelectorAll('select')
  shapeSel.value = 'gemme'
  shapeSel.dispatchEvent(new Event('change', { bubbles: true }))
  colorSel.value = 'violet'
  colorSel.dispatchEvent(new Event('change', { bubbles: true }))
  exprSel.value = 'colere'
  exprSel.dispatchEvent(new Event('change', { bubbles: true }))
})
await tab.waitForTimeout(500)

const after = await tab.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  const v = raw ? JSON.parse(raw) : {}
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const rs = card ? Array.from(card.querySelectorAll('.davs-rows-preset .davs-row')) : []
  const dataRows = rs.filter((r) => r.querySelectorAll('select').length > 0)
  const sels = dataRows[0]?.querySelectorAll('select') ?? []
  return {
    stored: v.preset,
    uiShape: sels[0]?.value ?? '',
    uiColor: sels[1]?.value ?? '',
    uiExpr: sels[2]?.value ?? ''
  }
})

if (Array.isArray(after.stored) && after.stored[0]?.shape === 'gemme')
  ok(`存储里第 1 行图案变成 gemme（原来是 ${before}）`)
else bad('存储没变：' + JSON.stringify(after.stored?.[0]))

if (Array.isArray(after.stored) && after.stored[0]?.color === 'violet')
  ok('存储里第 1 行配色也变成 violet')
else bad('配色没存上：' + JSON.stringify(after.stored?.[0]))

if (Array.isArray(after.stored) && after.stored[0]?.expression === 'colere')
  ok('存储里第 1 行表情也变成 colere（成套）')
else bad('表情没存上：' + JSON.stringify(after.stored?.[0]))

if (after.uiShape === 'gemme' && after.uiColor === 'violet' && after.uiExpr === 'colere')
  ok('界面三个下拉都跟上了')
else bad(`界面没跟上：${after.uiShape}/${after.uiColor}/${after.uiExpr}`)

const storedAsTriple =
  after.stored &&
  typeof after.stored[0]?.shape === 'string' &&
  typeof after.stored[0]?.color === 'string' &&
  typeof after.stored[0]?.expression === 'string'
if (storedAsTriple) ok('存的是「图案 + 配色 + 表情」成套结构（不是平行数组）')
else bad('存储结构不对：' + JSON.stringify(after.stored?.[0]))

/* ── 4. 恢复默认（两段式确认）──────────────────────────────────────────
   2026-10-31 起「恢复默认」变成二级确认：第一次点击只是把按钮置为确认态
   （红框 + 文字换成「确认恢复顺位？」），**第二次点击才真的执行**。
   用户要求这个，因为按钮紧挨着收起胶囊，很容易点到。

   所以探针必须点两次。只点一次的话读到的是旧值 —— 这不是功能坏了。

   ── 2026-10-31 二次修正：按钮必须**限定在顺位卡片里** ────────────────
   动画映射那块也有一个同名的「恢复默认」（用户要求两块都加二级确认）。
   之前这里用 `document.querySelectorAll('.davs-btn')` 取第一个，抓到的是
   动画映射那一枚 —— 于是点两次恢复的是**轮播**，顺位一动不动，
   报「恢复失败」而配置其实没坏。这是选择器没限定作用域，不是功能问题。
*/
console.log('\n恢复默认（两段式）')

const PRESET_CARD = '.davs-card[data-block="preset"]'

const hasReset = await tab.evaluate((sel) => {
  const card = document.querySelector(sel)
  const b = [...(card?.querySelectorAll('.davs-card-tools .davs-btn') ?? [])].find(
    (x) => (x.textContent || '').trim() === '恢复默认'
  )
  if (b) {
    b.click()
    return true
  }
  return false
}, PRESET_CARD)
await tab.waitForTimeout(300)
if (hasReset) ok('顺位卡片有「恢复默认」按钮')
else bad('顺位卡片没有「恢复默认」按钮')

/* 第一次点击之后：必须进入确认态，而且**配置还没变**。 */
const armed = await tab.evaluate((sel) => {
  const card = document.querySelector(sel)
  const b = card?.querySelector('.davs-btn.is-armed')
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  const v = raw ? JSON.parse(raw) : {}
  return {
    text: b ? (b.textContent || '').trim() : null,
    shapes: (v.preset ?? []).map((r) => r.shape)
  }
}, PRESET_CARD)
if (armed.text !== null) ok('第一次点击进入确认态：' + armed.text)
else bad('第一次点击没有进入确认态（二级确认没生效）')
if (JSON.stringify(armed.shapes) !== JSON.stringify(rows.shapes)) {
  ok('第一次点击没有改动配置（确认态挡住了误触）')
} else {
  bad('第一次点击就把配置恢复了 —— 二级确认形同虚设')
}

/* 第二次点击才执行。 */
await tab.evaluate((sel) => {
  const card = document.querySelector(sel)
  const b = card?.querySelector('.davs-btn.is-armed')
  if (b) b.click()
}, PRESET_CARD)
await tab.waitForTimeout(400)
const restored = await tab.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  const v = raw ? JSON.parse(raw) : {}
  return v.preset
})

const restoredShapes = (restored ?? []).map((r) => r.shape)
if (JSON.stringify(restoredShapes) === JSON.stringify(rows.shapes)) ok('第二次点击后回到默认顺位')
else bad('恢复失败：' + JSON.stringify(restoredShapes))

console.log('\n脚本错误：' + (errors.length ? errors.join(' | ') : '无'))

await tab.screenshot({ path: resolve(ROOT, 'preview', 'settings-order.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'settings-order.png'))
await browser.close()

console.log('\n' + '─'.repeat(50))
console.log(`通过 ${pass} 项，失败 ${fail} 项`)
process.exitCode = fail === 0 ? 0 : 1

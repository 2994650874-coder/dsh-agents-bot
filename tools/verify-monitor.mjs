/**
 * 监视流程验证：勾选 → 格子自动增加 → 规格自动推进 → 移除 → 自动回退。
 *
 * 这是第 1 条需求的硬证据。截图只能证明「长得对」，这个能证明「逻辑对」。
 *
 * 用法（在 grokbot 目录下）：node tools/verify-monitor.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(target).href)
await tab.waitForTimeout(700)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/**
 * 实际网格布局（行×列）。
 *
 * 以前读标题栏上的 `.davf-spec` 文本，但那块显示已经移除了 —— 它只是当初
 * 验证格子逻辑用的，对用户没有信息量。现在直接量 CSS grid 的实际列数，
 * 这比读文本更硬：文本可能和布局不一致，列数是浏览器算出来的。
 *
 * **规格现在取决于容器朝向**，所以断言必须跟着朝向走：
 *   横容器（宽 > 高）：2→1×2，3~4→2×2
 *   竖容器（高 > 宽）：2→2×1，3→3×1，4→2×2
 * 预览页默认是 360×760 的竖右栏，所以这里期望的是竖排阶梯。
 */
const spec = async () => {
  const cols = await tab.evaluate(() => {
    const g = document.querySelector('.davf-grid')
    if (!g) return 0
    return getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length
  })
  const rows = await tab.evaluate(() => {
    const g = document.querySelector('.davf-grid')
    if (!g) return 0
    return getComputedStyle(g).gridTemplateRows.split(' ').filter(Boolean).length
  })
  return rows === 1 && cols === 1 ? '1' : `${rows}×${cols}`
}

/** 当前朝向（面板自己写在 data-orient 上，测的是它算出来的那个值）。 */
const orient = () =>
  tab.evaluate(() => {
    const g = document.querySelector('.davf-grid')
    return g ? g.getAttribute('data-orient') : null
  })

/** 按朝向给出某格数应有的规格 —— 期望值不写死，避免测试和实现各说各话。 */
const expectSpec = (n, o) =>
  o === 'portrait'
    ? n <= 1
      ? '1'
      : n <= 2
        ? '2×1'
        : n <= 3
          ? '3×1'
          : n <= 4
            ? '2×2'
            : n <= 6
              ? '3×2'
              : '3×3'
    : n <= 1
      ? '1'
      : n <= 2
        ? '1×2'
        : n <= 4
          ? '2×2'
          : n <= 6
            ? '2×3'
            : '3×3'

const cells = () => tab.locator('.davf-cell').count()

const O = await orient()
console.log(`容器朝向：${O}（预览页 360×760 的竖右栏）\n`)

/* 1. 初始：只有当前窗口，1 格 */
if ((await cells()) === 1) ok('初始 1 格（只监视当前窗口）')
else bad('初始格数不对：' + (await cells()))
if ((await spec()) === '1') ok('初始规格显示「1」')
else bad('初始规格不对：' + (await spec()))

/* 2. 打开选择器 */
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)
if ((await tab.locator('.davf-picker').count()) === 1) ok('选择器能打开')
else bad('选择器打不开')

/* 展开全部工作区 —— 默认只展开当前窗口所在的那个，
   跨工作区勾选前必须展开，否则可勾选行不够（这个测试要勾 3 个）。 */
{
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(160)
    }
  }
}

/* 3. 勾一个会话 → 应该变 2 格，规格按朝向推进 */
const rows = tab.locator('.davf-pick-row')
const pickable = rows.filter({ hasNot: tab.locator('.davf-pick-tag') })
await pickable.first().click()
await tab.waitForTimeout(600)
if ((await cells()) === 2) ok('勾选后自动变 2 格')
else bad('勾选后格数不对：' + (await cells()))
if ((await spec()) === expectSpec(2, O)) ok(`规格自动推进到 ${expectSpec(2, O)}`)
else bad(`规格没自动推进：期望 ${expectSpec(2, O)}，实际 ${await spec()}`)

/* 4. 再勾两个 → 4 格 */
await pickable.nth(1).click()
await tab.waitForTimeout(400)
await pickable.nth(2).click()
await tab.waitForTimeout(600)
if ((await cells()) === 4) ok('勾到 4 个后变 4 格')
else bad('4 个时格数不对：' + (await cells()))
if ((await spec()) === expectSpec(4, O)) ok(`规格自动推进到 ${expectSpec(4, O)}`)
else bad(`${expectSpec(4, O)} 没生效：${await spec()}`)

/* 5. 关掉选择器，验证格子还在 */
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)
if ((await cells()) === 4) ok('关闭选择器后格子保持')
else bad('关闭选择器后格子丢了：' + (await cells()))

/* 6. 悬停一个非当前格 → 出现移除按钮 → 点掉 → 规格自动回退 */
const cell2 = tab.locator('.davf-cell').nth(1)
await cell2.hover()
await tab.waitForTimeout(250)
const rm = cell2.locator('.davf-cell-remove')
if ((await rm.count()) === 1) ok('非当前格有移除按钮')
else bad('非当前格没有移除按钮')
await rm.click()
await tab.waitForTimeout(700)
if ((await cells()) === 3) ok('移除后变 3 格')
else bad('移除后格数不对：' + (await cells()))
if ((await spec()) === expectSpec(3, O)) ok(`3 格规格回到 ${expectSpec(3, O)}（能装下的最小预设）`)
else bad(`3 格规格不对：期望 ${expectSpec(3, O)}，实际 ${await spec()}`)

/* 7. 当前窗口的格子不能移除 */
const activeCell = tab.locator('.davf-cell[data-active]')
if ((await activeCell.locator('.davf-cell-remove').count()) === 0) ok('当前窗口格没有移除按钮')
else bad('当前窗口格居然能移除')

/* 8. 全部移除 → 回到 1 格 */
await tab.locator('.davf-cap-quiet').click()
await tab.waitForTimeout(700)
if ((await cells()) === 1) ok('清空后回到 1 格')
else bad('清空后格数不对：' + (await cells()))
if ((await spec()) === '1') ok('清空后规格回到 1')
else bad('清空后规格不对：' + (await spec()))

/* 9. 选择落盘 */
const saved = await tab.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  return raw ? JSON.parse(raw) : null
})
if (saved && Array.isArray(saved.picked) && saved.picked.length === 0) ok('勾选状态已落盘')
else bad('勾选状态没落盘: ' + JSON.stringify(saved?.picked))

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

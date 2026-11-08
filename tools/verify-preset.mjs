/**
 * 顺位预设验证：加格子时自动分配「身形 + 表情」组合。
 *
 * 对应一次真实需求：用户每加一个对话都要手动调一遍外观，
 * 于是要求「按 1、2 的顺位组合排列下去，不用每次都调」。
 *
 * ── 为什么全部通过「读面板高亮」来断言 ────────────────────────────────
 * 第一版去比 SVG 路径的 `d` 字符串，两处都不成立：
 *   · 眼睛的 `d` 是**单位胶囊**，尺寸和朝向全在 `transform` 里 —— 只比 `d`
 *     会把不同表情看成同一个
 *   · 身体 `d` 每帧都在动（呼吸、轨道），比两次快照必然「全都变了」，
 *     于是「改全局只影响 1 格」这条永远假绿
 * 面板高亮读的是**配置**，稳定且可复现；「格子真的画出来了」由
 * `verify-look-scope` 负责（它比的是冻结姿态下的路径，那时没有动画干扰）。
 *
 * 用法（在 grokbot 目录下）：node tools/verify-preset.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(PAGE + '?w=360&h=760')
await tab.waitForTimeout(800)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/** 勾到 n 格（含当前窗口）。 */
async function fillTo(n) {
  const now = await tab.locator('.davf-cell').count()
  let need = n - now
  if (need <= 0) return
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
  const c = await rows.count()
  for (let i = 0; i < c && need > 0; i++) {
    const row = rows.nth(i)
    if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
    await row.click()
    await tab.waitForTimeout(120)
    need--
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(500)
}

const headText = () => tab.locator('.davf-custbox .davf-picker-head').innerText()
const isGlobal = async () => (await headText()).includes('全局')

/**
 * 回到「编辑全局」。
 *
 * 点第 1 格的「改它」是**选中它**（不是回到全局）—— 所以要多点一次
 * 把选中取消掉。第一版漏了这一步，后面「改全局」实际改的是第 1 格，
 * 于是「第 2 格应为卵石」的断言失败，看着像实现坏了。
 */
async function toGlobal() {
  for (let i = 0; i < 4 && !(await isGlobal()); i++) {
    const on = tab.locator('.davf-cell-tag.is-on')
    if ((await on.count()) > 0) {
      await on.first().click()
    } else {
      await tab.locator('.davf-cell-tag').nth(0).click()
    }
    await tab.waitForTimeout(280)
  }
  return isGlobal()
}

/** 打开第 i 格的面板，读出高亮的身形 + 表情。 */
async function panelLookOf(i) {
  await toGlobal()
  await tab.locator('.davf-cell-tag').nth(i).click()
  await tab.waitForTimeout(300)
  const shape = (await tab.locator('.davf-shape.is-on').innerText()).trim()
  const expression = (await tab.locator('.davf-chip.is-on').first().innerText()).trim()
  return { shape, expression }
}

/* ══ 1. 逐格组合 ═════════════════════════════════════════════════════
   用户点名的顺位：圆+中性 / 圆角方+好奇 / 六边形+困惑 / 云+专注 … */

console.log('4 格 → 每格拿到自己的顺位组合')
await fillTo(4)
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(600)

const cells = await tab.locator('.davf-cell').count()
if (cells === 4) ok('已到 4 格')
else bad(`格数不对：${cells}`)

const EXPECT = [
  ['圆', '中性'],
  ['圆角方', '好奇'],
  ['六边形', '困惑'],
  ['云', '专注'],
  ['胶囊', '害羞'],
  ['三角', '困倦'],
  ['卵石', '难过']
]

for (let i = 0; i < 4; i++) {
  const got = await panelLookOf(i)
  const [wantShape, wantExpr] = EXPECT[i]
  if (got.shape === wantShape && got.expression === wantExpr) {
    ok(`第 ${i + 1} 格 = ${got.shape} + ${got.expression}`)
  } else {
    bad(`第 ${i + 1} 格应为 ${wantShape} + ${wantExpr}，实际 ${got.shape} + ${got.expression}`)
  }
}

/* ══ 2. 面板顺序就是顺位顺序 ═════════════════════════════════════════ */

console.log('\n面板里的选项顺序')
const shapeOrder = await tab.locator('.davf-shape').allInnerTexts()
const shapeNames = shapeOrder.map((s) => s.trim())
/**
 * 14 个身形：用户点名的 8 个在前，从 grok-icon-study 搬来的 6 个接在卵石之后，
 * 水滴仍在最末。前 8 个的顺序是用户定的，不能动；后 6 个的位置是搬进来的顺序。
 */
const wantShapes = [
  '圆',
  '圆角方',
  '六边形',
  '云',
  '胶囊',
  '三角',
  '卵石',
  '盾牌',
  '穹顶',
  '拱门',
  '圆柱',
  '宝石',
  '晶体',
  '水滴'
]
if (shapeNames.join('|') === wantShapes.join('|')) {
  ok(`身形顺序（${shapeNames.length} 个）：` + shapeNames.join(' '))
} else {
  bad(`身形顺序不对（实际 ${shapeNames.length} 个）：` + shapeNames.join(' '))
}

const exprNames = (await tab.locator('.davf-chip').allInnerTexts()).map((s) => s.trim())
const wantExpr = ['中性', '好奇', '困惑', '专注', '害羞', '困倦', '难过', '害怕']
if (wantExpr.every((w, i) => exprNames[i] === w)) {
  ok('表情前 8 个顺序：' + exprNames.slice(0, 8).join(' '))
} else {
  bad('表情前 8 个顺序不对：' + exprNames.slice(0, 8).join(' '))
}

/* ══ 3. 水滴不参与顺位 ═══════════════════════════════════════════════ */

console.log('\n水滴不参与顺位')
const water = tab.locator('.davf-shape', { hasText: '水滴' })
if ((await water.count()) === 1) ok('「水滴」仍在选项里（可以手动选）')
else bad(`「水滴」选项不见了：${await water.count()}`)
const waterTitle = (await water.getAttribute('title')) ?? ''
if (waterTitle.includes('不参与顺位')) ok(`水滴标了「不参与顺位」`)
else bad(`水滴没标不参与顺位：${waterTitle}`)

/* ══ 4. 顺位是显式的：改全局只影响第 1 格 ═════════════════════════════
   v0.3.10 起放弃「锚点」语义。原因见 README《顺位是显式的》：
   锚点与「逐行可编辑」不能共存 —— 逐行填了第 3 行，锚点会让它显示在第 5 格，
   所见非所得。代价就是这一节要钉住的东西：改全局不动第 2 格以后。 */

console.log('\n改全局只影响第 1 格（顺位表是显式的）')
if (await toGlobal()) ok('已回到「外观 · 全局」')
else bad('回不到全局')

// 记录改之前第 1~4 格。
//
// **注意 `panelLookOf` 内部会先 `toGlobal()` 再点第 i 格**，所以循环结束时
// 停在「正在编辑第 4 格」的状态 —— 后面想改全局必须先显式回到全局，
// 否则点形状改的是第 4 格（第一版就在这儿误判成「第 1 格没跟着全局」）。
const beforeGlobal = []
for (let i = 0; i < 4; i++) beforeGlobal.push((await panelLookOf(i)).shape)

if (await toGlobal()) ok('已回到「外观 · 全局」')
else bad('回不到全局')

await tab.locator('.davf-shape', { hasText: '三角' }).first().click()
await tab.waitForTimeout(600)

const shifted = []
for (let i = 0; i < 4; i++) shifted.push((await panelLookOf(i)).shape)

if (shifted[0] === '三角') ok('第 1 格跟着全局变成三角')
else bad(`第 1 格没跟着全局：${shifted[0]}`)

const tailUnchanged =
  shifted[1] === beforeGlobal[1] && shifted[2] === beforeGlobal[2] && shifted[3] === beforeGlobal[3]
if (tailUnchanged) ok(`第 2~4 格没动（${shifted.slice(1).join(' → ')}）`)
else bad(`第 2 格以后跟着转了：改前 ${beforeGlobal.join('/')}，改后 ${shifted.join('/')}`)

/* ══ 5. 手动调过的格子冻结，不再跟顺位走 ═════════════════════════════ */

console.log('\n手动调过的格子冻结成自己的')
await toGlobal()
await tab.locator('.davf-cell-tag').nth(2).click()
await tab.waitForTimeout(300)
await tab.locator('.davf-shape', { hasText: '水滴' }).first().click()
await tab.waitForTimeout(600)
const ownMark = await tab.locator('.davf-cell-own').count()
/**
 * 判据用「≥1」而不是「===1」：前面几节的 `panelLookOf` 会在第 1~4 格之间来回点，
 * 而「点某一格改外观」本身就会给那一格留下单独设置（`looks[id]`），
 * 所以到这里自定标记可能已经有若干个。这一节要验的是**第 3 格确实被冻结了**，
 * 不是「全场只有它一个冻结」。
 */
if (ownMark >= 1) ok(`第 3 格标出「·自定」（当前共 ${ownMark} 个自定标记）`)
else bad('没有「·自定」标记')

await toGlobal()
await tab.locator('.davf-shape', { hasText: '胶囊' }).first().click()
await tab.waitForTimeout(600)
const third = await panelLookOf(2)
if (third.shape === '水滴') ok('再改全局，第 3 格仍是手动设的水滴（没被带动）')
else bad(`已自定的第 3 格被全局带动了：现在 ${third.shape}`)

/* ══ 6. 恢复顺位 ═════════════════════════════════════════════════════ */

console.log('\n「恢复顺位」回到顺位预设')
// 上一步的 `panelLookOf(2)` 结束时正编辑第 3 格 —— 别再多点一次，
// 那样会把选中取消、退回全局，就找不到「恢复顺位」了。
if ((await headText()).includes('全局')) {
  await tab.locator('.davf-cell-tag').nth(2).click()
  await tab.waitForTimeout(300)
}
const resetBtn = tab.locator('.davf-custbox .davf-cap-quiet')
if ((await resetBtn.count()) > 0) {
  await resetBtn.click()
  await tab.waitForTimeout(500)
  /**
   * 判据是「**第 3 格**不再自定」，不是「全场自定标记归零」——
   * 前面来回点别的格子也会留下自定标记（见上一节注释）。
   */
  const thirdOwn = await tab.locator('.davf-cell').nth(2).locator('.davf-cell-own').count()
  if (thirdOwn === 0) ok('「恢复顺位」清掉了第 3 格的单独设置')
  else bad('第 3 格恢复后仍有自定标记')
  const back = await panelLookOf(2)
  // 顺位是显式的：第 3 格 = 表第 2 行，与全局无关
  if (back.shape === '六边形') ok(`第 3 格回到顺位（表第 2 行 = 六边形）`)
  else bad(`第 3 格没回到顺位：${back.shape}`)
} else {
  bad('没有「恢复顺位」按钮')
}

/* ══ 7. 加第 5 格 → 顺位继续往下走 ═══════════════════════════════════ */

console.log('\n加第 5 格 → 顺位继续往下')
await toGlobal()
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(400)
await fillTo(5)
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(600)
const fifth = await panelLookOf(4)
/**
 * 顺位是显式的：第 N 格的图案 = 顺位表第 N-1 行，与全局无关。
 * 第 5 格 → 表第 4 行 = 胶囊 + 害羞。这里同时验「表情也跟着表走」（不是全局）。
 */
if (fifth.shape === '胶囊' && fifth.expression === '害羞') {
  ok(`第 5 格 = ${fifth.shape} + ${fifth.expression}（表第 4 行，未受全局影响）`)
} else {
  bad(`第 5 格 = ${fifth.shape} + ${fifth.expression}，应为 胶囊 + 害羞`)
}

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过（顺位组合自动分配，水滴不参与）')
await browser.close()

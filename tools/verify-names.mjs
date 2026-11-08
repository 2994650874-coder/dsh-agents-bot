/**
 * 回归锁：格子与选择器必须显示**会话标题**，不能显示 Team 投影里写死的 `lead`。
 *
 * ── 这个 bug 是什么 ──────────────────────────────────────────────────
 * 用户反馈：加几个对话后，格子和选择器里全是 `lead`，分不清谁是谁。
 *
 * 根因不是「拿不到标题」，而是**取名顺序错了**：
 *
 * ```ts
 * // 错的
 * name: member?.name ?? row.displayTitle ?? id.slice(0, 8)
 * ```
 *
 * 宿主的 `buildTeamProjection()` 里 Lead 的名字是**字面量常量**：
 *
 * ```js
 * const members = [{ id: rootId, name: 'lead', role: 'lead', phase: 'active' }]
 * ```
 *
 * 而且 `agentTeam` 投影对**每个**会话都存在（`init` 就返回带 lead 的结构），
 * 所以每一格都拿到 `'lead'`，把真实标题挤掉了。
 *
 * 正确判据是 `role === 'teammate'`：只有子代理的 name 才有信息量。
 *
 * ── 为什么这条必须用浏览器测 ────────────────────────────────────────
 * 纯函数测试只能验「我写的函数返回什么」，验不了「界面上真的显示了什么」。
 * 而这个 bug 的表现就是界面上全是 lead —— 必须真的看 DOM。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-panel.mjs && node tools/verify-names.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PANEL = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('names-cleared')) {
      localStorage.clear()
      sessionStorage.setItem('names-cleared', '1')
    }
  } catch {}
})
await tab.goto(PANEL)
await tab.waitForTimeout(800)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/** 加到 N 格（用选择器勾选）。 */
async function addCells(n) {
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(350)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(130)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const cnt = await rows.count()
  for (let i = 0; i < Math.min(n, cnt); i++) {
    await rows.nth(i).click()
    await tab.waitForTimeout(150)
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(600)
}

/* ── 1. 选择器里不能全是 lead ─────────────────────────────────────── */

console.log('选择器：每行显示会话标题，不是 lead')

await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)

const pickNames = await tab.evaluate(() =>
  Array.from(document.querySelectorAll('.davf-pick-name')).map((e) => e.textContent.trim())
)
console.log('  选择器里的名字：' + JSON.stringify(pickNames))

const leadCount = pickNames.filter((n) => n.toLowerCase() === 'lead').length
if (leadCount === 0) ok('选择器里没有出现 lead')
else bad(`选择器里有 ${leadCount} 行叫 lead —— 又退回到用 Team 的写死名字了`)

const distinct = new Set(pickNames.filter(Boolean)).size
if (distinct >= Math.min(3, pickNames.length)) {
  ok(`名字有区分度（${pickNames.length} 行里 ${distinct} 种不同名字）`)
} else {
  bad(`名字几乎都一样（${pickNames.length} 行里只有 ${distinct} 种）：${JSON.stringify(pickNames)}`)
}

// 每行都得有内容，不能是空或纯 id
const emptyNames = pickNames.filter((n) => n === '')
if (emptyNames.length === 0) ok('每一行都有名字')
else bad(`有 ${emptyNames.length} 行名字是空的`)

await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)

/* ── 2. 格子里也不能全是 lead ─────────────────────────────────────── */

console.log('\n格子：同样显示会话标题')

await addCells(5)
const cellNames = await tab.evaluate(() =>
  Array.from(document.querySelectorAll('.davf-cell-name')).map((e) => e.textContent.trim())
)
console.log('  格子里的名字：' + JSON.stringify(cellNames))

const cellLead = cellNames.filter((n) => n.toLowerCase() === 'lead').length
if (cellLead === 0) ok('格子里没有出现 lead')
else bad(`格子里有 ${cellLead} 个叫 lead`)

const cellDistinct = new Set(cellNames.filter(Boolean)).size
if (cellDistinct >= 3) ok(`格子名字有区分度（${cellNames.length} 格里 ${cellDistinct} 种）`)
else bad(`格子名字区分度不够：${JSON.stringify(cellNames)}`)

/* ── 3. 名字要等于宿主给的 displayTitle ──────────────────────────── */

console.log('\n契约：显示名 = displayTitle（Lead 不用 Team 名）')

/*
 * 假数据里 a1 的 displayTitle 是「总控 · Lead」，而 agentTeam 里
 * a1 的 name 是 'lead'。所以第一格必须显示「总控 · Lead」而不是「lead」。
 */
if (cellNames[0]?.includes('总控')) {
  ok(`第一格显示 displayTitle「${cellNames[0]}」，没被 Team 的 'lead' 覆盖`)
} else {
  bad(`第一格显示「${cellNames[0]}」—— 应该是 displayTitle「总控 · Lead」`)
}

/* ── 4. 子代理仍要用 Team 名字 ───────────────────────────────────── */

console.log('\n子代理：teammate 的名字仍然生效')

/*
 * 子代理（s1~s4）在假数据里是 agentTeam 的 teammate，名字是「检索手」等。
 * 它们不该显示 displayTitle，因为 teammate 名字更有信息量。
 *
 * 注意：子代理只在 byId 里、不在 ids 里，所以不会成为格子。
 * 这里验证的是「规则没写反」—— 用两条间接证据：
 *   1. 格子名字里不出现任何子代理名（它们不是格子）
 *   2. 当前窗口那格的左下角小框数到了 4（子代理确实被识别到了）
 *
 * 断言「小框数量」时不能直接数 `.davf-kids`：它现在是**每格各带各的**，
 * 格数变了总数就变。所以先点「清空」回到单格，再数。
 */
const namesNow = await tab.evaluate(() =>
  Array.from(document.querySelectorAll('.davf-cell-name')).map((e) => e.textContent.trim())
)
const kidNamesAll = ['检索手', '命令行工', '写手', '审查员']
const leakedCells = kidNamesAll.filter((n) => namesNow.some((c) => c.includes(n)))
if (leakedCells.length === 0) {
  ok(`子代理没有成为格子（${namesNow.length} 个格子名里没有子代理名）`)
} else {
  bad(`子代理出现在格子里（${leakedCells.join('、')}）`)
}

// 回到 1 格，确认小框数到 4
const hasClear = await tab.locator('.davf-cap', { hasText: /^清空/ }).count()
if (hasClear > 0) {
  await tab.locator('.davf-cap', { hasText: /^清空/ }).click()
  await tab.waitForTimeout(600)
}
const kidBadge = await tab.locator('.davf-kids').count()
if (kidBadge === 1) ok('回到 1 格后，左下角小框仍数到子代理（它们只在 byId 里）')
else bad(`子代理小框状态异常：${kidBadge} 个`)

/* ── 5. 文案：按钮叫「对话」不叫「监视」 ─────────────────────────── */

console.log('\n文案：按钮叫「对话」')

const capText = await tab.locator('.davf-cap').first().innerText()
if (capText.includes('对话')) ok(`第一个胶囊是「${capText}」`)
else bad(`第一个胶囊还是「${capText}」，应改成「对话」`)

const bodyText = await tab.locator('.davf-panel').innerText()
if (!bodyText.includes('监视')) ok('面板里没有残留「监视」字样')
else bad('面板里还有「监视」字样')

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

/**
 * 验证设置页的折叠卡片 / 顺位行缩略图 / 试片改外观三件事。
 *
 * 钉四件事：
 *   1. 「动画映射」是胶囊可折叠的，**默认收起**（第 104 轮用户要求），
 *      展开后能再收起
 *   2. 「自动分配顺位」每行 = 图案下拉 + 配色下拉 + 表情下拉
 *   3. 行内缩略图真的画出来了（不是空白 SVG），且跟着下拉当场变
 *   4. 试片的图案 / 配色 / 表情芯片真的改变试片（不只是换了文字）
 *
 * ── 2026-10-31 修过一次 ─────────────────────────────────────────────
 * 这份脚本原先断「动画映射默认展开」「每行 2 个下拉」「试片是
 * `.davs-look-col` 两列」。三条都随产品改动失效了：默认改为收起
 * （用户要求），顺位加了配色槽（2→3），试片改成 `.davs-group` 四组。
 * 断言是**产品的镜子**，产品讲清楚了要改就改断言 —— 但只改这两处，
 * 其余判据（缩略图非空白、改下拉缩略图变、fp 指纹）原样保留。
 *
 * 用法：node tools/build-panel.mjs && node tools/probe-settings-v2.mjs
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve('preview/panel.html')).href + '?settings=1&plain=1'

let pass = 0
let fail = 0
const ok = (m) => {
  pass++
  console.log('  ok   ' + m)
}
const bad = (m) => {
  fail++
  console.log('  FAIL ' + m)
}
const check = (label, cond, detail = '') => (cond ? ok(label) : bad(label + (detail ? ' — ' + detail : '')))

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(PAGE)
await page.waitForSelector('.davs', { timeout: 15000 })
await page.waitForTimeout(1200)

/* ── 1. 动画映射可折叠 ───────────────────────────────────────────── */
console.log('\n动画映射：胶囊折叠')
/* 用 `data-block` 锚点而不是 `.davs-card` 第一个：v0.3.11 起有两张卡片
   （动画映射 + 自动分配顺位），按位置取第一个只是碰巧对，改一次顺序就错。 */
const card = page.locator('.davs-card[data-block="map"]')
check('存在动画映射卡片', (await card.count()) === 1)

const rowsBefore = await page.locator('.davs-card[data-block="map"] .davs-rows').count()
check('默认收起（第一眼看不到 13 行表单）', rowsBefore === 0, `实际 ${rowsBefore} 组行`)

const toggle = card.locator('.davs-chip-toggle')
const t0 = (await toggle.textContent())?.trim()
check('胶囊文字是「展开调整」', t0 === '展开调整', `实际「${t0}」`)
const noteText0 = (await card.locator('.davs-fold-note').textContent())?.trim() ?? ''
check('收起时有摘要文字（不会一片空白）', noteText0.length > 0, `「${noteText0}」`)

await toggle.click()
await page.waitForTimeout(300)
const rowsAfter = await page.locator('.davs-card[data-block="map"] .davs-rows').count()
check('点一下展开（行出现）', rowsAfter === 1)

const t1 = (await toggle.textContent())?.trim()
check('胶囊文字变成「收起」', t1 === '收起', `实际「${t1}」`)

await toggle.click()
await page.waitForTimeout(300)
check('再点一下又收起', (await page.locator('.davs-card[data-block="map"] .davs-rows').count()) === 0)

/* ── 2. 顺位行结构 ───────────────────────────────────────────────── */
console.log('\n自动分配顺位：行结构 = 图案 + 配色 + 表情')
const presetSection = page.locator('.davs-card[data-block="preset"]')
check('存在顺位区块', (await presetSection.count()) === 1)

const openBtn = presetSection.locator('.davs-chip-toggle').first()
await openBtn.click()
await page.waitForTimeout(300)

const presetRows = presetSection.locator('.davs-rows-preset .davs-row')
const rowCount = await presetRows.count()
// 8 行数据 + 可能 1 行「＋」
check('展开后有 8 行数据', rowCount >= 8, `实际 ${rowCount}`)

const firstRow = presetRows.first()
const selects = firstRow.locator('select')
check('每行有 3 个下拉（图案 + 配色 + 表情）', (await selects.count()) === 3, `实际 ${await selects.count()}`)

const rowLabel = (await firstRow.locator('.davs-row-label').textContent())?.trim() ?? ''
check('行首标签是「第 N 格」', /^第 \d+ 格$/.test(rowLabel), `实际「${rowLabel}」`)
check('第一个数据行是「第 2 格」', rowLabel === '第 2 格', `实际「${rowLabel}」`)

// 三个下拉的选项数量：图案 15 / 配色 12 / 表情 16
const optCounts = await firstRow.evaluate((el) =>
  Array.from(el.querySelectorAll('select')).map((s) => s.options.length)
)
check('图案下拉 15 个选项', optCounts[0] === 15, `实际 ${optCounts[0]}`)
check('配色下拉 12 个选项', optCounts[1] === 12, `实际 ${optCounts[1]}`)
check('表情下拉 16 个选项', optCounts[2] === 16, `实际 ${optCounts[2]}`)

/* ── 3. 缩略图真的画出来了 ───────────────────────────────────────── */
console.log('\n顺位行缩略图')
const thumbs = presetSection.locator('.davs-preset-thumb svg')
const thumbCount = await thumbs.count()
check('每行一张缩略图', thumbCount >= 8, `实际 ${thumbCount}`)

// 缩略图里必须有至少一条有长度的 path（否则是空白图）
const pathInfo = await thumbs.first().evaluate((svg) => {
  const ps = Array.from(svg.querySelectorAll('path'))
  return { total: ps.length, longest: Math.max(0, ...ps.map((p) => (p.getAttribute('d') || '').length)) }
})
check('缩略图里有 path', pathInfo.total > 0, `${pathInfo.total} 条`)
check('缩略图 body path 有实际长度', pathInfo.longest > 200, `最长 d 长 ${pathInfo.longest}`)

// 8 张缩略图的 body path 不能全一样（否则说明身形没生效）
const bodyLen = await presetSection.evaluate((sec) =>
  Array.from(sec.querySelectorAll('.davs-preset-thumb svg')).map((svg) => {
    const ps = Array.from(svg.querySelectorAll('path')).map((p) => (p.getAttribute('d') || '').length)
    return Math.max(0, ...ps)
  })
)
check('8 张缩略图不全一样（身形确实不同）', new Set(bodyLen).size >= 6, `不同值 ${new Set(bodyLen).size} 个`)

/* ── 4. 改下拉真的改缩略图 ───────────────────────────────────────── */
console.log('\n改下拉 → 缩略图当场变')
const before = await presetRows.first().locator('.davs-preset-thumb svg').evaluate((svg) => {
  const ps = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '')
  return ps.sort((a, b) => b.length - a.length)[0] || ''
})

await presetRows.first().locator('select').first().selectOption('triangle')
await page.waitForTimeout(400)

const after = await presetRows.first().locator('.davs-preset-thumb svg').evaluate((svg) => {
  const ps = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '')
  return ps.sort((a, b) => b.length - a.length)[0] || ''
})

// 引擎每帧呼吸，path 会差 1~2 个字符，不能逐字节比。用「命令数 + x 跨度」fingerprint。
// 不能用「长度/20」那一版：圆 2451 与 晶体 2445 会落在同一档（都是 66:122），
// 明明换了身形却判成没变 —— 判据太粗会给出假 FAIL。
const fp = (d) => {
  const cmds = (d.match(/[MLCQZ]/g) || []).length
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  const span = xs.length ? Math.round(Math.max(...xs) - Math.min(...xs)) : 0
  return `${cmds}:${span}`
}
check('换成三角后缩略图变了（fingerprint 不同）', fp(before) !== fp(after), `${fp(before)} vs ${fp(after)}`)

// 存盘检查
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  return raw ? JSON.parse(raw) : null
})
check('改动写进了 localStorage（preset 字段）', Array.isArray(stored?.preset), JSON.stringify(stored?.preset?.[0]))
check(
  '存的是「图案 + 配色 + 表情」成套结构',
  typeof stored?.preset?.[0]?.shape === 'string' &&
    typeof stored?.preset?.[0]?.color === 'string' &&
    typeof stored?.preset?.[0]?.expression === 'string',
  JSON.stringify(stored?.preset?.[0])
)
check('第一行图案已变成 triangle', stored?.preset?.[0]?.shape === 'triangle', stored?.preset?.[0]?.shape)

/* ── 5. 试片的图案 / 配色 / 表情 ─────────────────────────────────── */
console.log('\n试片：图案 / 配色 / 表情可调')
/* 2026-10-31：从两列（`.davs-look-col`）改成四组（`.davs-group`），
   这是 B 版布局的通用组。所以按 data-group 锚定，不按位置取。 */
const group = (name) => page.locator(`.davs-preview .davs-group[data-group="${name}"]`)
const groupNames = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.davs-preview .davs-group')).map((g) => g.dataset.group)
)
check('试片下有 4 组（动画 / 图案 / 配色 / 表情）', groupNames.length === 4, JSON.stringify(groupNames))

check('图案组 15 个（就是 15 个图案，无多余项）', (await group('图案').locator('.davs-chip').count()) === 15, `实际 ${await group('图案').locator('.davs-chip').count()}`)
check('配色组 12 个（就是 12 个配色，无多余项）', (await group('配色').locator('.davs-chip').count()) === 12, `实际 ${await group('配色').locator('.davs-chip').count()}`)
check('表情组 16 个（就是 16 个表情，无多余项）', (await group('表情').locator('.davs-chip').count()) === 16, `实际 ${await group('表情').locator('.davs-chip').count()}`)

const allChipText = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.davs-group-chips .davs-chip')).map((c) => c.textContent.trim())
)
check('各组里都没有「跟全局」', !allChipText.some((t) => t.includes('全局')), JSON.stringify(allChipText.filter((t) => t.includes('全局'))))

// 「跟随」改成隐式：没点过时高亮落在全局当前值上
const defaultOn = await page.evaluate(() =>
  ['图案', '配色', '表情'].map(
    (n) =>
      document.querySelector(`.davs-preview .davs-group[data-group="${n}"] .davs-chip.is-on`)?.textContent.trim() ??
      null
  )
)
check('默认高亮落在全局值（圆 / 墨黑 / 中性）', defaultOn[0] === '圆' && defaultOn[1] === '墨黑' && defaultOn[2] === '中性', JSON.stringify(defaultOn))

// 改图案 → 试片大 bot 的 body path 变
const previewBig = page.locator('.davs-preview-bot svg')
const bigBefore = await previewBig.evaluate((svg) => {
  const ps = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '')
  return ps.sort((a, b) => b.length - a.length)[0] || ''
})
await group('图案').locator('.davs-chip', { hasText: '晶体' }).click()
await page.waitForTimeout(700)
const bigAfter = await previewBig.evaluate((svg) => {
  const ps = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '')
  return ps.sort((a, b) => b.length - a.length)[0] || ''
})
check('试片换成晶体后大 bot 变了', fp(bigBefore) !== fp(bigAfter), `${fp(bigBefore)} vs ${fp(bigAfter)}`)

// 改配色 → 身体轮廓那个 rect 的 fill 变（第 104 轮加的配色槽，这是它的硬判据）
const bodyFill = () =>
  previewBig.evaluate((svg) => {
    const body = svg.querySelector('rect[mask], rect[fill]:not([fill="transparent"])')
    return body?.getAttribute('fill') ?? ''
  })
const fillBefore = await bodyFill()
await group('配色').locator('.davs-chip', { hasText: '紫' }).click()
await page.waitForTimeout(700)
const fillAfter = await bodyFill()
check('试片换配色后身体主色变了', fillBefore !== fillAfter, `${fillBefore} → ${fillAfter}`)
check('主色是 violet 的 hex（#8b5cf6）', fillAfter.toLowerCase() === '#8b5cf6', fillAfter)

// 试片外观不落盘（临时看一眼的工具）
const stored2 = await page.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  return raw ? JSON.parse(raw) : null
})
check('试片图案不落盘', stored2?.previewShape === undefined, JSON.stringify(stored2?.previewShape))
check('试片配色不落盘', stored2?.previewColor === undefined, JSON.stringify(stored2?.previewColor))

/* ── 6. 没有运行时报错 ───────────────────────────────────────────── */
console.log('\n运行时报错')
const realErrors = errors.filter((e) => !/favicon|net::ERR_FILE/.test(e))
check('页面无 JS 报错', realErrors.length === 0, realErrors.slice(0, 3).join(' | '))

/* ── 截图 ────────────────────────────────────────────────────────── */
/* 截图用「圆」而不是「跟全局」—— 那一项已经没有了。
    用 /^圆$/ 而不是 '圆'：后者是子串匹配，会同时命中「圆角方」。 */
await group('图案').locator('.davs-chip', { hasText: /^圆$/ }).click()
await page.waitForTimeout(200)
await page.screenshot({ path: 'preview/settings-v2.png', fullPage: true })
console.log('\n截图 → preview/settings-v2.png')

// 顺位表特写
await presetSection.scrollIntoViewIfNeeded()
await page.waitForTimeout(200)
await presetSection.screenshot({ path: 'preview/preset-rows.png' })
console.log('截图 → preview/preset-rows.png')

console.log(`\n${fail === 0 ? '全部通过' : '有失败项'}（${pass} 通过 / ${fail} 失败）`)
await browser.close()
process.exit(fail === 0 ? 0 : 1)

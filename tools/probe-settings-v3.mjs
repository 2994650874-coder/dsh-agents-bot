/**
 * 设置页结构验证：试片在最上面 + 两块卡片同形 + 试片多组芯片平铺。
 *
 * ── 这份脚本的历史 ──────────────────────────────────────────────────
 * 它最早对应 v0.3.11 的「图案 / 表情两列平铺」（`.davs-look-col`）。B 版
 * 改版把那一套换成了 `.davs-group` 通用组（每组固定三行，为了左右等高），
 * 脚本没跟着改，于是从 d804117 起就一直红着 —— **测的是一个已经不存在的
 * 布局**。2026-10-31 按当前 DOM 重写，同时补上第 104 轮加的「配色」组。
 *
 * ── 钉这些事 ────────────────────────────────────────────────────────
 *   1. 试片在最上面，且**不**属于任何一块卡片（两块共用）
 *   2. 两块卡片都有 .davs-card 外壳，标题是「动画映射」「自动分配顺位」
 *   3. 两块的收起胶囊都在**标题行右侧**（同一水平位置 ±2px）
 *   4. 「恢复默认」出现在胶囊**左边**
 *   5. 试片是**四组平铺**（动画 / 形状 / 配色 / 表情），没有 <select>
 *   6. 点芯片 → 试片大 bot 当场变 + 本组高亮跟着走，别组不受影响
 *   7. 试片的选择**不落盘**（它是「临时看一眼」的工具）
 *   8. 两块各自独立折叠
 *
 * 用法：node tools/build-panel.mjs && node tools/probe-settings-v3.mjs
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href + '?settings=1&plain=1'

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
const check = (label, cond, detail = '') =>
  cond ? ok(label) : bad(label + (detail ? ' — ' + detail : ''))

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 1100 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(PAGE)
await page.waitForSelector('.davs', { timeout: 15000 })
await page.waitForTimeout(1200)

/* ── 1. 试片在最上面 ─────────────────────────────────────────────── */
console.log('\n试片位置')
const order = await page.evaluate(() => {
  const box = document.querySelector('.davs')
  if (!box) return []
  const out = []
  for (const el of box.children) {
    if (el.classList.contains('davs-preview')) out.push('试片')
    else if (el.classList.contains('davs-card'))
      out.push('卡片:' + (el.querySelector('.davs-title')?.textContent || '?').trim())
    else {
      const t = el.querySelector('.davs-title')?.textContent
      if (t) out.push('段:' + t.trim())
      else if (el.classList.contains('davs-foot')) out.push('脚注')
    }
  }
  return out
})
console.log('  ' + order.join(' → '))

check('第一块就是试片', order[0] === '试片', order[0])
check('试片在「动画映射」之前', order.indexOf('试片') < order.indexOf('卡片:动画映射'))
check(
  '试片不在任何卡片内部（两块共用）',
  (await page.locator('.davs-card .davs-preview').count()) === 0,
  `卡片里还有 ${await page.locator('.davs-card .davs-preview').count()} 个试片`
)

/* ── 2. 两块都有卡片外壳 ─────────────────────────────────────────── */
console.log('\n两块同形：都有胶囊外壳')
const cards = page.locator('.davs-card')
check('恰好两张卡片（动画映射 + 自动分配顺位）', (await cards.count()) === 2, `实际 ${await cards.count()}`)

const cardTitles = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.davs-card .davs-title')).map((t) => t.textContent.trim())
)
check(
  '两张卡片的标题是「动画映射」「自动分配顺位」',
  JSON.stringify(cardTitles) === JSON.stringify(['动画映射', '自动分配顺位']),
  JSON.stringify(cardTitles)
)
const presetCard = page.locator('.davs-card[data-block="preset"]')
check('顺位那块有 .davs-card 外壳', (await presetCard.count()) === 1)

/* ── 3. 收起胶囊在同一水平位置 ───────────────────────────────────── */
console.log('\n收起胶囊的位置')
const chipRects = await page.evaluate(() => {
  const out = {}
  for (const block of ['map', 'preset']) {
    const card = document.querySelector(`.davs-card[data-block="${block}"]`)
    const chip = card?.querySelector('.davs-card-tools .davs-chip-toggle')
    if (!chip) {
      out[block] = null
      continue
    }
    const r = chip.getBoundingClientRect()
    const cr = card.getBoundingClientRect()
    out[block] = { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(cr.right - r.right) }
  }
  return out
})
check(
  '两个胶囊都在 .davs-card-tools 里（标题行右侧）',
  (await page.locator('.davs-card-tools .davs-chip-toggle').count()) === 2,
  `实际 ${await page.locator('.davs-card-tools .davs-chip-toggle').count()} 个`
)
if (chipRects.map && chipRects.preset) {
  check(
    '两个胶囊距卡片右边缘一致（同一水平位置）',
    Math.abs(chipRects.map.right - chipRects.preset.right) <= 2,
    `map 距右 ${chipRects.map.right}px / preset 距右 ${chipRects.preset.right}px`
  )
}

/* ── 4. 「恢复默认」在胶囊之前 ───────────────────────────────────── */
console.log('\n恢复默认：往前推到胶囊左边')
await presetCard.locator('.davs-chip-toggle').click()
await page.waitForTimeout(400)
await presetCard.locator('.davs-rows-preset .davs-row select').first().selectOption('gemme')
await page.waitForTimeout(400)

const toolsOrder = await page.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="preset"]')
  const tools = card?.querySelector('.davs-card-tools')
  if (!tools) return null
  return Array.from(tools.children).map((el) => {
    const r = el.getBoundingClientRect()
    return { cls: el.className, text: (el.textContent || '').trim(), left: Math.round(r.left) }
  })
})
check('顺位标题行右侧有两个控件', (toolsOrder?.length ?? 0) === 2, JSON.stringify(toolsOrder))
if (toolsOrder && toolsOrder.length === 2) {
  const [first, second] = toolsOrder
  check('第一个是「恢复默认」按钮', first.text === '恢复默认', first.text)
  check('第二个是收起胶囊', /davs-chip-toggle/.test(second.cls), second.cls)
  check('「恢复默认」在胶囊左边（往前推）', first.left < second.left, `${first.left} vs ${second.left}`)
}

/* ── 5. 试片四组平铺 ─────────────────────────────────────────────── */
console.log('\n试片：四组芯片平铺')
const groupInfo = await page.evaluate(() => {
  const out = []
  for (const g of document.querySelectorAll('.davs-preview .davs-group')) {
    const head = g.querySelector('.davs-group-head')
    const chips = Array.from(g.querySelectorAll('.davs-chip'))
    const r = g.getBoundingClientRect()
    out.push({
      name: g.dataset.group ?? '',
      count: chips.length,
      labels: chips.map((c) => c.textContent.trim()),
      on: chips.filter((c) => c.className.includes('is-on')).map((c) => c.textContent.trim()),
      top: Math.round(r.top),
      left: Math.round(r.left),
      width: Math.round(r.width)
    })
  }
  return out
})
console.log('  ' + groupInfo.map((g) => `${g.name}(${g.count})`).join(' | '))

check('恰好四组', groupInfo.length === 4, `实际 ${groupInfo.length}`)
check(
  '四组顺序是 动画 / 形状 / 配色 / 表情',
  JSON.stringify(groupInfo.map((g) => g.name)) === JSON.stringify(['动画', '形状', '配色', '表情']),
  JSON.stringify(groupInfo.map((g) => g.name))
)
check('试片里没有下拉了（改成芯片）', (await page.locator('.davs-preview select').count()) === 0)

const by = Object.fromEntries(groupInfo.map((g) => [g.name, g]))
check('动画 22 项', by['动画']?.count === 22, `实际 ${by['动画']?.count}`)
check('形状 15 项', by['形状']?.count === 15, `实际 ${by['形状']?.count}`)
check('配色 12 项', by['配色']?.count === 12, `实际 ${by['配色']?.count}`)
check('表情 16 项', by['表情']?.count === 16, `实际 ${by['表情']?.count}`)

/* 2026-10-31：三个动画改名。这里断「新名在、旧名不在」，与
   tools/check-animation-order.mjs 互为双保险（那边读芯片顺序，这里读组内文本）。 */
check('动画组里有「环流」「写文件」「错误」', ['环流', '写文件', '错误'].every((n) => by['动画']?.labels.includes(n)), JSON.stringify(by['动画']?.labels))
check('动画组里没有旧名「惊叹」', !by['动画']?.labels.includes('惊叹'))

/* 配色组每枚带一个色点（`.davs-swatch`），这是它和别的组的区别 */
const swatchCount = await page.locator('.davs-preview .davs-group[data-group="配色"] .davs-swatch').count()
check('配色组 12 枚芯片各带一个色点', swatchCount === 12, `实际 ${swatchCount}`)

/* 每组各有一项高亮，且默认落在全局值（圆 / 中性）——去掉「跟全局」按钮以后，
   一旦哪组一项都不亮，用户就没法判断当前是哪个。 */
check(
  '四组各有一项高亮，默认落在全局值（空闲 / 圆 / 墨黑 / 中性）',
  groupInfo.every((g) => g.on.length === 1) &&
    by['动画']?.on[0] === '空闲' &&
    by['形状']?.on[0] === '圆' &&
    by['配色']?.on[0] === '墨黑' &&
    by['表情']?.on[0] === '中性',
  JSON.stringify(groupInfo.map((g) => g.on))
)

/* ── 6. 点芯片 → 画像变 + 高亮走 ─────────────────────────────────── */
console.log('\n点组里的芯片 → 试片当场变')
const bigPath = () =>
  page.locator('.davs-preview-bot svg').evaluate((svg) => {
    const ps = Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '')
    return ps.sort((a, b) => b.length - a.length)[0] || ''
  })
/** 引擎每帧呼吸，path 差 1~2 字符，不能逐字节比 —— 用指纹。 */
const fp = (d) => {
  const cmds = (d.match(/[MLCQZ]/g) || []).length
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0)
  return `${cmds}:${Math.round(xs.length ? Math.max(...xs) - Math.min(...xs) : 0)}`
}

const beforeShape = await bigPath()
await page.locator('.davs-group[data-group="形状"] .davs-chip', { hasText: '三角' }).click()
await page.waitForTimeout(700)
const afterShape = await bigPath()
check('换形状后大 bot 变了', fp(beforeShape) !== fp(afterShape), `${fp(beforeShape)} vs ${fp(afterShape)}`)

const shapeOn = await page.evaluate(
  () => document.querySelector('.davs-group[data-group="形状"] .davs-chip.is-on')?.textContent.trim()
)
check('形状组高亮移到「三角」', shapeOn === '三角', shapeOn)
const exprOnStill = await page.evaluate(
  () => document.querySelector('.davs-group[data-group="表情"] .davs-chip.is-on')?.textContent.trim()
)
check('表情组不受影响（仍停在全局值「中性」）', exprOnStill === '中性', exprOnStill)

/* 配色：换一个色，主色 fill 必须真的变（这是「颜色槽」有没有接上的硬判据）。
   ── 2026-10-31 修：不能只读 path，也不能「取出现最多的 fill」────────────
   身体轮廓是带 mask 的 <rect fill={ink} stroke={ink}>，不是 path。
   第一版只扫 path[fill]，扫到的是眼睛（#000），于是「换配色前后一样」——
   那是**探针瞎了**，不是功能坏了。
   第二版改成「取出现最多的非色块」，仍然错：眼睛那两条 #000 path 比
   身体那一个 rect 更多。所以直接锚定那个 rect —— 它是有 mask 的轮廓，
   全 SVG 只有一个。 */
const fillOf = () =>
  page.locator('.davs-preview-bot svg').evaluate((svg) => {
    const body = svg.querySelector('rect[mask], rect[fill]:not([fill="transparent"])')
    return body?.getAttribute('fill') ?? ''
  })
const fillBefore = await fillOf()
await page.locator('.davs-group[data-group="配色"] .davs-chip', { hasText: '红' }).click()
await page.waitForTimeout(700)
const fillAfter = await fillOf()
check('换配色后主色真的变了', fillBefore !== fillAfter, `${fillBefore} → ${fillAfter}`)
/* 红 = #e8483f（skins.ts 里 rouge 的 hex），断到具体色值，而不是只断「变了」 */
check('主色是 rouge 的 hex（#e8483f）', fillAfter.toLowerCase() === '#e8483f', fillAfter)
const colorOn = await page.evaluate(
  () => document.querySelector('.davs-group[data-group="配色"] .davs-chip.is-on')?.textContent.trim()
)
check('配色组高亮移到「红」', colorOn === '红', colorOn)

const pathAfterExpr = await page.locator('.davs-preview-bot svg').evaluate((svg) =>
  Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '').join('|')
)
await page.locator('.davs-group[data-group="表情"] .davs-chip', { hasText: '难过' }).click()
await page.waitForTimeout(700)
const pathAfterExpr2 = await page.locator('.davs-preview-bot svg').evaluate((svg) =>
  Array.from(svg.querySelectorAll('path')).map((p) => p.getAttribute('d') || '').join('|')
)
check('换表情后大 bot 的路径变了', pathAfterExpr !== pathAfterExpr2, `长度 ${pathAfterExpr.length} vs ${pathAfterExpr2.length}`)

/* 试片外观不落盘 */
const stored = await page.evaluate(() => {
  const raw = localStorage.getItem('dsh-agents-bot:ui')
  return raw ? JSON.parse(raw) : null
})
check('试片形状不落盘', stored?.previewShape === undefined, JSON.stringify(stored?.previewShape))
check('试片配色不落盘', stored?.previewColor === undefined, JSON.stringify(stored?.previewColor))
check('试片表情不落盘', stored?.previewExpression === undefined, JSON.stringify(stored?.previewExpression))

/* ── 7. 两块各自独立折叠 ─────────────────────────────────────────── */
console.log('\n两块各自独立折叠')
check('顺位展开时有行', (await page.locator('.davs-card[data-block="preset"] .davs-rows').count()) === 1)
await page.locator('.davs-card[data-block="preset"] .davs-chip-toggle').click()
await page.waitForTimeout(350)
check('收顺位后顺位行消失', (await page.locator('.davs-card[data-block="preset"] .davs-rows').count()) === 0)
const presetNote = (await page.locator('.davs-card[data-block="preset"] .davs-fold-note').innerText()).trim()
check('收顺位后有摘要', presetNote.length > 0, `「${presetNote}」`)

/* 动画映射**默认是收起的**（第 104 轮用户要求），所以这里先确认它现在是收的，
   再展开、再收起 —— 顺带把「默认收起」这条判据也钉住。 */
const mapRowsIdle = await page.locator('.davs-card[data-block="map"] .davs-rows').count()
check('刷新后动画映射默认是收起的', mapRowsIdle === 0, `实际 ${mapRowsIdle} 组行`)
await page.locator('.davs-card[data-block="map"] .davs-chip-toggle').click()
await page.waitForTimeout(350)
check('点一下能展开动画映射', (await page.locator('.davs-card[data-block="map"] .davs-rows').count()) === 1)
check('展开后试片还在（共用，不收）', (await page.locator('.davs-preview').count()) === 1)

/* 动画映射每行都有「试播」 */
const tryCount = await page.locator('.davs-card[data-block="map"] .davs-row .davs-btn-try').count()
check('动画映射 13 行每行都有「试播」', tryCount === 13, `实际 ${tryCount}`)

/* 点试播 → 动画组的当前值变成轮播摘要（不是单个动画名） */
const animCurBefore = await page.evaluate(
  () => document.querySelector('.davs-group[data-group="动画"] .davs-group-cur')?.textContent.trim()
)
await page.locator('.davs-card[data-block="map"] .davs-row').first().locator('.davs-btn-try').click()
await page.waitForTimeout(600)
const animCurAfter = await page.evaluate(
  () => document.querySelector('.davs-group[data-group="动画"] .davs-group-cur')?.textContent.trim()
)
check(
  '点「试播」后动画组显示轮播摘要（含 ×N 和箭头）',
  /×\d/.test(animCurAfter ?? '') && (animCurAfter ?? '').includes('→'),
  `${animCurBefore} → ${animCurAfter}`
)

await page.locator('.davs-card[data-block="map"] .davs-chip-toggle').click()
await page.waitForTimeout(350)
check('两块都收起后动画映射行也消失', (await page.locator('.davs-card[data-block="map"] .davs-rows').count()) === 0)
check('两块都收起后试片还在', (await page.locator('.davs-preview').count()) === 1)

/* ── 8. 无报错 ───────────────────────────────────────────────────── */
console.log('\n运行时报错')
const real = errors.filter((e) => !/favicon|net::ERR_FILE/.test(e))
check('页面无 JS 报错', real.length === 0, real.slice(0, 3).join(' | '))

/* ── 截图 ────────────────────────────────────────────────────────── */
await page.screenshot({ path: resolve(ROOT, 'preview', 'settings-v3.png'), fullPage: true })
console.log('\n截图 → preview/settings-v3.png')
await page.locator('.davs-preview').screenshot({ path: resolve(ROOT, 'preview', 'preview-groups.png') })
console.log('截图 → preview/preview-groups.png')

console.log(`\n${fail === 0 ? '全部通过' : '有失败项'}（${pass} 通过 / ${fail} 失败）`)
await browser.close()
process.exit(fail === 0 ? 0 : 1)

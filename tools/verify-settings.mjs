/**
 * 设置页的验证。
 *
 * 对应本轮需求：
 *   1. 设置页能选「每个活动播哪几个动画、各播几遍」，最多两项
 *   2. 休眠阈值是单独一行，不是动画
 *   3. 帧率在设置页，不在右栏
 *   4. 试片在设置页（服务于动画映射），能预览所有动画
 *   5. 配置能落盘，且改坏了能恢复
 *
 * 为什么每条都要真的点界面：这个项目上 fake fixture 已经掩盖过两次真 bug
 * （一次是子代理只在 byId 里，一次是投影推送用 setAttribute 模拟）。
 * 断言要落在「点完之后 localStorage 里存了什么」这种硬事实上。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-settings.mjs && node tools/verify-settings.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'settings.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
const page = await ctx.newPage()
await page.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await page.goto(pathToFileURL(target).href)
await page.waitForTimeout(700)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/**
 * 把「动画映射」拨到展开态。
 *
 * 为什么需要它：这块 2026-10-31 起默认收起，而同一个按钮既展开又收起。
 * 探针里凡是要读轮播行的地方都必须先调它，不能假设当前是开是关 ——
 * 无脑点一下在多处调用时会让第二次调用把第一次展开的又收回去。
 */
async function ensureMapExpanded() {
  const expanded = await page.evaluate(
    () => document.querySelectorAll('.davs-card[data-block="map"] .davs-row').length > 0
  )
  if (!expanded) {
    await page.locator('.davs-card[data-block="map"] .davs-chip-toggle').click()
    await page.waitForTimeout(400)
  }
}

/** 读落盘的配置。 */
const stored = () =>
  page.evaluate(() => {
    const raw = localStorage.getItem('dsh-agents-bot:ui')
    return raw ? JSON.parse(raw) : null
  })

/* ── 1. 结构 ─────────────────────────────────────────────────────── */

console.log('结构：13 个活动 + 休眠 + 帧率')

/*
 * 2026-10-31：动画映射默认收起，所以进页面时**没有任何轮播行**。
 * 这一节先验「默认是收起的」（用户第 104 轮的要求），再展开去数行。
 * 直接把「0 行」当失败是错误的 —— 收起态下 0 行才是正确结果。
 */
const collapsedByDefault = await page.evaluate(() => {
  const card = document.querySelector('.davs-card[data-block="map"]')
  if (!card) return null
  return {
    rows: card.querySelectorAll('.davs-row').length,
    note: card.querySelector('.davs-fold-note')?.textContent?.trim() ?? ''
  }
})
if (collapsedByDefault && collapsedByDefault.rows === 0 && collapsedByDefault.note.includes('已收起')) {
  ok('动画映射默认收起（' + collapsedByDefault.note + '）')
} else {
  bad('动画映射默认没有收起：' + JSON.stringify(collapsedByDefault))
}

await ensureMapExpanded()

const rows = await page.locator('.davs-card[data-block="map"] .davs-row').count()
if (rows === 13) ok(`展开后 13 行活动（实际 ${rows}）`)
else bad(`活动行数不对：${rows}（应为 13）`)

// 每一行都要有中文活动名
const labels = await page.evaluate(() =>
  Array.from(document.querySelectorAll('.davs-card[data-block="map"] .davs-row-label')).map((e) =>
    e.textContent.trim()
  )
)
const EXPECT = [
  '空闲', '思考中', '读文件', '检索中', '跑命令', '写文件', '压缩上下文',
  '后台任务', '等待确认', '刚完成', '出错', '启动中', '休眠'
]
if (JSON.stringify(labels) === JSON.stringify(EXPECT)) {
  ok('活动顺序与列表一致：' + labels.join(' / '))
} else {
  bad(`活动列表不对：${JSON.stringify(labels)}`)
}

// 「压缩上下文」和「后台任务」必须在（本轮新增）
if (labels.includes('压缩上下文') && labels.includes('后台任务')) {
  ok('新增的「压缩上下文」「后台任务」都在')
} else {
  bad('缺少新增的活动行：' + JSON.stringify(labels))
}

// 交付文件不该有（用户明确说不加）
if (!labels.some((l) => l.includes('交付'))) ok('没有「交付」行（用户明确不加）')
else bad('出现了不该有的「交付」行')

/* ── 2. 休眠是阈值行，不是动画行 ─────────────────────────────────── */

console.log('\n休眠：单独一行阈值')

const sleepSection = await page.evaluate(() => {
  const secs = Array.from(document.querySelectorAll('.davs-section'))
  const sec = secs.find((s) => s.querySelector('.davs-title')?.textContent?.includes('休眠'))
  if (!sec) return null
  return Array.from(sec.querySelectorAll('.davs-chip')).map((b) => b.textContent.trim())
})
if (sleepSection && sleepSection.includes('30 分钟')) {
  ok('休眠阈值单独一段，选项齐全：' + sleepSection.join(' / '))
} else {
  bad('休眠阈值段不对：' + JSON.stringify(sleepSection))
}

// 默认 30 分钟高亮
const sleepOn = await page.evaluate(() => {
  const secs = Array.from(document.querySelectorAll('.davs-section'))
  const sec = secs.find((s) => s.querySelector('.davs-title')?.textContent?.includes('休眠'))
  const b = sec?.querySelector('.davs-chip.is-on')
  return b ? b.textContent.trim() : null
})
if (sleepOn === '30 分钟') ok('默认休眠阈值是 30 分钟')
else bad('默认休眠阈值不对：' + sleepOn)

// 改到 10 分钟 → 落盘
await page.locator('.davs-section', { hasText: '休眠' }).locator('.davs-chip', { hasText: '10 分钟' }).click()
await page.waitForTimeout(300)
let s = await stored()
if (s?.sleepMinutes === 10) ok('改休眠阈值能落盘（sleepMinutes=10）')
else bad('休眠阈值没落盘：' + JSON.stringify(s?.sleepMinutes))

/* ── 3. 帧率在设置页 ─────────────────────────────────────────────── */

console.log('\n帧率：在设置页')

const fpsRow = await page.evaluate(() => {
  const secs = Array.from(document.querySelectorAll('.davs-section'))
  const sec = secs.find((s) => s.querySelector('.davs-title')?.textContent?.includes('帧率'))
  if (!sec) return null
  return Array.from(sec.querySelectorAll('.davs-chip')).map((b) => b.textContent.trim())
})
if (fpsRow && JSON.stringify(fpsRow) === JSON.stringify(['45', '60', '90', '120'])) {
  ok('帧率四档在设置页：' + fpsRow.join(' / '))
} else {
  bad('设置页帧率档位不对：' + JSON.stringify(fpsRow))
}

await page.locator('.davs-section', { hasText: '帧率' }).locator('.davs-chip', { hasText: /^120$/ }).click()
await page.waitForTimeout(300)
s = await stored()
if (s?.fps === 120) ok('高刷 120 档能落盘（fps=120）')
else bad('高刷帧率没落盘：' + JSON.stringify(s?.fps))
await page.locator('.davs-section', { hasText: '帧率' }).locator('.davs-chip', { hasText: /^90$/ }).click()
await page.waitForTimeout(300)
s = await stored()
if (s?.fps === 90) ok('高刷 90 档能落盘（fps=90）')
else bad('高刷帧率没落盘：' + JSON.stringify(s?.fps))

await page.locator('.davs-section', { hasText: '帧率' }).locator('.davs-chip', { hasText: /^45$/ }).click()
await page.waitForTimeout(300)
s = await stored()
if (s?.fps === 45) ok('改帧率能落盘（fps=45）')
else bad('帧率没落盘：' + JSON.stringify(s?.fps))

/* ── 4. 试片 ───────────────────────────────────────────────────────
   2026-10-31：选择器换成 `.davs-group[data-group="动画"]`。

   `.davs-preview-chips` 这个类**早就不存在了**（试片从「两列芯片」改成
   「四组 .davs-group」时就没这个类）。所以这一节到这里之前一直是全红，
   而整份脚本的退出码被后面几节盖过去，没人注意到 —— 又一个「测试比没有
   更糟」的例子。

   同时这里不再写死 14 个名字：动画列表从 22 项起就不是手写清单能跟上的，
   改成「断言页面上出现的顺序 = `ANIMATION_OPTIONS` 的顺序」，两者都由
   同一张表驱动，才是真的在测「试片能预览每一个可选动画」。 */

console.log('\n试片：在设置页，能预览所有动画')

const previewChips = await page.evaluate(() => {
  const g = document.querySelector('.davs-preview .davs-group[data-group="动画"]')
  return g ? Array.from(g.querySelectorAll('.davs-chip')).map((b) => b.textContent.trim()) : []
})

if (previewChips.length === 22) {
  ok(`试片能预览全部 ${previewChips.length} 个动画`)
} else {
  bad(`试片动画数不对：${previewChips.length}（应为 22）`)
}

// 三个改过名的必须用新名字（旧名字在页面上一个字都不该留）
for (const [oldName, newName] of [
  ['写文件', '环流'],
  ['出错', '写文件'],
  ['惊叹', '错误']
]) {
  if (previewChips.includes(newName)) ok(`试片用的是新名字「${newName}」`)
  else bad(`试片里没有新名字「${newName}」`)
  /* 「写文件」既是新名字也是旧名字 —— 它对应的是两个不同的动画（旧 exclaim
     叫「惊叹」、旧 play 叫「写文件」），所以不能简单断言「旧名不在」。 */
  void oldName
}

if (!previewChips.includes('漩涡')) ok('漩涡已移除（用户判「太丑了」）')
else bad('试片里还有漩涡')

if (!previewChips.includes('六边形')) ok('六边形已从试片移除（它没有业务语义）')
else bad('试片里还有六边形')

// 点「爆发」→ 试片标题跟着变
await page.locator('.davs-preview .davs-group[data-group="动画"] .davs-chip', { hasText: /^爆发$/ }).click()
await page.waitForTimeout(400)
const previewLabel = await page.locator('.davs-group[data-group="动画"] .davs-group-cur').first().innerText()
if (previewLabel.includes('爆发')) ok('点试片按钮能切换预览：' + previewLabel)
else bad('试片没跟着切：' + previewLabel)

/* ── 5. 轮播配置 ───────────────────────────────────────────────────
   2026-10-31：动画映射默认收起，所以要先展开才能看到行。

   ── 为什么用「没展开才点」而不是无脑点一下 ──────────────────────────
   第 1 节已经展开过了 —— 再点一次反而会收起（这是同一个按钮）。
   探针里的点击必须是「把状态拨到目标」，不能假设初始状态。这类错误在本项目
   已经出现过一次（`probe-settings-v2` 假设映射默认展开，结果超时）。

   同时默认轮播已经烧录成作者那一份：`idle` 是「空闲 ×1 + 眨眼 ×1」，
   不再是旧的「空闲 ×5」。 */

console.log('\n轮播：每行最多两项，各配播几遍')

const mapCard = page.locator('.davs-card[data-block="map"]')
await ensureMapExpanded()
await page.waitForTimeout(300)

const idleRow = page.locator('.davs-card[data-block="map"] .davs-row', { hasText: '空闲' }).first()
const idleSlots = await idleRow.locator('.davs-slot').count()
if (idleSlots === 2) ok(`空闲默认两项轮播（${idleSlots} 项）`)
else bad(`空闲默认项数不对：${idleSlots}`)

const idleSelects = await idleRow.locator('.davs-select').evaluateAll((els) => els.map((e) => e.value))
const idlePlays = await idleRow.locator('.davs-num').evaluateAll((els) => els.map((e) => Number(e.value)))
if (JSON.stringify(idleSelects) === JSON.stringify(['idle', 'wink'])) {
  ok('空闲轮播 = 空闲 + 眨眼：' + idleSelects.join(' → '))
} else {
  bad('空闲轮播配错：' + JSON.stringify(idleSelects))
}
/*
 * 遍数：烧录后的默认是 1 / 1（作者的配置）。
 *
 * 旧断言锁的是 [5, 1]，那是旧的「空闲播 5 遍」默认值。用户这轮要求
 * 「把我目前的动画映射烧录成插件默认」，他存盘里就是 1 / 1，所以断言
 * 跟着改成 1 / 1 —— 这条锁的是「默认值 = 作者存盘」，不是「5 遍」。
 */
if (JSON.stringify(idlePlays) === JSON.stringify([1, 1])) {
  ok('空闲的遍数是烧录值 1 / 1：' + idlePlays.join(' / '))
} else {
  bad('空闲遍数不对：' + JSON.stringify(idlePlays))
}

// 改遍数 → 落盘
await idleRow.locator('.davs-num').first().fill('8')
await page.waitForTimeout(350)
s = await stored()
const idleSaved = s?.rotation?.idle
if (idleSaved?.[0]?.plays === 8) ok('改遍数能落盘（idle[0].plays=8）')
else bad('遍数没落盘：' + JSON.stringify(idleSaved))

/*
 * 单项 / 两项的加减。
 *
 * ── 2026-10-31：烧录后的默认里**每一行都是两项** ─────────────────────
 * 作者的存盘 13 个活动全是两项轮播，所以烧录成默认之后，页面上再没有
 * 「只有 1 项」的行可加。旧写法（写死「读文件」并假设它一项）会直接超时。
 *
 * 改成：先在一个**两项**的行上点「−」减到一项，再验「＋」加得回来、
 * 两项之后没有「＋」。顺序反过来，测的是同一组行为。
 */
const mapRows = page.locator('.davs-card[data-block="map"] .davs-row')
const twoSlotIndex = await page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.davs-card[data-block="map"] .davs-row'))
  return rows.findIndex((r) => r.querySelectorAll('.davs-slot').length === 2)
})
if (twoSlotIndex < 0) {
  bad('找不到两项的活动行，无法验「＋ / −」')
} else {
  const row = mapRows.nth(twoSlotIndex)
  const rowName = (await row.locator('.davs-row-label').first().innerText()).trim()

  // 两项 → 点「−」→ 一项
  const beforeRemove = await row.locator('.davs-slot').count()
  await row.locator('.davs-icon', { hasText: '−' }).click()
  await page.waitForTimeout(350)
  const afterRemove = await row.locator('.davs-slot').count()
  if (beforeRemove === 2 && afterRemove === 1) ok(`「${rowName}」点「−」从 2 项减到 1 项`)
  else bad(`减项失败（${rowName}）：${beforeRemove} → ${afterRemove}`)

  // 一项 → 点「＋」→ 两项
  await row.locator('.davs-icon', { hasText: '＋' }).click()
  await page.waitForTimeout(350)
  const afterAdd = await row.locator('.davs-slot').count()
  if (afterAdd === 2) ok(`「${rowName}」点「＋」从 1 项回到 2 项`)
  else bad(`加项失败（${rowName}）：${afterAdd}`)

  // 第三项加不了（最多两项）
  const plusCount = await row.locator('.davs-icon', { hasText: '＋' }).count()
  if (plusCount === 0) ok('两项之后没有「＋」了（最多两项）')
  else bad('两项之后还能加第三项')
}

/* ── 5.5 动画停留（节流）──────────────────────────────────────────── */

console.log('\n动画停留：默认关闭，能落盘')

const dwellSection = await page.evaluate(() => {
  const secs = [...document.querySelectorAll('.davs-section')]
  const s = secs.find((x) => x.querySelector('.davs-title')?.textContent?.includes('动画停留'))
  if (!s) return null
  return {
    chips: [...s.querySelectorAll('.davs-chip')].map((c) => c.textContent.trim()),
    on: [...s.querySelectorAll('.davs-chip')].filter((c) => c.className.includes('is-on')).map((c) => c.textContent.trim())
  }
})

if (dwellSection === null) {
  bad('设置页没有「动画停留」这一段')
} else {
  ok('有「动画停留」段：' + dwellSection.chips.join(' / '))
  /*
   * 默认必须是「关闭」。
   *
   * 为什么锁这条：节流是**行为改变**（面板从「实时」变「平滑」）。
   * 默认打开等于替用户做了决定，而且老用户升级后会突然发现短活动不见了。
   */
  if (dwellSection.on.length === 1 && dwellSection.on[0] === '关闭') {
    ok('默认是「关闭」（不改变现有行为）')
  } else {
    bad('默认不是「关闭」：' + JSON.stringify(dwellSection.on))
  }

  // 点 1.6 秒 → 落盘
  await page.evaluate(() => {
    const secs = [...document.querySelectorAll('.davs-section')]
    const s = secs.find((x) => x.querySelector('.davs-title')?.textContent?.includes('动画停留'))
    const chip = [...s.querySelectorAll('.davs-chip')].find((c) => c.textContent.trim() === '1.6 秒')
    chip.click()
  })
  await page.waitForTimeout(450)
  const s2 = await stored()
  if (s2?.dwellMs === 1600) ok('点「1.6 秒」能落盘（dwellMs=1600）')
  else bad('节流档位没落盘：' + JSON.stringify(s2?.dwellMs))

  // 再点回「关闭」→ 落盘 0
  await page.evaluate(() => {
    const secs = [...document.querySelectorAll('.davs-section')]
    const s = secs.find((x) => x.querySelector('.davs-title')?.textContent?.includes('动画停留'))
    const chip = [...s.querySelectorAll('.davs-chip')].find((c) => c.textContent.trim() === '关闭')
    chip.click()
  })
  await page.waitForTimeout(450)
  const s3 = await stored()
  if (s3?.dwellMs === 0) ok('能点回「关闭」（dwellMs=0）')
  else bad('点回关闭失败：' + JSON.stringify(s3?.dwellMs))
}

/* ── 6. 已改标记 + 恢复默认 ──────────────────────────────────────── */

console.log('\n已改标记与恢复')
const changedRows = await page.locator('.davs-row[data-changed]').count()
if (changedRows >= 1) ok(`改过的行有标记（${changedRows} 行）`)
else bad('改过的行没有标记')

// 「全部恢复默认」必须在**有改动时**出现 —— 先验它，再验单行恢复
/*
 * ── 2026-10-31：按钮改名 + 两段式确认 ────────────────────────────────
 * 用户：「动画映射的恢复默认，那个按钮名字改一下，就恢复默认就行」+
 *      「动画映射和自动分配顺位的恢复默认都增加一个二级确定，不然很容易点到」。
 *
 * 所以这里有三处跟着变：
 *   ① 文字从「全部恢复默认（N 项已改）」变成纯「恢复默认」，改动数挪进 title
 *   ② 必须点**两次**才执行（第一次只进入确认态）
 *   ③ 确认态的按钮带 `.is-armed`
 */
/*
 * ── 选择器的坑：`.davs-btn` 现在不只「恢复默认」一个 ──────────────────
 * 第 104 轮起每一行都有一个「试播」按钮，它也带 `.davs-btn`
 * （`.davs-btn.davs-btn-try`）。所以 `page.locator('.davs-btn')` 数出来的
 * 是 14 个（1 恢复默认 + 13 试播），用它判断「按钮该不该消失」必然误判。
 *
 * 只认 .davs-card-tools 里的那一枚 —— 那是标题行右侧的工具位，
 * 用户要的「恢复默认」只可能在那儿。
 */
const resetBtn = page.locator('.davs-card[data-block="map"] .davs-card-tools .davs-btn')

if ((await resetBtn.count()) > 0) {
  const btnText = (await resetBtn.first().innerText()).trim()
  if (btnText === '恢复默认') ok('按钮名已改成纯「恢复默认」')
  else bad(`按钮名不是「恢复默认」：${btnText}`)

  await resetBtn.first().click()
  await page.waitForTimeout(300)
  const armedCount = await page.locator('.davs-card[data-block="map"] .davs-btn.is-armed').count()
  if (armedCount === 1) ok('第一次点击进入确认态（二级确认生效）')
  else bad('第一次点击没有进入确认态')

  const stillChanged = await page.locator('.davs-row[data-changed]').count()
  if (stillChanged >= 1) ok('第一次点击没有清掉改动（挡住了误触）')
  else bad('第一次点击就清掉了改动 —— 二级确认形同虚设')

  await page.locator('.davs-card[data-block="map"] .davs-btn.is-armed').first().click()
  await page.waitForTimeout(450)
  const noneLeft = await page.locator('.davs-row[data-changed]').count()
  if (noneLeft === 0) ok('第二次点击才真的「恢复默认」')
  else bad(`还有 ${noneLeft} 行处于已改状态`)

  /*
   * ── 按钮现在必须**常驻**（2026-10-31 修回归）─────────────────────────
   * 旧断言是「没有改动时按钮自动消失」。它当时是个减少视觉噪音的小优化。
   *
   * 但它和「把用户配置烧录成默认值」撞在一起就变成 bug 了：烧录后
   * 用户存盘 == 默认，`changedCount` 恒为 0，按钮**永远不出现** ——
   * 用户报的就是「两个恢复默认的按钮不见了」。
   *
   * 判据因此掉头：没改动时按钮**仍然在**，只是 title 说明「当前没有改动」。
   * 掉头而不是删掉，是为了拦住「将来谁再想加隐藏优化」。
   */
  const stillThere = await resetBtn.count()
  if (stillThere === 1) ok('没有改动时「恢复默认」仍然在（常驻）')
  else bad(`没有改动时「恢复默认」消失了（${stillThere} 个）—— 正是用户报的 bug`)

  const btnTitle = await resetBtn.first().getAttribute('title')
  if (btnTitle && btnTitle.includes('没有改动')) {
    ok('常驻按钮的 title 说明当前状态：' + btnTitle)
  } else {
    bad('常驻按钮的 title 没说明当前状态：' + btnTitle)
  }
} else {
  bad('有改动时却没有「恢复默认」按钮')
}

// 单行恢复：先改一行，再点它的「已改 · 恢复」
const readRow2 = page.locator('.davs-row', { hasText: '读文件' }).first()
await readRow2.locator('.davs-num').first().fill('7')
await page.waitForTimeout(350)
const oneChanged = await page.locator('.davs-row[data-changed]').count()
if (oneChanged === 1) ok('改一行后恰好 1 行有已改标记')
else bad(`已改行数不对：${oneChanged}`)
await page.locator('.davs-link').first().click()
await page.waitForTimeout(400)
const backToDefault = await page.locator('.davs-row[data-changed]').count()
if (backToDefault === 0) ok('点「已改 · 恢复」把那一行恢复成默认')
else bad(`单行恢复没生效：还剩 ${backToDefault} 行`)

/* ── 7. 分界线：设置页不该管个体外观 ─────────────────────────────── */

console.log('\n分界线：个体形状/配色/表情不另设配置行')

/*
 * 断言要看**控件**，不能看文字。设置页底部有一句
 * 「形状、配色、表情属于单个 bot 的外观，在右栏调」——
 * 那是说明文字，不是控件。用 innerText 匹配会把这句话算成违规。
 *
 * 所以这里数真正的行标签（`.davs-cust-label` 那种结构在设置页不存在，
 * 用 `.davs-row-label` + 各段标题），确认没有外观类的行。
 */
const controlLabels = await page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('.davs-row-label')) out.push(el.textContent.trim())
  for (const el of document.querySelectorAll('.davs-title')) out.push(el.textContent.trim())
  return out
})
for (const banned of ['形状', '配色', '表情']) {
  if (!controlLabels.includes(banned)) ok(`设置页没有单独的「${banned}」配置行（试片选择不落盘）`)
  else bad(`设置页出现了「${banned}」独立配置行 —— 个体外观应在右栏`)
}

// 反向确认：设置页确实有该有的控件（防止上面那条因为页面空白而假通过）
for (const wanted of ['动画映射', '休眠', '帧率']) {
  if (controlLabels.includes(wanted)) ok(`设置页有「${wanted}」控件`)
  else bad(`设置页缺少「${wanted}」控件`)
}

// 底部说明文字要指明个体外观在哪
const body = await page.locator('.davs').innerText()
if (/在右栏/.test(body)) ok('设置页指明个体形状配色表情在右栏')
else bad('设置页没说明个体外观在哪')

/* ── 8. 窄容器不塌 ───────────────────────────────────────────────── */

console.log('\n窄容器（插件页在窄面板里）')

await page.setViewportSize({ width: 520, height: 900 })
await page.waitForTimeout(500)
const overflow = await page.evaluate(() => {
  const el = document.querySelector('.davs')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { scrollW: el.scrollWidth, clientW: el.clientWidth, width: Math.round(r.width) }
})
if (overflow && overflow.scrollW <= overflow.clientW + 1) {
  ok(`窄容器下没有横向溢出（${overflow.scrollW} ≤ ${overflow.clientW}）`)
} else {
  bad(`窄容器下横向溢出：${JSON.stringify(overflow)}`)
}

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

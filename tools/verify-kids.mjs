/**
 * 子代理小框（内嵌在格子里）的验证。
 *
 * 对应本轮需求：子代理不再侵占主代理的格子高度（旧形态是底部 1/3 横条，
 * 会把主代理的框挤矮），而是**内嵌在主代理格子内部左下角的小矩形框**，
 * 里面是一个静态的眨眼脸 + 数量，尺寸自适应。
 *
 * 这条脚本锁住的判据（每一条都对应一次实测踩坑）：
 *   1. 小框存在，且在格子**内部**（不是格子外的一条横条）
 *   2. 小框**不参与布局** —— 有无小框，格子与头像的尺寸不变
 *   3. 小框不压住名字/状态文字（9 格密排时最容易犯）
 *   4. 里面只有 1 个 bot，且是**静止**的（不出 rAF，帧不变）
 *   5. 是矩形框（小圆角），不是胶囊
 *   6. 从上方弹出（translateY 负值 → 0）
 *   7. 面板开着时仍然显示（旧横条要隐藏是因为它会挤格子；覆盖层不用）
 *   8. 每格各算各的 —— 多格时只有真有子代理的格子带小框
 *
 * 用法（在 grokbot 目录下）：node tools/verify-kids.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
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

const kids = () => tab.locator('.davf-kids')
const cells = () => tab.locator('.davf-cell').count()

/** 勾到 target 格（含当前窗口那 1 个）。
 *
 * 只点**还没勾**的行：`.davf-pick-row` 是开关，重复点同一行会取消勾选。
 * 第一版没判 is-on，于是从 4 格加 9 格时把已勾的 3 行又点掉了，
 * 结果停在 6 格 —— 断言报「格数不对」，看着像布局坏了，其实是脚本在减格。
 *
 * 现在**两个方向都走**：扫 1~9 格时要能回到更少的格数，所以多出来的
 * 格子用格子上的 ✕ 摘掉。只增不减的话，逐档扫完停在 9 格，后面
 * 「加回 4 格」的断言必然失败。
 */
async function fillTo(n) {
  let have = await tab.locator('.davf-cell').count()
  // 减：点掉多余的格子（当前窗口那格没有 ✕，所以减不到 1 以下）
  while (have > n) {
    const cell = tab.locator('.davf-cell').nth(have - 1)
    await cell.hover()
    await tab.waitForTimeout(180)
    const rm = cell.locator('.davf-cell-remove')
    if ((await rm.count()) === 0) break
    await rm.click()
    await tab.waitForTimeout(280)
    const next = await tab.locator('.davf-cell').count()
    if (next === have) break
    have = next
  }
  if (have === n) return

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
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const c = await rows.count()
  have = await tab.locator('.davf-cell').count()
  for (let i = 0; i < c && have < n; i++) {
    const row = rows.nth(i)
    if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
    await row.click()
    await tab.waitForTimeout(110)
    have = await tab.locator('.davf-cell').count()
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(450)
}

/* ── 1. 小框存在，且在格子内部 ───────────────────────────────────── */

console.log('1. 小框存在且在格子内部')

if ((await cells()) === 1) ok('初始 1 格（只监视当前窗口）')
else bad('初始格数不对：' + (await cells()))

if ((await kids().count()) === 1) ok('1 格且有子代理 → 小框出现')
else bad('小框没出现')

// 必须是格子的后代节点（旧横条是 .davf-body 的直接子节点）
const nested = await tab.evaluate(() => {
  const k = document.querySelector('.davf-kids')
  const cell = document.querySelector('.davf-cell')
  return k !== null && cell !== null && cell.contains(k)
})
if (nested) ok('计数行是格子的后代节点（内嵌在格子里，不是独立横条）')
else bad('计数行不在格子里 —— 还是旧横条那种布局')

// 数量必须是 4（s1~s4 都以 a1 为父），且带「×」前缀 + 「子代理」字样
const countText = (await tab.locator('.davf-kids-count').innerText()).trim()
if (countText === '×4') ok(`数量显示 ×4（实际 ${countText}）`)
else bad('数量不对：' + countText)
const labelText = (await tab.locator('.davf-kids-label').innerText()).trim()
if (labelText === '子代理') ok('数量旁标明「子代理」')
else bad('「子代理」字样不对：' + labelText)

/* ── 回归锁：子代理「只在 byId、不在 ids」也必须数得到 ────────────────
   这是更早一版的真 bug：宿主 projectList() 把 subagentCatalog 投影里的
   子代理只写进 byId，不写进 ids；而 countDescendants 只遍历 list.ids，
   于是真实环境里一个都数不到 —— 表现为「明明有子代理，小框不出现」。
   预览页假数据刻意复刻这个形态，这条断言把它锁住。 */
const rowNames = await tab.evaluate(async () => {
  document.querySelector('.davf-cap')?.click()
  await new Promise((r) => setTimeout(r, 320))
  for (const h of document.querySelectorAll('.davf-ws-head')) {
    if (!(h.className ?? '').includes('is-open')) h.click()
    await new Promise((r) => setTimeout(r, 120))
  }
  return Array.from(document.querySelectorAll('.davf-pick-name')).map((e) => e.textContent.trim())
})
const kidNames = ['检索手', '命令行工', '写手', '审查员']
const leaked = kidNames.filter((n) => rowNames.includes(n))
if (leaked.length === 0) {
  ok(`子代理不在可勾选列表里（共 ${rowNames.length} 行）—— 假数据复刻了真实形态`)
} else {
  bad(`子代理出现在勾选列表里（${leaked.join('、')}），假数据形态不对，回归锁失效`)
}
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)
if ((await kids().count()) === 1) {
  ok('即便如此小框仍数到子代理 → countDescendants 扫的是全部 byId')
} else {
  bad('小框没出现 —— countDescendants 仍然只扫 ids（旧 bug 复发）')
}

/* ── 2. 它在文字区（meta）的第三行 ─────────────────────────────────
   上一版它是浮在头像上的覆盖层。用户报的问题是：覆盖层要在头像上找一次、
   再回文字区找一次，是两套坐标。现在放进 meta 的第三行，
   名字 → 状态 → 子代理 是同一条竖线。

   判据三条：
     a. 它是 `.davf-cell-meta` 的后代（不是 `.davf-cell-bot` 的后代）
     b. 它在状态行**下方**（纵向不重叠，且 top ≥ 状态行 bottom）
     c. 它不再绝对定位（是文档流里的一行，参与 meta 的纵向排布） */
console.log('\n2. 位置：文字区第三行（不是头像覆盖层）')

const place = await tab.evaluate(() => {
  const cell = document.querySelector('.davf-cell')
  const k = cell?.querySelector('.davf-kids')
  const meta = cell?.querySelector('.davf-cell-meta')
  const botArea = cell?.querySelector('.davf-cell-bot')
  const act = cell?.querySelector('.davf-cell-act')
  const name = cell?.querySelector('.davf-cell-name')
  if (!k || !meta || !act || !name) return null
  const R = (e) => e.getBoundingClientRect()
  const kb = R(k)
  const ab = R(act)
  const nb = R(name)
  return {
    inMeta: meta.contains(k),
    inBotArea: botArea ? botArea.contains(k) : false,
    belowAct: kb.top >= ab.bottom - 1,
    belowName: kb.top >= nb.top,
    position: getComputedStyle(k).position,
    hitsAct: !(kb.bottom <= ab.top || kb.top >= ab.bottom),
    hitsName: !(kb.bottom <= nb.top || kb.top >= nb.bottom)
  }
})
if (place?.inMeta) ok('它是 .davf-cell-meta 的后代 → 在文字区里')
else bad('它不在文字区里 —— 还是头像覆盖层')
if (place && !place.inBotArea) ok('它不在头像区（不再浮在头像上）')
else bad('它还在头像区')
if (place?.belowAct) ok('它在状态行下方 → 是第三行')
else bad('它不在状态行下方 —— 位置不是第三行')
if (place?.position !== 'absolute') ok(`它不是绝对定位（position:${place?.position}）→ 参与布局`)
else bad('它仍是绝对定位 —— 还是覆盖层')
if (place && !place.hitsName && !place.hitsAct) ok('它不压名字、也不压状态（三行各占各的）')
else bad('它压住了名字或状态')

/* ── 3. 图案固定：跨格数、跨外观，图标完全一致 ──────────────────────
   这是用户这次的核心诉求。之前图标继承 `cellLook`，而顺位预设让第 1 格
   圆、第 2 格圆角方、第 3 格三角…… 增减格子会让图案整体前移，用户看到
   的就是「每次都在变，丑丑的」。

   判据：把 SVG 的 path `d` + `fill` 拼成签名，1/4/9 格三档必须**完全相同**。
   只比 `d` 不够 —— 配色不同时 `d` 可能相同，`fill` 才抓得到。

   跨格数的比对在第 8 节（那里本来就要逐档扫格数），这里先确认签名取得到。 */
console.log('\n3. 图案固定（不随格数/外观变化）')

const sigNow = async () =>
  tab.evaluate(() => {
    const svg = document.querySelector('.davf-kids-bot svg')
    if (!svg) return null
    return Array.from(svg.querySelectorAll('path'))
      .map((p) => `${p.getAttribute('d') ?? ''}|${p.getAttribute('fill') ?? ''}`)
      .join('#')
  })

const sig1 = await sigNow()
if (sig1) ok(`1 格时取到图标签名（${sig1.length} 字符）`)
else bad('取不到图标签名')

/* ── 4. 里面只有 1 个 bot，且是静止的 ─────────────────────────────── */

console.log('\n4. 一个静止的 bot')

const kidsSvg = await tab.locator('.davf-kids-bot svg').count()
if (kidsSvg === 1) ok('里面只有 1 个 bot（不逐个监测子代理）')
else bad(`里面 bot 数量不对：${kidsSvg}`)

// 静止 = 不启动 rAF 循环。判据是「同一路径连续采样不变」：
// 让它播动画的话，1.2 秒内身体路径必然变化（呼吸 3.4 秒一圈，至少有几个数值变）。
const still = await tab.evaluate(async () => {
  const path = document.querySelector('.davf-kids-bot svg path')
  if (!path) return null
  const a = path.getAttribute('d')
  await new Promise((r) => setTimeout(r, 1200))
  const b = path.getAttribute('d')
  return { same: a === b, len: a?.length ?? 0 }
})
if (still?.same) ok(`路径 1.2 秒内没变 → 静止渲染，不出 rAF 循环（d 长 ${still.len}）`)
else bad('小框里的 bot 在动 —— 应该是 frozenAt 的静止帧')

/* 而且是**睁眼**的。
   上一版取的是半闭帧（那时它是「眨眼指示器」）。现在它是「子代理图标」，
   要表达「这只 bot 是谁」，不是「它正在眨眼」；用户给的参考图也是睁眼。

   判据：眼睛 path 的 matrix 里，纵向行/横向行 ≈ 1（没有纵向压缩）。
   眨眼在引擎里是屏幕坐标系的纵向压缩，所以 k<0.6 就说明在闭眼。
   注意不能用 hypot(a,b)/hypot(c,d)：那是**列**向量，纵压缩会同时污染
   两列，算出来恒接近 1。 */
const eyeK = await tab.evaluate(() => {
  const svg = document.querySelector('.davf-kids-bot svg')
  const paths = Array.from(svg?.querySelectorAll('path') ?? [])
  const eyes = paths.filter((p) => (p.getAttribute('transform') ?? '').startsWith('matrix'))
  const m = eyes[0]?.getAttribute('transform') ?? ''
  const nums = m
    .replace(/matrix\(|\)/g, '')
    .split(/[ ,]+/)
    .filter(Boolean)
    .map(Number)
  if (nums.length < 4) return null
  const row1 = Math.hypot(nums[0], nums[2])
  const row2 = Math.hypot(nums[1], nums[3])
  return row1 > 0 ? row2 / row1 : 0
})
if (eyeK !== null && eyeK > 0.85) {
  ok(`眼睛纵向/横向 = ${eyeK.toFixed(2)} → 睁眼（不是眯眼）`)
} else {
  bad(`眼睛被压扁（k=${eyeK?.toFixed(2)}）→ 还是眨眼帧，不是睁眼图标`)
}

// 眼睛在屏幕上必须真的看得见。实测 12px（当前）有 2.44px，10px 只有
// 2.04px 开始糊。这条锁住「图标不能被改小到看不出眼睛」。
// 注意：这个阈值是按**睁眼帧**定的。眯眼帧下眼睛被纵向压扁，同一尺寸
// 只剩一半高度 —— 换帧时刻必须重新量，不能沿用旧阈值（上一版 28px
// 的结论就是这么来的：那是眯眼帧的数据，换成睁眼后 12px 就够）。
const eyePx = await tab.evaluate(() => {
  const svg = document.querySelector('.davf-kids-bot svg')
  const eye = svg?.querySelector('path[transform^="matrix"]')
  if (!eye) return null
  const r = eye.getBoundingClientRect()
  return { w: +r.width.toFixed(2), h: +r.height.toFixed(2) }
})
if (eyePx && eyePx.h >= 2.2) {
  ok(`眼睛在屏幕上 ${eyePx.w}×${eyePx.h}px → 看得出是眼睛，不是黑点`)
} else {
  bad(`眼睛只有 ${eyePx?.h}px 高 → 整张脸是黑点`)
}

/* ── 5. 胶囊，不是矩形 ─────────────────────────────────────────────
   形态随需求反转过一次：上一版用户要「小的矩形框」，这一版要胶囊。
   判据也要跟着反过来 —— 否则测试会守着旧形态、把新的当回归。

   胶囊的判据：圆角 ≥ 框高的一半（两头全圆）。`border-radius:999px`
   在窄框里会被浏览器夹到 height/2，所以量出来的值正好是 h/2。 */
console.log('\n5. 胶囊（两头全圆）')

const radius = await tab.evaluate(() => {
  const k = document.querySelector('.davf-kids')
  if (!k) return null
  const cs = getComputedStyle(k)
  const r = k.getBoundingClientRect()
  return { radius: parseFloat(cs.borderTopLeftRadius), h: r.height, w: r.width }
})
if (radius && radius.radius >= radius.h / 2 - 0.5) {
  ok(`圆角 ${radius.radius}px ≈ 框高一半（${Math.round(radius.h)}px）→ 是胶囊`)
} else {
  bad(`圆角 ${radius?.radius}px / 框高 ${Math.round(radius?.h ?? 0)}px → 还是矩形，不是胶囊`)
}

/* ── 6. 从上方弹出 ───────────────────────────────────────────────── */

console.log('\n6. 入场动画：从上方弹出')

const anim = await tab.evaluate(() => {
  const k = document.querySelector('.davf-kids')
  if (!k) return null
  const names = k.getAnimations().map((a) => a.animationName ?? '(waapi)')
  // 直接读 keyframes 的起始 transform，比猜动画名可靠
  let start = ''
  for (const sheet of Array.from(document.styleSheets)) {
    let rules
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(rules ?? [])) {
      if (rule.type === CSSRule.KEYFRAMES_RULE && rule.name === 'davf-kids-in') {
        const first = rule.cssRules[0]
        start = first?.style?.transform ?? ''
      }
    }
  }
  return { names, start }
})
if (anim && anim.names.length > 0) ok('小框有入场动画：' + JSON.stringify(anim.names))
else bad('小框没有入场动画')
if (/translateY\(\s*-/.test(anim?.start ?? '')) {
  ok(`起始位移向上（${anim.start}）→ 从上往下弹出`)
} else {
  bad(`起始位移不是向上：${anim?.start || '(空)'}`)
}

/* ── 7. 面板开着时仍显示 ─────────────────────────────────────────── */

console.log('\n7. 面板开着时小框照常显示（覆盖层不需要让位）')

await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(450)
if ((await kids().count()) === 1) ok('外观面板打开 → 小框仍在（旧横条在这里必须隐藏）')
else bad('外观面板打开后小框消失了 —— 它不该再受面板开合影响')

// 而且面板开着时格子仍然完整（面板在上方，小框在格子内，两者不打架）
const bothFit = await tab.evaluate(() => {
  const g = document.querySelector('.davf-grid')
  const c = document.querySelector('.davf-cell')
  return g !== null && c !== null && c.getBoundingClientRect().height > 40
})
if (bothFit) ok('面板打开时格子仍有可用高度（没有被挤没）')
else bad('面板打开时格子被压到 40px 以下')

await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(400)

await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(450)
if ((await kids().count()) === 1) ok('对话面板打开 → 小框仍在')
else bad('对话面板打开后小框消失了')
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(400)

/* ── 8. 每格各算各的 ─────────────────────────────────────────────── */

console.log('\n8. 多格时只有真有子代理的格子带小框')

/* ── 回归锁：小框在**每一档格数**下都必须还在 ──────────────────────
   这条是补的，因为漏掉它真的放过了 bug：`.davf-cell-bot` 少了
   `position:relative` 时，小框会去锚更外层的定位祖先，再被那层的
   `overflow:hidden` 裁掉 —— 单格时高度富裕看着没事，**2 格起全部消失**。
   当时的断言只测「1 格」和「9 格」（9 格那段因为格子变矮反而又量得到
   位置，掩盖了消失），于是中间 2~8 格全没覆盖，测试是绿的。

   教训：这类「随格数退化」的布局问题，必须逐档扫，不能抽首尾两点。 */
/* ── 回归锁：小框在**每一档格数**下都必须还在，且图案完全不变 ──────
   两个判据一起扫，因为它们会在同一个场景下退化：

   a. 存在性：`.davf-cell-bot` 少了 `position:relative` 时，小框会去锚
      更外层的定位祖先，再被那层的 `overflow:hidden` 裁掉 —— 单格时
      高度富裕看着没事，**2 格起全部消失**。当时的断言只测「1 格」和
      「9 格」，中间 2~8 格全没覆盖，测试是绿的。

   b. 图案固定：图标曾经继承 `cellLook`，而顺位预设让第 N 格拿到不同的
      身形/表情。增减格子会让后面的格子整体前移，图案跟着换 —— 用户看到的
      就是「每次都在变」。现在固定成 DEFAULT_LOOK，签名必须跨格数一致。

   教训：这类「随格数退化」的问题必须逐档扫，不能抽首尾两点。 */
const perCellCounts = []
const perCellSigs = []
for (let n = 1; n <= 9; n++) {
  if (n > 1) await fillTo(n)
  const s = await tab.evaluate(() => ({
    cells: document.querySelectorAll('.davf-cell').length,
    badges: document.querySelectorAll('.davf-kids').length,
    sig: (() => {
      const svg = document.querySelector('.davf-kids-bot svg')
      if (!svg) return null
      return Array.from(svg.querySelectorAll('path'))
        .map((p) => `${p.getAttribute('d') ?? ''}|${p.getAttribute('fill') ?? ''}`)
        .join('#')
    })()
  }))
  perCellCounts.push({ want: n, ...s })
  if (s.sig) perCellSigs.push({ n, sig: s.sig })
}
const broken = perCellCounts.filter((r) => r.cells === r.want && r.badges < 1)
if (broken.length === 0) {
  ok(`1~9 格逐档都带小框（${perCellCounts.map((r) => r.badges).join('/')}）`)
} else {
  bad(`这些格数下小框消失了：${broken.map((r) => `${r.want}格(框${r.badges})`).join('、')}`)
}

const sigSet = new Set(perCellSigs.map((r) => r.sig))
if (perCellSigs.length >= 8 && sigSet.size === 1) {
  ok(`1~9 格逐档图案完全一致（${perCellSigs.length} 档、1 种签名）→ 固定图标`)
} else {
  bad(`图案随格数变了：${perCellSigs.length} 档里有 ${sigSet.size} 种签名`)
}

await fillTo(4)
if ((await cells()) === 4) ok('已加到 4 格')
else bad('格数不对：' + (await cells()))

// 假数据里只有 a1 有子代理，且 a1 是当前窗口 → 4 格里只该有 1 个小框
const n4 = await kids().count()
if (n4 === 1) ok('4 格时只有 1 个小框（只有当前窗口有子代理）')
else bad(`4 格时小框数量不对：${n4}（应为 1）`)

// 有子代理的那格必须正是第一格
const whichCell = await tab.evaluate(() => {
  const cell = document.querySelector('.davf-cell')
  return cell?.querySelector('.davf-kids') !== null
})
if (whichCell) ok('小框长在有子代理的那一格（第一格）')
else bad('小框没长在有子代理的格子上')

/* ── 9 格密排时同样不压文字 ─────────────────────────────────────── */
await fillTo(9)
if ((await cells()) === 9) ok('已加到 9 格')
else bad('格数不对：' + (await cells()))

const dense = await tab.evaluate(() => {
  const cell = document.querySelector('.davf-cell')
  if (!cell) return null
  const b = cell.querySelector('.davf-kids')?.getBoundingClientRect()
  const n = cell.querySelector('.davf-cell-name')?.getBoundingClientRect()
  const a = cell.querySelector('.davf-cell-act')?.getBoundingClientRect()
  const c = cell.getBoundingClientRect()
  if (!b) return null
  const hits = (x, y) => x && y && !(x.bottom <= y.top || x.top >= y.bottom || x.right <= y.left || x.left >= y.right)
  return {
    hitsName: hits(b, n),
    hitsAct: hits(b, a),
    insideCell: b.left >= c.left - 1 && b.right <= c.right + 1 && b.top >= c.top - 1 && b.bottom <= c.bottom + 1,
    cellH: Math.round(c.height),
    badgeH: Math.round(b.height),
    eyeH: (() => {
      const e = cell.querySelector('.davf-kids-bot path[transform^="matrix"]')
      return e ? +e.getBoundingClientRect().height.toFixed(2) : null
    })()
  }
})
if (dense?.insideCell) ok(`9 格密排时小框仍在格子内（格子 ${dense.cellH}px 高，小框 ${dense.badgeH}px）`)
else bad('9 格密排时小框超出格子')
if (!dense?.hitsName) ok('9 格密排时没压住名字')
else bad('9 格密排时压住了名字')
if (!dense?.hitsAct) ok('9 格密排时没压住状态文字')
else bad('9 格密排时压住了状态文字')
// 密排时格子变小，但图标是固定尺寸 —— 眼睛仍然要看得见
if (dense?.eyeH !== null && dense.eyeH >= 2.2) ok(`9 格密排时眼睛仍 ${dense.eyeH}px → 看得见`)
else bad(`9 格密排时眼睛只有 ${dense?.eyeH}px → 变成黑点了`)

/* ── 10. 尺寸恒定：图标不随栏宽变 ───────────────────────────────
   上一版是「按头像 26% 自适应」，因为那时要「小框相对主代理视觉权重一致」。
   现在图案固定成图标，尺寸再随栏宽变就成了「同一张图忽大忽小」，反而更像
   拼贴。所以判据反过来：**跨栏宽必须完全一样**。

   同时锁住两件事：
     a. 窄栏不溢出格子（96px 的格子装得下 86px 的计数行）
     b. 「子代理」三字在极窄栏仍能显示（不再需要降级 —— 图标固定后
        整行宽度也固定了，96px 刚好够） */
console.log('\n10. 尺寸恒定（图标不随栏宽变，且窄栏不溢出）')

const sizeRows = []
for (const w of [116, 240, 360, 562]) {
  // 每次开独立 context：localStorage 里的 ui 状态（picked/look）是共享的，
  // 复用同一个 context 会让后面的档位带着前面的勾选，量到多格尺寸。
  const c2 = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const p = await c2.newPage()
  await p.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await p.goto(pathToFileURL(target).href + `?w=${w}&h=760`)
  await p.waitForTimeout(700)
  const r = await p.evaluate(() => {
    const cell = document.querySelector('.davf-cell')
    const k = cell?.querySelector('.davf-kids')
    const icon = k?.querySelector('.davf-kids-bot')
    const c = cell?.getBoundingClientRect()
    const b = k?.getBoundingClientRect()
    const i = icon?.getBoundingClientRect()
    return {
      cellW: c ? Math.round(c.width) : 0,
      icon: i ? Math.round(i.width) : 0,
      badgeW: b ? Math.round(b.width) : 0,
      badgeH: b ? Math.round(b.height) : 0,
      text: k ? k.textContent.trim() : '',
      overCell: b && c ? Math.round(b.right - c.right) : 0
    }
  })
  sizeRows.push({ w, ...r })
  await c2.close()
}

for (const r of sizeRows) {
  console.log(
    `     栏宽 ${String(r.w).padEnd(4)} 格子 ${String(r.cellW).padEnd(4)} 图标 ${String(r.icon).padEnd(3)}` +
      ` 计数行 ${String(r.badgeW + '×' + r.badgeH).padEnd(9)} ${JSON.stringify(r.text)}` +
      (r.overCell > 0 ? `  溢出 ${r.overCell}px` : '')
  )
}

const icons = new Set(sizeRows.map((r) => r.icon))
if (icons.size === 1) ok(`栏宽 116~562 之间图标尺寸恒定为 ${[...icons][0]}px → 是图标不是缩略图`)
else bad(`图标尺寸随栏宽变了：${[...icons].join('/')}px`)

const spill = sizeRows.filter((r) => r.overCell > 0)
if (spill.length === 0) ok('116~562 各档计数行都没溢出格子边框')
else bad(`这些栏宽下溢出格子：${spill.map((r) => `${r.w}(${r.overCell}px)`).join('、')}`)

const noLabel = sizeRows.filter((r) => !r.text.includes('子代理'))
if (noLabel.length === 0) ok('各档都带「子代理」字样（图标固定后宽度够，不用降级）')
else bad(`这些栏宽下「子代理」字样丢了：${noLabel.map((r) => r.w).join('、')}`)

/* ── 收尾 ────────────────────────────────────────────────────────── */

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

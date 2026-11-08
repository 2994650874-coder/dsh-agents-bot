/**
 * 验证用户实际打开的那两个页面（settings.html / anim-lab.html）在真浏览器里
 * 跑的是**新引擎**。
 *
 * ── 为什么必须有这一步 ──────────────────────────────────────────────
 * 这一轮已经踩过一次：`preview/turn94.html` 看板是好的，但 `settings.html`
 * 用的 `settings.js` 是上一次构建的产物，里面还是旧引擎。看板和用户看的
 * 页面不是同一份代码 —— 那是最坏的一种「验证通过」。
 *
 * 判据不靠肉眼：点「加载」芯片，等一会儿，量页面上有没有**渐变填充的路径**
 * （那就是彩带）。旧版这里是彩色的圆点，只有 `fill` 是纯色、没有 `url(#…)`。
 *
 * ── 为什么要点芯片而不是选下拉框 ──────────────────────────────────
 * 第一版这里 `selectOption` 选下拉框，量出 0 条彩带 —— 但下拉框管的是
 * **轮播槽位**（9 个格子各播哪一段），试片区那个大预览由「动画」芯片组驱动
 * （`Settings.tsx` 里 `<ChipGroup title="动画">` → `preview` → `<Bot state>`）。
 * 选错控件，得到的 0 不是产品的问题。
 *
 * 用法：node tools/verify-preview-pages.mjs
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

let pass = 0
let fail = 0
function check(name, ok, detail = '') {
  if (ok) {
    pass++
    console.log(`  ok   ${name}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${detail ? `\n       ${detail}` : ''}`)
  }
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

// ── settings.html ────────────────────────────────────────────────────
console.log('\nsettings.html（用户实际打开的那一页）')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(pathToFileURL(resolve(ROOT, 'preview/settings.html')).href)
  await page.waitForTimeout(2000)

  check('页面没有 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '))

  // 动画芯片组（不是轮播下拉框）
  const chips = await page.evaluate(() =>
    [...document.querySelectorAll('.davs-chip')].map((c) => ({
      text: c.textContent.trim(),
      group: c.getAttribute('data-group') || (c.closest('[data-group]') ? c.closest('[data-group]').getAttribute('data-group') : '')
    }))
  )
  const animChips = chips.filter((c) => c.group === 'anim' || c.group === 'animation')
  check(
    '动画芯片里有「加载」',
    chips.some((c) => c.text === '加载'),
    `共 ${chips.length} 个芯片，组名：${[...new Set(chips.map((c) => c.group))].join(' / ')}`
  )
  check('没有残留的「加载（长 3.1 秒）」芯片', !chips.some((c) => c.text.includes('3.1')))
  void animChips

  // 点「加载」，等它铺开，然后量彩带
  const loadChip = page.locator('.davs-chip', { hasText: /^加载$/ }).first()
  await loadChip.click()
  await page.waitForTimeout(900)

  const painted = await page.evaluate(() => {
    const el = document.querySelector('.davs-preview-bot')
    const paths = [...el.querySelectorAll('path')]
    const circles = [...el.querySelectorAll('circle')]
    return {
      total: paths.length,
      gradientFill: paths.filter((p) => (p.getAttribute('fill') || '').startsWith('url(')).length,
      grads: el.querySelectorAll('linearGradient').length,
      // 彩球是纯色 `circle`（不是 path）—— 加载现在用这个
      dotCircles: circles.filter((c) => {
        const f = c.getAttribute('fill') || ''
        return f && f !== 'none' && !f.startsWith('url(')
      }).length,
      // 环是描边无填充的圆，用来确认「黑框」也还在
      strokes: paths.filter((p) => p.getAttribute('stroke') && !p.getAttribute('fill')).length
    }
  })
  /*
   * ── 断言对象跟着材质换（2026-10-31）───────────────────────────
   * 上一版这里量「渐变填充路径」，因为那时 `loading` 是彩带。用户这一轮
   * 把 `loading` 换回「圆形小球」（彩球），于是页面上正确的产物是**纯色
   * circle**，渐变路径数为 0 是**正确结果**，不是缺陷。
   *
   * 拿彩线的尺子量彩球，会得到一个「0 条」的失败——那不是产品坏了，是断言
   * 问错了问题。这条现在问「有没有彩色圆球」。
   */
  check(
    '点「加载」后页面上真的有彩球（纯色圆盘）',
    painted.dotCircles > 0,
    `实测 ${painted.dotCircles} 个纯色圆 / 共 ${painted.total} 条路径 / ${painted.grads} 个渐变定义（彩球不用渐变）`
  )
  /*
   * ── 这条断言被反转过一次（2026-10-31）─────────────────────────────
   * 它原本锁的是「黑框（描边圆）也还在」，因为 `loading` 从上游继承了一个
   * `whirlRing`：一个 4,5px 宽的描边圆，画在 REACH 上，先张开再收回。
   * 用户这一轮说「（加载）的黑框去掉」，那个圆就没有了 —— 页面上**没有**
   * 描边才是正确状态。
   *
   * 反过来锁而不是删掉：「没有黑框」本身是需求。删了这条，哪天有人（比如
   * 为了「和上游一致」）把环加回来，页面验证不会拦。
   */
  check(
    '加载没有黑框了（页面上没有描边圆）',
    painted.strokes === 0,
    `实测 ${painted.strokes} 条描边 —— 大于 0 说明 whirlRing 又回来了`
  )

  // 检索：量射线是否排在小球下面（dotsBehind 会让粒子先画、身体后画）
  const searchChip = page.locator('.davs-chip', { hasText: /^检索$/ }).first()
  await searchChip.click()
  await page.waitForTimeout(1000)
  const searchOrder = await page.evaluate(() => {
    const el = document.querySelector('.davs-preview-bot')
    /*
     * 只取**渲染层**的路径，跳过 `<defs>` 里的。
     *
     * 第一版没跳，量出「身体在第 0 个」—— 那个 0 是 `defs` 里给 mask 用的
     * `<path d={frame.bodyPath} fill="#fff">`，它永远排在最前，跟绘制顺序无关。
     */
    const all = [...el.querySelectorAll('path')]
    const inDefs = new Set([...el.querySelectorAll('defs path')])
    const nodes = all.filter((p) => !inDefs.has(p))

    /*
     * ── 识别「身体」不能用路径长度（2026-10-31）───────────────────
     * 第一版写成 `d.length > 300`，想当然以为身体是最大的形状。错了：
     * `search` 的身体是 `BODY.tiny`（19 px 的小黑球），路径只有 100 多字符；
     * 反而是**黑圆框那条描边圆**（REACH = 102 px）更长。结果「身体」被认成了
     * 黑圆框，量出「彩线在第 15、身体在第 7」，看上去像层级反了，其实层级是对的。
     *
     * 改成按几何判断：把路径里所有点取出来，算**最大半径**。身体是纯色填充里
     * 半径最小且非零的那个（小黑球 0.17 R）；彩线是带渐变填充的。
     */
    const maxR = (d) => {
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
      let m = 0
      for (let i = 0; i + 1 < nums.length; i += 2) {
        m = Math.max(m, Math.hypot(nums[i], nums[i + 1]))
      }
      return m
    }
    let bodyIdx = -1
    let bodyR = Infinity
    let rayIdx = -1
    let rayFirst = Infinity
    nodes.forEach((n, i) => {
      const fill = n.getAttribute('fill') || ''
      const stroke = n.getAttribute('stroke') || ''
      const d = n.getAttribute('d') || ''
      const isGrad = fill.startsWith('url(') || stroke.startsWith('url(')
      if (isGrad) {
        // 彩线：渐变填充，取第一条出现的位置
        if (i < rayFirst) {
          rayFirst = i
          rayIdx = i
        }
      } else if (!stroke && fill !== '#fff' && fill !== 'none') {
        // 身体：纯色填充、无描边。取半径最小的那个（小黑球）
        const r = maxR(d)
        if (r > 1 && r < bodyR) {
          bodyR = r
          bodyIdx = i
        }
      }
    })
    return { bodyIdx, rayIdx, total: nodes.length, bodyR: bodyR === Infinity ? -1 : bodyR }
  })
  check(
    '检索的彩线排在小球之前（被身体遮住 = 走球下面）',
    searchOrder.rayIdx >= 0 && searchOrder.bodyIdx >= 0 && searchOrder.rayIdx < searchOrder.bodyIdx,
    `彩线在第 ${searchOrder.rayIdx} 个、身体在第 ${searchOrder.bodyIdx} 个（身体半径 ${searchOrder.bodyR.toFixed(1)}px，共 ${searchOrder.total} 条路径）`
  )
  await page.close()
}

// ── anim-lab.html ────────────────────────────────────────────────────
console.log('\nanim-lab.html（交互翻看那一页）')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errs = []
  page.on('pageerror', (e) => errs.push(e.message))
  await page.goto(pathToFileURL(resolve(ROOT, 'preview/anim-lab.html')).href)
  await page.waitForTimeout(2000)

  check('页面没有 JS 报错', errs.length === 0, errs.slice(0, 3).join(' | '))

  const chipTexts = await page.evaluate(() =>
    [...document.querySelectorAll('.davs-chip')].map((c) => c.textContent.trim())
  )
  check('「加载」的芯片文案不带「短/长」', chipTexts.some((t) => t === '加载'), chipTexts.filter((t) => t.startsWith('加载')).join(' / '))
  check('没有残留的「加载（长 3.1 秒）」', !chipTexts.some((t) => t.includes('3.1')))
  await page.close()
}

await browser.close()
console.log(`\n${pass} 项通过` + (fail ? `，${fail} 项失败` : ''))
process.exitCode = fail ? 1 : 0

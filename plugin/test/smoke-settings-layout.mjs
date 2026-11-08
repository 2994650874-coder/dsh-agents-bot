/**
 * 设置页试片区版式的浏览器回归测试。
 *
 * ── 锁的是什么 ──────────────────────────────────────────────────────
 * 用户 2026-10-30 定的版式（候选 B）：左 288px 大预览 + 右几组按钮、
 * 每组固定三行。这一版有几条**容易在后续改动中悄悄退化**的性质：
 *
 *   1. bot 的绘制尺寸是 288px（= 旧 96 的三倍）—— 有人觉得「太大」随手调小，
 *      上下差就又回到 200px 那种「上下差太多」。
 *   2. 那一行是左右排的，不是上下排 —— 这是 B 与 A/C/D 的区别。
 *   3. 左右两边**等高** —— 2026-10-31 加了「配色」组以后右边成了四组，
 *      高度从 368 涨上去，而左框原先是写死的 288。现在左边改成 stretch，
 *      这条断言就是那一改的锁：谁把 stretch 去掉，差立刻回到 80px 以上。
 *   4. 任何宽度下都**不省略**标签 —— 网格列数靠 ceil(n/3) 算，
 *      有人改行数或加芯片就可能开始截断，而截断在截图里很难一眼看出。
 *
 * ── 为什么在真浏览器里测 ────────────────────────────────────────────
 * 这几条都是**布局事实**，在 jsdom 里算不出来（没有排版）。所以用真
 * chromium 打开 preview/panel.html?settings=1 的假外壳，挂真 SettingsPage。
 *
 * 用法：node plugin/test/smoke-settings-layout.mjs
 * 依赖：先跑 `node tools/build-panel.mjs` 生成 preview/panel.html。
 */
import { chromium } from 'playwright-core'
import { resolveBrowserExecutable } from './browser-executable.mjs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const SRC = fileURLToPath(new URL('../../preview/panel.html', import.meta.url))
const CHROME = resolveBrowserExecutable(chromium)

let pass = 0
const fails = []
function check(name, fn) {
  try {
    fn()
    pass++
    console.log(`  ok   ${name}`)
  } catch (e) {
    fails.push({ name, msg: String(e && e.message ? e.message : e) })
    console.log(`  FAIL ${name}`)
    console.log(`       ${e && e.message ? e.message : e}`)
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

if (!existsSync(SRC)) {
  console.log('先跑 node tools/build-panel.mjs 生成 preview/panel.html')
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

/** DSH 的 padding: 0 clamp(24px,4vw,48px)，每行 max-width:960px */
const containerOf = (vw) => Math.min(960, vw - 2 * Math.min(48, Math.max(24, vw * 0.04)))

/** 在给定窗口宽度下量一次版式。 */
async function measure(vw, panelWidth = Math.round(containerOf(vw))) {
  const page = await browser.newPage({ viewport: { width: vw, height: 900 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(SRC).href + '?settings=1&w=360')
  await page.waitForTimeout(1200)
  await page.evaluate((w) => {
    const el = document.querySelector('.fake-settings')
    if (el) el.style.flex = `0 0 ${w}px`
  }, panelWidth)
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const prev = document.querySelector('.davs-preview')
    if (!prev) return null
    const bot = prev.querySelector('.davs-preview-bot')
    const groups = prev.querySelector('.davs-groups')
    const rowsOf = (el) => {
      const tops = new Set()
      for (const c of el.querySelectorAll('.davs-chip')) tops.add(Math.round(c.getBoundingClientRect().top))
      return tops.size
    }
    let clipped = 0
    const clippedNames = []
    for (const c of prev.querySelectorAll('.davs-chip')) {
      if (c.scrollWidth > c.clientWidth + 1) {
        clipped++
        if (clippedNames.length < 3) clippedNames.push(c.textContent.trim())
      }
    }
    const per = [...prev.querySelectorAll('.davs-group')].map((g) => ({
      name: g.dataset.group,
      rows: rowsOf(g.querySelector('.davs-group-chips'))
    }))
    return {
      dir: getComputedStyle(prev).flexDirection,
      botW: Math.round(bot.getBoundingClientRect().width),
      botH: Math.round(bot.getBoundingClientRect().height),
      groupsH: Math.round(groups.getBoundingClientRect().height),
      clipped,
      clippedNames,
      per,
      chips: prev.querySelectorAll('.davs-chip').length
    }
  })
  await page.close()
  return m
}

/** DSH 最宽时（960px 容器）：完全体版式。 */
const wide = await measure(1500)

console.log('\n设置页试片区版式（B 版：左大预览 + 右三组三行）')

check('左边框和右边按钮区等高（stretch 没被去掉）', () => {
  assert(wide, '量不到 .davs-preview')
  assert(
    Math.abs(wide.botH - wide.groupsH) <= 1,
    `左 ${wide.botH} vs 右 ${wide.groupsH}，差 ${Math.abs(wide.botH - wide.groupsH)}px`
  )
})

check('左右排（预览在左、按钮在右）', () => {
  assert(wide.dir === 'row', `实测 flex-direction=${wide.dir}，期望 row`)
})

check('四组都在，一共 65 个芯片（22 动画 + 15 形状 + 12 配色 + 16 表情）', () => {
  const names = wide.per.map((p) => p.name).join(',')
  assert(names === '动画,形状,配色,表情', `组名实测 ${names}`)
  assert(wide.chips === 65, `芯片数实测 ${wide.chips}，期望 65`)
})

check('动画 / 形状 / 表情三组各三行，配色组压成一行（不然右边太高）', () => {
  for (const g of wide.per) {
    const want = g.name === '配色' ? 1 : 3
    assert(g.rows === want, `${g.name} 实测 ${g.rows} 行，期望 ${want} 行`)
  }
})

check('预览框宽度仍是 288px（旧值 96 的三倍）', () => {
  assert(wide.botW === 288, `实测 ${wide.botW}px，期望 288px`)
})

check('宽容器下没有标签被省略', () => {
  assert(wide.clipped === 0, `${wide.clipped} 个芯片被截断: ${wide.clippedNames.join(',')}`)
})

/*
 * ── 窄容器：从「左右」切到「上下」，且全宽度档位零省略 ────────────────
 *
 * 这一条锁的是最容易被忽略的回归：三行网格在窄容器里每列放不下「跑命令」，
 * 标签会变成「跑…」。断点 780 是量出来的（见 style.ts 的注释）。
 * 实测各档：窗口 520→容器 474（上下）、840→775（左右）、1200→962（左右）。
 */
console.log('\n窄容器退化（三行网格放不下时必须退回上下排 + 自然换行）')

for (const vw of [520, 760, 840, 1200]) {
  const m = await measure(vw)
  const cw = Math.round(containerOf(vw))
  check(`窗口 ${vw}px（设置页 ${cw}px）：零省略`, () => {
    assert(m, '量不到试片区')
    assert(m.clipped === 0, `${m.clipped} 个被截断: ${m.clippedNames.join(',')}`)
  })
}

const narrow = await measure(520)
check('设置页 474px 时退回上下排', () => {
  assert(narrow.dir === 'column', `实测 ${narrow.dir}，期望 column`)
})

// Desktop 窗口宽时，DSH 插件详情容器仍可能只有 412px；不能只看 @media viewport。
const embedded = await measure(1200, 412)
check('宽窗口中嵌入 412px 设置栏也须上下排且零省略', () => {
  assert(embedded.dir === 'column', `嵌入栏实测 ${embedded.dir}，期望 column`)
  assert(embedded.clipped === 0, `${embedded.clipped} 个被截断: ${embedded.clippedNames.join(',')}`)
})

await browser.close()

console.log('')
if (fails.length) {
  console.log(`${pass} 项通过，${fails.length} 项失败`)
  process.exit(1)
}
console.log(`${pass} 项通过`)

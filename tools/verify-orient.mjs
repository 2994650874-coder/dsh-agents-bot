/**
 * 格子阶梯自适应验证：同一套代码，横容器走横阶梯、竖容器走竖阶梯。
 *
 * 为什么需要单独一条：用户第 3 项需求的原话是「注册到右边之后，页面排布
 * 是不是就不那么通用了，得重新梳理自适应结构？」—— 这条验证的就是
 * 「它现在是自适应的」，而不是「写死了一套竖排」。
 *
 * 两种容器都测：
 *   竖（右栏典型值 360×760）：2→2×1，3→3×1，4→2×2，6→3×2，9→3×3
 *   横（浮窗时代/宽容器 900×520）：2→1×2，3~4→2×2，5~6→2×3，7~9→3×3
 *
 * 还测一件事：**朝向不能自我锁定**。曾经踩过的坑是拿格子区自己的宽高比
 * 判朝向，而格子区的形状又由朝向决定 —— 打开面板把格子区压扁后判成横排，
 * 关掉面板也回不来。所以这里断言「面板开合之后朝向不变」。
 *
 * 用法（在 grokbot 目录下）：node tools/verify-orient.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/** 某格数在某朝向下应有的规格 —— 与 store.ts 的 gridOf 是同一套定义。 */
const expect = (n, o) =>
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

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

/** 开一个指定尺寸的预览页，返回 tab 与几个读数函数。 */
async function open(w, h) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href + `?w=${w}&h=${h}`)
  await tab.waitForTimeout(800)

  /* 自检：容器尺寸必须真的等于请求值。
     没有这一条，参数静默失效时整个测试会「全绿但测的是同一个尺寸」——
     本项目的 goto search 选项踩过一次，宽容器那组实际跑的是竖容器。

     用 clientWidth 而不是 getBoundingClientRect().width：后者含 1px 左边框，
     会报 361 而不是 360（这个差值会让人误以为参数没生效）。 */
  const realW = await tab.evaluate(() => {
    const el = document.querySelector('.fake-right')
    return el ? el.clientWidth : -1
  })
  if (realW !== w) {
    bad(`容器宽度没生效：要 ${w}，实际 ${realW} —— 这组断言无效`)
  }

  return {
    tab,
    ctx,
    orient: () =>
      tab.evaluate(() => {
        const g = document.querySelector('.davf-grid')
        return g ? g.getAttribute('data-orient') : null
      }),
    spec: async () => {
      const cols = await tab.evaluate(() => {
        const g = document.querySelector('.davf-grid')
        return g ? getComputedStyle(g).gridTemplateColumns.split(' ').filter(Boolean).length : 0
      })
      const rows = await tab.evaluate(() => {
        const g = document.querySelector('.davf-grid')
        return g ? getComputedStyle(g).gridTemplateRows.split(' ').filter(Boolean).length : 0
      })
      return rows === 1 && cols === 1 ? '1' : `${rows}×${cols}`
    },
    cells: () => tab.locator('.davf-cell').count()
  }
}

/**
 * 勾到 n 格（含当前窗口那一格）。
 *
 * 关键：只点**还没勾上**的行。
 * 第一版从第 0 行开始点，于是第二次调用会把上一次勾的又点掉 ——
 * 表现为「想加到 3 格，结果还是 2 格」，看着像实现有问题，其实是测试自己
 * 在反复开关同一个复选框。判据用行上的 `is-on` 类（已勾选）。
 */
async function fillTo(p, n) {
  const now = await p.cells()
  let need = n - now
  if (need <= 0) return
  await p.tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await p.tab.waitForTimeout(320)
  const heads = p.tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await p.tab.waitForTimeout(140)
    }
  }
  // 排除「当前窗口」行（不可勾）与「已勾选」行
  const rows = p.tab.locator('.davf-pick-row').filter({ hasNot: p.tab.locator('.davf-pick-tag') })
  const c = await rows.count()
  for (let i = 0; i < c && need > 0; i++) {
    const row = rows.nth(i)
    const cls = (await row.getAttribute('class')) ?? ''
    if (cls.includes('is-on')) continue // 已经勾上了，再点就是取消
    await row.click()
    await p.tab.waitForTimeout(110)
    need--
  }
  await p.tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await p.tab.waitForTimeout(450)
}

/* ══ 竖容器：右栏典型尺寸 360×760 ══════════════════════════════════ */
console.log('竖容器 360×760（右栏典型值）')
{
  const p = await open(360, 760)
  const o = await p.orient()
  if (o === 'portrait') ok('朝向判为 portrait')
  else bad(`朝向判错：${o}（360 宽 < 760 高，应为 portrait）`)

  if ((await p.cells()) === 1 && (await p.spec()) === '1') ok('1 格 → 1')
  else bad(`1 格不对：${await p.spec()}`)

  for (const n of [2, 3, 4, 6, 9]) {
    await fillTo(p, n)
    const got = await p.cells()
    const s = await p.spec()
    const want = expect(n, 'portrait')
    if (got === n && s === want) ok(`${n} 格 → ${want}`)
    else bad(`${n} 格：期望 ${want}，实际 ${s}（格数 ${got}）`)
  }
  await p.ctx.close()
}

/* ══ 横容器：900×520 ══════════════════════════════════════════════ */
console.log('\n横容器 900×520（宽容器 / 浮窗时代尺寸）')
{
  const p = await open(900, 520)
  const o = await p.orient()
  if (o === 'landscape') ok('朝向判为 landscape')
  else bad(`朝向判错：${o}（900 宽 > 520 高，应为 landscape）`)

  if ((await p.cells()) === 1 && (await p.spec()) === '1') ok('1 格 → 1')
  else bad(`1 格不对：${await p.spec()}`)

  for (const n of [2, 4, 6, 9]) {
    await fillTo(p, n)
    const got = await p.cells()
    const s = await p.spec()
    const want = expect(n, 'landscape')
    if (got === n && s === want) ok(`${n} 格 → ${want}`)
    else bad(`${n} 格：期望 ${want}，实际 ${s}（格数 ${got}）`)
  }
  await p.ctx.close()
}

/* ══ 回归锁：朝向不能自我锁定 ══════════════════════════════════════
   踩过的坑：拿格子区自己的宽高比判朝向 → 打开面板把格子区压成矮宽形 →
   判成横排 → 关掉面板后朝向不回来。现在判据是内容区（.davf-body），
   面板在它内部，开合不改它的尺寸。 */
console.log('\n回归锁：面板开合不应改变朝向')
{
  const p = await open(360, 760)
  await fillTo(p, 2)
  const before = await p.orient()
  const specBefore = await p.spec()

  await p.tab.locator('.davf-cap', { hasText: /^外观/ }).click()
  await p.tab.waitForTimeout(500)
  const during = await p.orient()

  await p.tab.locator('.davf-cap', { hasText: /^外观/ }).click()
  await p.tab.waitForTimeout(500)
  const after = await p.orient()
  const specAfter = await p.spec()

  if (before === 'portrait' && during === 'portrait' && after === 'portrait') {
    ok('开面板 / 关面板，朝向始终 portrait')
  } else {
    bad(`朝向被面板带跑了：前 ${before} / 中 ${during} / 后 ${after}`)
  }
  if (specBefore === specAfter) ok(`规格没被带跑（${specBefore} → ${specAfter}）`)
  else bad(`规格被带跑了：${specBefore} → ${specAfter}`)
  await p.ctx.close()
}

/* ══ 极窄：右栏下限 300px ═════════════════════════════════════════ */
console.log('\n极窄容器 300×600（右栏宽度下限）')
{
  const p = await open(300, 600)
  const o = await p.orient()
  if (o === 'portrait') ok('极窄下仍是 portrait')
  else bad(`极窄下朝向判错：${o}`)
  // 面板不能在 300px 下横向溢出（那会盖住会话区）
  const overflow = await p.tab.evaluate(() => {
    const el = document.querySelector('.davf-panel')
    if (!el) return null
    return { scrollW: el.scrollWidth, clientW: el.clientWidth }
  })
  if (overflow && overflow.scrollW <= overflow.clientW + 1) {
    ok(`300px 宽下没有横向溢出（${overflow.scrollW} ≤ ${overflow.clientW}）`)
  } else {
    bad(`300px 宽下横向溢出：${JSON.stringify(overflow)}`)
  }
  await p.ctx.close()
}

await browser.close()

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  process.exit(1)
}
console.log('全部通过（横/竖两套阶梯都按容器比例生效，且不会被面板开合带跑）')

/**
 * 子代理计数行（meta 第三行）的几何与「图案固定」实测。
 *
 * 两个判据：
 *   1. 它在 meta 里、是第三行，且不压住名字/状态
 *   2. 图案**固定** —— 跨格数、跨外观设置，SVG 形状完全一致
 *
 * 用法（在 grokbot 目录下）：node tools/probe-kids-row.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const page = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

async function open(w) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(pathToFileURL(page).href + `?w=${w}&h=760`)
  await tab.waitForTimeout(700)
  return { ctx, tab }
}

console.log('栏宽  格子        头像      计数行     在meta内  位置')
console.log('─'.repeat(74))
for (const w of [116, 240, 360, 562]) {
  const { ctx, tab } = await open(w)
  const m = await tab.evaluate(() => {
    const cell = document.querySelector('.davf-cell')
    const k = cell?.querySelector('.davf-kids')
    const meta = cell?.querySelector('.davf-cell-meta')
    const name = cell?.querySelector('.davf-cell-name')
    const act = cell?.querySelector('.davf-cell-act')
    const bot = cell?.querySelector('.davf-cell-bot > svg')
    const R = (e) => (e ? e.getBoundingClientRect() : null)
    const c = R(cell)
    const b = R(k)
    const mt = R(meta)
    const n = R(name)
    const a = R(act)
    const g = R(bot)
    return {
      cell: c ? `${Math.round(c.width)}×${Math.round(c.height)}` : '',
      bot: g ? Math.round(g.width) : 0,
      row: b ? `${Math.round(b.width)}×${Math.round(b.height)}` : '',
      inMeta: k !== null && meta !== null && meta.contains(k),
      // 第三行 = 在 meta 里位于 name 和 act 之后
      belowAct: b && a ? b.top >= a.bottom - 1 : null,
      hitsName: b && n ? !(b.bottom <= n.top || b.top >= n.bottom) : null,
      hitsAct: b && a ? !(b.bottom <= a.top || b.top >= a.bottom) : null,
      metaH: mt ? Math.round(mt.height) : 0,
      text: k ? k.textContent.trim() : ''
    }
  })
  console.log(
    `${String(w).padEnd(5)}${String(m.cell).padEnd(12)}${String(m.bot).padEnd(9)}` +
      `${String(m.row).padEnd(11)}${String(m.inMeta).padEnd(9)}` +
      `${m.belowAct ? '状态下方' : '不在状态下方'}  ${JSON.stringify(m.text)}`
  )
  await ctx.close()
}

/* ── 图案固定：跨格数比对 SVG 形状 ─────────────────────────────── */
console.log('\n图案固定性（跨格数比对小框 SVG 的形状与配色）:')

const { ctx, tab } = await open(562)

async function sigOf() {
  return tab.evaluate(() => {
    const k = document.querySelector('.davf-kids')
    const svg = k?.querySelector('svg')
    if (!svg) return null
    // 用 path 的 d 与 fill 做签名：形状不同 d 必不同，配色不同 fill 必不同
    const paths = Array.from(svg.querySelectorAll('path'))
    return paths.map((p) => `${(p.getAttribute('d') ?? '').slice(0, 60)}|${p.getAttribute('fill') ?? ''}`).join('#')
  })
}

const sigs = []
sigs.push({ n: 1, sig: await sigOf() })

// 加到 4 格、9 格，每次都取第一格的小框签名
async function fillTo(n) {
  let have = await tab.locator('.davf-cell').count()
  while (have > n) {
    const cell = tab.locator('.davf-cell').nth(have - 1)
    await cell.hover()
    await tab.waitForTimeout(150)
    const rm = cell.locator('.davf-cell-remove')
    if ((await rm.count()) === 0) break
    await rm.click()
    await tab.waitForTimeout(250)
    const next = await tab.locator('.davf-cell').count()
    if (next === have) break
    have = next
  }
  if (have === n) return
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(320)
  for (const h of await tab.locator('.davf-ws-head').all()) {
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(120)
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

for (const n of [4, 9]) {
  await fillTo(n)
  sigs.push({ n, sig: await sigOf() })
}

const uniq = new Set(sigs.map((s) => s.sig))
console.log(`     1/4/9 格下第一格小框签名：${uniq.size} 种 ${uniq.size === 1 ? '→ 完全固定 ✓' : '→ 有变化 ✗'}`)
for (const s of sigs) console.log(`     ${s.n} 格: ${(s.sig ?? '(无)').slice(0, 70)}`)

await ctx.close()
await browser.close()

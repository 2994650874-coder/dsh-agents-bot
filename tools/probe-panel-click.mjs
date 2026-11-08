/**
 * 真实面板里点新身形，格子里的 bot 真的会变吗？
 *
 * ── 为什么这条不能省 ──────────────────────────────────────────────────
 * 「14 个按钮都渲染出来了」不等于「点了有用」。中间还隔着：
 *   · `onLook` 有没有把新 id 写进 store
 *   · `shapeRadiiOf(id)` 能不能从 `SHAPE_BY_ID` 里查到（新 id 拼错就查不到）
 *   · 查不到时引擎退回圆 —— 于是「点了没反应」但也不报错
 *
 * 最后这条是最隐蔽的：拼错 id 的表现和「按钮坏了」一模一样。
 * 所以必须真的点一遍，量格子里的 bot 有没有变。
 *
 * 判据：点每个新身形后，格子里那个 bot 的 `<path>` 的 `d` 必须变。
 *
 * 用法：node tools/build-panel.mjs && node tools/probe-panel-click.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const NEW_SHAPES = ['盾牌', '穹顶', '拱门', '圆柱', '宝石', '晶体']

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 560, height: 900 }, deviceScaleFactor: 2 })
const tab = await ctx.newPage()
const errors = []
tab.on('pageerror', (e) => errors.push(String(e)))
await tab.goto('file:///' + resolve(ROOT, 'preview', 'panel.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1200)

// 打开外观面板
await tab.evaluate(() => {
  const b = Array.from(document.querySelectorAll('button')).find(
    (x) => (x.textContent || '').trim() === '外观'
  )
  b?.click()
})
await tab.waitForTimeout(600)

/** 读格子里主 bot 的身体路径（第一格）。 */
const bodyPath = () =>
  tab.evaluate(() => {
    const cell = document.querySelector('.davf-cell')
    const p = cell?.querySelector('svg path')
    return p?.getAttribute('d') ?? null
  })

/** 点某个身形按钮。 */
const clickShape = (label) =>
  tab.evaluate((want) => {
    const b = Array.from(document.querySelectorAll('.davf-shape')).find(
      (x) => (x.textContent || '').trim() === want
    )
    if (!b) return false
    b.click()
    return true
  }, label)

console.log('点新身形 → 格子里 bot 的轮廓是否真的改变\n')
console.log('身形'.padEnd(10) + '按钮找到'.padStart(10) + '轮廓变化'.padStart(12) + '  判定')
console.log('─'.repeat(52))

const seen = new Set()
let bad = 0
for (const label of NEW_SHAPES) {
  const found = await clickShape(label)
  await tab.waitForTimeout(450) // 等 morph 结束（SHAPE_MORPH 约 0.35s）
  const d = await bodyPath()
  const changed = d !== null && !seen.has(d)
  if (d) seen.add(d)
  if (!found || !changed) bad++
  console.log(
    '  ' +
      label.padEnd(8) +
      (found ? '是' : '否 ✗').padStart(10) +
      (changed ? '是' : '否 ✗').padStart(12) +
      '  ' + (found && changed ? 'ok' : '有问题')
  )
}

console.log('─'.repeat(52))
// 6 个新身形应该产生 6 个互不相同的轮廓
console.log(`不同轮廓数：${seen.size} / 6 ${seen.size === 6 ? '✓' : '✗ 有形状撞了'}`)
console.log('脚本错误：' + (errors.length ? errors.join(' | ') : '无'))

await browser.close()
process.exitCode = bad === 0 && seen.size === 6 ? 0 : 1

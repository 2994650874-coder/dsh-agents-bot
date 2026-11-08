/**
 * 真实插件的面板截图：确认 14 个身形都出来了、顺序对、没有溢出。
 *
 * ── 为什么这条必须跑 ──────────────────────────────────────────────────
 * 前面的探针都是往 `preview/_bot6` 的**副本**里注入身形测的。那份副本
 * 只能证明「引擎画得对」，不能证明「真实插件里的面板长对了」——
 * 名字有没有、顺序对不对、flex-wrap 换行会不会挤、格子会不会溢出，
 * 都只有在**真源码构建出来的面板**里才看得见。
 *
 * 这个脚本用 `tools/panel.tsx` 那个预览页（它 import 的是真 `plugin/src`），
 * 所以量到的是用户真会看到的东西。
 *
 * 用法：node tools/build-panel.mjs && node tools/probe-panel-shapes.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 560, height: 900 }, deviceScaleFactor: 3 })
const tab = await ctx.newPage()
const errors = []
tab.on('pageerror', (e) => errors.push(String(e)))
await tab.goto('file:///' + resolve(ROOT, 'preview', 'panel.html').replace(/\\/g, '/'))
await tab.waitForTimeout(1200)

// 打开「外观」面板
const opened = await tab.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('button'))
  const b = btns.find((x) => (x.textContent || '').trim() === '外观')
  if (b) {
    b.click()
    return true
  }
  return false
})
console.log('打开外观面板：' + (opened ? '成功' : '没找到「外观」按钮'))
await tab.waitForTimeout(700)

const info = await tab.evaluate(() => {
  const shapes = Array.from(document.querySelectorAll('.davf-shape'))
  return {
    count: shapes.length,
    labels: shapes.map((s) => (s.textContent || '').trim()),
    // 有没有格子溢出容器
    overflow: (() => {
      const box = document.querySelector('.davf-shapes')
      if (!box) return null
      return { scrollW: box.scrollWidth, clientW: box.clientWidth }
    })()
  }
})

console.log(`\n面板里的身形按钮：${info.count} 个`)
console.log('  顺序：' + info.labels.join(' / '))
if (info.overflow) {
  const o = info.overflow
  console.log(
    `  横向溢出：${o.scrollW > o.clientW ? `有（${o.scrollW} > ${o.clientW}）✗` : `无（${o.scrollW} ≤ ${o.clientW}）✓`}`
  )
}
console.log('脚本错误：' + (errors.length ? errors.join(' | ') : '无'))

await tab.screenshot({ path: resolve(ROOT, 'preview', 'panel-14-shapes.png'), fullPage: true })
report(resolve(ROOT, 'preview', 'panel-14-shapes.png'))
await browser.close()

const expect = ['圆', '圆角方', '六边形', '云', '胶囊', '三角', '卵石', '盾牌', '穹顶', '拱门', '圆柱', '宝石', '晶体', '水滴']
const okCount = info.count === 14
const okLabels = JSON.stringify(info.labels) === JSON.stringify(expect)
console.log('\n' + '─'.repeat(50))
console.log(`14 个身形：${okCount ? '✓' : '✗'}`)
console.log(`中文名与顺序：${okLabels ? '✓' : '✗ 期望 ' + expect.join('/')}`)
process.exitCode = okCount && okLabels ? 0 : 1

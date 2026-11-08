// 实测「接 Host 投影订阅」的开销 —— 第二版，必须触发**真实的 React 重渲染**。
//
// 上一版用 setAttribute 改 DOM，绕过了 React，所以增量是负的（纯噪声），
// 等于什么都没测。这一版通过面板自己的 store 推真实状态变化。
//
// 用法: node tools\research\probe-projection-cost.cjs
'use strict'
const path = require('node:path')
const { chromium } = require(path.resolve(__dirname, '..', '..', 'node_modules', 'playwright-core'))
const { pathToFileURL } = require('node:url')

const ROOT = path.resolve(__dirname, '..', 'grokbot')
const PAGE = pathToFileURL(path.resolve(ROOT, 'preview', 'panel.html')).href

;(async () => {
  const browser = await chromium.launch({
    executablePath: 'D:/百分/CentBrowser/Application/chrome.exe',
    headless: true
  })
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  await tab.goto(PAGE + '?w=360&h=760')
  await tab.waitForTimeout(900)

  // 勾到 9 格（最坏情况）
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(400)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(120)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const rc = await rows.count()
  let need = 9 - (await tab.locator('.davf-cell').count())
  for (let i = 0; i < rc && need > 0; i++) {
    const row = rows.nth(i)
    if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
    await row.click()
    await tab.waitForTimeout(100)
    need--
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(700)
  console.log(`格数: ${await tab.locator('.davf-cell').count()}`)

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')

  const sample = async (label, ms) => {
    const before = await cdp.send('Performance.getMetrics')
    await tab.waitForTimeout(ms)
    const after = await cdp.send('Performance.getMetrics')
    const get = (m, k) => (m.metrics.find((x) => x.name === k) ?? {}).value ?? 0
    const dur = (get(after, 'TaskDuration') - get(before, 'TaskDuration')) * 1000
    const scr = (get(after, 'ScriptDuration') - get(before, 'ScriptDuration')) * 1000
    console.log(`  ${label.padEnd(28)} 主线程 ${((dur / ms) * 100).toFixed(1)}%  脚本 ${((scr / ms) * 100).toFixed(1)}%`)
    return { pct: (dur / ms) * 100, spct: (scr / ms) * 100 }
  }

  console.log('\n=== 基线（9 格动画在跑，不推任何投影）===')
  const base = await sample('静置 3 秒', 3000)

  /* 真实重渲染：通过面板的 store 切外观。
     每切一次 = 一次真实的 useSyncExternalStore 通知 + 9 格重渲染，
     这比「投影推一个标量」重得多 —— 是保守上界。 */
  console.log('\n=== 模拟投影推送（走真实 store → 9 格重渲染）===')
  await tab.evaluate(() => {
    window.__pushes = 0
    const caps = Array.from(document.querySelectorAll('.davf-cap'))
    const lookBtn = caps.find((b) => b.textContent.trim().startsWith('外观'))
    if (lookBtn) lookBtn.click()
  })
  await tab.waitForTimeout(400)

  // 在页面内循环点颜色 —— 每次都是真实的 store 更新 + 全格重渲染
  await tab.evaluate(() => {
    window.__pushes = 0
    window.__timer = setInterval(() => {
      const colors = document.querySelectorAll('.davf-color')
      if (colors.length) {
        const i = window.__pushes % colors.length
        colors[i].click()
        window.__pushes++
      }
    }, 100)
  })
  const pushed = await sample('每 100ms 一次真实重渲染', 3000)
  const count = await tab.evaluate(() => {
    clearInterval(window.__timer)
    return window.__pushes
  })

  console.log(`\n  实际触发 ${count} 次真实重渲染（3 秒）`)
  console.log(`  主线程增量: ${(pushed.pct - base.pct >= 0 ? '+' : '')}${(pushed.pct - base.pct).toFixed(1)} 个百分点`)
  console.log(`  脚本增量:   ${(pushed.spct - base.spct >= 0 ? '+' : '')}${(pushed.spct - base.spct).toFixed(1)} 个百分点`)

  await browser.close()
})()

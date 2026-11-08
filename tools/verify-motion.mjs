/**
 * 过渡验证：确认加/减监控时有动画，不是硬切。
 *
 * 做法：在动作前后采样同一格子的 opacity / transform，看它是否处于动画中。
 * 只看「有没有动」——具体曲线由 CSS 决定，不该被测试钉死。
 *
 * 用法（在 grokbot 目录下）：node tools/verify-motion.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const target = resolve(ROOT, 'preview', 'panel.html')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 820 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(pathToFileURL(target).href)
await tab.waitForTimeout(700)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/** 读某个格子的动画状态。 */
const anims = (index) =>
  tab.evaluate((i) => {
    const cell = document.querySelectorAll('.davf-cell')[i]
    if (!cell) return null
    const list = cell.getAnimations()
    return list.map((a) => ({
      name: a.animationName ?? a.transitionProperty ?? '(waapi)',
      state: a.playState,
      dur: a.effect?.getTiming?.().duration ?? null
    }))
  }, index)

/* 1. 加一个监控：新格子应该有入场动画 */
await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
await tab.waitForTimeout(350)
const rows = tab.locator('.davf-pick-row')
await rows.filter({ hasNot: tab.locator('.davf-pick-tag') }).first().click()

// 立刻采样（不等动画跑完）
await tab.waitForTimeout(60)
const during = await anims(1)
if (during && during.length > 0) {
  ok(`新格子有动画：${during.map((a) => a.name + '/' + a.state).join(', ')}`)
} else {
  bad('新格子没有动画（硬切）')
}

/* 2. 动画应该自己结束 */
await tab.waitForTimeout(500)
const after = await anims(1)
const running = (after ?? []).filter((a) => a.state === 'running')
if (running.length === 0) ok('动画正常结束')
else bad('动画卡住不结束：' + JSON.stringify(running))

/* 3. 选择器展开时也该有过渡。注意第 1 步把选择器留在打开状态，
   所以这里要先关掉再打开，否则点一下是「关」。 */
await tab.locator('.davf-cap', { hasText: /^对话/ }).click() // 关
await tab.waitForTimeout(400)
await tab.locator('.davf-cap', { hasText: /^对话/ }).click() // 开
await tab.waitForTimeout(40)
const pickerAnim = await tab.evaluate(() => {
  const el = document.querySelector('.davf-picker')
  if (!el) return null
  return el.getAnimations().map((a) => a.playState)
})
if (pickerAnim && pickerAnim.length > 0) ok('选择器展开有过渡')
else bad('选择器展开是硬切')

/* 4. 移除格子：剩下的格子应该做位置补间（FLIP） */
await tab.waitForTimeout(500)
// 现在选择器是开着的，直接勾两个
const pk = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
await pk.nth(0).click()
await tab.waitForTimeout(350)
await pk.nth(1).click()
await tab.waitForTimeout(500)
await tab.locator('.davf-cap', { hasText: /^对话/ }).click() // 收起选择器
await tab.waitForTimeout(450)

const beforeCount = await tab.locator('.davf-cell').count()
const c1 = tab.locator('.davf-cell').nth(1)
await c1.hover()
await tab.waitForTimeout(200)
await c1.locator('.davf-cell-remove').click()
await tab.waitForTimeout(50)
const afterCount = await tab.locator('.davf-cell').count()
const flip = await tab.evaluate(() => {
  const cells = [...document.querySelectorAll('.davf-cell')]
  return cells.flatMap((c) => c.getAnimations().map((a) => a.playState))
})
if (afterCount === beforeCount - 1 && flip.length > 0) {
  ok(`移除后剩余格子有补间动画（${beforeCount} → ${afterCount} 格）`)
} else if (afterCount !== beforeCount - 1) {
  bad(`移除没生效：${beforeCount} → ${afterCount}`)
} else {
  bad('移除后剩余格子是硬切')
}

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

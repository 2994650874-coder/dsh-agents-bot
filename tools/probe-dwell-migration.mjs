/**
 * 验证 2400 → 3000 的迁移真的生效（在真浏览器里，走真实的 store 读盘逻辑）。
 *
 * 为什么单独写：`smoke-*` 只测纯函数，`readDwell` 是模块私有的，
 * 从外面拿不到。唯一可信的验证方式是「往 localStorage 塞一个旧值，
 * 刷新页面，看界面高亮落在哪一档」。
 */
import { chromium } from 'playwright-core'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const browser = await chromium.launch({
  executablePath: 'D:/百分/CentBrowser/Application/chrome.exe',
  headless: true
})

let pass = 0
let fail = 0
const ok = (m) => {
  console.log('  ok   ' + m)
  pass++
}
const bad = (m) => {
  console.log('  FAIL ' + m)
  fail++
}

async function loadWith(stored) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript((s) => {
    try {
      localStorage.clear()
      if (s !== null) localStorage.setItem('dsh-agents-bot:ui', s)
    } catch {}
  }, stored)
  await page.goto(pathToFileURL(resolve(ROOT, 'preview', 'settings.html')).href)
  await page.waitForTimeout(600)
  const info = await page.evaluate(() => {
    const secs = [...document.querySelectorAll('.davs-section')]
    const s = secs.find((x) => x.querySelector('.davs-title')?.textContent?.includes('动画停留'))
    const chips = s ? [...s.querySelectorAll('.davs-chip')] : []
    const raw = localStorage.getItem('dsh-agents-bot:ui')
    return {
      labels: chips.map((c) => c.textContent.trim()),
      on: chips.filter((c) => c.className.includes('is-on')).map((c) => c.textContent.trim()),
      dwellMs: raw ? JSON.parse(raw).dwellMs : null
    }
  })
  await ctx.close()
  return info
}

console.log('动画停留档位：3.0 秒是新档，老存盘的 2400 要迁过来')

const fresh = await loadWith(null)
ok('页面上四档：' + fresh.labels.join(' / '))
if (fresh.labels.includes('3.0 秒')) ok('有「3.0 秒」档')
else bad('没有「3.0 秒」档：' + JSON.stringify(fresh.labels))
if (!fresh.labels.includes('2.4 秒')) ok('「2.4 秒」已经下线')
else bad('页面上还有「2.4 秒」')
if (fresh.on[0] === '关闭') ok('全新安装默认「关闭」')
else bad('全新安装默认不是关闭：' + JSON.stringify(fresh.on))

/* 老存盘：dwellMs=2400（用户升级前的真实值） */
const legacy = await loadWith(JSON.stringify({ fps: 60, dwellMs: 2400 }))
if (legacy.on[0] === '3.0 秒') ok('老存盘的 2400 被认成「3.0 秒」（不是掉回关闭）')
else bad('2400 迁移失败，高亮落在：' + JSON.stringify(legacy.on))

/* 对照：其它已下线的值是**真的**下线，必须掉回关闭。
   为什么不给所有旧值都做迁移：那等于把已下线的选项永久留在数据层里。 */
const dead = await loadWith(JSON.stringify({ fps: 60, dwellMs: 1234 }))
if (dead.on[0] === '关闭') ok('无关的坏值 1234 掉回「关闭」（不是乱认档位）')
else bad('坏值没被拦住：' + JSON.stringify(dead.on))

await browser.close()
console.log(`\n通过 ${pass} 项，失败 ${fail} 项`)
process.exitCode = fail === 0 ? 0 : 1

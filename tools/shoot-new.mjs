/**
 * 截设置页和「工具级状态」两张图 —— 本轮改动的两块新东西。
 *
 * 用法：node tools/shoot-new.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const OUT = 'F:/桌面'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

/* ── 1. 设置页（宽 + 窄两种）─────────────────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 1400 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('shot-cleared')) {
        localStorage.clear()
        sessionStorage.setItem('shot-cleared', '1')
      }
    } catch {}
  })

  // 宽容器：看完整布局
  await page.goto(pathToFileURL(resolve(ROOT, 'preview', 'settings.html')).href + '?w=760')
  await page.waitForTimeout(900)
  await page.locator('.davs').screenshot({ path: `${OUT}/grokbot-settings-wide.png` })
  console.log('settings-wide.png')

  // 改几项，让「已改」标记和恢复按钮都出现
  await page.locator('.davs-row', { hasText: '思考中' }).first().locator('.davs-num').first().fill('6')
  await page.waitForTimeout(300)
  await page.locator('.davs-row', { hasText: '检索中' }).first().locator('.davs-icon', { hasText: '＋' }).click()
  await page.waitForTimeout(400)
  await page.locator('.davs').screenshot({ path: `${OUT}/grokbot-settings-changed.png` })
  console.log('settings-changed.png')

  // 窄容器
  await page.goto(pathToFileURL(resolve(ROOT, 'preview', 'settings.html')).href + '?w=420')
  await page.waitForTimeout(700)
  await page.locator('.davs').screenshot({ path: `${OUT}/grokbot-settings-narrow.png` })
  console.log('settings-narrow.png')

  await ctx.close()
}

/* ── 2. 工具级状态（9 格，能看到读文件/跑命令/写文件/出错/压缩/后台）── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('shot-cleared2')) {
        localStorage.clear()
        sessionStorage.setItem('shot-cleared2', '1')
      }
    } catch {}
  })
  await page.goto(pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href + '?w=380&h=820')
  await page.waitForTimeout(800)

  // 勾到 9 格
  await page.locator('.davf-cap', { hasText: /^对话/ }).click()
  await page.waitForTimeout(320)
  const heads = page.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await page.waitForTimeout(130)
    }
  }
  const rows = page.locator('.davf-pick-row').filter({ hasNot: page.locator('.davf-pick-tag') })
  const cnt = await rows.count()
  for (let i = 0; i < Math.min(8, cnt); i++) {
    await rows.nth(i).click()
    await page.waitForTimeout(150)
  }
  await page.locator('.davf-cap', { hasText: /^对话/ }).click()
  await page.waitForTimeout(900)

  await page.locator('.fake-right').screenshot({ path: `${OUT}/grokbot-tool-states.png` })
  console.log('tool-states.png')

  const acts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.davf-cell-act')).map((e) => e.textContent.trim())
  )
  console.log('  各格活动：' + JSON.stringify(acts))

  await ctx.close()
}

await browser.close()
console.log('\n完成')

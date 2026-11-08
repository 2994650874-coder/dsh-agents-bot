/**
 * 多场景截图：一次跑完关键组合。
 *
 * 面板现在是右栏的一个 tab，所以每张图都包含「假右栏 + 假 tab 条 + 面板」，
 * 让人一眼看出它嵌在栏里，而不是浮在界面上的卡片。
 *
 * 两种容器都拍：竖右栏（真实形态）和宽容器（证明自适应没退化）。
 *
 * 用法（在 grokbot 目录下）：node tools/shoot-scenes.mjs
 */
import { chromium } from 'playwright-core'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

if (!existsSync(CHROME)) {
  console.error('找不到百分浏览器:', CHROME)
  process.exit(1)
}

/**
 * 勾到 n 格（含当前窗口）。
 * 只点还没勾上的行 —— 否则第二次调用会把上一次的点掉。
 */
async function fillTo(tab, n) {
  const now = await tab.locator('.davf-cell').count()
  let need = n - now
  if (need <= 0) return
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(350)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(150)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const count = await rows.count()
  for (let i = 0; i < count && need > 0; i++) {
    const row = rows.nth(i)
    if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
    await row.click()
    await tab.waitForTimeout(110)
    need--
  }
}

/** 竖右栏的典型尺寸；宽的那组用来证明横阶梯还在。 */
const SCENES = [
  { name: '01-单格竖', w: 360, h: 760, fill: 1, closePicker: true },
  { name: '02-选择器竖', w: 360, h: 760, fill: 0, openPicker: true },
  { name: '03-2格竖', w: 360, h: 760, fill: 2, closePicker: true },
  { name: '04-4格竖', w: 360, h: 760, fill: 4, closePicker: true },
  { name: '05-9格竖', w: 360, h: 760, fill: 9, closePicker: true },
  { name: '06-9格外观竖', w: 360, h: 760, fill: 9, closePicker: true, custom: true },
  { name: '07-极窄300', w: 300, h: 600, fill: 4, closePicker: true },
  { name: '08-宽容器横排', w: 900, h: 520, fill: 6, closePicker: true }
]

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 })

for (const scene of SCENES) {
  const tab = await ctx.newPage()
  await tab.addInitScript(() => {
    try {
      localStorage.clear()
    } catch {}
  })
  // 注意：不能用 goto 的 search 选项 —— 在 file:// 上它不生效（实测截出来
  // 全是默认 360 宽，「宽容器横排」那张其实是竖容器）。必须直接拼到 href 后面。
  await tab.goto(`${PAGE}?w=${scene.w}&h=${scene.h}`)
  await tab.waitForTimeout(700)

  // 确认容器尺寸真的生效了，否则后面拍的图全是错的。
  // 用 clientWidth：getBoundingClientRect 含 1px 左边框。
  const realW = await tab.evaluate(() => {
    const el = document.querySelector('.fake-right')
    return el ? el.clientWidth : -1
  })
  if (realW !== scene.w) {
    console.error(`  !! ${scene.name}: 容器宽度没生效（要 ${scene.w}，实际 ${realW}），跳过`)
    await tab.close()
    continue
  }

  await fillTo(tab, scene.fill)
  if (scene.closePicker && scene.fill > 0) {
    await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
    await tab.waitForTimeout(400)
  }
  if (scene.openPicker) {
    await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
    await tab.waitForTimeout(500)
  }
  if (scene.custom) {
    await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
    await tab.waitForTimeout(500)
  }

  const out = resolve(ROOT, 'preview', `scene-${scene.name}.png`)
  // 截整个假右栏（含 tab 条），这样图里能看出它嵌在栏里
  await tab.locator('.fake-right').screenshot({ path: out })
  report(out, 'grokbot-' + out.split(/[\\/]/).pop())
  await tab.close()
}

await browser.close()

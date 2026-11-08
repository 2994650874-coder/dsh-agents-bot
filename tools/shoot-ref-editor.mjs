/**
 * 截 grok-icon-study 的两页，确认「编辑页面」到底长什么样。
 *
 * 目的：用户在 B 站视频里看到的是 `animation.html`（状态 / 身形 / 调色板三块），
 * 而不是仓库 README 里那个聊天壳 `index.html`。两页都在本地 refs 里，直接开文件即可
 * —— 它们是自包含单文件，没有任何外部依赖（已核：只有一条外链指向 GitHub）。
 *
 * 用法（在 grokbot 目录下）：node tools/shoot-ref-editor.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { report } from './shot-util.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const REFS = resolve(ROOT, 'refs', 'grok-icon-study')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

// ── 1. animation.html：那个「编辑页面」────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await ctx.newPage()
  const errors = []
  tab.on('pageerror', (e) => errors.push(String(e)))
  await tab.goto(pathToFileURL(resolve(REFS, 'animation.html')).href)
  await tab.waitForTimeout(1200)

  const info = await tab.evaluate(() => ({
    title: document.title,
    states: document.querySelectorAll('#states button').length,
    shapes: document.querySelectorAll('#shapes button').length,
    swatches: document.querySelectorAll('#swatches button').length,
    groups: Array.from(document.querySelectorAll('#states h2')).map((h) => h.textContent),
    hasExport: !!document.querySelector('[download],[type=file]'),
    bodyScroll: document.body.scrollHeight
  }))
  console.log('animation.html')
  console.log('  状态按钮 ' + info.states + ' 个，分组：' + info.groups.join(' / '))
  console.log('  身形按钮 ' + info.shapes + ' 个；调色板 ' + info.swatches + ' 个')
  console.log('  导出/导入控件：' + (info.hasExport ? '有' : '没有'))
  console.log('  脚本错误：' + (errors.length ? errors.join(' | ') : '无'))

  await tab.screenshot({ path: resolve(ROOT, 'preview', 'ref-editor-top.png') })
  report(resolve(ROOT, 'preview', 'ref-editor-top.png'))

  await tab.screenshot({ path: resolve(ROOT, 'preview', 'ref-editor-full.png'), fullPage: true })
  report(resolve(ROOT, 'preview', 'ref-editor-full.png'))
  await ctx.close()
}

// ── 2. index.html：那个聊天壳（README 提到的「成品网页」）─────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await ctx.newPage()
  const errors = []
  tab.on('pageerror', (e) => errors.push(String(e)))
  await tab.goto(pathToFileURL(resolve(REFS, 'index.html')).href)
  await tab.waitForTimeout(1200)
  await tab.screenshot({ path: resolve(ROOT, 'preview', 'ref-index.png') })
  report(resolve(ROOT, 'preview', 'ref-index.png'))
  console.log('index.html 脚本错误：' + (errors.length ? errors.join(' | ') : '无'))
  await ctx.close()
}

await browser.close()

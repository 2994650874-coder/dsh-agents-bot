/**
 * 那个「编辑页面」到底能不能**保存**用户的改动？
 *
 * ── 为什么要单独验这一条 ──────────────────────────────────────────────
 * 用户看到的是 B 站视频里的「编辑页面」，想把它搬进设置页，理由是
 * 「它提供了用户自定义 bot 的能力」。但「能改」和「改完留得住」是两件事。
 *
 * 静态看源码已经给了强提示（animation.html 里 localStorage / JSON.parse /
 * download / input[type=file] 的出现次数全是 0），但那是读代码得出的结论，
 * 不是行为证据。这个探针真去点、真去刷新，看改动还在不在。
 *
 * 判据：
 *   · animation.html 点一个身形 → 刷新 → 还选着吗？有导出按钮吗？
 *   · index.html 改身形/配色 → 刷新 → 还是原来那个吗？
 *
 * 用法（在 grokbot 目录下）：node tools/probe-ref-editor-saves.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const REFS = resolve(ROOT, 'refs', 'grok-icon-study')

const browser = await chromium.launch({ executablePath: CHROME, headless: true })

/* ── A. animation.html：那个「动效实验室」 ─────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await ctx.newPage()
  await tab.goto(pathToFileURL(resolve(REFS, 'animation.html')).href)
  await tab.waitForTimeout(900)

  // 1) 有没有任何「存下来」的出口
  const outlets = await tab.evaluate(() => ({
    download: document.querySelectorAll('[download]').length,
    fileInput: document.querySelectorAll('input[type=file]').length,
    buttons: Array.from(document.querySelectorAll('button'))
      .map((b) => b.textContent.trim())
      .filter((t) => /保存|导出|下载|分享|复制|save|export|download|share|copy/i.test(t)),
    // localStorage 有没有被写过
    keys: Object.keys(localStorage)
  }))

  // 2) 点一个身形，记下当前选中
  const before = await tab.evaluate(() => {
    const on = document.querySelector('#shapes button[aria-pressed="true"]')
    return on?.dataset.shape ?? null
  })
  const clicked = await tab.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('#shapes button'))
    // 挑一个不是当前选中的
    const target = btns.find((b) => b.getAttribute('aria-pressed') !== 'true')
    target?.click()
    return target?.dataset.shape ?? null
  })
  await tab.waitForTimeout(200)
  const after = await tab.evaluate(() => {
    const on = document.querySelector('#shapes button[aria-pressed="true"]')
    return on?.dataset.shape ?? null
  })

  // 3) 刷新，看还在不在
  await tab.reload()
  await tab.waitForTimeout(900)
  const afterReload = await tab.evaluate(() => {
    const on = document.querySelector('#shapes button[aria-pressed="true"]')
    return on?.dataset.shape ?? null
  })

  console.log('A. animation.html（动效实验室）')
  console.log(`   「保存 / 导出 / 下载 / 分享」类按钮：${outlets.buttons.length} 个${outlets.buttons.length ? ' → ' + outlets.buttons.join(' / ') : ''}`)
  console.log(`   <a download>：${outlets.download} 个；<input type=file>：${outlets.fileInput} 个`)
  console.log(`   localStorage 里的键：${outlets.keys.length ? outlets.keys.join(', ') : '（空）'}`)
  console.log(`   点「${clicked}」前选中=${before}，点完=${after}（能改：${after === clicked ? '是' : '否'}）`)
  console.log(`   刷新后选中=${afterReload}（留得住：${afterReload === clicked ? '是' : '否'}）`)
  await ctx.close()
}

/* ── B. index.html：那个聊天壳的「设置」 ───────────────────────────── */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const tab = await ctx.newPage()
  await tab.goto(pathToFileURL(resolve(REFS, 'index.html')).href)
  await tab.waitForTimeout(900)

  // 打开设置
  await tab.evaluate(() => document.getElementById('settings-button')?.click())
  await tab.waitForTimeout(200)
  const options = await tab.evaluate(() => ({
    shapes: Array.from(document.querySelectorAll('#shape option')).map((o) => o.value),
    colors: Array.from(document.querySelectorAll('#color option')).map((o) => o.value)
  }))

  // 改成一个和默认不同的值
  await tab.evaluate(() => {
    const s = document.getElementById('shape')
    const c = document.getElementById('color')
    s.value = 'bean'
    s.dispatchEvent(new Event('change'))
    c.value = 'green'
    c.dispatchEvent(new Event('change'))
  })
  await tab.waitForTimeout(200)

  // 刷新
  await tab.reload()
  await tab.waitForTimeout(900)
  await tab.evaluate(() => document.getElementById('settings-button')?.click())
  await tab.waitForTimeout(200)
  const afterReload = await tab.evaluate(() => ({
    shape: document.getElementById('shape').value,
    color: document.getElementById('color').value,
    keys: Object.keys(localStorage)
  }))

  console.log('\nB. index.html（聊天壳的「设置」）')
  console.log(`   身形可选：${options.shapes.join(' / ')}（${options.shapes.length} 个）`)
  console.log(`   配色可选：${options.colors.join(' / ')}（${options.colors.length} 个）`)
  console.log(`   改成 bean + green，刷新后：身形=${afterReload.shape} 配色=${afterReload.color}`)
  console.log(`   留得住：${afterReload.shape === 'bean' && afterReload.color === 'green' ? '是' : '否'}`)
  console.log(`   localStorage 里只存了：${afterReload.keys.join(', ') || '（空）'}`)
  await ctx.close()
}

await browser.close()

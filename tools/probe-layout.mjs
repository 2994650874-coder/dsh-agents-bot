/**
 * 布局探针：打开预览页、点若干胶囊，然后打印关键元素的实际尺寸。
 * 用来查「点了但看不见」这类问题，比截图猜快。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-layout.mjs 外观
 *   node tools/probe-layout.mjs 对话
 *
 * 注意参数是**胶囊文案**（「对话…」「外观」「清空」），不是规格名 ——
 * 规格显示早已从标题栏移除，传 "2×3" 会报「缺少胶囊」。
 *
 * 探针默认看 360×760 的竖右栏；用 --w/--h 改：
 *   node tools/probe-layout.mjs --w 900 --h 520 外观
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'

/** 从 argv 里取 --w / --h，剩下的当胶囊文案。 */
const argv = process.argv.slice(2)
let W = 360
let H = 760
const labels = []
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--w') W = Number(argv[++i])
  else if (argv[i] === '--h') H = Number(argv[++i])
  else labels.push(argv[i])
}

const target = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const tab = await ctx.newPage()
// 注意：file:// 上必须把查询串直接拼进 href。
// goto 的 search 选项在这里不生效（实测 search 为空、容器仍是默认 360），
// 而拼 href 会报 ERR_FILE_NOT_FOUND 的话说明没编码 —— 这里不需要编码，
// 因为 w/h 都是纯数字。
await tab.goto(`${target}?w=${W}&h=${H}`)
await tab.waitForTimeout(600)

for (const label of labels) {
  const btn = tab.locator('.davf-cap', { hasText: new RegExp('^' + label + '$') }).first()
  if ((await btn.count()) > 0) {
    await btn.click()
    await tab.waitForTimeout(500)
  } else {
    console.warn('缺少胶囊', label)
  }
}

const info = await tab.evaluate(() => {
  const pick = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return { sel, found: false }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      sel,
      found: true,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      display: cs.display,
      flex: cs.flex,
      maxH: cs.maxHeight,
      overflow: cs.overflow,
      children: el.children.length
    }
  }
  return {
    orient: document.querySelector('.davf-grid')?.getAttribute('data-orient') ?? null,
    cells: document.querySelectorAll('.davf-cell').length,
    parts: ['.davf-panel', '.davf-body', '.davf-grid', '.davf-kids', '.davf-picker', '.davf-cust-row'].map(pick)
  }
})

console.log(JSON.stringify(info, null, 2))
await browser.close()

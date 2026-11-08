/**
 * GIF 的 256 色够不够：直接量化一帧里有多少种颜色。
 *
 * ── 为什么这条是硬限制 ──────────────────────────────────────────────
 * GIF 每帧最多 256 色（调色板）。而本插件的弧是彩虹渐变：
 * `RINGS` 的 hue = i×60，6 条弧铺满 0~360°，每条弧还有 3 个 stop 的渐变。
 * 加上抗锯齿边缘（每个边缘像素都是混合色）。
 *
 * 如果一帧的真实色数远超 256，那么量化必然引入色带或抖动噪点 ——
 * 而这个动画是「纯色平涂 + 细渐变」，两种劣化都非常显眼。
 *
 * ── 怎么量 ──────────────────────────────────────────────────────────
 * 在浏览器里把 SVG 栅格化，读 ImageData，统计**不同颜色数**。
 * 分别量带弧的状态（orbit / comet）和不带弧的（idle），看差多少。
 *
 * 判据：
 *   < 256 色  → GIF 无损，可换
 *   256~1000  → 轻微色带，需实测观感
 *   > 1000    → GIF 明显劣化，不建议
 *
 * 用法（在 grokbot 下）：node tools/probe-gif-colors.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, fileURLToPath as f2, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

/**
 * 量某个状态一帧的颜色数。
 *
 * 用「所有活动都播同一个动画」的 localStorage 注入把 9 格钉在目标状态，
 * 然后取第一格栅格化。多采几个时刻（不同 t 下弧的位置不同，色数会变）。
 */
async function colorsOf(state, px = 96) {
  const acts = [
    'idle', 'thinking', 'reading', 'searching', 'running', 'writing',
    'compacting', 'background', 'waiting', 'done', 'error', 'spawning', 'sleep'
  ]
  const rotation = {}
  for (const a of acts) rotation[a] = [{ state, plays: 1 }]

  const tab = await ctx.newPage()
  await tab.addInitScript(
    ({ rotation }) => {
      try {
        localStorage.clear()
      } catch {}
      localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps: 45, rotation }))
    },
    { rotation }
  )
  await tab.goto(PAGE)
  await tab.waitForTimeout(1400)

  const out = []
  for (let k = 0; k < 5; k++) {
    const r = await tab.evaluate(async ({ px }) => {
      const svg = document.querySelector('.davf-cell svg')
      if (!svg) return null
      const clone = svg.cloneNode(true)
      clone.setAttribute('width', String(px))
      clone.setAttribute('height', String(px))
      const xml = new XMLSerializer().serializeToString(clone)
      const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
        img.src = url
      })
      const cv = document.createElement('canvas')
      cv.width = px
      cv.height = px
      const g = cv.getContext('2d')
      // 白底：GIF 默认背景是白的，透明底会让色数虚低
      g.fillStyle = '#ffffff'
      g.fillRect(0, 0, px, px)
      g.drawImage(img, 0, 0, px, px)
      URL.revokeObjectURL(url)
      const data = g.getImageData(0, 0, px, px).data
      const set = new Set()
      for (let i = 0; i < data.length; i += 4) {
        // 量化到 8 位：和 GIF 的调色板粒度一致
        set.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2])
      }
      return set.size
    }, { px })
    out.push(r)
    await tab.waitForTimeout(300)
  }
  await tab.close()
  return out.filter((x) => typeof x === 'number')
}

console.log('GIF 色深可行性：一帧有多少种颜色（96px，5 个时刻取最大）\n')
console.log('状态       最大色数   判定')
console.log('─'.repeat(52))

const STATES = ['idle', 'thinking', 'play', 'swirl', 'comet', 'orbit', 'burst', 'notify']
const rows = []
for (const st of STATES) {
  const counts = await colorsOf(st)
  const max = Math.max(...counts, 0)
  const verdict =
    max <= 256 ? 'GIF 无损 ✓' : max <= 1000 ? '轻微色带，需实测观感' : 'GIF 明显劣化 ✗'
  rows.push({ st, max, verdict })
  console.log(`${st.padEnd(10)} ${String(max).padStart(8)}   ${verdict}`)
}

console.log('')
const arcStates = rows.filter((r) => ['play', 'swirl', 'comet', 'orbit'].includes(r.st))
const plainStates = rows.filter((r) => ['idle', 'thinking', 'burst', 'notify'].includes(r.st))
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length

console.log(`带弧状态平均 ${avg(arcStates.map((r) => r.max)).toFixed(0)} 色`)
console.log(`无弧状态平均 ${avg(plainStates.map((r) => r.max)).toFixed(0)} 色`)
console.log('')
console.log('GIF 上限 256 色。超出部分必须量化 —— 表现为色带或抖动噪点。')
console.log('这个动画是「纯色平涂 + 细渐变」，两种劣化都非常显眼。')

await browser.close()

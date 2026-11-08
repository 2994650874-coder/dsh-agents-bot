/**
 * 修前/修后对账：`检索 ×2 → 空闲 ×1`，身形=三角。
 *
 * 旧 bug 的指纹：进入「空闲」之后有一段很长的静止圆（orbit 的收尾姿态
 * 被当成第 2 遍播完），然后再变回正确形状。
 *
 * 判据（不用肉眼看）：
 *   1. 每一个「有环」区间（= orbit 正在播）内部，bbox 必须有明显变化 ——
 *      静止说明没重播
 *   2. 进入「无环」区间（= idle）后，bbox 应在 0.5 秒内收敛到三角（h≈186），
 *      且之后不再出现 h≈201 的圆
 */
import { chromium } from 'playwright-core'
import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const BASE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href + '?plain=1'

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
page.on('pageerror', (e) => console.log('  [pageerror] ' + String(e)))

await page.goto(BASE)
await page.waitForSelector('.davf-panel', { timeout: 15000 })
await page.evaluate(() => {
  localStorage.setItem(
    'dsh-agents-bot:ui',
    JSON.stringify({
      look: { shape: 'triangle', color: 'encre', expression: 'neutre', size: 96 },
      rotation: {
        idle: [
          { state: 'orbit', plays: 2 },
          { state: 'idle', plays: 1 }
        ]
      }
    })
  )
})
await page.reload()
await page.waitForSelector('.davf-panel', { timeout: 15000 })
await page.waitForTimeout(700)

const data = await page.evaluate(async () => {
  const svg = document.querySelector('.davf-cell-bot svg')
  const out = []
  const t0 = performance.now()
  return await new Promise((res) => {
    const tick = () => {
      const paths = Array.from(svg.querySelectorAll('mask path'))
      const d = paths[0] ? paths[0].getAttribute('d') || '' : ''
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
      const xs = nums.filter((_, i) => i % 2 === 0)
      const ys = nums.filter((_, i) => i % 2 === 1)
      out.push({
        t: +((performance.now() - t0) / 1000).toFixed(2),
        w: xs.length ? Math.round(Math.max(...xs) - Math.min(...xs)) : 0,
        h: ys.length ? Math.round(Math.max(...ys) - Math.min(...ys)) : 0,
        arcs: svg.querySelectorAll('path[stroke^="url"]').length
      })
      if (performance.now() - t0 < 22000) requestAnimationFrame(tick)
      else res(out)
    }
    requestAnimationFrame(tick)
  })
})

/* 分段 */
const segs = []
let cur = null
for (const s of data) {
  const k = s.arcs > 0 ? 'orbit' : 'idle'
  if (!cur || cur.k !== k) {
    cur = { k, from: s.t, to: s.t, hs: [s.h], ws: [s.w] }
    segs.push(cur)
  } else {
    cur.to = s.t
    cur.hs.push(s.h)
    cur.ws.push(s.w)
  }
}

console.log(`采到 ${data.length} 帧 / ${data[data.length - 1].t}s\n`)
let fail = 0
for (const s of segs) {
  const hMin = Math.min(...s.hs)
  const hMax = Math.max(...s.hs)
  const wMin = Math.min(...s.ws)
  const wMax = Math.max(...s.ws)
  const dur = +(s.to - s.from).toFixed(2)
  if (dur < 0.5) continue // 过渡碎片，不算

  if (s.k === 'orbit') {
    const moving = hMax - hMin >= 4 || wMax - wMin >= 4
    console.log(
      `  ${s.k.padEnd(5)} ${dur.toFixed(2)}s  bbox ${wMin}~${wMax} x ${hMin}~${hMax}  ` +
        `${moving ? '✓ 在动（有重播）' : '✗ 静止（没重播）'}`
    )
    if (!moving) fail++
  } else {
    /* idle 段：收敛到三角（h≈186），且不该长时间停在圆（h≈201） */
    const after = s.hs.filter((h, i) => i * (dur / s.hs.length) >= 0.5)
    const circleFrames = after.filter((h) => h >= 198).length
    const triFrames = after.filter((h) => h >= 184 && h <= 189).length
    const ok = circleFrames === 0
    console.log(
      `  ${s.k.padEnd(5)} ${dur.toFixed(2)}s  bbox ${wMin}~${wMax} x ${hMin}~${hMax}  ` +
        `0.5s 后：三角 ${triFrames} 帧 / 圆 ${circleFrames} 帧  ${ok ? '✓ 正常' : '✗ 有幽灵圆'}`
    )
    if (!ok) fail++
  }
}

console.log(fail === 0 ? '\n结论：全部正常 —— 没有静止的 orbit，也没有幽灵圆。' : `\n结论：${fail} 处异常。`)
await browser.close()
process.exitCode = fail === 0 ? 0 : 1

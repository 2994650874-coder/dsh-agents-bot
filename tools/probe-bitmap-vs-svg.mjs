/**
 * 位图 vs 矢量：绘制成本到底差多少（直接回答「换 GIF 会更省吗」）。
 *
 * ── 为什么必须实测这一步 ────────────────────────────────────────────
 * 前面的推理是：换 GIF 只省掉引擎那 2.7%，绘制 14.5% 一样要付。
 * 但这个推理有个漏洞 —— **SVG 的栅格化是每帧重做的，位图只需要 blit。**
 * 如果位图绘制真的比 SVG 便宜一大截，那「换 GIF 更省」就成立。
 *
 * 所以这里做一个**等价对照实验**：
 *   A. 9 个真实 SVG bot（现状）
 *   B. 9 个 <img> 循环切帧（模拟 GIF / 位图序列的真实做法）
 *   C. 9 个 <canvas> 反复 drawImage（位图方案的上界：连解码都省了）
 *
 * 三者格数、尺寸、帧率完全相同，唯一变量是「怎么画」。
 * 如果 B/C 明显低于 A，说明位图方案在绘制上有真实收益。
 *
 * ── 判读规则（沿用上一轮的教训）────────────────────────────────────
 * 单次采样波动 ±5pp。这里 3 个场景 × 5 轮**交错**采样，取中位数，
 * **区间重叠即无结论**。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/probe-bitmap-vs-svg.mjs            # 45 帧
 *   node tools/probe-bitmap-vs-svg.mjs --rounds 5
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const argOf = (n, d) => {
  const i = process.argv.indexOf(n)
  return i >= 0 ? Number(process.argv[i + 1]) : d
}
const FPS = argOf('--fps', 45)
const ROUNDS = argOf('--rounds', 5)
const CELLS = 9
const SIZE = 96

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return { task: pick('TaskDuration'), script: pick('ScriptDuration') }
}

async function sample(cdp, ms) {
  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, ms))
  const b = await snap(cdp)
  const w = ms / 1000
  return { task: ((b.task - a.task) / w) * 100, script: ((b.script - a.script) / w) * 100 }
}

/** 勾到 n 格。 */
async function fillTo(tab, target) {
  const need = target - 1
  if (need <= 0) return
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(320)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(140)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const c = await rows.count()
  for (let i = 0; i < Math.min(need, c); i++) {
    await rows.nth(i).click()
    await tab.waitForTimeout(110)
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(400)
}

/**
 * 在页面里搭一个位图播放区。
 *
 * 关键：**真的先生成帧，再播放** —— 否则量的是「空 div 的合成」，
 * 那当然便宜，但那是假的。这里先用真实 SVG 栅格化出 24 帧，再循环播。
 *
 * `mode`：
 *   'img'    —— 24 个 <img>，每帧改 style.display（等价于 GIF 的帧切换）
 *   'canvas' —— 24 帧预解码，一个 canvas 每帧 drawImage
 * `tickFps` 必须能对齐被测的 SVG 帧率，否则量到的是「少画帧」的收益，
 * 不是「换位图」的收益 —— 这个对照第一版就错在这里。
 */
async function installBitmap(tab, mode, frames, tickFps) {
  return tab.evaluate(
    async ({ mode, frames, cells, size, tickFps }) => {
      // 1) 拿一个真实 bot 的 SVG，栅格化出 N 帧（模拟预渲染）
      const srcSvg = document.querySelector('.davf-cell svg')
      if (!srcSvg) return { ok: false, reason: 'no svg' }

      const toDataUrl = async () => {
        const clone = srcSvg.cloneNode(true)
        clone.setAttribute('width', String(size))
        clone.setAttribute('height', String(size))
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
        cv.width = size
        cv.height = size
        const g = cv.getContext('2d')
        g.fillStyle = '#ffffff'
        g.fillRect(0, 0, size, size)
        g.drawImage(img, 0, 0, size, size)
        URL.revokeObjectURL(url)
        return cv.toDataURL('image/png')
      }

      const urls = []
      for (let i = 0; i < frames; i++) urls.push(await toDataUrl())

      // 2) 清掉原面板，换成位图区
      const host = document.querySelector('.davf-grid')
      if (!host) return { ok: false, reason: 'no grid' }
      host.innerHTML = ''
      host.style.gridTemplateColumns = `repeat(3, minmax(0,1fr))`
      host.style.gridTemplateRows = `repeat(3, minmax(0,1fr))`

      const perCell = []
      for (let c = 0; c < cells; c++) {
        const box = document.createElement('div')
        box.style.cssText = `display:flex;align-items:center;justify-content:center;overflow:hidden`
        if (mode === 'img') {
          const imgs = urls.map((u) => {
            const el = document.createElement('img')
            el.src = u
            el.width = size
            el.height = size
            el.style.display = 'none'
            el.style.position = 'absolute'
            box.appendChild(el)
            return el
          })
          perCell.push({ kind: 'img', imgs })
        } else {
          const cv = document.createElement('canvas')
          cv.width = size
          cv.height = size
          box.appendChild(cv)
          const g = cv.getContext('2d')
          // 预解码：全部 Image 对象就绪
          const imgs = []
          for (const u of urls) {
            const im = new Image()
            im.src = u
            await new Promise((res) => {
              im.onload = res
              im.onerror = res
            })
            imgs.push(im)
          }
          perCell.push({ kind: 'canvas', cv, g, imgs })
        }
        host.appendChild(box)
      }

      // 3) 播放循环：帧率与 SVG 场景对齐，否则量的是「少画帧」不是「换位图」
      const interval = 1000 / tickFps
      let idx = 0
      let last = 0
      window.__bitmapStop = false
      const tick = (now) => {
        if (window.__bitmapStop) return
        if (now - last >= interval) {
          last = now
          const f = idx % frames
          for (const cell of perCell) {
            if (cell.kind === 'img') {
              cell.imgs.forEach((el, i) => {
                el.style.display = i === f ? 'block' : 'none'
              })
            } else {
              cell.g.drawImage(cell.imgs[f], 0, 0, size, size)
            }
          }
          idx++
        }
        requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)

      return { ok: true, cells: perCell.length, frames: urls.length, bytes: urls[0].length }
    },
    { mode, frames, cells: CELLS, size: SIZE, tickFps }
  )
}

/** 量一个场景。 */
async function measure(scene) {
  const tab = await ctx.newPage()
  await tab.addInitScript(
    ({ fps }) => {
      try {
        localStorage.clear()
      } catch {}
      localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps }))
    },
    { fps: FPS }
  )
  await tab.goto(PAGE)
  await tab.waitForTimeout(700)

  let info = null
  if (scene === 'svg') {
    await fillTo(tab, CELLS)
    info = { ok: true, cells: CELLS }
  } else {
    await fillTo(tab, CELLS)
    // 帧率对齐到被测的 SVG 帧率 —— 不这样做，量到的是「少画帧」的收益
    info = await installBitmap(tab, scene, 24, FPS)
    await tab.waitForTimeout(600)
  }

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000)
  const r = await sample(cdp, 2500)
  await tab.close()
  return { ...r, info }
}

const SCENES = [
  { id: 'svg', label: `A 现状：9 个 SVG bot（${FPS} 帧）` },
  { id: 'img', label: `B 9 个 <img> 切帧（${FPS} 帧）` },
  { id: 'canvas', label: `C 9 个 canvas drawImage（${FPS} 帧）` }
]

const results = Object.fromEntries(SCENES.map((s) => [s.id, []]))
for (let round = 0; round < ROUNDS; round++) {
  for (const s of SCENES) results[s.id].push(await measure(s.id))
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

console.log(`矢量 vs 位图：绘制成本对照（9 格，${ROUNDS} 轮交错）\n`)
console.log('场景                              主线程(中位)   范围            脚本')
console.log('─'.repeat(76))

const rows = SCENES.map((s) => {
  const xs = results[s.id]
  const tasks = xs.map((r) => r.task)
  const info = xs.find((r) => r.info?.ok)?.info
  return {
    ...s,
    task: median(tasks),
    script: median(xs.map((r) => r.script)),
    min: Math.min(...tasks),
    max: Math.max(...tasks),
    info
  }
})

for (const r of rows) {
  console.log(
    `${r.label.padEnd(32)} ${r.task.toFixed(1).padStart(8)}%   ` +
      `${r.min.toFixed(1)}~${r.max.toFixed(1)}%`.padEnd(14) +
      `  ${r.script.toFixed(1).padStart(5)}%`
  )
}

const svg = rows.find((r) => r.id === 'svg')
const img = rows.find((r) => r.id === 'img')
const canvas = rows.find((r) => r.id === 'canvas')

console.log('\n判读（区间重叠即无结论）：')
for (const r of [img, canvas]) {
  const overlap = r.min <= svg.max && svg.min <= r.max
  const d = r.task - svg.task
  if (overlap) {
    console.log(`  ${r.label.slice(0, 24).padEnd(26)} 与现状区间重叠 → 分不出高下`)
  } else if (d < 0) {
    console.log(`  ${r.label.slice(0, 24).padEnd(26)} 稳定省 ${(-d).toFixed(1)} pp`)
  } else {
    console.log(`  ${r.label.slice(0, 24).padEnd(26)} 稳定贵 ${d.toFixed(1)} pp`)
  }
}

console.log('\n注：三个场景帧率已对齐（都是 ' + FPS + ' 帧），所以差异只来自「怎么画」。')
console.log('    对照第一版把位图跑在 20 帧、SVG 跑在 45 帧，量出来的「省 9.3pp」')
console.log('    其实主要是少画了一半帧，不是位图本身便宜 —— 那个结论是错的。')
if (img?.info?.bytes) {
  console.log(`    每帧 dataURL 约 ${(img.info.bytes / 1024).toFixed(0)} KB（96px，base64 膨胀 33%）`)
}

await browser.close()

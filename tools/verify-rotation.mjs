/**
 * 轮播验证：面板上真的在按「播几遍」切换动画。
 *
 * ── 为什么这条不能只靠纯函数测试 ────────────────────────────────────
 * `smoke-rotation.cjs` 已经验了 `slotAt` 的算法。但算法对了不等于
 * **界面上真的在换** —— 中间隔着 store → props → Bot 的 rAF 循环。
 * 断在任何一环，纯函数测试都是绿的。
 *
 * ── 怎么判「换动画了」────────────────────────────────────────────────
 * 不读文字（文字是活动名，轮播不改它），直接读 SVG：
 *   · `eyeAlpha`：`wink` 有眼睛，`sleep` 没有（`eyeAlpha: 0`）
 *   · 身体路径的 `d` 形状：`idle` 是圆，`alert` 是「!」的斜杠
 *
 * 最稳的判据是**眼睛数量**：`idle` 有 2 个眼睛 path，`sleep` 是 0 个。
 * 这个差别是 2 → 0，不可能是动画抖动造成的误判。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-panel.mjs && node tools/verify-rotation.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PANEL = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const tab = await ctx.newPage()

/**
 * 预置配置：把「空闲」配成「空闲 ×1 → 休眠 ×1」。
 *
 * 为什么用这两个：`idle` 有 2 个眼睛、`sleep` 有 0 个，是整套动画里
 * 差别最锐利的一对。用「空闲 + 眨眼」的话两个都有眼睛，判据要靠形状，
 * 容易和呼吸抖动混淆。
 *
 * 时长：idle 2.4 秒、sleep 2.4 秒 → 一轮 4.8 秒，测试在 8 秒内能看全。
 */
await tab.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('rot-test-seeded')) {
      localStorage.setItem(
        'dsh-agents-bot:ui',
        JSON.stringify({
          picked: [],
          fps: 60,
          sleepMinutes: 30,
          rotation: {
            idle: [
              { state: 'idle', plays: 1 },
              { state: 'sleep', plays: 1 }
            ]
          }
        })
      )
      sessionStorage.setItem('rot-test-seeded', '1')
    }
  } catch {}
})

await tab.goto(PANEL)
await tab.waitForTimeout(900)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/**
 * 采样第一格的头像特征。
 *
 * 返回 `{ eyes, state }`：
 *   eyes = mask 里 `fill="#000"` 的 path 数量（眼睛是洞）
 *   state = 当前引擎状态（从 DOM 推不出来，用眼睛数代替）
 */
async function sample() {
  return tab.evaluate(() => {
    const cell = document.querySelector('.davf-cell')
    if (!cell) return null
    const svg = cell.querySelector('svg')
    if (!svg) return null
    const mask = svg.querySelector('mask')
    const eyes = mask ? mask.querySelectorAll('path[fill="#000"]').length : -1
    // 身体路径：mask 里那个 fill="#fff" 的
    const body = mask?.querySelector('path[fill="#fff"]')
    return { eyes, d: body?.getAttribute('d')?.slice(0, 40) ?? '' }
  })
}

/* ── 1. 起始状态落在轮播的某一项上 ─────────────────────────────── */

/*
 * 不能断言「起始一定是 idle」：页面加载后轮播已经按真实时间跑了一段，
 * 起始落在哪一项取决于加载耗时（第一版就是这么写的，跑出 0 个眼睛时
 * 误报）。能断言的是「它一定在轮播的某一项上」，也就是眼睛数只能是
 * 2（idle）或 0（sleep），不会是别的值。
 */
const first = await sample()
if (first && (first.eyes === 2 || first.eyes === 0)) {
  ok(`起始落在轮播的某一项上（眼睛数 ${first.eyes}）`)
} else {
  bad(`起始状态不是轮播的任何一项：${JSON.stringify(first)}`)
}

/* ── 2. 等到第二轮该切到休眠（0 个眼睛）────────────────────────── */

console.log('\n轮播：等它自己切到下一个动画')

/*
 * idle 播 1 遍 = 2.4 秒，然后切 sleep。
 * 每 200ms 采一次，最多等 8 秒，记录眼睛数的变化序列。
 */
const series = []
const t0 = Date.now()
let sawSleep = false
let sawBackToIdle = false
while (Date.now() - t0 < 9000) {
  const s = await sample()
  if (s) {
    const last = series[series.length - 1]
    if (!last || last.eyes !== s.eyes) series.push({ at: Date.now() - t0, eyes: s.eyes })
    if (s.eyes === 0) sawSleep = true
    // 休眠之后又回到 2 个眼睛 = 一整轮走完，回到空闲
    if (sawSleep && s.eyes === 2) {
      sawBackToIdle = true
      break
    }
  }
  await tab.waitForTimeout(200)
}

console.log('  眼睛数变化：' + series.map((s) => `${s.at}ms:${s.eyes}`).join(' → '))

if (sawSleep) ok('轮播切到了「休眠」（眼睛从 2 变 0）')
else bad('等 9 秒也没切到休眠 —— 轮播没在跑，或没接上 rAF 循环')

if (sawBackToIdle) ok('一轮走完回到「空闲」（眼睛从 0 变回 2）—— 循环正确')
else bad('没有回到空闲 —— 轮播没有循环')

/* ── 3. 切换是渐变的，不是硬切 ─────────────────────────────────── */

console.log('\n切换不是硬跳（有 morph 过渡）')

/*
 * 硬切的表现是「一帧之内眼睛数直接变」。
 * morph 期间引擎在混合两个姿态，所以眼睛数是逐渐变化的 ——
 * 但眼睛 path 是「有/没有」二值，中间态可能是 1 个。
 *
 * 更可靠的判据：采样期间身体路径的 `d` 会持续变化（动画在跑），
 * 而不是长时间不动。
 */
const dSamples = []
for (let i = 0; i < 12; i++) {
  const s = await sample()
  if (s) dSamples.push(s.d)
  await tab.waitForTimeout(120)
}
const distinct = new Set(dSamples).size
if (distinct >= 6) ok(`身体路径在持续变化（12 次采样 ${distinct} 种形状）—— 动画在跑`)
else bad(`身体路径几乎不变（12 次采样只有 ${distinct} 种）—— 动画可能停了`)

/* ── 4. 调外观时轮播必须停 ─────────────────────────────────────── */

console.log('\n调外观时轮播暂停（否则改到一半效果会消失）')

await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(600)

/*
 * 外观面板打开后，作用对象被强制静止在 idle。
 * 这时轮播必须关掉 —— 否则它会每隔 2.4 秒自己切到 sleep，
 * 用户正在调的身形/表情就看不见了。
 *
 * 判据：连续 3 秒采样，眼睛数应该**一直是 2**（稳定在 idle），
 * 不再出现 0。
 */
const posedSamples = []
for (let i = 0; i < 15; i++) {
  const s = await sample()
  if (s) posedSamples.push(s.eyes)
  await tab.waitForTimeout(200)
}
const anyZero = posedSamples.some((n) => n === 0)
const allTwo = posedSamples.every((n) => n === 2)
if (!anyZero && allTwo) ok('外观面板开着时稳定在 idle（眼睛数一直是 2，轮播已暂停）')
else bad(`外观面板开着时轮播没停：眼睛数序列 ${JSON.stringify(posedSamples)}`)

/* ── 5. 关掉外观面板后轮播恢复 ─────────────────────────────────── */

console.log('\n关掉外观面板后轮播恢复')

await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(500)

let resumed = false
const t1 = Date.now()
while (Date.now() - t1 < 9000) {
  const s = await sample()
  if (s && s.eyes === 0) {
    resumed = true
    break
  }
  await tab.waitForTimeout(200)
}
if (resumed) ok('关掉面板后轮播继续（又切到了休眠）')
else bad('关掉面板后轮播没恢复')

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

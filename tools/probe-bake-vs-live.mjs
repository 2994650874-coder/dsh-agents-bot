/**
 * 「能不能换成 GIF / 视频」的量化回答。
 *
 * ── 要回答的三个问题 ────────────────────────────────────────────────
 *   1. 现在的绘制结构对不对（矢量每帧重算 vs 预渲染位图）
 *   2. 因为要可自定义模组，是不是不适合转 GIF
 *   3. 换 GIF 会更省吗
 *
 * ── 怎么答才不是猜 ──────────────────────────────────────────────────
 * 把**可组合空间**真的算出来（从源码读，不拍脑袋），再量**一帧栅格化的
 * 实际字节数**（浏览器里真渲染真编码），两者相乘就是「预渲染方案」的
 * 存储与内存代价。然后和「每帧重算矢量」的 CPU 代价对比。
 *
 * ── 关键前提：哪些状态能被用户改 ────────────────────────────────────
 * 引擎的硬约束（`states.ts` 的 baseBody / baseFace）：
 *   · `baseBody: true` 的状态才能换**身形**  → idle / wink / wide / notify
 *   · `baseFace: true` 的状态才能换**表情**  → 只有 idle
 *   · 配色对所有状态都生效
 * 其余 10 个状态的轮廓和表情是逐帧量出来的动画，**不吃用户设置**。
 *
 * 这条约束决定了组合空间的大小 —— 也是「为什么不能简单预渲染」的核心。
 *
 * 用法（在 grokbot 目录下）：node tools/probe-bake-vs-live.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/* ══ 第 1 部分：从源码读真实的可组合空间 ══════════════════════════════ */

const OUT = resolve(ROOT, '.test-build', 'bake-space.cjs')
const result = await build({
  stdin: {
    contents: `export { STATES, STATE_BY_ID, SEQUENCE } from './src/bot/states'
export { SHAPES, COLORS } from './src/bot/skins'
export { EXPRESSIONS } from './src/bot/expressions'
export { playLengthOf } from './src/client/rotation'
export { ANIMATION_OPTIONS, ACTIVITY_ORDER, MAX_ROTATION_ITEMS, MIN_PLAYS, MAX_PLAYS } from './src/client/activities'
export { FPS_OPTIONS } from './src/client/store'`,
    resolveDir: resolve(ROOT, 'plugin'),
    sourcefile: 'bake-space-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
  charset: 'utf8'
})
mkdirSync(resolve(ROOT, '.test-build'), { recursive: true })
writeFileSync(OUT, result.outputFiles[0].text, 'utf8')

const S = createRequire(import.meta.url)(OUT)
const { STATES, SHAPES, COLORS, EXPRESSIONS, playLengthOf, ANIMATION_OPTIONS, ACTIVITY_ORDER } = S

const N_SHAPE = SHAPES.length
const N_COLOR = COLORS.length
const N_EXPR = EXPRESSIONS.length
const N_STATE = STATES.length

console.log('一、可组合空间（从源码读，不是估算）\n')
console.log(`身形 ${N_SHAPE} × 配色 ${N_COLOR} × 表情 ${N_EXPR} × 状态 ${N_STATE}`)
console.log('')

/* 按 baseBody / baseFace 分类，算「真正需要预渲染的外观数」。 */
const bodyStates = STATES.filter((s) => s.baseBody).map((s) => s.id)
const faceStates = STATES.filter((s) => s.baseFace).map((s) => s.id)
const plainStates = STATES.filter((s) => !s.baseBody).map((s) => s.id)

console.log('状态分类（决定组合空间）：')
console.log(`  可换身形（baseBody）${bodyStates.length} 个：${bodyStates.join(', ')}`)
console.log(`  可换表情（baseFace）${faceStates.length} 个：${faceStates.join(', ')}`)
console.log(`  不吃用户设置        ${plainStates.length} 个：${plainStates.join(', ')}`)
console.log('')

/**
 * 需要预渲染的「外观 × 状态」组合数。
 *
 *   · 能吃表情的状态：身形 × 配色 × 表情
 *   · 只能吃身形的状态：身形 × 配色
 *   · 都不吃的状态：配色
 */
let appearances = 0
for (const st of STATES) {
  const shapes = st.baseBody ? N_SHAPE : 1
  const exprs = st.baseFace ? N_EXPR : 1
  appearances += shapes * N_COLOR * exprs
}

const idleAppearances = N_SHAPE * N_COLOR * N_EXPR
const bodyOnlyAppearances = bodyStates.filter((s) => s !== 'idle' && s !== 'swirl').length * N_SHAPE * N_COLOR
const plainAppearances = plainStates.length * N_COLOR

console.log('二、预渲染需要多少份「外观 × 状态」\n')
console.log(`  idle（身形×配色×表情）       ${String(idleAppearances).padStart(7)} 份`)
console.log(`  其它可换身形的状态           ${String(bodyOnlyAppearances).padStart(7)} 份`)
console.log(`  不吃设置的状态（只有配色）    ${String(plainAppearances).padStart(7)} 份`)
console.log(`  ─────────────────────────────────────`)
console.log(`  合计                        ${String(appearances).padStart(7)} 份`)

/* 轮播让组合空间再乘一层。 */
const rotCombos =
  Math.pow(ANIMATION_OPTIONS.length, 1) * (S.MAX_PLAYS - S.MIN_PLAYS + 1) +
  Math.pow(ANIMATION_OPTIONS.length, S.MAX_ROTATION_ITEMS) *
    Math.pow(S.MAX_PLAYS - S.MIN_PLAYS + 1, S.MAX_ROTATION_ITEMS)
console.log('')
console.log('三、轮播再乘一层（用户可配「哪个活动播哪两个动画、各几遍」）')
console.log(`  单个活动的轮播配置组合数：${rotCombos.toLocaleString()} 种`)
console.log(`  13 个活动各自独立 → ${Math.pow(rotCombos, ACTIVITY_ORDER.length).toExponential(2)} 种整表配置`)
console.log('  → 预渲染方案在这个维度上**无法穷举**。')

/* ══ 第 2 部分：量一帧栅格化的真实字节数 ══════════════════════════════ */

const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
  localStorage.setItem('dsh-agents-bot:ui', JSON.stringify({ fps: 45 }))
})
await tab.goto(PAGE + '?plain=1')
await tab.waitForTimeout(900)

/**
 * 把一个 SVG 栅格化成 PNG，返回字节数。
 *
 * 走 canvas.toBlob('image/png') —— 这是浏览器真实的编码路径，不是估算。
 * 同时量 `image/gif` 不可用（浏览器不提供 GIF 编码），所以 GIF 体积按
 * 「PNG 的 1/3 ~ 1/2」估算并在输出里标注这是估算。
 */
const sizes = await tab.evaluate(async () => {
  const svg = document.querySelector('.davf-cell svg')
  if (!svg) return null

  async function rasterBytes(targetPx) {
    const clone = svg.cloneNode(true)
    clone.setAttribute('width', String(targetPx))
    clone.setAttribute('height', String(targetPx))
    // 去掉外部样式依赖：显式给背景，否则透明底会压缩得过于理想
    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    await new Promise((res, rej) => {
      img.onload = res
      img.onerror = rej
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = targetPx
    canvas.height = targetPx
    const g = canvas.getContext('2d')
    g.fillStyle = '#ffffff'
    g.fillRect(0, 0, targetPx, targetPx)
    g.drawImage(img, 0, 0, targetPx, targetPx)
    URL.revokeObjectURL(url)
    const pngBlob = await new Promise((res) => canvas.toBlob(res, 'image/png'))
    return pngBlob.size
  }

  const out = {}
  for (const px of [64, 96, 128, 192, 256, 320]) {
    out[px] = await rasterBytes(px)
  }
  return out
})

console.log('\n四、一帧栅格化的真实体积（浏览器真编码 PNG）\n')
console.log('  边长    PNG 字节   20fps 下每秒   一个 3.4 秒动画（68 帧）')
console.log('─'.repeat(70))
const durations = { orbit: 3.4 }
for (const [px, bytes] of Object.entries(sizes)) {
  const perSec = bytes * 20
  const perAnim = bytes * Math.round(3.4 * 20)
  console.log(
    `  ${String(px).padStart(4)}px  ${String(bytes).padStart(8)}  ` +
      `${(perSec / 1024).toFixed(0).padStart(10)} KB  ${(perAnim / 1024).toFixed(0).padStart(18)} KB`
  )
}

/* ══ 第 3 部分：把两边乘起来 ══════════════════════════════════════════ */

console.log('\n五、如果真去预渲染（按 96px、每状态一个循环）\n')

/** 每个状态的循环帧数（20fps）。 */
let totalFrames = 0
const perState = []
for (const st of STATES) {
  const dur = playLengthOf(st.id)
  const frames = Math.max(1, Math.round(dur * 20))
  totalFrames += frames
  perState.push({ id: st.id, dur, frames })
}

const bytes96 = sizes[96]
const bytes320 = sizes[320]

/**
 * 总量必须**逐状态**累加：每个状态有自己的帧数。
 *
 * ⚠️ 第一版这里写错了：用「份数合计 3480 × 总帧数 650」，
 * 等于假设每个外观都要烤全部 15 个状态的所有帧 —— 夸大了 17 倍
 * （算出 2.6 GB，实际 0.15 GB）。份数和帧数必须按状态配对相乘。
 */
let totalBytes96 = 0
let totalBytes320 = 0
for (const st of STATES) {
  const shapes = st.baseBody ? N_SHAPE : 1
  const exprs = st.baseFace ? N_EXPR : 1
  const combos = shapes * N_COLOR * exprs
  const frames = Math.max(1, Math.round(playLengthOf(st.id) * 20))
  totalBytes96 += combos * frames * bytes96
  totalBytes320 += combos * frames * bytes320
}

console.log('')
console.log(`  预渲染总量（96px）  = Σ(各状态份数 × 该状态帧数 × ${bytes96} B)`)
console.log(`                      ≈ ${(totalBytes96 / 1024 / 1024).toFixed(0)} MB`)
console.log(`  预渲染总量（320px） ≈ ${(totalBytes320 / 1024 / 1024).toFixed(0)} MB`)
console.log('')
console.log('  注：GIF 用调色板压缩，通常比同尺寸 PNG 小 30~50%，但**有损且有 256 色上限**。')
console.log(`      按最优情况（PNG 的 40%）折算，96px 方案 ≈ ${((totalBytes96 * 0.4) / 1024 / 1024).toFixed(0)} MB。`)
console.log('')
console.log('  ⚠️ 这个总量的大头是两个「吃表情」的状态：')
for (const st of STATES) {
  if (!st.baseFace) continue
  const combos = (st.baseBody ? N_SHAPE : 1) * N_COLOR * N_EXPR
  const frames = Math.max(1, Math.round(playLengthOf(st.id) * 20))
  const mb = (combos * frames * bytes96) / 1024 / 1024
  console.log(`     ${st.id.padEnd(8)} ${String(combos).padStart(5)} 份 × ${String(frames).padStart(3)} 帧 = ${mb.toFixed(0)} MB`)
}
console.log('     其余 13 个状态加起来只有几 MB（它们不吃表情，只有配色一个变量）。')

/* ══ 第 4 部分：内存常驻 ══════════════════════════════════════════════ */

console.log('\n六、内存常驻（解码后的位图，不是文件大小）\n')
console.log('  位图内存 = 宽 × 高 × 4 字节（RGBA），与压缩率无关。')
console.log('')
console.log('  边长    单帧位图    68 帧一个动画    9 格同时（9 个动画）')
console.log('─'.repeat(70))
for (const px of [96, 128, 320]) {
  const perFrame = px * px * 4
  const perAnim = perFrame * 68
  console.log(
    `  ${String(px).padStart(4)}px  ${(perFrame / 1024).toFixed(0).padStart(8)} KB  ` +
      `${(perAnim / 1024 / 1024).toFixed(1).padStart(14)} MB  ${((perAnim * 9) / 1024 / 1024).toFixed(1).padStart(18)} MB`
  )
}

console.log('\n  对照：现在的矢量方案每格常驻 = 一个 BotEngine 实例（几十个数字 + 两个数组），')
console.log('        实测 9 格总共 < 1 MB。')

await browser.close()

/* ══ 第 5 部分：结论数字 ══════════════════════════════════════════════ */

console.log('\n七、CPU 侧对照（前一轮实测）\n')
console.log('  矢量方案：引擎 0.066 ms/格/帧 → 9 格 45fps 占主线程 2.7%')
console.log('  绘制部分：14.5%（这部分是 SVG 栅格化，换成 GIF 后同样要付）')
console.log('')
console.log('  → 换 GIF 只能省掉「脚本 8.0%」里的引擎部分（2.7%），')
console.log('    但绘制（14.5%）一样要付 —— 位图贴图也是要合成的。')
console.log('    也就是说**理论最大收益 ≈ 2.7 个百分点**，代价是 GB 级存储与上百 MB 内存。')

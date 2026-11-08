/**
 * 外观生效范围验证：**调外观时作用对象必须能立刻看到变化**。
 *
 * 对应一次真实的用户反馈：「身形设置和表情，依然需要选中，然后那个 bot 才会发生变化，
 * 而试片则会直接变化」。
 *
 * 根因不是功能缺失，而是引擎的硬约束没被用户看见：
 *   - 身形只在 `baseBody` 状态生效（idle / wink / wide / notify / swirl）
 *   - 表情只在 `baseFace` 状态生效，而**只有 idle 一个**
 * 用户盯着的那格恰好是「思考中」，两种都不生效，于是以为坏了。
 *
 * 修法：外观面板开着时，把**作用对象那一格**钉在 idle（静止姿态），
 * 关掉面板回到真实状态。这条测试锁住三件事：
 *
 *   1. 开面板 → 作用对象变成静止（状态文字带「静止以调外观」，且出现眼睛）
 *   2. 此时改身形 / 改表情，**那一格真的变了**
 *   3. 关面板 → 回到真实状态（文字里没有「静止以调外观」）
 *
 * 另外锁一条**不该变**的：非作用对象的格子必须继续反映真实状态 ——
 * 否则「实时观看」这个本职就被外观面板破坏了。
 *
 * 用法（在 grokbot 目录下）：node tools/verify-look-scope.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PAGE = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    localStorage.clear()
  } catch {}
})
await tab.goto(PAGE + '?w=360&h=760')
await tab.waitForTimeout(800)

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/**
 * 读每格状态。
 *
 * mask 中的眼睛 path 即使动画将其 alpha 降到 0 也可能仍留在 DOM。
 * `eyeCount` 只核对静止预览有双眼结构；是否切换由静止提示、下方的
 * 形状/表情 SVG 实际变化共同验证，不把 0→2 当作硬判据。
 */
const snap = () =>
  tab.evaluate(() =>
    Array.from(document.querySelectorAll('.davf-cell')).map((c) => {
      const svg = c.querySelector('svg')
      const body = svg ? svg.querySelector('path[fill]') : null
      const eyes = svg ? Array.from(svg.querySelectorAll('mask path[fill="#000"]')) : []
      const act = c.querySelector('.davf-cell-act')
      const name = c.querySelector('.davf-cell-name')
      return {
        name: name ? name.textContent.trim() : '',
        act: act ? act.textContent.trim() : '',
        body: body ? body.getAttribute('d') : null,
        eye: eyes[0] ? eyes[0].getAttribute('d') : null,
        eyeCount: eyes.length
      }
    })
  )

const firstM = (d) => {
  if (!d) return null
  const m = /^M(-?[\d.]+)[ ,](-?[\d.]+)/.exec(d)
  return m ? [Number(m[1]), Number(m[2])] : null
}
const delta = (a, b) => {
  const x = firstM(a)
  const y = firstM(b)
  if (!x || !y) return NaN
  return Math.hypot(y[0] - x[0], y[1] - x[1])
}

/** 勾到 n 格（含当前窗口）。只点还没勾上的行。 */
async function fillTo(n) {
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
  const c = await rows.count()
  for (let i = 0; i < c && need > 0; i++) {
    const row = rows.nth(i)
    if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
    await row.click()
    await tab.waitForTimeout(120)
    need--
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(450)
}

/* ══ 前置：必须有一格「不是 idle」才能复现用户看到的场景 ═══════════════
 *
 * 用户报的问题是「改身形/表情没反应」——根因是作用对象当时处于一个
 * `baseFace=false` 的状态，引擎不覆盖它的脸。所以要复现，前置条件不是
 * 「必须是思考中」，而是「必须有一格不是静止状态」。
 *
 * 第一版写死了「思考中」，后来假数据把 a1 配成「跑命令」就失败了 ——
 * 不是实现坏了，是前置条件写窄了。任何非 idle 的活动都等价。
 */
console.log('前置条件：存在一格「非静止」状态')
const s0 = await snap()
const NON_STILL = ['思考中', '读文件', '检索中', '跑命令', '写文件', '压缩上下文', '后台任务', '出错']
const busyIdx = s0.findIndex((c) => NON_STILL.some((w) => c.act.includes(w)))
if (busyIdx >= 0) {
  ok(`第 ${busyIdx} 格是「${s0[busyIdx].act}」（非静止状态，能复现问题）`)
} else {
  bad('假数据里没有非静止状态的格子 —— 这条测试复现不了用户的场景，先修 tools/panel.tsx')
}

/* ══ 1. 开外观面板 → 作用对象切到静止 ═══════════════════════════════ */
console.log('\n开外观面板 → 作用对象切到静止姿态')
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(700)
const s1 = await snap()

const target = s1[0]
if (target.act.includes('静止以调外观')) ok(`作用对象标出了原因：「${target.act}」`)
else bad(`作用对象没标「静止以调外观」：${target.act}`)

if (target.eyeCount === 2 && target.eye) {
  ok(`静止预览有可用的双眼路径（${target.eyeCount} 个）；后续还要测形状/表情确实改变`)
} else {
  bad(`静止预览双眼路径不完整：${target.eyeCount} 个`)
}

/* ══ 2. 改身形：作用对象必须立刻变 ══════════════════════════════════ */
console.log('\n改身形（圆 → 三角）')
await tab.locator('.davf-shape', { hasText: '三角' }).first().click()
await tab.waitForTimeout(1000)
const s2 = await snap()
const bodyDelta = delta(s1[0].body, s2[0].body)
if (bodyDelta > 1) ok(`作用对象身体轮廓变了（Δ=${bodyDelta.toFixed(2)}）`)
else bad(`改身形后作用对象没变（Δ=${bodyDelta.toFixed(2)}）—— 用户报的问题复发了`)

/* ══ 3. 改表情：作用对象必须立刻变 ══════════════════════════════════ */
console.log('\n改表情（中性 → 惊讶）')
await tab.locator('.davf-chip', { hasText: '惊讶' }).first().click()
await tab.waitForTimeout(1000)
const s3 = await snap()
const eyeDelta = delta(s2[0].eye, s3[0].eye)
if (eyeDelta > 0.5) ok(`作用对象眼睛形状变了（Δ=${eyeDelta.toFixed(2)}）`)
else bad(`改表情后作用对象没变（Δ=${eyeDelta.toFixed(2)}）—— 用户报的问题复发了`)

/* ══ 4. 面板里必须有「只在空闲时可见」的说明 ═══════════════════════ */
console.log('\n说明文案')
const notes = await tab.locator('.davf-custbox .davf-cust-note').allInnerTexts()
const joined = notes.join(' | ')
if (joined.includes('仅空闲时可见')) ok('表情行写明了「平时仅空闲时可见」')
else bad('表情行没写生效范围：' + joined)
if (joined.includes('静止姿态')) ok('面板底部说明了「调外观时会切到静止姿态」')
else bad('面板底部没说明姿态切换：' + joined)

/* 顺位机制的说明**不该出现在这里**。
   用户明确要求：「第 2 格起按顺位自动分配身形和表情，改全局等于整排一起转；
   水滴不参与顺位」这句话不需要出现在侧边栏外观里 —— 它是实现细节，
   不是调外观时要看的东西。水滴那条已经写在它自己的 title 上（悬停才出）。
   这条断言防止它被「好心」加回来。 */
if (joined.includes('顺位')) {
  bad('面板底部又把「顺位」那句说明加回来了：' + joined)
} else {
  ok('面板底部没有「顺位」那段实现细节说明')
}

/* ══ 5. 关面板 → 回到真实状态 ══════════════════════════════════════ */
console.log('\n关掉外观面板 → 回到真实状态')
await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
await tab.waitForTimeout(700)
const s4 = await snap()
if (!s4[0].act.includes('静止以调外观')) ok(`作用对象回到真实状态（「${s4[0].act}」）`)
else bad(`关掉面板后仍标着静止：${s4[0].act}`)
if (s4[0].act === s0[0].act) ok(`状态与开面板前一致（都是「${s4[0].act}」）`)
else bad(`状态没还原：开前「${s0[0].act}」→ 关后「${s4[0].act}」`)

/* ══ 6. 回归锁：非作用对象必须继续反映真实状态 ══════════════════════
   外观面板不能把整个面板变成「静止展示」—— 其余格子还在实时观看。 */
console.log('\n回归锁：非作用对象照常反映真实状态')
await fillTo(3)
const s5 = await snap()
if (s5.length >= 3) {
  await tab.locator('.davf-cap', { hasText: /^外观/ }).click()
  await tab.waitForTimeout(700)
  const s6 = await snap()
  // 第 1、2 格（非作用对象）的状态文字不该出现「静止以调外观」
  const others = s6.slice(1)
  const wrongly = others.filter((c) => c.act.includes('静止以调外观'))
  if (wrongly.length === 0) {
    ok(`其余 ${others.length} 格都没被强制静止（仍反映真实状态）`)
  } else {
    bad(`有 ${wrongly.length} 格被误强制静止：` + wrongly.map((c) => c.act).join(' / '))
  }
  // 只有一格带「静止以调外观」
  const posedCount = s6.filter((c) => c.act.includes('静止以调外观')).length
  if (posedCount <= 1) ok(`最多一格被强制静止（实际 ${posedCount} 格）`)
  else bad(`被强制静止的格子太多了：${posedCount} 格`)
} else {
  bad('没能加到 3 格，回归锁未生效')
}

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过（调外观时作用对象立刻可见，其余格子仍实时）')
await browser.close()

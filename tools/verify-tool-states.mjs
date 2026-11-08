/**
 * 工具级状态验证：面板真的会显示「跑命令 / 读文件 / 写文件 / 检索 / 出错 / 压缩」。
 *
 * ── 这一轮的核心价值就是它 ──────────────────────────────────────────
 * 改动前，面板只知道「这个会话在跑 / 没跑」，所以只有四个状态会亮：
 * 空闲、思考中、等待确认、刚完成。其余十个永远不亮。
 *
 * 改动后，Host 半侧的 `agentsBot` 投影把工具名送到客户端，于是
 * 这些状态才真的会出现。这个测试就是「它真的出现了」的证据。
 *
 * ── 为什么必须用真实形状的假投影 ────────────────────────────────────
 * 投影的字段名（`tool` / `tools` / `bg` / `compacting` / `errorAt`）来自
 * `src/host/index.ts` 的 `viewOf`。如果测试自己编一套字段名，那测的是
 * 测试自己的想象 —— 这个项目上 fake fixture 已经掩盖过两次真 bug。
 * 所以 `tools/panel.tsx` 里的假投影必须和 Host 半侧逐字段一致，这里
 * 再加一条断言把这个一致性钉住。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-panel.mjs && node tools/verify-tool-states.mjs
 */
import { chromium } from 'playwright-core'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const PANEL = pathToFileURL(resolve(ROOT, 'preview', 'panel.html')).href

const fails = []
const ok = (m) => console.log('  ok   ' + m)
const bad = (m) => {
  console.log('  FAIL ' + m)
  fails.push(m)
}

/* ── 0. 假投影必须和 Host 半侧字段一致 ───────────────────────────── */

console.log('契约：假投影的字段与 Host 半侧一致')

/*
 * 从 Host 源码里抽出 `viewOf` 返回的字段名，和 panel.tsx 里的假投影比。
 * 这样「Host 改了字段名但忘了改测试」会在这里失败，而不是变成
 * 「面板上某些状态永远不亮」的线上问题。
 */
const hostSrc = readFileSync(resolve(ROOT, 'plugin/src/host/index.ts'), 'utf8')
/*
 * 抽 `viewOf` 里 `return { ... }` 的字段名。
 *
 * 正则要匹配到函数体里那个对象字面量 —— 直接 `return {` 会先命中
 * `viewOf` 之外的其它 return（第一版就这么失败了，抽出来是空的）。
 * 所以先定位 `function viewOf`，再从它往后找第一个 `return {`。
 */
const viewFn = hostSrc.slice(hostSrc.indexOf('function viewOf'))
const viewMatch = viewFn.match(/return\s*\{([\s\S]*?)\n\s*\}/)
const hostFields = viewMatch
  ? [...viewMatch[1].matchAll(/^\s*(\w+)\s*[,:]/gm)].map((m) => m[1]).sort()
  : []

const panelSrc = readFileSync(resolve(ROOT, 'tools/panel.tsx'), 'utf8')
const fakeMatch = panelSrc.match(/const P = [\s\S]*?\n\}\)/)
const fakeFields = fakeMatch
  ? [...fakeMatch[0].matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]).sort()
  : []

console.log(`  Host 视图字段：${hostFields.join(', ')}`)
console.log(`  假投影字段：  ${fakeFields.join(', ')}`)

if (hostFields.length === 0) {
  bad('没能从 Host 源码里抽出视图字段 —— 断言失效，先看 src/host/index.ts 的 viewOf')
} else if (JSON.stringify(hostFields) === JSON.stringify(fakeFields)) {
  ok('假投影字段与 Host 半侧完全一致')
} else {
  bad(`字段不一致：Host=[${hostFields}] vs 假投影=[${fakeFields}]`)
}

/* ── 打开面板 ─────────────────────────────────────────────────────── */

const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const tab = await ctx.newPage()
await tab.addInitScript(() => {
  try {
    if (!sessionStorage.getItem('tool-test-cleared')) {
      localStorage.clear()
      sessionStorage.setItem('tool-test-cleared', '1')
    }
  } catch {}
})
await tab.goto(PANEL)
await tab.waitForTimeout(800)

/** 读每格显示的活动文字。 */
const readActs = () =>
  tab.evaluate(() =>
    Array.from(document.querySelectorAll('.davf-cell')).map((c) => {
      const el = c.querySelector('.davf-cell-act')
      return el ? el.textContent.trim() : ''
    })
  )

/** 加到指定格数（用监视选择器）。 */
async function addCells(n) {
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(320)
  const heads = tab.locator('.davf-ws-head')
  const hn = await heads.count()
  for (let i = 0; i < hn; i++) {
    const h = heads.nth(i)
    if (!((await h.getAttribute('class')) ?? '').includes('is-open')) {
      await h.click()
      await tab.waitForTimeout(130)
    }
  }
  const rows = tab.locator('.davf-pick-row').filter({ hasNot: tab.locator('.davf-pick-tag') })
  const cnt = await rows.count()
  for (let i = 0; i < Math.min(n, cnt); i++) {
    await rows.nth(i).click()
    await tab.waitForTimeout(150)
  }
  await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
  await tab.waitForTimeout(600)
}

/* ── 1. 工具级状态真的出现了 ─────────────────────────────────────── */

console.log('\n工具级状态（这是本轮改动的核心）')

/*
 * 加到 9 格（上限），把 7 个投影场景全部覆盖进来。
 *
 * 为什么要 9 格：假数据里 7 个场景分布在 a1/a6/a7/b1/b2/b3/c1 上，
 * 而勾选列表的顺序是 a6、a7、b1、b2、b3、c1、c2、c3、c4。
 * 只加 5 个（共 6 格）时 b3（出错）和 c1（压缩）进不来 ——
 * 第一版就是这么写的，「出错」断言永远失败，看着像实现坏了。
 */
await addCells(8)
const cellCount = await tab.locator('.davf-cell').count()
console.log(`  当前 ${cellCount} 格`)

const acts = await readActs()
console.log('  各格活动：' + JSON.stringify(acts))

/*
 * 假投影里配了这些场景（见 tools/panel.tsx 的 FAKE_PROJECTIONS）：
 *   a1 → pwsh（跑命令）      s1 → grep（检索中）
 *   s2 → write（写文件）     s3 → bg=1（后台任务）
 *   b2 → errorAt（出错）     a6 → compacting（压缩上下文）
 *
 * 注意：面板第一位永远是「当前窗口」= a1，所以「跑命令」一定在。
 */
const joined = acts.join(' | ')

for (const [label, expected] of [
  ['跑命令', /跑命令/],
  ['读文件', /读文件/],
  ['检索中', /检索中/],
  ['写文件', /写文件/],
  ['出错', /出错/],
  ['压缩上下文', /压缩上下文/],
  ['后台任务', /后台任务/]
]) {
  if (expected.test(joined)) ok(`出现了「${label}」`)
  else bad(`没有出现「${label}」—— 该状态仍然拿不到`)
}

/* ── 2. 关键：改动前只有四个状态能亮 ─────────────────────────────── */

console.log('\n对照：这五个状态在改动前是拿不到的')

/*
 * 这五个（读文件 / 检索中 / 写文件 / 压缩上下文 / 后台任务）在
 * 接投影之前**不可能**出现 —— 客户端当时只知道「在跑/没跑」。
 * 它们现在出现，就是投影真的接通了的证据。
 */
for (const s of ['读文件', '检索中', '写文件', '压缩上下文', '后台任务']) {
  if (joined.includes(s)) ok(`「${s}」现在可见（改动前不可达）`)
  else bad(`「${s}」仍不可见 —— 投影可能没接通`)
}

/* ── 3. 投影缺失时要优雅降级 ─────────────────────────────────────── */

console.log('\n降级：投影缺失时回落基础状态')

/*
 * 老版本 Host 半侧没有注册 `agentsBot`，客户端读到的是 undefined。
 * 这时不能崩，要回落到「空闲 / 思考中 / 等待确认 / 刚完成 / 休眠 / 启动中」。
 *
 * 假数据里 c2/c3/c4 刻意不给投影。它们排在第 8、9、10 位，
 * 勾到 8 个时只有 c2 进得来 —— 所以按「有投影的会话 id」反推更可靠：
 * 直接读 DOM 里的格子顺序，和假数据里「有投影的 id 集合」比对。
 */
/**
 * 有投影的会话 id —— 必须与 `tools/panel.tsx` 的 `FAKE_PROJECTIONS` 键一致。
 * 改那边就要改这里；不一致的表现是「降级断言把有投影的格子算成无投影」。
 */
const projectedIds = ['a1', 'a6', 'a7', 'b1', 'b2', 'c1', 'c2']
const cellIds = await tab.evaluate(() =>
  Array.from(document.querySelectorAll('.davf-cell')).map((c) => c.getAttribute('data-session-id') ?? '')
)
const toolStateWords = ['读文件', '检索中', '跑命令', '写文件', '压缩上下文', '后台任务', '出错']
const noProjActs = acts.filter((_, i) => !projectedIds.includes(cellIds[i] ?? ''))
if (noProjActs.length === 0) {
  console.log('  （这次没勾到无投影的会话，跳过这条）')
} else if (noProjActs.every((a) => !toolStateWords.some((w) => a.includes(w)))) {
  ok(`无投影的会话落在基础状态：${JSON.stringify(noProjActs)}`)
} else {
  bad(`无投影的会话出现了工具级状态（不可能）：${JSON.stringify(noProjActs)}`)
}

/* ── 4. 状态色与活动对应 ─────────────────────────────────────────── */

console.log('\n状态点颜色跟着活动变（不是全部一个色）')

const colors = await tab.evaluate(() =>
  Array.from(document.querySelectorAll('.davf-cell')).map((c) => {
    const dot = c.querySelector('.davf-dot')
    return dot ? getComputedStyle(dot).backgroundColor : ''
  })
)
const distinctColors = new Set(colors.filter(Boolean)).size
if (distinctColors >= 3) ok(`不同活动有不同颜色（${distinctColors} 种）`)
else bad(`颜色几乎一样（${distinctColors} 种）—— 活动可能没区分开`)

/* ── 5. 子代理小框里的脸 ─────────────────────────────────────────── */

console.log('\n子代理：小框里有张静止的脸')

// 回到 1 格才能看到小框
await tab.locator('.davf-cap', { hasText: /^清空/ }).click()
await tab.waitForTimeout(700)
const kidsBot = await tab.locator('.davf-kids-bot svg').count()
if (kidsBot === 1) ok('子代理小框里有 1 个 bot')
else bad(`子代理小框里的 bot 数不对：${kidsBot}`)

console.log('')
if (fails.length) {
  console.log('失败 ' + fails.length + ' 项')
  await browser.close()
  process.exit(1)
}
console.log('全部通过')
await browser.close()

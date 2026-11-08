/**
 * A/B：子代理指示器「旧横条（动画蛋）」vs「新内嵌小框（静态脸）」的 CPU 对照。
 *
 * ── 为什么需要这个探针 ──────────────────────────────────────────────
 * 用户问的是「换掉之后省了多少」。这种问题**不能用估算回答** ——
 * 之前「砍弧省 CPU」的估算就被实测推翻了（1~4 条弧差异全在噪声内）。
 * 所以这里做真 A/B：两个版本各构建一份 panel.html，交错采样，报区间。
 *
 * ── 三个必须成立的对照条件 ──────────────────────────────────────────
 *   1. **同一帧率档位**（45）。跨帧率比较等于比「少画了多少帧」，不是比结构。
 *   2. **同一格数**。旧横条只在单格显示；新小框每格都可能显示。
 *      所以主对照用「1 格 + 有子代理」——那是旧横条唯一存在过的场景，
 *      也是用户实际看到的场景。多格另测，用来看新方案的额外成本。
 *   3. **交错采样**。单次 3 秒采样的波动可达 ±5pp（README 有记录），
 *      必须让机器漂移平均分给两个版本，否则量到的是漂移不是差异。
 *
 * ── 两种构建怎么共存 ────────────────────────────────────────────────
 * 用 git worktree 不现实（这个仓库不推远程、且改动未提交）。这里直接
 * 用 `git stash` 切换工作树，分别构建到两个不同文件名，然后交错采样。
 * 采样结束会把改动恢复回去 —— 失败也必须恢复，否则用户的工作区被留在
 * 旧版本上。
 *
 * 用法（在 grokbot 目录下，工作区必须是「改动已保存但未提交」的状态）：
 *   node tools/probe-kids-ab.mjs                # 默认 5 轮
 *   node tools/probe-kids-ab.mjs --rounds 7
 */
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WS = resolve(ROOT, '..') // 工作区根（git 仓库根）
const CHROME = 'D:/百分/CentBrowser/Application/chrome.exe'
const FPS = 45

const argOf = (name, dflt) => {
  const i = process.argv.indexOf(name)
  return i >= 0 ? Number(process.argv[i + 1]) : dflt
}
const ROUNDS = argOf('--rounds', 5)

const NEW_HTML = resolve(ROOT, 'preview', 'panel.html')
const NEW_JS = resolve(ROOT, 'preview', 'panel.js')
const OLD_HTML = resolve(ROOT, 'preview', 'panel-old.html')
const OLD_JS = resolve(ROOT, 'preview', 'panel-old.js')

const sh = (cmd, cwd = WS) => execSync(cmd, { cwd, stdio: 'pipe' }).toString()

/** 构建当前工作树到指定文件名。 */
function buildTo(htmlPath, jsPath) {
  sh('node tools/build-panel.mjs', ROOT)
  copyFileSync(NEW_JS, jsPath)
  copyFileSync(NEW_HTML, htmlPath)
  // HTML 里的 <script src> 要指向改名后的 js
  const jsName = jsPath.split(/[\\/]/).pop()
  writeFileSync(htmlPath, readFileSync(htmlPath, 'utf8').replace('panel.js', jsName), 'utf8')
}

let stashed = false
function restore() {
  if (!stashed) return
  try {
    sh('git stash pop')
    stashed = false
    console.log('\n（已恢复改动）')
  } catch (e) {
    console.error('\n!! 恢复改动失败，请手动执行 git stash pop !!')
    console.error(String(e))
  }
}

process.on('SIGINT', () => {
  restore()
  process.exit(1)
})

/* ── 1. 构建新版（当前工作树） ─────────────────────────────────────── */
console.log('构建新版（内嵌静态小框）…')
buildTo(NEW_HTML, NEW_JS)
copyFileSync(NEW_JS, resolve(ROOT, 'preview', 'panel-new.js'))

/* ── 2. 切到旧版构建 ──────────────────────────────────────────────── */
console.log('切到旧版（底部动画横条）…')
const dirty = sh('git status --porcelain -- grokbot/plugin/src grokbot/tools/panel.tsx').trim()
if (!dirty) {
  console.error('工作区没有改动 —— 旧版就是 HEAD，直接构建 HEAD 即可，但这个探针假设改动已存在。')
  process.exit(1)
}
sh('git stash push -u -m probe-kids-ab -- grokbot/plugin/src grokbot/tools/panel.tsx')
stashed = true

let oldOk = false
try {
  buildTo(OLD_HTML, OLD_JS)
  oldOk = existsSync(OLD_HTML) && existsSync(OLD_JS)
} finally {
  restore()
}

if (!oldOk) {
  console.error('旧版构建失败')
  process.exit(1)
}

/*
 * ── 必须重构建一次新版 ────────────────────────────────────────────────
 * `buildTo` 内部调的是 `tools/build-panel.mjs`，它**固定**写
 * `preview/panel.html` 与 `preview/panel.js`。所以上面那次旧版构建
 * 已经把「新版」的那两个文件覆盖成旧版内容了。
 *
 * 不补这一步的后果是静默的：两个场景其实加载同一个旧版产物，量出来
 * 的差异只剩噪声（第一版就是这样，9 格两行 21.6% vs 22.6% 看着像
 * 「差不多」，实际是同一个东西跑了两遍）。
 */
console.log('恢复源码后重构建新版…')
buildTo(NEW_HTML, NEW_JS)

/* ── 自检：两份产物必须是不同的字节 ────────────────────────────────
   这是本探针最容易静默失效的地方 —— 如果两份一样，量出来的是同一个
   东西跑两遍，差异只剩噪声，而结论会写成「新旧差不多」。宁可直接失败。 */
const sizeOld = statSync(OLD_JS).size
const sizeNew = statSync(NEW_JS).size
if (sizeOld === sizeNew && readFileSync(OLD_JS).equals(readFileSync(NEW_JS))) {
  console.error('两份产物完全相同 —— 构建没切换成功，A/B 无意义，中止。')
  process.exit(1)
}
console.log(`产物自检通过：旧 ${sizeOld} B / 新 ${sizeNew} B`)

/* ── 自检 2：两份产物在「有没有内嵌小框」上必须给出不同答案 ─────────
   字节不同还不够（可能只差个注释），要确认它们真的是两种形态。 */
{
  const probe = await chromium.launch({ executablePath: CHROME, headless: true })
  const c2 = await probe.newContext({ viewport: { width: 1280, height: 860 } })
  const sig = async (html) => {
    const t = await c2.newPage()
    await t.addInitScript(() => {
      try {
        localStorage.clear()
      } catch {}
    })
    await t.goto(pathToFileURL(html).href)
    await t.waitForTimeout(900)
    const r = await t.evaluate(() => ({
      kids: document.querySelectorAll('.davf-kids').length,
      nested: !!document.querySelector('.davf-cell .davf-kids')
    }))
    await t.close()
    return r
  }
  const a = await sig(OLD_HTML)
  const b = await sig(NEW_HTML)
  await probe.close()
  if (a.nested === b.nested) {
    console.error(`两份产物的形态相同（旧 ${JSON.stringify(a)} / 新 ${JSON.stringify(b)}）—— 切换没生效，中止。`)
    process.exit(1)
  }
  console.log(`形态自检通过：旧=${JSON.stringify(a)} 新=${JSON.stringify(b)}`)
}

/* ── 3. 交错采样 ──────────────────────────────────────────────────── */
const browser = await chromium.launch({ executablePath: CHROME, headless: true })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } })

const snap = async (cdp) => {
  const m = await cdp.send('Performance.getMetrics')
  const pick = (k) => m.metrics.find((x) => x.name === k)?.value ?? 0
  return { task: pick('TaskDuration'), script: pick('ScriptDuration'), layout: pick('LayoutDuration'), style: pick('RecalcStyleDuration') }
}

async function sample(cdp, ms) {
  const a = await snap(cdp)
  await new Promise((r) => setTimeout(r, ms))
  const b = await snap(cdp)
  const win = ms / 1000
  return {
    task: ((b.task - a.task) / win) * 100,
    script: ((b.script - a.script) / win) * 100,
    layout: ((b.layout - a.layout) / win) * 100,
    style: ((b.style - a.style) / win) * 100
  }
}

/**
 * 量一个版本。`cells` = 勾到几格（1 = 旧横条唯一出现的场景）。
 */
async function measure(html, cells) {
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
  await tab.goto(pathToFileURL(html).href)
  await tab.waitForTimeout(700)

  if (cells > 1) {
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
    const c = await rows.count()
    let have = await tab.locator('.davf-cell').count()
    for (let i = 0; i < c && have < cells; i++) {
      const row = rows.nth(i)
      if (((await row.getAttribute('class')) ?? '').includes('is-on')) continue
      await row.click()
      await tab.waitForTimeout(100)
      have = await tab.locator('.davf-cell').count()
    }
    await tab.locator('.davf-cap', { hasText: /^对话/ }).click()
    await tab.waitForTimeout(400)
  }

  const cdp = await ctx.newCDPSession(tab)
  await cdp.send('Performance.enable')
  await sample(cdp, 1000) // 预热丢弃
  const r = await sample(cdp, 3000)
  const n = await tab.locator('.davf-cell').count()
  // 记录指示器形态，确认两个版本真的不同
  const shape = await tab.evaluate(() => ({
    kids: document.querySelectorAll('.davf-kids').length,
    // 旧横条是 .davf-body 的直接子节点；新小框在 .davf-cell 里
    nested: !!document.querySelector('.davf-cell .davf-kids'),
    animated: !!document.querySelector('.davf-kids svg')?.closest('[class]')
  }))
  await tab.close()
  return { cells: n, ...r, shape }
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const SCENES = [
  { key: 'old-1', label: '旧·横条 1格', html: OLD_HTML, cells: 1 },
  { key: 'new-1', label: '新·小框 1格', html: NEW_HTML, cells: 1 },
  { key: 'old-9', label: '旧 9格', html: OLD_HTML, cells: 9 },
  { key: 'new-9', label: '新 9格', html: NEW_HTML, cells: 9 }
]

const results = Object.fromEntries(SCENES.map((s) => [s.key, []]))
console.log(`\n交错采样（${ROUNDS} 轮，每轮各场景各 3 秒，帧率 ${FPS}）`)
for (let round = 0; round < ROUNDS; round++) {
  for (const s of SCENES) {
    results[s.key].push(await measure(s.html, s.cells))
  }
  process.stdout.write(`\r已跑 ${round + 1}/${ROUNDS} 轮…`)
}
process.stdout.write('\n\n')

const rows = SCENES.map((s) => {
  const xs = results[s.key]
  const tasks = xs.map((r) => r.task)
  return {
    label: s.label,
    cells: xs[0].cells,
    kids: xs[0].shape.kids,
    nested: xs[0].shape.nested,
    task: median(tasks),
    min: Math.min(...tasks),
    max: Math.max(...tasks),
    script: median(xs.map((r) => r.script)),
    layout: median(xs.map((r) => r.layout)),
    style: median(xs.map((r) => r.style))
  }
})

console.log('场景           格数 小框数 主线程(中位)   范围           脚本    布局    样式')
console.log('─'.repeat(82))
for (const r of rows) {
  console.log(
    `${r.label.padEnd(14)} ${String(r.cells).padStart(2)}  ${String(r.kids).padStart(3)}  ` +
      `${r.task.toFixed(1).padStart(8)}%  ${`${r.min.toFixed(1)}~${r.max.toFixed(1)}%`.padEnd(13)}` +
      `  ${r.script.toFixed(1).padStart(4)}%  ${r.layout.toFixed(1).padStart(4)}%  ${r.style.toFixed(1).padStart(4)}%`
  )
}

/** 区间是否重叠 —— 重叠就是「分不出高下」，不许当结论。 */
const overlaps = (a, b) => a.min <= b.max && b.min <= a.max

console.log('\n判读：')
const o1 = rows.find((r) => r.label.startsWith('旧·横条'))
const n1 = rows.find((r) => r.label.startsWith('新·小框'))
if (o1 && n1) {
  const d = n1.task - o1.task
  const o = overlaps(o1, n1)
  console.log(
    `  1 格：旧 ${o1.task.toFixed(1)}%（${o1.min.toFixed(1)}~${o1.max.toFixed(1)}%） → ` +
      `新 ${n1.task.toFixed(1)}%（${n1.min.toFixed(1)}~${n1.max.toFixed(1)}%）` +
      `，差 ${d >= 0 ? '+' : ''}${d.toFixed(1)}pp${o ? ' —— **区间重叠，这个差异分不出来**' : ''}`
  )
}
const o9 = rows.find((r) => r.label === '旧 9格')
const n9 = rows.find((r) => r.label === '新 9格')
if (o9 && n9) {
  const d = n9.task - o9.task
  const o = overlaps(o9, n9)
  console.log(
    `  9 格：旧 ${o9.task.toFixed(1)}% → 新 ${n9.task.toFixed(1)}%，` +
      `差 ${d >= 0 ? '+' : ''}${d.toFixed(1)}pp${o ? ' —— **区间重叠**' : ''}`
  )
  console.log('   （9 格时旧版本来就不画横条，这一行是「结构差异」的对照，不是指示器成本）')
}
console.log('  单次采样波动可达 ±5pp，比较版本请用 --rounds 5 以上，并看区间是否重叠。')

await browser.close()

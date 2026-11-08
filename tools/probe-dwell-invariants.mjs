/**
 * 节流**真的在生效**吗？—— 光测开销不够，必须证明它改变了显示行为。
 *
 * 判据：同一段活动流喂进去，开启节流后「显示的动画切换次数」必须明显减少，
 * 且「每个动画至少停留 dwellMs」这条必须成立。
 *
 * 做法：不依赖真实会话（活动变化不可控），用**可控的活动序列**直接驱动
 * `pickDisplayed`，检查不变量。这是纯函数层，比跑浏览器可靠。
 *
 * 用法：node tools/build-test.mjs && node tools/probe-dwell-invariants.mjs
 */
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/* 用 esbuild 现场打一份 dwell.ts（它只有类型 import，可以直接打）。 */
const { buildSync } = require('esbuild')
buildSync({
  entryPoints: [resolve(ROOT, 'plugin/src/client/dwell.ts')],
  bundle: true,
  outfile: resolve(ROOT, 'preview', '_dwell.cjs'),
  platform: 'node',
  format: 'cjs',
  logLevel: 'error'
})
const { pickDisplayed } = require(resolve(ROOT, 'preview', '_dwell.cjs'))

let pass = 0
let fail = 0
const ok = (m) => {
  console.log('  ok   ' + m)
  pass++
}
const bad = (m) => {
  console.log('  FAIL ' + m)
  fail++
}

/* ── 1. 关闭时必须与「不节流」逐帧一致 ─────────────────────────────── */
console.log('关闭态（dwellMs=0）：必须与改造前行为完全一致')
{
  const wants = ['thinking', 'reading', 'writing', 'running', 'idle']
  let st
  let mismatched = 0
  for (let i = 0; i < wants.length; i++) {
    const t = i * 50
    st = pickDisplayed(st, wants[i], t, 0)
    if (st.shown !== wants[i]) mismatched++
  }
  if (mismatched === 0) ok('每一帧都直接跟随真实活动（零延迟）')
  else bad(`有 ${mismatched} 帧没跟随`)
}

/* ── 2. 开启时必须保证「至少停留 dwellMs」──────────────────────────── */
console.log('\n开启态：每个动画至少停留 dwellMs')
{
  const D = 1600
  /* 高频变化的输入：每 100ms 换一个活动，共 60 次（6 秒）。 */
  const seq = []
  const pool = ['thinking', 'reading', 'writing', 'running']
  for (let i = 0; i < 60; i++) seq.push({ t: i * 100, want: pool[i % pool.length] })

  let st
  const shown = []
  for (const s of seq) {
    st = pickDisplayed(st, s.want, s.t, D)
    if (shown.length === 0 || shown[shown.length - 1].a !== st.shown) {
      shown.push({ t: s.t, a: st.shown })
    }
  }

  /* 每个显示段（除了最后一段还没结束）都要 >= D。 */
  let violations = 0
  for (let i = 1; i < shown.length - 1; i++) {
    const dur = shown[i + 1].t - shown[i].t
    if (dur < D) violations++
  }
  if (violations === 0) ok(`${shown.length} 段显示，每段都 >= ${D}ms`)
  else bad(`${violations} 段短于 ${D}ms`)

  const rawSwitches = seq.length
  if (shown.length < rawSwitches) ok(`切换次数 ${rawSwitches} → ${shown.length}（明显减少）`)
  else bad(`切换次数没减少：${rawSwitches} → ${shown.length}`)

  /* 关键：不能永久卡住 —— 最后必须跟上最新的 want */
  if (st.shown === seq[seq.length - 1].want) ok('最终跟上了最新的活动（没有永久卡死）')
  else bad(`最终停在 ${st.shown}，没跟上 ${seq[seq.length - 1].want}`)
}

/* ── 3. 边界：首次调用必须立刻显示，不能等 ─────────────────────────── */
console.log('\n边界')
{
  const st = pickDisplayed(undefined, 'reading', 1000, 1600)
  if (st.shown === 'reading') ok('首次调用立刻显示（不等 1.6 秒）')
  else bad('首次调用没有立刻显示')

  /* 活动没变时不能续期（否则永远换不掉） */
  let s2 = pickDisplayed(undefined, 'reading', 0, 1600)
  const until1 = s2.until
  s2 = pickDisplayed(s2, 'reading', 500, 1600)
  if (s2.until === until1) ok('活动没变时不续期（否则永远换不掉）')
  else bad('活动没变却把解禁时刻往后推了')

  /* 负数 / 非数字不能崩 */
  try {
    pickDisplayed(undefined, 'idle', 0, -1)
    pickDisplayed(undefined, 'idle', 0, NaN)
    ok('负数 / NaN 的 dwellMs 不崩（按关闭处理）')
  } catch (e) {
    bad('dwellMs 为负数或 NaN 时崩了：' + e.message)
  }
}

/* ── 4. 不排队：中间那些活动必须被丢弃，而不是攒着 ─────────────────── */
console.log('\n不排队（用户原话：去掉没播完的）')
{
  const D = 1600
  let st = pickDisplayed(undefined, 'idle', 0, D) // 显示 idle 到 1600
  /* 在停留期内来了 3 个新活动 */
  st = pickDisplayed(st, 'reading', 400, D)
  st = pickDisplayed(st, 'writing', 800, D)
  st = pickDisplayed(st, 'running', 1200, D)
  if (st.shown === 'idle') ok('停留期内保持不动')
  else bad('停留期内提前切换了')

  /* 到点：必须直接跳到最新的 running，不是回到 reading */
  st = pickDisplayed(st, 'running', 1700, D)
  if (st.shown === 'running') ok('到点直接跳到最新（跳过了 reading / writing，不排队）')
  else bad(`到点跳到了 ${st.shown}，应该是 running（说明在排队）`)
}

console.log('')
if (fail === 0) console.log(`全部通过（${pass} 项）`)
else console.log(`${pass} 项通过，${fail} 项失败`)
process.exitCode = fail === 0 ? 0 : 1

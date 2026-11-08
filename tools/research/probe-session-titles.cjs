/**
 * 看真实会话日志里 title / cwd 到底存了什么 —— 决定「格子显示什么名字」。
 *
 * ── 为什么要查 ──────────────────────────────────────────────────────
 * 用户反馈「加几个对话后，格子里都显示 lead，分不清谁是谁」。
 *
 * 已知：宿主 `buildTeamProjection` 里 Lead 的名字是**字面量**：
 *   members = [{ id: rootId, name: 'lead', role: 'lead', phase: 'active' }]
 * 所以只要一个会话参与了 Team，它的 `agentTeam.members` 里就有个叫 lead
 * 的条目，而我们的 `teamNames()` 会用它覆盖掉真正的标题。
 *
 * 要判断「改用会话标题」是否可行，得先确认标题本身有没有内容。
 *
 * 用法：node tools/research/probe-session-titles.cjs
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const zlib = require('node:zlib')

const SESS = path.join(os.homedir(), '.dsh', 'sessions')
const ZSTD = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')

let scanZstdFrames
try {
  ;({ scanZstdFrames } = require(ZSTD))
} catch (e) {
  console.error('拿不到官方 zstd 解码器：' + e.message)
  process.exit(1)
}

/** DSH 日志是多帧 zstd 拼接，必须用官方 scanZstdFrames 逐帧解。 */
function readLines(p) {
  let buf
  try {
    buf = fs.readFileSync(p)
  } catch {
    return null
  }
  const parts = []
  try {
    for (const f of scanZstdFrames(buf).frames) {
      try {
        parts.push(zlib.zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8'))
      } catch {}
    }
  } catch {
    return null
  }
  return parts
    .join('')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l)
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** 收集所有 session.vN.jsonl.zstd */
function findLogs(dir, out = []) {
  let ents
  try {
    ents = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of ents) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) findLogs(p, out)
    else if (/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) out.push(p)
  }
  return out
}

const logs = findLogs(SESS)
console.log(`找到 ${logs.length} 个会话日志\n`)

const rows = []
for (const p of logs) {
  const evs = readLines(p)
  if (!evs || evs.length === 0) continue
  // 第一条通常是 header
  const header = evs[0]
  const d = header?.data ?? header
  rows.push({
    file: path.basename(path.dirname(p)),
    type: header?.type,
    title: d?.title,
    cwd: d?.cwd,
    id: d?.id ?? d?.sessionId,
    events: evs.length
  })
}

console.log('前 15 个会话的 header：')
console.log('  ' + 'title'.padEnd(30) + 'cwd')
for (const r of rows.slice(0, 15)) {
  const t = r.title === undefined ? '(无 title)' : String(r.title)
  const c = r.cwd === undefined ? '(无 cwd)' : String(r.cwd)
  console.log('  ' + t.slice(0, 29).padEnd(30) + c)
}

const withTitle = rows.filter((r) => typeof r.title === 'string' && r.title.trim() !== '')
const withCwd = rows.filter((r) => typeof r.cwd === 'string' && r.cwd.trim() !== '')

console.log(`\n统计（共 ${rows.length} 个）：`)
console.log(`  有 title: ${withTitle.length}  (${((withTitle.length / rows.length) * 100).toFixed(0)}%)`)
console.log(`  有 cwd  : ${withCwd.length}  (${((withCwd.length / rows.length) * 100).toFixed(0)}%)`)

console.log('\n有 title 的样本：')
for (const r of withTitle.slice(0, 10)) console.log(`  · ${r.title}`)

console.log('\ncwd 的 basename（title 缺失时的兜底）分布：')
const bases = new Map()
for (const r of withCwd) {
  const b = String(r.cwd).replace(/[/\\]+$/, '').split(/[/\\]/).pop() || ''
  bases.set(b, (bases.get(b) ?? 0) + 1)
}
for (const [b, n] of [...bases.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
  console.log(`  ${String(n).padStart(3)}  ${b}`)
}

console.log('\n结论：')
if (withTitle.length / rows.length > 0.5) {
  console.log('  多数会话有真实 title → 格子应该优先显示 title（比 lead 有信息量得多）。')
  console.log('  没有 title 的会话用 cwd 的 basename 兜底，最后才是 id 前 8 位。')
} else {
  console.log('  多数会话没有 title → 改用 cwd basename 为主。')
}
console.log('  绝不能再让 team 的 lead 名字覆盖标题 —— 那是宿主的字面量常量，没有信息量。')

/**
 * 从真实会话日志里找「标题」到底存在哪。
 *
 * ── 背景 ────────────────────────────────────────────────────────────
 * 左栏明明显示「R2 王华实测剧本沙盘执行测试 (4)」这种标题，
 * 但我之前只读了 header 事件，得出「27 个会话全都没有 title」——
 * 说明标题不在 header 里，或者存在别处（投影快照 / 别的文件）。
 *
 * 这个脚本把一条会话日志的前若干事件全打出来，逐个看哪个带 title。
 *
 * 用法：node tools/research/probe-where-title-lives.cjs
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const zlib = require('node:zlib')

const SESS = path.join(os.homedir(), '.dsh', 'sessions')
const ZSTD = path.join(os.homedir(), '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')
const { scanZstdFrames } = require(ZSTD)

function readEvents(p) {
  const buf = fs.readFileSync(p)
  const parts = []
  for (const f of scanZstdFrames(buf).frames) {
    try {
      parts.push(zlib.zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8'))
    } catch {}
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
// 挑一个最大的（内容最多，最可能有标题）
logs.sort((a, b) => {
  try {
    return fs.statSync(b).size - fs.statSync(a).size
  } catch {
    return 0
  }
})

const target = logs[0]
console.log('会话日志：' + target)
console.log('目录名：' + path.basename(path.dirname(target)) + '\n')

const evs = readEvents(target)
console.log(`共 ${evs.length} 条事件\n`)

console.log('=== 前 8 条事件的完整形状 ===')
for (let i = 0; i < Math.min(8, evs.length); i++) {
  const e = evs[i]
  console.log(`\n[${i}] type=${e.type}`)
  console.log(JSON.stringify(e).slice(0, 700))
}

console.log('\n\n=== 所有含 "title" 字样的事件 ===')
let n = 0
for (let i = 0; i < evs.length && n < 12; i++) {
  const s = JSON.stringify(evs[i])
  if (s.includes('title')) {
    console.log(`\n[${i}] type=${evs[i].type}`)
    console.log(s.slice(0, 600))
    n++
  }
}
if (n === 0) console.log('（没有任何事件含 title）')

console.log('\n\n=== 事件类型分布（前 25 种）===')
const counts = new Map()
for (const e of evs) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
for (const [t, c] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${String(c).padStart(5)}  ${t}`)
}

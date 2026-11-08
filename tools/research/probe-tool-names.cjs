// 列出本机会话日志里出现过的全部工具名 —— 这是「能拿到多少种状态」的事实依据。
// 用法: node tools\research\probe-tool-names.cjs
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const HOME = process.env.USERPROFILE
const SESS = path.join(HOME, '.dsh', 'sessions')
const ZSTD_MOD = path.join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')
const RE = /^session(\.v\d+)?\.jsonl(\.zstd)?$/

async function main() {
  const { scanZstdFrames } = await import('file://' + ZSTD_MOD.split(path.sep).join('/'))
  const { zstdDecompressSync } = require('node:zlib')

  function readZ(f) {
    const b = fs.readFileSync(f)
    const r = scanZstdFrames(b)
    const p = []
    for (const x of r.frames) {
      try {
        p.push(zstdDecompressSync(b.subarray(x.start, x.end)).toString('utf8'))
      } catch {}
    }
    return p.join('')
  }

  const names = new Map()
  const resultStatus = new Map()
  let calls = 0

  function walk(d) {
    let ents
    try {
      ents = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        walk(p)
        continue
      }
      if (!RE.test(e.name)) continue
      let t = ''
      try {
        t = e.name.endsWith('.zstd') ? readZ(p) : fs.readFileSync(p, 'utf8')
      } catch {
        continue
      }
      for (const line of t.split('\n')) {
        if (!line.trim()) continue
        let o
        try {
          o = JSON.parse(line)
        } catch {
          continue
        }
        if (o.type === 'tool/call' && o.data && typeof o.data.name === 'string') {
          calls++
          names.set(o.data.name, (names.get(o.data.name) || 0) + 1)
        }
        // tool/result 里有没有成败标记？
        if (o.type === 'tool/result' && o.data && o.data.message) {
          const m = o.data.message
          const keys = Object.keys(m).join(',')
          resultStatus.set(keys, (resultStatus.get(keys) || 0) + 1)
        }
      }
    }
  }
  walk(SESS)

  const s = [...names.entries()].sort((a, b) => b[1] - a[1])
  console.log(`tool/call 共 ${calls} 次，${s.length} 种工具\n`)
  console.log('次数'.padStart(7), '工具名')
  for (const [n, c] of s) console.log(String(c).padStart(7), n)

  console.log('\n=== tool/result.message 的字段组合 ===')
  for (const [k, c] of [...resultStatus.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(String(c).padStart(7), k)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

// 统计本机会话日志里真实出现过的事件类型，判断「能不能拿到工具级状态」。
//
// 必须用官方多帧解码：DSH 日志是多帧 zstd 拼接，zstdDecompressSync(整文件)
// 只解第一帧、只返回 header 一行（本机实测 27 个文件只出 27 条事件，全是 header）。
//
// 用法: node tools\research\probe-event-types.cjs
'use strict'
const fs = require('node:fs')
const path = require('node:path')

const HOME = process.env.USERPROFILE
const SESS = path.join(HOME, '.dsh', 'sessions')
const ZSTD_MOD = path.join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')

async function main() {
  const { scanZstdFrames } = await import('file://' + ZSTD_MOD.replace(/\\/g, '/'))
  const { zstdDecompressSync } = require('node:zlib')

  function readZstd(file) {
    const buf = fs.readFileSync(file)
    let frames
    try {
      frames = scanZstdFrames(buf)
    } catch (e) {
      return { text: '', err: String(e.message).slice(0, 80) }
    }
    const parts = []
    for (const f of frames.frames) {
      try {
        parts.push(zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8'))
      } catch {}
    }
    return { text: parts.join(''), frames: frames.frames.length }
  }

  const typeCount = new Map()
  const sampleByType = new Map()
  const toolCount = new Map()
  let files = 0
  let events = 0
  let totalFrames = 0
  let errs = 0

  function walk(dir) {
    let ents
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        walk(p)
        continue
      }
      if (!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) continue
      let r
      try {
        r = e.name.endsWith('.zstd')
          ? readZstd(p)
          : { text: fs.readFileSync(p, 'utf8'), frames: 0 }
      } catch {
        continue
      }
      if (!r.text) {
        errs++
        continue
      }
      files++
      totalFrames += r.frames ?? 0
      for (const line of r.text.split('\n')) {
        if (!line.trim()) continue
        let o
        try {
          o = JSON.parse(line)
        } catch {
          continue
        }
        events++
        const t = o.type ?? '(no type)'
        typeCount.set(t, (typeCount.get(t) ?? 0) + 1)
        if (!sampleByType.has(t)) sampleByType.set(t, JSON.stringify(o).slice(0, 400))

        // 抓工具名：递归找任何叫 tool / toolName / name 的字符串字段
        const seen = new Set()
        const dig = (v, depth) => {
          if (!v || depth > 4 || typeof v !== 'object' || seen.has(v)) return
          seen.add(v)
          for (const [k, val] of Object.entries(v)) {
            if (typeof val === 'string' && /^(tool|toolName|name)$/.test(k) && val.length < 40) {
              toolCount.set(val, (toolCount.get(val) ?? 0) + 1)
            } else if (typeof val === 'object') dig(val, depth + 1)
          }
        }
        dig(o, 0)
      }
    }
  }

  walk(SESS)

  console.log(`扫了 ${files} 个会话文件（${totalFrames} 个 zstd 帧，${errs} 个读失败），共 ${events} 条事件\n`)

  console.log('=== 事件类型分布 ===')
  const sorted = [...typeCount.entries()].sort((a, b) => b[1] - a[1])
  for (const [t, n] of sorted) console.log(String(n).padStart(8), t)

  console.log('\n=== 疑似工具名（前 30）===')
  const tools = [...toolCount.entries()].sort((a, b) => b[1] - a[1])
  for (const [t, n] of tools.slice(0, 30)) console.log(String(n).padStart(8), t)

  console.log('\n=== 每种类型的样本（前 12 类）===')
  for (const [t] of sorted.slice(0, 12)) {
    console.log('\n--- ' + t + ' ---')
    console.log(sampleByType.get(t))
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

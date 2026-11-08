// 判断 job/registered 是「前台工具调用」还是「后台任务」。
// 判据：job/settled 的时间是否明显晚于对应 tool/result 的时间。
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const HOME = process.env.USERPROFILE
const SESS = path.join(HOME, '.dsh', 'sessions')
const ZSTD = path.join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')

async function main() {
  const { scanZstdFrames } = await import('file://' + ZSTD.replace(/\\/g, '/'))
  const { zstdDecompressSync } = require('node:zlib')

  let outlived = 0
  let inline = 0
  const samples = []

  function readEvents(p) {
    let buf
    try { buf = fs.readFileSync(p) } catch { return null }
    let text = ''
    try {
      const fr = scanZstdFrames(buf)
      const parts = []
      for (const f of fr.frames) {
        try { parts.push(zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8')) } catch {}
      }
      text = parts.join('')
    } catch { return null }
    const evs = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let o
      try { o = JSON.parse(line) } catch { continue }
      evs.push(o)
    }
    return evs
  }

  function scanFile(evs) {
    const resultAt = new Map()
    for (const o of evs) {
      if (o.type !== 'tool/result') continue
      const cid = o.data?.message?.toolCallId
      if (cid) resultAt.set(cid, o.time)
    }
    const settleAt = new Map()
    for (const o of evs) {
      if (o.type === 'job/settled') settleAt.set(o.data?.jobId, o.time)
    }
    for (const o of evs) {
      if (o.type !== 'job/registered') continue
      const d = o.data || {}
      const cid = d.toolCall?.callId
      const r = resultAt.get(cid)
      if (r === undefined) continue
      const s = settleAt.get(d.jobId)
      if (s === undefined) continue
      const lag = s - r
      if (lag > 500) {
        outlived++
        if (samples.length < 3) samples.push({ jobId: d.jobId, total: s - (d.startedAt ?? o.time), afterResult: lag })
      } else inline++
    }
  }

  function walk(dir) {
    let ents
    try { ents = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of ents) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) { walk(p); continue }
      if (!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) continue
      const evs = readEvents(p)
      if (evs) scanFile(evs)
    }
  }

  walk(SESS)
  console.log('settled 晚于 tool/result 500ms 以上（=后台任务）:', outlived)
  console.log('之内结束（=前台调用）:', inline)
  console.log('样本:', JSON.stringify(samples, null, 1))
}

main().catch((e) => { console.error(e); process.exit(1) })

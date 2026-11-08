// 用真实会话日志验证投影单元：把每个会话的事件流跑过 lib/index.js 的 apply，
// 看最后的状态和「日志里确实发生过什么」对不对得上。
//
// 为什么必须用真数据：假事件序列只能证明代码按我设想的方式跑，
// 不能证明我的设想符合宿主真实的事件形状。这个项目上已经栽过两次
// （fake fixture 掩盖了真 bug）。
//
// 用法：node plugin/test/verify-projection.cjs
'use strict'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const HOME = process.env.USERPROFILE
const SESS = path.join(HOME, '.dsh', 'sessions')
// 使用工作区已跟踪的同源帧扫描器，不依赖桌面 profile 是否另装 dsh-chat-export。
const { scanZstdFrames } = require('../../../.dsh/skills/session-log-digest/scripts/会话日志解读skill-附属脚本-新.cjs')
const LIB = pathToFileURL(process.env.GROKBOT_TEST_HOST_LIB || path.resolve(__dirname, '..', 'lib', 'index.js')).href

async function main() {
  const { zstdDecompressSync } = require('node:zlib')
  const def = (await import(LIB)).agentsBotProjection

  function readEvents(p) {
    let buf
    try {
      buf = fs.readFileSync(p)
    } catch {
      return null
    }
    let text = ''
    try {
      const fr = scanZstdFrames(buf)
      const parts = []
      for (const f of fr.frames) {
        try {
          parts.push(zstdDecompressSync(buf.subarray(f.start, f.end)).toString('utf8'))
        } catch {}
      }
      text = parts.join('')
    } catch {
      return null
    }
    const out = []
    for (const line of text.split('\n')) {
      if (!line.trim()) continue
      let o
      try {
        o = JSON.parse(line)
      } catch {
        continue
      }
      out.push(o)
    }
    return out
  }

  function collect(dir, acc) {
    let ents
    try {
      ents = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return acc
    }
    for (const e of ents) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) {
        collect(p, acc)
        continue
      }
      if (!/^session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) continue
      const evs = readEvents(p)
      if (evs && evs.length) acc.push({ file: e.name, events: evs })
    }
    return acc
  }

  const sessions = collect(SESS, [])
  console.log(`扫到 ${sessions.length} 个会话\n`)

  let checked = 0
  let failures = 0

  /** 从原始事件里独立数一遍「应该」得到什么，用来对照折叠结果。 */
  function expected(events) {
    const callNames = new Map()
    let openCalls = 0
    let lastError = 0
    let lastActivity = 0
    let sawCompaction = false
    const jobCalls = new Map()
    const resultAt = new Map()

    for (const e of events) {
      const t = e.type
      if (t === 'tool/call') {
        const cid = e.data?.callId
        const name = e.data?.name
        if (typeof cid === 'string' && typeof name === 'string') {
          callNames.set(cid, name)
          openCalls++
          lastActivity = Math.max(lastActivity, e.time ?? 0)
        }
      } else if (t === 'tool/result') {
        const cid = e.data?.message?.toolCallId
        if (typeof cid === 'string' && callNames.has(cid)) {
          callNames.delete(cid)
          openCalls--
        }
        resultAt.set(cid, e.time)
        lastActivity = Math.max(lastActivity, e.time ?? 0)
      } else if (t === 'job/registered') {
        const jid = e.data?.jobId
        const cid = e.data?.toolCall?.callId
        if (typeof jid === 'string') jobCalls.set(jid, cid)
      } else if (t === 'compaction/start') {
        sawCompaction = true
      } else if (t === 'turn/end') {
        const reason = e.data?.reason
        const failure = reason?.error
        if (reason?.kind === 'error' && failure && typeof failure === 'object' && (
          (Number.isInteger(failure.status) && failure.status >= 400 && failure.status <= 599) ||
          (typeof failure.code === 'string' && failure.code.length > 0 && failure.code !== 'TOOL_ACTIVATION_FAILED' && failure.code !== 'UNKNOWN')
        )) lastError = e.time ?? 0
        if (reason?.kind === 'completed') lastError = 0
        openCalls = 0
        callNames.clear()
      }
    }
    return { openCalls, lastError, lastActivity, sawCompaction }
  }

  for (const { file, events } of sessions) {
    const exp = expected(events)
    let s = def.init()
    for (const e of events) s = def.apply(s, e)
    const v = def.wire.view(s)

    const tag = file.slice(0, 40)
    try {
      assert.equal(v.tools, exp.openCalls, `${tag}: 在跑工具数`)
      assert.equal(v.errorAt, exp.lastError, `${tag}: 出错时刻`)
      assert.ok(v.compacting === false, `${tag}: 压缩应在回合结束时清掉`)
      assert.ok(v.bg >= 0, `${tag}: 后台任务数不能为负`)
      def.wire.viewSchema.parse(v)
      def.stateSchema.parse(s)
      checked++
    } catch (e) {
      failures++
      console.log(`  FAIL ${String(e.message).split('\n')[0]}`)
    }
  }

  console.log(`\n${checked} 个会话折叠结果与独立计数一致` + (failures ? `，${failures} 个不一致` : ''))

  /* 额外确认：真数据里确实出现了本单元要抓的信号 */
  const anyEvents = sessions.flatMap((s) => s.events)
  const types = new Set(anyEvents.map((e) => e.type))
  console.log('\n真数据里出现过的相关事件类型：')
  for (const t of ['tool/call', 'tool/result', 'job/registered', 'job/settled', 'compaction/start', 'compaction/end', 'assistant/attempt', 'turn/end']) {
    console.log(`  ${types.has(t) ? '有' : '无'}  ${t}`)
  }

  if (failures) process.exitCode = 1
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

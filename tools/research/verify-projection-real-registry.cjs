/**
 * 用**真实的宿主注册表**验证投影单元 —— 不重启 DSH，也不连 RPC。
 *
 * ── 为什么需要这一层 ────────────────────────────────────────────────
 * 前面的测试都用手写的假 `sessionProjections`。它们能证明「我调的 API
 * 形状对」，但证明不了「宿主真的会接受这次注册」—— 比如：
 *   · `stateSchema` 是不是真的被调用（我们的最小校验器够不够）
 *   · `apply` 对无关事件返回同一引用时，注册表是不是真的跳过下游
 *   · `wire.viewSchema.parse` 会不会因为我们的实现被拒
 *
 * 这一层把**宿主自己的 `SessionProjectionRegistry`** 从 asar 里取出来，
 * 配一个假的 `ctx`（只要 `on` / `effect` 两个方法，注册表只用这两个），
 * 然后把我们的定义注册进去、喂真实会话事件、读快照。
 *
 * 这样验的是真实契约，不是我以为的契约。
 *
 * ── 为什么不直接重启 DSH ────────────────────────────────────────────
 * 重启会中断用户正在跑的会话。等用户自己重启之后再看面板即可；
 * 这个脚本负责「在重启之前就把宿主契约验掉」。
 *
 * 用法：node tools\research\verify-projection-real-registry.cjs
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { pathToFileURL } = require('node:url')

const ASAR = 'F:/deepseek harness/resources/app.asar'
const HOME = process.env.USERPROFILE
const SESS = path.join(HOME, '.dsh', 'sessions')
const ZSTD = path.join(HOME, '.dsh', 'profiles', 'desktop', 'node_modules', 'dsh-chat-export', 'src', 'zstd.js')
const OUT = path.join(process.env.TEMP, 'dsh-proj-verify')

/** 按 asar header 的 offset 直接切一个文件出来（asar-extract 会截断大文件）。 */
function readAsarFile(want) {
  const buf = fs.readFileSync(ASAR)
  const hdrSize = buf.readUInt32LE(12)
  const base = 16 + hdrSize
  const hdr = JSON.parse(buf.subarray(16, base).toString('utf8'))
  let node = hdr
  for (const seg of want.replace(/^\//, '').split('/')) {
    node = node?.files?.[seg]
    if (!node) throw new Error(`asar 里没有 ${want}`)
  }
  if (!node.offset) throw new Error(`${want} 不是文件`)
  const start = base + Number(node.offset)
  return buf.subarray(start, start + Number(node.size))
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  /* ── 1. 取出宿主真实的注册表实现 ──────────────────────────────── */

  /*
   * 注册表模块 import 了 `@deepseek-ai/cordis` 和 `@deepseek-ai/dsh-session`。
   * 这两个都在 asar 里，但 Node 不能直接从 asar 里 import。
   * 所以：把注册表源码切出来，把它的两个 import 换成本地桩，
   * 再写成临时 .mjs 动态 import。
   *
   * 桩要够用：`Service` 只需要能被 class extends（构造时调 super(ctx, name)
   * 并挂 ctx[name]），`SessionSeq` / `SessionLogOffset` 是恒等/加减一。
   */
  const raw = readAsarFile('/dsh/node_modules/@deepseek-ai/dsh-session-projection/lib/index.js').toString('utf8')

  const cordisStub = `
export class Service {
  constructor(ctx, name) {
    this.ctx = ctx
    this.name = name
    if (ctx && name) ctx[name] = this
  }
}
`
  const sessionStub = `
export const SessionSeq = (n) => n
export const SessionLogOffset = (n) => n
`
  fs.writeFileSync(path.join(OUT, 'cordis-stub.mjs'), cordisStub, 'utf8')
  fs.writeFileSync(path.join(OUT, 'session-stub.mjs'), sessionStub, 'utf8')

  const patched = raw
    .replace(/from\s+["']@deepseek-ai\/cordis["']/g, 'from "./cordis-stub.mjs"')
    .replace(/from\s+["']@deepseek-ai\/dsh-session["']/g, 'from "./session-stub.mjs"')

  fs.writeFileSync(path.join(OUT, 'registry.mjs'), patched, 'utf8')
  const { SessionProjectionRegistry } = await import(pathToFileURL(path.join(OUT, 'registry.mjs')).href)

  /* ── 2. 假 ctx：注册表只用 on / effect 两个方法 ───────────────── */

  const handlers = new Map()
  const disposers = []
  const fakeCtx = {
    on(event, fn) {
      const arr = handlers.get(event) ?? []
      arr.push(fn)
      handlers.set(event, arr)
    },
    effect(fn, label) {
      /*
       * 真实 cordis 的 effect 支持 generator：yield 一个 disposer。
       * 注册表的 `register` 正是这么写的（`ctx.effect(function*(){...})`）。
       * 这里最小复刻：调一次、把 yield 出来的东西收好。
       */
      const it = fn()
      if (it && typeof it.next === 'function') {
        const first = it.next()
        if (!first.done && typeof first.value === 'function') disposers.push(first.value)
      } else if (typeof it === 'function') {
        disposers.push(it)
      }
      return () => {}
    }
  }

  const registry = new SessionProjectionRegistry(fakeCtx)
  console.log('✓ 宿主真实的 SessionProjectionRegistry 已构造')
  console.log(`  ctx.sessionProjections 已挂上：${typeof fakeCtx.sessionProjections === 'object'}`)

  /* ── 3. 注册我们的投影单元（走插件真实的 apply） ───────────────── */

  const plugin = await import(pathToFileURL(path.resolve(__dirname, '..', '..', 'plugin', 'lib', 'index.js')).href)
  console.log(`\n插件 Host 半侧：name=${plugin.name} inject=${JSON.stringify(plugin.inject)}`)

  /*
   * 直接调 `apply`，但把 `ctx.inject` 换成「立刻执行」——
   * 这样走的是插件真实的注册路径，不是绕过它。
   */
  let registeredDef = null
  plugin.apply({
    inject(services, fn) {
      const scope = { sessionProjections: { register: (d) => (registeredDef = d) } }
      fn(scope)
    }
  })

  if (!registeredDef) {
    console.error('✗ apply 没有注册任何东西')
    process.exit(1)
  }
  console.log(`✓ 插件 apply 调用了 register（key=${registeredDef.key}）`)

  // 再用**真实注册表**注册一次，验宿主接不接受
  try {
    registry.register(registeredDef)
    console.log('✓ 真实注册表接受了这次注册（schema 与 stateVersion 都合格）')
  } catch (e) {
    console.error('✗ 真实注册表拒绝了：' + e.message)
    process.exit(1)
  }

  /* ── 4. 喂真实会话事件，读快照 ────────────────────────────────── */

  const { scanZstdFrames } = await import('file://' + ZSTD.replace(/\\/g, '/'))
  const { zstdDecompressSync } = require('node:zlib')

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
      try {
        out.push(JSON.parse(line))
      } catch {}
    }
    return out
  }

  /** 找一个事件最多的会话。 */
  let best = null
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
      const evs = readEvents(p)
      if (evs && (!best || evs.length > best.length)) best = evs
    }
  }
  walk(SESS)

  if (!best || best.length === 0) {
    console.log('没有可用的会话日志 —— 跳过事件驱动验证')
    process.exit(0)
  }
  console.log(`\n用 ${best.length} 条真实事件驱动注册表`)

  /*
   * 造一个「会话」对象，满足注册表需要的最小接口：
   *   seq / header / inheritedEventCount / snapshotEvents() / eventAt() / id
   */
  const events = best.map((e, i) => ({ ...e, seq: i }))
  const session = {
    id: 'verify-session',
    seq: events.length,
    header: { id: 'verify-session' },
    inheritedEventCount: 0,
    snapshotEvents: () => events,
    eventAt: (seq) => events[seq]
  }

  // 逐个事件驱动（模拟 `ctx.on('session/event')`）
  const drive = handlers.get('session/event') ?? []
  if (drive.length === 0) {
    console.error('✗ 注册表没有订阅 session/event —— 构造方式不对')
    process.exit(1)
  }

  let published = 0
  registry.onChanged(() => {
    published++
  })

  for (const ev of events) {
    for (const fn of drive) fn(session, ev)
  }
  console.log(`✓ 驱动完成，变更流通知 ${published} 次`)

  /* ── 5. 读快照，确认值是真实形状 ─────────────────────────────── */

  const snap = registry.snapshot(session)
  const val = snap.values[registeredDef.key]

  if (val === undefined) {
    console.error('✗ 快照里没有 agentsBot')
    process.exit(1)
  }
  console.log(`\n✓ 快照里有 agentsBot（asOfSeq=${snap.asOfSeq}）`)
  console.log('  值：' + JSON.stringify(val))

  const okShape =
    val !== null &&
    typeof val === 'object' &&
    (val.tool === null || typeof val.tool === 'string') &&
    Number.isInteger(val.tools) &&
    Number.isInteger(val.bg) &&
    typeof val.compacting === 'boolean' &&
    Number.isFinite(val.errorAt)
  if (!okShape) {
    console.error('✗ 形状不对')
    process.exit(1)
  }
  console.log('✓ 形状校验通过（宿主已用我们的 viewSchema 校验过）')

  /* ── 6. 检查点往返（持久化缓存要它）───────────────────────────── */

  const ck = registry.checkpoint(session)
  const row = ck[registeredDef.key]
  if (!row || row.ver !== registeredDef.stateVersion) {
    console.error('✗ 检查点不对：' + JSON.stringify(row))
    process.exit(1)
  }
  console.log(`✓ 检查点可生成（ver=${row.ver}, seq=${row.seq}）`)

  const viewed = registry.viewCheckpoint(ck)
  if (viewed[registeredDef.key] === undefined) {
    console.error('✗ viewCheckpoint 没能从检查点还原视图')
    process.exit(1)
  }
  console.log('✓ 检查点能还原成视图（冷读路径通）')

  console.log('\n全部通过 —— 宿主真实契约验证完毕')
}

main().catch((e) => {
  console.error('失败：', e)
  process.exit(1)
})

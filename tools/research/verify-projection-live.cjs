/**
 * 真机验证：确认 `agentsBot` 投影单元真的在运行中的 DSH 里注册并推送。
 *
 * ── 为什么必须有这一步 ──────────────────────────────────────────────
 * 前面的测试全跑在假环境里：假 ctx、假 ModuleLoader、假投影数据。
 * 它们能证明「代码按我设想的方式跑」，但证明不了「宿主真的接受了这次
 * 注册」。而注册失败的表现是**静默的** —— 宿主不报错，客户端只是读不到
 * 那个键，面板照常显示四个基础状态，看起来一切正常。
 *
 * 这个项目上「假 fixture 掩盖真 bug」已经发生过两次，所以真机验证不能省。
 *
 * ── 认证怎么来 ──────────────────────────────────────────────────────
 * DSH 桌面版的 Web 认证走 cookie jar（Electron 的 sqlite），
 * cookie 名形如 `dsh-auth-<hash>`。这里直接读那个库拿值 —— 和浏览器
 * 用的是同一份，不需要额外登录。
 *
 * ── 验什么 ──────────────────────────────────────────────────────────
 * `session.projections` 返回某个会话全部 client-visible 单元的当前值。
 * `agentsBot` 在里面 = 注册成功、快照可读、值能通过 schema 校验。
 *
 * 用法：node tools\research\verify-projection-live.cjs
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const { DatabaseSync } = require('node:sqlite')

const BASE = 'http://127.0.0.1:5877'
const COOKIE_DB = path.join(process.env.APPDATA, '@deepseek-ai', 'dsh-desktop', 'Network', 'Cookies')

/**
 * 从 cookie jar 里取 dsh-auth cookie。
 *
 * 库里可能堆着几十个同名不同 hash 的历史 cookie（`clean-dsh-auth-cookies.cjs`
 * 就是清理这个的）。取**最近创建**的那个 —— 当前进程 mint 的一定最新。
 *
 * ── 两个坑 ──────────────────────────────────────────────────────────
 *  1. Electron 正持有这个库，`copyFileSync` 会 EBUSY。用**共享读**方式
 *     打开（Windows 上 `fs.openSync` 带 'r' 不够，要读字节流不锁），
 *     再写到临时文件。
 *  2. 打不开就说明 DSH 正忙 —— 这不是失败，是「现在验不了」。
 *     退回到让用户自己在界面上确认。
 */
function readAuthCookie() {
  if (!fs.existsSync(COOKIE_DB)) return null
  const tmp = path.join(process.env.TEMP, `dsh-cookies-${process.pid}.db`)
  try {
    // 用流式读取绕过独占锁：Electron 开的是共享读，fs.copyFileSync 要独占
    const data = fs.readFileSync(COOKIE_DB)
    fs.writeFileSync(tmp, data)
  } catch (e) {
    // EBUSY / EPERM 都说明库被占用
    return { busy: true, error: String(e.code ?? e.message) }
  }
  try {
    const db = new DatabaseSync(tmp)
    const row = db
      .prepare(
        `SELECT name, value FROM cookies
         WHERE name LIKE 'dsh-auth%' AND value <> ''
         ORDER BY creation_utc DESC LIMIT 1`
      )
      .get()
    db.close()
    return row && row.value ? { name: row.name, value: row.value } : null
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {}
  }
}

async function main() {
  const cookie = readAuthCookie()
  if (!cookie) {
    console.log('cookie jar 里没有 dsh-auth —— 无法直连 RPC。')
    process.exit(2)
  }
  if (cookie.busy) {
    console.log(`cookie 库被 DSH 占用（${cookie.error}），现在读不了。`)
    console.log('这不是失败：说明 DSH 正在跑，而它独占着 cookie 库。')
    console.log('')
    console.log('改用界面确认（等价，只是要人工看一眼）：')
    console.log('  1. 打开 http://127.0.0.1:5877')
    console.log('  2. 设置 → 插件 → dsh-agents-bot')
    console.log('  3. 出现「动画映射 / 休眠 / 帧率」三段 = 客户端半侧已接通')
    console.log('  4. 右栏「活动 AI」格子里，agent 在跑工具时应显示「读文件/跑命令/写文件」')
    process.exit(2)
  }
  console.log(`认证 cookie：${cookie.name}`)

  const headers = {
    'content-type': 'application/json',
    cookie: `${cookie.name}=${cookie.value}`
  }

  async function rpc(method, params) {
    const res = await fetch(`${BASE}/rpc`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ method, params })
    })
    const text = await res.text()
    if (!res.ok) throw new Error(`${method} HTTP ${res.status}: ${text.slice(0, 300)}`)
    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`${method} 返回的不是 JSON：${text.slice(0, 300)}`)
    }
  }

  const list = await rpc('session.list', {})
  const items = list?.result?.items ?? list?.items ?? []
  console.log(`会话数：${items.length}`)
  if (items.length === 0) {
    console.log('没有会话 —— 先在 GUI 里开一个对话再跑。')
    process.exit(2)
  }

  const id = items[0].sessionId ?? items[0].id
  console.log(`检查会话：${id}`)

  const out = await rpc('session.projections', { sessionId: id })
  const value = out?.result?.value ?? out?.result ?? out
  const keys = Object.keys(value?.values ?? {})

  console.log(`\n该会话的 client-visible 投影键（${keys.length} 个）：`)
  console.log('  ' + keys.join(', '))

  if (!keys.includes('agentsBot')) {
    console.log('\n✗ 没有 agentsBot —— 投影单元没注册成功')
    console.log('  1. DSH 是否重启过？（Host 半侧是重启才加载，不是热更）')
    console.log('  2. lib/index.js 是否重新构建过？')
    console.log('  3. profile 里是否挂着这个插件？')
    process.exit(1)
  }

  const avatar = value.values.agentsBot
  console.log('\n✓ agentsBot 投影已注册并在推送')
  console.log('  当前值：' + JSON.stringify(avatar))

  // 值必须能过 schema（宿主在推送前已经校验过，这里再确认形状符合预期）
  const okShape =
    avatar !== null &&
    typeof avatar === 'object' &&
    (avatar.tool === null || typeof avatar.tool === 'string') &&
    Number.isInteger(avatar.tools) &&
    Number.isInteger(avatar.bg) &&
    typeof avatar.compacting === 'boolean' &&
    Number.isFinite(avatar.errorAt)
  if (!okShape) {
    console.log('✗ 值的形状不对 —— Host 与客户端对字段的理解不一致')
    process.exit(1)
  }
  console.log('  形状校验通过（tool / tools / bg / compacting / errorAt 齐全）')

  // 多看几个会话，确认不是只有第一个有
  if (items.length > 1) {
    const second = items[1].sessionId ?? items[1].id
    const out2 = await rpc('session.projections', { sessionId: second })
    const v2 = out2?.result?.value ?? out2?.result ?? out2
    const has2 = Object.keys(v2?.values ?? {}).includes('agentsBot')
    if (has2) console.log(`  第二个会话也有（${second}）—— 每个会话都带这个键`)
    else console.log(`  ⚠ 第二个会话没有（${second}）—— 需要查为什么不是全局生效`)
  }

  console.log('\n全部通过')
}

main().catch((e) => {
  console.error('失败：', e.message)
  process.exit(1)
})

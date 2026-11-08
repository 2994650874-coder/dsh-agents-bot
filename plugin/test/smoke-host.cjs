/**
 * Host 投影单元的无宿主测试。
 *
 * 为什么要这个文件：投影单元跑在 DSH 主进程里，出错的形态是「静默不推」
 * 而不是崩溃 —— 上线后才发现的话，只能靠盯着面板猜。所以这里用一个
 * 假的 `sessionProjections` 把注册路径走一遍，再用真实事件序列把折叠
 * 规则钉死。
 *
 * 三条硬规矩都在这里锁住：
 *   1. 无关事件返回同一引用（性能的命根子）
 *   2. 并发工具不会互相覆盖
 *   3. 回合结束清空残留（否则状态永远灭不掉）
 *
 * 用法：node plugin/test/smoke-host.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const LIB = pathToFileURL(process.env.GROKBOT_TEST_HOST_LIB || path.resolve(__dirname, '..', 'lib', 'index.js')).href

let passed = 0
function check(label, fn) {
  try {
    fn()
    passed++
    console.log('  ok   ' + label)
  } catch (e) {
    console.log('  FAIL ' + label + '\n       ' + String(e.message).split('\n')[0])
    process.exitCode = 1
  }
}

async function main() {
  const mod = await import(LIB)
  const def = mod.agentsBotProjection

  console.log('模块形状')

  check('导出 name / inject / apply', () => {
    assert.equal(mod.name, 'dsh-agents-bot')
    assert.ok(Array.isArray(mod.inject))
    assert.equal(typeof mod.apply, 'function')
  })

  check('inject 不包含 sessionProjections（缺席时要能降级）', () => {
    assert.ok(!mod.inject.includes('sessionProjections'))
  })

  check('key 带插件前缀，stateVersion=2 避免恢复旧错误口径的检查点', () => {
    assert.equal(def.key, 'agentsBot')
    assert.equal(def.stateVersion, 2)
  })

  check('注册表要的三个成员都在', () => {
    assert.equal(typeof def.init, 'function')
    assert.equal(typeof def.apply, 'function')
    assert.equal(typeof def.stateSchema.parse, 'function')
    assert.equal(typeof def.wire.viewSchema.parse, 'function')
    assert.equal(typeof def.wire.view, 'function')
  })

  console.log('\n注册路径')

  check('apply 通过 ctx.inject 注册，不直接调用注册表', () => {
    const registered = []
    const fake = {
      effect(start, description) { assert.equal(typeof start, 'function'); assert.match(description, /loopback/); },
      inject(services, fn) {
        assert.deepEqual(services, ['sessionProjections'])
        const scope = { sessionProjections: { register: (d) => registered.push(d) } }
        fn(scope)
      }
    }
    mod.apply(fake)
    assert.equal(registered.length, 1)
    assert.equal(registered[0], def)
  })

  check('注册表缺席时不抛错（部署没有投影也能装插件）', () => {
    const fake = { effect: () => {}, inject: () => {} }
    assert.doesNotThrow(() => mod.apply(fake))
  })

  console.log('\n折叠规则')

  const ev = (type, time, data) => ({ type, time, data })

  /** 跑一串事件，返回最终 state。 */
  function fold(events) {
    let s = def.init()
    for (const e of events) s = def.apply(s, e)
    return s
  }

  check('init 是确定值（可写进检查点，冷热读一致）', () => {
    assert.deepEqual(def.init(), def.init())
    assert.deepEqual(def.init(), {
      calls: {},
      jobs: {},
      bg: 0,
      compacting: false,
      errorAt: 0
    })
  })

  check('无关事件返回同一引用', () => {
    const s = def.init()
    for (const t of ['user/message', 'assistant/message', 'session/title', 'todo/write', 'step/start', 'step/end', 'workspace/changes', 'whatever']) {
      assert.equal(def.apply(s, ev(t, 1000, {})), s, `${t} 不该返回新引用`)
    }
  })

  check('tool/call 记下工具名', () => {
    const s = fold([ev('tool/call', 100, { callId: 'c1', name: 'pwsh' })])
    assert.equal(def.wire.view(s).tool, 'pwsh')
    assert.equal(def.wire.view(s).tools, 1)
  })

  check('并发工具不会互相覆盖', () => {
    const s = fold([
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/call', 110, { callId: 'c2', name: 'read' }),
      ev('tool/call', 120, { callId: 'c3', name: 'edit' })
    ])
    assert.equal(def.wire.view(s).tools, 3)
  })

  check('tool 取最近开始的那个（并发时用户关心刚触发的）', () => {
    const s = fold([
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/call', 110, { callId: 'c2', name: 'read' })
    ])
    assert.equal(def.wire.view(s).tool, 'read')
  })

  check('tool/result 把对应工具移出', () => {
    const s = fold([
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/call', 110, { callId: 'c2', name: 'read' }),
      ev('tool/result', 200, { message: { toolCallId: 'c2', isError: false } })
    ])
    assert.equal(def.wire.view(s).tool, 'pwsh')
    assert.equal(def.wire.view(s).tools, 1)
  })

  console.log('\n出错只认终止回合的模型请求失败')

  check('HTTP 439 的最终模型请求失败点亮动画', () => {
    const s = fold([ev('turn/end', 500, { reason: { kind: 'error', error: { code: 'UNKNOWN', status: 439, message: 'cannot start request' } } })])
    assert.equal(s.errorAt, 500)
  })

  check('模型请求终止失败即使没有 HTTP 状态也保留结构化错误码', () => {
    const s = fold([ev('turn/end', 500, { reason: { kind: 'error', error: { code: 'QUOTA', message: 'quota exhausted' } } })])
    assert.equal(s.errorAt, 500)
  })

  check('工作流内部异常、工具激活失败和非结构化回合错误不点亮', () => {
    for (const error of [{ code: 'TOOL_ACTIVATION_FAILED', message: 'tool failed' }, { code: 'UNKNOWN', message: 'workflow exception' }, undefined]) {
      const s = fold([ev('turn/end', 500, { reason: { kind: 'error', error } })])
      assert.equal(s.errorAt, 0)
    }
  })

  check('人工取消和中断均不算宿主级模型请求失败', () => {
    for (const kind of ['aborted', 'interrupted', 'completed', 'blocked', 'max-tokens', 'forked']) {
      const s = fold([ev('turn/end', 500, { reason: { kind } })])
      assert.equal(s.errorAt, 0, kind)
    }
  })

  check('工具内部出错不点亮动画，但仍正确清理工具', () => {
    const s = fold([
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/result', 200, { message: { toolCallId: 'c1', isError: true } }),
      ev('turn/end', 300, { reason: { kind: 'completed' } })
    ])
    assert.equal(s.errorAt, 0)
    assert.equal(def.wire.view(s).tools, 0)
  })

  check('流式请求失败后重试成功不点亮动画', () => {
    const attempt = ev('assistant/attempt', 400, { stream: [{ chunk: { type: 'finish', reason: { kind: 'error', failure: { code: 'QUOTA', status: 439 } } } }] })
    const start = def.init()
    assert.equal(def.apply(start, attempt), start, '单次失败尚未决定最终回合')
    assert.equal(fold([attempt, ev('turn/end', 500, { reason: { kind: 'completed' } })]).errorAt, 0)
  })

  check('压缩失败只清理压缩状态，不播放模型请求错误动画', () => {
    const bad = fold([ev('compaction/start', 300, {}), ev('compaction/end', 400, { error: 'summary is not smaller' })])
    assert.equal(bad.compacting, false)
    assert.equal(bad.errorAt, 0)
  })

  check('之后成功完成回合就清除旧的错误动画', () => {
    const s = fold([
      ev('turn/end', 500, { reason: { kind: 'error', error: { code: 'QUOTA', status: 439, message: 'service error' } } }),
      ev('turn/end', 700, { reason: { kind: 'completed' } })
    ])
    assert.equal(s.errorAt, 0)
  })
  console.log('\n压缩上下文')

  check('compaction/start 置位，end 清位', () => {
    const on = fold([ev('compaction/start', 300, {})])
    assert.equal(on.compacting, true)
    const off = fold([ev('compaction/start', 300, {}), ev('compaction/end', 400, {})])
    assert.equal(off.compacting, false)
  })

  check('回合结束强制清掉 compacting（压缩中途被取消）', () => {
    const s = fold([ev('compaction/start', 300, {}), ev('turn/end', 500, { reason: { kind: 'aborted' } })])
    assert.equal(s.compacting, false)
  })

  console.log('\n后台任务（结果已返回、任务仍在跑）')

  check('同一次调用的 job 登记 + 结果 + 结束，不算后台任务', () => {
    const s = fold([
      ev('job/registered', 100, { jobId: 'j1', toolCall: { callId: 'c1' } }),
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/result', 200, { message: { toolCallId: 'c1', isError: false } }),
      ev('job/settled', 210, { jobId: 'j1' })
    ])
    assert.equal(s.bg, 0, '前台调用不该点亮后台任务')
  })

  check('结果返回后任务还在跑，计入 bg', () => {
    const s = fold([
      ev('job/registered', 100, { jobId: 'j1', toolCall: { callId: 'c1' } }),
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/result', 200, { message: { toolCallId: 'c1', isError: false } }),
      ev('job/settled', 5000, { jobId: 'j1' })
    ])
    assert.equal(s.bg, 0, 'settled 之后应归零')
    const mid = fold([
      ev('job/registered', 100, { jobId: 'j1', toolCall: { callId: 'c1' } }),
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/result', 200, { message: { toolCallId: 'c1', isError: false } })
    ])
    assert.equal(mid.bg, 1, '结果已返回但任务未结束，应计 1')
  })

  check('bg 不会掉成负数', () => {
    const s = fold([
      ev('job/registered', 100, { jobId: 'j1', toolCall: { callId: 'c1' } }),
      ev('job/settled', 200, { jobId: 'j1' }),
      ev('job/settled', 300, { jobId: 'j1' })
    ])
    assert.equal(s.bg, 0)
  })

  console.log('\n回合结束的清理')

  check('回合结束清空残留工具（被取消的回合没有 tool/result）', () => {
    const s = fold([
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/call', 110, { callId: 'c2', name: 'read' }),
      ev('turn/end', 500, { reason: { kind: 'aborted' } })
    ])
    assert.equal(def.wire.view(s).tools, 0, '残留工具必须清掉，否则状态永远灭不掉')
  })

  check('回合结束保留已 orphaned 的后台任务（settled 可能下一回合才到）', () => {
    const s = fold([
      ev('job/registered', 100, { jobId: 'j1', toolCall: { callId: 'c1' } }),
      ev('tool/call', 100, { callId: 'c1', name: 'pwsh' }),
      ev('tool/result', 200, { message: { toolCallId: 'c1', isError: false } }),
      ev('turn/end', 500, { reason: { kind: 'completed' } })
    ])
    assert.equal(s.bg, 1, '后台任务跨回合存在，不能清')
  })

  console.log('\n校验器')

  check('stateSchema 接受 init，拒绝坏值', () => {
    assert.doesNotThrow(() => def.stateSchema.parse(def.init()))
    for (const bad of [null, {}, { calls: [], jobs: {}, bg: 0, compacting: false, errorAt: 0, at: 0 }, { calls: {}, jobs: {}, bg: -1, compacting: false, errorAt: 0, at: 0 }]) {
      assert.throws(() => def.stateSchema.parse(bad), undefined, JSON.stringify(bad) + ' 应被拒')
    }
  })

  check('viewSchema 接受视图，拒绝坏值', () => {
    const v = def.wire.view(def.init())
    assert.doesNotThrow(() => def.wire.viewSchema.parse(v))
    assert.throws(() => def.wire.viewSchema.parse({ ...v, tool: 42 }))
    assert.throws(() => def.wire.viewSchema.parse({ ...v, tools: -1 }))
  })

  check('视图不带 callId（不把内部键泄露到线上）', () => {
    const s = fold([ev('tool/call', 100, { callId: 'secret-call-id', name: 'pwsh' })])
    const v = def.wire.view(s)
    assert.deepEqual(Object.keys(v).sort(), ['bg', 'compacting', 'errorAt', 'tool', 'tools'])
    assert.ok(!JSON.stringify(v).includes('secret-call-id'))
  })

  console.log(`\n${passed} 项通过` + (process.exitCode ? '，有失败' : ''))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

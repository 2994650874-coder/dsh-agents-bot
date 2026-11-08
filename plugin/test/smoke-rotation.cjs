/**
 * 轮播调度 + 活动推导的测试。
 *
 * 这两块都是纯函数（见 `tools/build-test.mjs` 为什么单独打包），
 * 所以能直接钉死。它们也是最容易悄悄坏掉的地方：优先级顺序错了、
 * 轮播算错位置，界面上的表现都只是「有时候状态不对」，不会报错。
 *
 * 断言具体到「第几秒该播什么」，不是「调用了某个函数」。
 *
 * 用法：node plugin/test/smoke-rotation.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')

const PURE = require(path.join(__dirname, '..', '..', '.test-build', 'test-pure.cjs'))

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

const { slotAt, cycleLength, playLengthOf, deriveActivity, activityOfTool } = PURE
const { DEFAULT_ROTATION, ACTIVITY_ORDER, ANIMATION_OPTIONS, PREVIEW_STATES, MAX_ROTATION_ITEMS, SLEEP_OPTIONS } = PURE

console.log('动画时长（决定轮播节奏的底数）')

check('每个动画都有一遍的时长，且为正数', () => {
  for (const o of ANIMATION_OPTIONS) {
    const d = playLengthOf(o.id)
    assert.ok(typeof d === 'number' && d > 0, `${o.id} 的时长是 ${d}`)
  }
})

check('时长不短于该状态的最短要求（否则动画会被截断露馅）', () => {
  for (const o of ANIMATION_OPTIONS) {
    const def = PURE.STATE_BY_ID.get(o.id)
    if (!def) continue
    assert.ok(
      playLengthOf(o.id) >= (def.minDuration ?? 0),
      `${o.id}: 轮播用 ${playLengthOf(o.id)}s，但最短要 ${def.minDuration}s`
    )
  }
})

console.log('\n轮播：位置计算')

check('单项轮播永远播那一项', () => {
  const rot = [{ state: 'idle', plays: 3 }]
  for (const t of [0, 1000, 7000, 99999]) {
    assert.equal(slotAt(rot, 0, t).state, 'idle')
  }
})

check('两项轮播按遍数排片（空闲×5 → 眨眼×1）', () => {
  const idleLen = playLengthOf('idle')
  const winkLen = playLengthOf('wink')
  const rot = [
    { state: 'idle', plays: 5 },
    { state: 'wink', plays: 1 }
  ]
  const total = cycleLength(rot)
  assert.equal(total, idleLen * 5 + winkLen)

  // 第 0 秒 → 空闲
  assert.equal(slotAt(rot, 0, 0).state, 'idle')
  // 空闲段中间 → 空闲
  assert.equal(slotAt(rot, 0, (idleLen * 2.5) * 1000).state, 'idle')
  // 刚过空闲段 → 眨眼
  assert.equal(slotAt(rot, 0, (idleLen * 5 + 0.01) * 1000).state, 'wink')
  // 一整轮之后 → 回到空闲
  assert.equal(slotAt(rot, 0, (total + 0.01) * 1000).state, 'idle')
})

check('连播 N 遍时，每一遍都从头开始（不是一直往前跑）', () => {
  const one = playLengthOf('idle')
  const rot = [{ state: 'idle', plays: 3 }]
  // 第 1 遍的开头
  assert.ok(slotAt(rot, 0, 0).elapsed < 0.05)
  // 第 2 遍的开头（时间上是一整遍之后）
  assert.ok(slotAt(rot, 0, one * 1000).elapsed < 0.05, '第 2 遍应从 0 开始')
  // 第 2 遍的中间
  assert.ok(Math.abs(slotAt(rot, 0, one * 1000 + 500).elapsed - 0.5) < 0.05)
})

/*
 * ── 重播必须能被调用方看见（v0.3.13）─────────────────────────────────
 *
 * 只交出 `elapsed` 是不够的：调用方每帧拿到的都是「这一遍里的进度」，
 * 而引擎自己不认这个数 —— 它只在自己内部时间上前进。`Bot.tsx` 早先只比较
 * `state`，同一状态连播第二遍时 state 没变，于是不重播，引擎一路往前跑，
 * 第 2 遍画成第 1 遍的收尾姿态。
 *
 * 用户症状：`检索 ×2` 的第 2 遍屏幕上是个静止的圆（orbit 收尾就是一条淡出的球），
 * 明明选了三角身形。所以必须把 `pass`（第几遍）交出去。
 */
check('slotAt 交出「第几遍」（pass），调用方才可能重播', () => {
  const one = playLengthOf('idle')
  const rot = [{ state: 'idle', plays: 3 }]
  assert.equal(slotAt(rot, 0, 0).pass, 0, '第 1 遍 pass 应为 0')
  assert.equal(slotAt(rot, 0, (one - 0.01) * 1000).pass, 0, '第 1 遍末尾仍是 0')
  assert.equal(slotAt(rot, 0, one * 1000).pass, 1, '第 2 遍 pass 应为 1')
  assert.equal(slotAt(rot, 0, one * 2 * 1000).pass, 2, '第 3 遍 pass 应为 2')
})

check('pass 不会越界：正是 plays 次，第 plays 次之后时间已离开这一项', () => {
  const one = playLengthOf('idle')
  const rot = [{ state: 'idle', plays: 2 }]
  const passes = new Set()
  // 采样整整两遍，收齐出现过的 pass
  for (let ms = 0; ms < one * 2 * 1000; ms += 50) passes.add(slotAt(rot, 0, ms).pass)
  assert.deepEqual([...passes].sort((a, b) => a - b), [0, 1], `实际出现 ${[...passes].join(',')}`)
})

check('切换到另一项时 pass 归 0（不同动画的遍数各算各的）', () => {
  const idleLen = playLengthOf('idle')
  const rot = [
    { state: 'idle', plays: 2 },
    { state: 'wink', plays: 1 }
  ]
  assert.equal(slotAt(rot, 0, (idleLen * 2 + 0.01) * 1000).state, 'wink')
  assert.equal(slotAt(rot, 0, (idleLen * 2 + 0.01) * 1000).pass, 0, 'wink 是它自己的第 1 遍')
})

check('一轮结束后 pass 归 0（循环不累积）', () => {
  const rot = [
    { state: 'idle', plays: 1 },
    { state: 'wink', plays: 1 }
  ]
  const total = cycleLength(rot)
  assert.equal(slotAt(rot, 0, (total + 0.01) * 1000).pass, 0, '第 2 轮的第 1 遍 pass 仍是 0')
  assert.equal(slotAt(rot, 0, (total * 2 + 0.01) * 1000).pass, 0)
})


check('负时间差也能算（时钟回拨 / 起点在未来）', () => {
  const rot = [
    { state: 'idle', plays: 1 },
    { state: 'wink', plays: 1 }
  ]
  const s = slotAt(rot, 10000, 0)
  assert.ok(typeof s.state === 'string')
  assert.ok(s.elapsed >= 0)
})

check('空轮播回落 idle（不崩）', () => {
  assert.equal(slotAt([], 0, 1000).state, 'idle')
})

console.log('\n默认轮播表')

check('每个活动都有轮播配置', () => {
  for (const a of ACTIVITY_ORDER) {
    assert.ok(Array.isArray(DEFAULT_ROTATION[a]), `${a} 没有默认轮播`)
    assert.ok(DEFAULT_ROTATION[a].length >= 1, `${a} 的轮播是空的`)
    assert.ok(DEFAULT_ROTATION[a].length <= MAX_ROTATION_ITEMS, `${a} 超过 ${MAX_ROTATION_ITEMS} 项`)
  }
})

check('默认配置里的动画都是真实存在的', () => {
  const ids = new Set(ANIMATION_OPTIONS.map((o) => o.id))
  for (const a of ACTIVITY_ORDER) {
    for (const item of DEFAULT_ROTATION[a]) {
      assert.ok(ids.has(item.state), `${a} 配了不存在的动画 ${item.state}`)
      assert.ok(item.plays >= 1, `${a} 的遍数应 >= 1`)
    }
  }
})

check('空闲配了「空闲 + 眨眼」轮播（用户明确要的效果）', () => {
  const r = DEFAULT_ROTATION.idle
  assert.equal(r.length, 2)
  assert.equal(r[0].state, 'idle')
  assert.equal(r[1].state, 'wink')
})

check('试片能预览设置里能选的每一个动画', () => {
  /*
   * ── 「蛋」为什么不在这一条里了（2026-10-30）────────────────────────
   * 原来这里断言的是「蛋在试片里」。蛋已经被提升为**身形**（见 `bot/skins.ts`
   * 的 `oeuf` 和 `smoke-look.cjs`），它不再是一个动画 —— 一条动画都不能是
   * 一个不动的形状。所以这条断言的主语换了，这正是用户要求的方向。
   *
   * ── 为什么不再单独点名 `loading-long`（2026-10-31）────────────────
   * 第92轮为了让人比较，加载曾经有两个版本（1,2 s / 3,1 s），这条额外断言
   * 「长版必须在试片里」。第94轮用户定了 2,6 s 的单版本，长版下线，那条
   * 点名断言也随之失效 —— 它描述的是一个已经被删掉的产品决定。
   *
   * 保留的是真正的不变式：**设置页能选的，试片一定能预览**。它不点名任何
   * 具体动画，所以增删动画时它会自动跟着走。
   */
  const previewIds = new Set(PREVIEW_STATES.map((s) => s.id))
  for (const o of ANIMATION_OPTIONS) {
    assert.ok(previewIds.has(o.id), `试片里没有 ${o.id}`)
  }
})

console.log('\n活动推导：优先级')

const NOW = 1_700_000_000_000
const base = { now: NOW, sleepMinutes: 30 }
const noProj = undefined
const okProj = { tool: null, tools: 0, bg: 0, compacting: false, errorAt: 0 }

check('什么都没发生 → 空闲', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's', updatedAt: NOW }, status: {}, proj: okProj }),
    'idle'
  )
})

check('投影缺失时也能工作（老版本 Host 半侧）', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's', updatedAt: NOW }, status: { running: true }, proj: noProj }),
    'thinking'
  )
})

check('在跑 → 思考中', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: { running: true }, proj: okProj }),
    'thinking'
  )
})

check('在跑工具 → 按工具名给活动', () => {
  for (const [tool, expected] of [
    ['pwsh', 'running'],
    ['read', 'reading'],
    ['grep', 'searching'],
    ['edit', 'writing'],
    ['write', 'writing']
  ]) {
    const a = deriveActivity({
      ...base,
      row: { id: 's' },
      status: { running: true },
      proj: { ...okProj, tool, tools: 1 }
    })
    assert.equal(a, expected, `${tool} 应该推出 ${expected}，实际 ${a}`)
  }
})

check('压缩中 → 压缩上下文', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: { running: true }, proj: { ...okProj, compacting: true } }),
    'compacting'
  )
})

check('后台任务 → background', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: { running: true }, proj: { ...okProj, bg: 1 } }),
    'background'
  )
})

check('刚完成 → done', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: { completionUnread: true }, proj: okProj }),
    'done'
  )
})

check('等待确认 → waiting', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: { pendingInteraction: {} }, proj: okProj }),
    'waiting'
  )
})

check('出错 → error', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: {}, proj: { ...okProj, errorAt: NOW - 1000 } }),
    'error'
  )
})

check('出错过期后回到正常状态（不能永远红着）', () => {
  assert.equal(
    deriveActivity({ ...base, row: { id: 's' }, status: {}, proj: { ...okProj, errorAt: NOW - 20000 } }),
    'idle'
  )
})

check('休眠：超过阈值没活动', () => {
  const old = NOW - 31 * 60_000
  assert.equal(
    deriveActivity({ ...base, row: { id: 's', updatedAt: old }, status: {}, proj: okProj }),
    'sleep'
  )
})

check('休眠阈值可配：10 分钟档下，11 分钟没活动就算休眠', () => {
  const t = NOW - 11 * 60_000
  assert.equal(
    deriveActivity({ ...base, sleepMinutes: 10, row: { id: 's', updatedAt: t }, status: {}, proj: okProj }),
    'sleep'
  )
  // 同一个时刻，30 分钟档还不算休眠
  assert.equal(
    deriveActivity({ ...base, sleepMinutes: 30, row: { id: 's', updatedAt: t }, status: {}, proj: okProj }),
    'idle'
  )
})

console.log('\n活动推导：优先级顺序（这些是最容易写错的地方）')

check('出错压过一切', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 's' },
    status: { running: true, pendingInteraction: {}, completionUnread: true },
    proj: { ...okProj, errorAt: NOW - 1000, tool: 'pwsh', tools: 1, compacting: true, bg: 2 }
  })
  assert.equal(a, 'error', '出错必须压过等待确认 / 工具 / 压缩 / 后台')
})

check('等待确认压过工具（卡在等人，不是还在跑）', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 's' },
    status: { running: true, pendingInteraction: {} },
    proj: { ...okProj, tool: 'pwsh', tools: 1 }
  })
  assert.equal(a, 'waiting')
})

check('具体工具压过后台任务（当下动作压过背景噪声）', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 's' },
    status: { running: true },
    proj: { ...okProj, tool: 'read', tools: 1, bg: 3 }
  })
  assert.equal(a, 'reading')
})

check('压缩压过具体工具（压缩期间不该显示在读文件）', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 's' },
    status: { running: true },
    proj: { ...okProj, tool: 'read', tools: 1, compacting: true }
  })
  assert.equal(a, 'compacting')
})

check('工具压过刚完成', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 's' },
    status: { completionUnread: true },
    proj: { ...okProj, tool: 'edit', tools: 1 }
  })
  assert.equal(a, 'writing')
})

console.log('\n活动推导：启动中（子代理）')

check('Team 成员 provisioning → 启动中（权威信号）', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 'c', parentId: 'p' },
    status: {},
    proj: okProj,
    teamPhase: 'provisioning'
  })
  assert.equal(a, 'spawning')
})

check('子代理 updatedAt=0（还没产生事件）→ 启动中', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 'c', parentId: 'p', origin: 'subagent', blank: false, updatedAt: 0 },
    status: { running: false },
    proj: okProj
  })
  assert.equal(a, 'spawning')
})

check('子代理已经开始跑 → 不再是启动中', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 'c', parentId: 'p', origin: 'subagent', blank: false, updatedAt: 0 },
    status: { running: true },
    proj: okProj
  })
  assert.equal(a, 'thinking')
})

check('根会话不会变成启动中', () => {
  const a = deriveActivity({
    ...base,
    row: { id: 'r', blank: false, updatedAt: 0 },
    status: {},
    proj: okProj
  })
  assert.equal(a, 'idle')
})

console.log('\n工具名 → 活动')

check('27 种真实工具名都能映射，没有遗漏到 undefined', () => {
  // 这些名字取自本机会话日志的真实统计
  const names = [
    'pwsh', 'read', 'edit', 'write', 'grep', 'run_code', 'knowledge_search', 'read_image',
    'glob', 'todo_write', 'present', 'list_agents', 'skill', 'plugin_manager', 'job_output',
    'wait_agent', 'ask_user_question', 'web_fetch', 'web_search', 'knowledge_get_document',
    'cordis_inspect_query', 'mnemon_runtime_memory', 'spawn_teammate', 'send_message',
    'powerShell', 'cordis_inspect_list', 'job_kill'
  ]
  const valid = new Set(ACTIVITY_ORDER)
  for (const n of names) {
    const a = activityOfTool(n)
    assert.ok(valid.has(a), `${n} 映射到了非法活动 ${a}`)
  }
})

check('几个关键的映射是明确的', () => {
  assert.equal(activityOfTool('pwsh'), 'running')
  assert.equal(activityOfTool('read'), 'reading')
  assert.equal(activityOfTool('grep'), 'searching')
  assert.equal(activityOfTool('web_search'), 'searching')
  assert.equal(activityOfTool('edit'), 'writing')
  assert.equal(activityOfTool('write'), 'writing')
  assert.equal(activityOfTool('spawn_teammate'), 'spawning')
  assert.equal(activityOfTool('ask_user_question'), 'waiting')
})

check('未知工具名回落思考中（不是崩掉）', () => {
  assert.equal(activityOfTool('some_future_tool_that_does_not_exist'), 'thinking')
})

console.log('\n休眠阈值选项')

check('阈值选项都是正整数分钟，且含默认值', () => {
  for (const o of SLEEP_OPTIONS) {
    assert.ok(Number.isInteger(o.id) && o.id > 0, `${o.label} 的分钟数不合法`)
    assert.ok(typeof o.label === 'string' && o.label.length > 0)
  }
  assert.ok(SLEEP_OPTIONS.some((o) => o.id === PURE.DEFAULT_SLEEP_MINUTES))
})

console.log(`\n${passed} 项通过` + (process.exitCode ? '，有失败' : ''))

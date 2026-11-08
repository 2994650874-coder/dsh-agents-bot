// 把「宿主能给的信号」映射到「bloub 的 14 个状态」，算出真实可激活的数量。
// 这是回答用户「我能拿到多少种状态」的核心依据，不能靠估。
//
// 用法: node tools\research\probe-state-coverage.cjs
'use strict'

/* ── 宿主真实能给的信号（来自本机会话日志实测 + 投影键清单） ────────────
   实测依据：
   - _work/probe-event-types.cjs  → 15345 条真实事件，tool/call 2485 条
   - _work/probe-tool-names.cjs   → 27 种工具名，tool/result 带 isError
   - SessionProjectionMap         → inbox/agentTeam/subagentCatalog/tokenUsage/
                                    contextPressure/goal/plan/todos/userQuestions…
*/

/** 日志事件 → 我们能判断出来的「agent 在干什么」 */
const SIGNALS = [
  { from: 'tool/call name=pwsh/bash/terminal_send', activity: 'running', note: '跑命令' },
  { from: 'tool/call name=read/read_image', activity: 'reading', note: '读文件' },
  { from: 'tool/call name=grep/glob/web_search/anysearch_*', activity: 'searching', note: '检索' },
  { from: 'tool/call name=write/edit', activity: 'writing', note: '写文件/改代码' },
  { from: 'tool/call name=knowledge_*', activity: 'searching', note: '知识库检索' },
  { from: 'tool/call name=todo_write/plan', activity: 'thinking', note: '写计划' },
  { from: 'step/start → step/end 之间无 tool/call', activity: 'thinking', note: '模型在想' },
  { from: 'tool/result isError=true', activity: 'error', note: '工具报错' },
  { from: 'userQuestions.active 非空', activity: 'waiting', note: '等用户确认' },
  { from: 'turn/end reason=completed + 未读', activity: 'done', note: '刚完成' },
  { from: 'subagentCatalog 出现新条目', activity: 'spawning', note: '子代理启动' },
  { from: 'compaction/start', activity: 'compacting', note: '压缩上下文' },
  { from: '全部静默', activity: 'idle', note: '空闲' }
]

/** bloub 引擎的全部状态 + 每个状态的可用条件 */
const STATES = [
  { id: 'idle', label: '空闲', need: '无活动', reachable: true },
  { id: 'thinking', label: '思考', need: 'step 中无工具', reachable: true },
  { id: 'orbit', label: '检索/读文件', need: 'reading/searching 工具', reachable: true },
  { id: 'comet', label: '跑命令', need: 'pwsh/bash 工具', reachable: true },
  { id: 'play', label: '写文件', need: 'write/edit 工具', reachable: true },
  { id: 'wide', label: '等待确认', need: 'pendingInteraction', reachable: true },
  { id: 'notify', label: '刚完成', need: 'completionUnread', reachable: true },
  { id: 'alert', label: '出错', need: 'tool/result isError', reachable: true },
  { id: 'swirl', label: '启动中', need: '子代理创建', reachable: true },
  { id: 'sleep', label: '休眠', need: '长时间无活动', reachable: '需新增判据' },
  { id: 'egg', label: '蛋', need: '子代理未孵化', reachable: '需新增判据' },
  { id: 'burst', label: '爆发', need: '无对应业务语义', reachable: false },
  { id: 'exclaim', label: '惊叹', need: '无对应业务语义', reachable: false },
  { id: 'wink', label: '眨眼', need: '装饰性，非状态', reachable: '仅装饰' },
  {
    id: 'hexagon',
    label: '六边形',
    need: '无对应业务语义，已从试片移除',
    reachable: false
  }
]

console.log('=== 宿主能给的信号 → 活动 ===')
for (const s of SIGNALS) {
  console.log(`  ${s.activity.padEnd(10)} ${s.note.padEnd(12)} ← ${s.from}`)
}

console.log(`\n=== ${STATES.length} 个状态的可达性 ===`)
let reach = 0
let maybe = 0
for (const s of STATES) {
  const mark = s.reachable === true ? '✓ 能' : s.reachable === false ? '✗ 不能' : '~ ' + s.reachable
  if (s.reachable === true) reach++
  if (s.reachable !== false) maybe++
  console.log(`  ${s.id.padEnd(10)} ${s.label.padEnd(8)} ${mark.padEnd(12)} ${s.need}`)
}
console.log(`\n  确定可达: ${reach} / ${STATES.length}`)
console.log(`  加上需补判据的: ${maybe} / ${STATES.length}`)

'use strict'
/** Run from any directory: node grokbot/plugin/test/activity-presentations.cjs */
const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { runInNewContext } = require('node:vm')
const esbuild = require('../../node_modules/esbuild')
const source = file => readFileSync(resolve(__dirname, '../src', file), 'utf8')
const activitySource = source('client/activities.ts')
const isolationSource = source('isolation/main.jsx')
const overlaySource = source('client/OverlayBotMeta.tsx')
const activityModule = { exports: {} }
runInNewContext(esbuild.transformSync(activitySource, { loader: 'ts', format: 'cjs' }).code, { module: activityModule, exports: activityModule.exports })
const { ACTIVITY_ORDER, ACTIVITY_LABEL, ACTIVITY_PRESENTATION, activityShortLabel } = activityModule.exports
const expected = {
  idle: ['空闲', '#8db6a0'], thinking: ['思考中', '#5aa9e6'],
  reading: ['读文件', '#5aa9e6'], searching: ['检索中', '#5aa9e6'],
  running: ['跑命令', '#5aa9e6'], writing: ['写文件', '#5aa9e6'],
  compacting: ['压缩上下文', '#5aa9e6', '压缩'],
  background: ['后台任务', '#5aa9e6', '后台'],
  waiting: ['等待确认', '#f0b429', '等待'],
  done: ['刚完成', '#5aa9e6', '完成'],
  error: ['出错', '#e0563f'], spawning: ['启动中', '#5aa9e6', '启动'],
  sleep: ['休眠', '#8db6a0']
}
test('single dictionary covers all thirteen activities and preserves existing colors', () => {
  assert.equal(ACTIVITY_ORDER.length, 13)
  assert.deepEqual(Object.keys(ACTIVITY_PRESENTATION), Array.from(ACTIVITY_ORDER))
  assert.deepEqual(Object.keys(ACTIVITY_LABEL), Array.from(ACTIVITY_ORDER))
  for (const activity of ACTIVITY_ORDER) {
    const [label, color, short] = expected[activity]
    assert.equal(ACTIVITY_PRESENTATION[activity].label, label, activity)
    assert.equal(ACTIVITY_PRESENTATION[activity].color, color, activity)
    assert.equal(ACTIVITY_PRESENTATION[activity].short, short, activity)
    assert.equal(ACTIVITY_LABEL[activity], label, activity)
    assert.equal(activityShortLabel(activity), short ?? label, activity)
  }
})
test('both production UI consumers use the same metadata; child tooltip keeps full name', () => {
  assert.match(isolationSource, /import\s*\{ACTIVITY_PRESENTATION,activityShortLabel\}\s*from '\.\.\/client\/activities\.ts'/)
  assert.match(isolationSource, /title=\{ACTIVITY_PRESENTATION\[row\.pose\?row\.activity:shown\]\.label/)
  assert.match(isolationSource, /backgroundColor:ACTIVITY_PRESENTATION\[row\.pose\?row\.activity:shown\]\.color/)
  assert.match(isolationSource, /activityShortLabel\(shown\)/)
  assert.match(overlaySource, /background: ACTIVITY_PRESENTATION\[activity\]\.color/)
  assert.match(overlaySource, /label=\{ACTIVITY_PRESENTATION\[data\.main\.activity\]\.label\}/)
  assert.doesNotMatch(isolationSource, /const LABEL=|const indicatorColor=/)
  assert.doesNotMatch(overlaySource, /const COLOR:/)
})
test('both UI entries compile without writing bundles or installed files', () => {
  for (const file of ['isolation/main.jsx', 'client/OverlayBotMeta.tsx']) {
    const result = esbuild.buildSync({ entryPoints: [resolve(__dirname, '../src', file)], bundle: true,
      write: false, platform: 'browser', format: 'esm', jsx: 'automatic',
      external: ['react', 'react-dom/client', 'react/jsx-runtime'],
      define: { __CHILD_ORIGIN__: JSON.stringify('http://127.0.0.1:49382'),
        __PARENT_ORIGIN__: JSON.stringify('http://127.0.0.1:49383') } })
    assert.ok(result.outputFiles[0].text.length > 0, file)
  }
})

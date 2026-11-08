/** Shared pure session ownership and eviction criteria for sidebar and main overlay. */
const assert = require('node:assert/strict')
const { activeSessionOf, unavailableSessionIds } = require('../../.test-build/test-pure.cjs')

const ready = {
  phase: 'ready', ids: ['child', 'fork', 'main'], byId: {
    child: { id: 'child', parentId: 'main', origin: 'subagent', retainedBy: { mainView: 1 } },
    fork: { id: 'fork', parentId: 'main', retainedBy: { mainView: 1 } },
    main: { id: 'main', retainedBy: { mainView: 0 } },
    present: { id: 'present', parentId: 'main', origin: 'subagent' }
  }
}
assert.equal(activeSessionOf(ready), 'fork', 'ignore subagent but keep a retained fork')
assert.equal(activeSessionOf({ ...ready, ids: ['child', 'main'], byId: { ...ready.byId, main: { id: 'main', retainedBy: { mainView: 1 } } } }), 'main')
assert.equal(activeSessionOf({ ...ready, ids: ['child'] }), undefined, 'subagent cannot claim main view')
assert.equal(activeSessionOf({ ids: 'invalid', byId: {} }), undefined, 'invalid snapshot fails closed')
assert.equal(activeSessionOf(undefined), undefined)

const selections = ['missing', 'present', 'fork']
assert.deepEqual([...unavailableSessionIds(ready, 'fork', selections, ['archived'])].sort(), ['archived', 'missing'])
assert.deepEqual([...unavailableSessionIds({ ...ready, phase: 'loading' }, 'fork', selections, ['archived'])], ['archived'], 'incomplete list cannot evict')
assert.deepEqual([...unavailableSessionIds(ready, undefined, selections, ['archived'])], ['archived'], 'absent current view cannot evict')
assert.deepEqual([...unavailableSessionIds(ready, 'fork', selections, undefined)], ['missing'])
console.log('session selection: sidebar and overlay share current view and unavailable policy PASS')

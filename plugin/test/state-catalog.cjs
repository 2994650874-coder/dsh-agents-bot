/** No ghost state may be exposed to users or accepted by the isolated child. */
const assert = require('node:assert/strict')
const { STATES, STATE_BY_ID, SEQUENCE, POSES } = require('../../.test-build/test-pure.cjs')
const { pathToFileURL } = require('node:url')
const { join } = require('node:path')

;(async () => {
  const { ANIMATION } = await import(pathToFileURL(join(__dirname, '../src/isolation/protocol.mjs')).href)
  const ids = STATES.map(state => state.id)
  assert.equal(ids.length, new Set(ids).size, 'state ids must be unique')
  assert.deepEqual([...STATE_BY_ID.keys()].sort(), [...ids].sort(), 'lookup covers every implemented state')
  assert.deepEqual(Object.keys(POSES).sort(), [...ids].sort(), 'every implemented state has exactly one representative pose')
  assert.deepEqual([...SEQUENCE].sort(), [...ids].sort(), 'sequence cannot contain missing states')
  assert.deepEqual([...ANIMATION].sort(), [...ids].sort(), 'cross-origin whitelist cannot admit missing states')
  assert.ok(!ids.includes('humming'), 'humming was renamed to search and may not enter a BotEngine')
  console.log('state catalog: runtime, POSES, SEQUENCE and offscreen whitelist 23/23 agree PASS')
})().catch(error => { console.error(error); process.exitCode = 1 })

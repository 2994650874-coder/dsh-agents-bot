import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { ACTIVITY, validateSnapshot } from '../src/isolation/protocol.mjs'

async function adapter() {
  const entry = fileURLToPath(new URL('../src/client/bridgeSnapshot.ts', import.meta.url))
  const bundle = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' })
  return import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))
}

const id1 = 'real-session-id-abc', id2 = 'second-session-id-def'
const token1 = 'a'.repeat(32), token2 = 'b'.repeat(32)
const look = { shape: 'cercle', color: 'encre', expression: 'neutre', size: 96, privatePath: 'secret-path' }
const rotation = Object.fromEntries(ACTIVITY.map((activity) => [activity, [{ state: 'idle', plays: 1 }]]))
function input() {
  return {
    shownIds: [id1, id2],
    agentById: new Map([[id1, { id: id1, name: 'PRIVATE TITLE 987', activity: 'reading', changedAt: 101, isChild: false, projection: { tool: 'cat /secret' } }], [id2, { id: id2, name: 'SECOND TITLE 456', activity: 'running', changedAt: 102, isChild: true }]]),
    kidsCount: new Map([[id1, 3]]),
    tokenFor: (id) => id === id1 ? token1 : token2,
    lookFor: () => look,
    botSize: 112, customizer: true, editTarget: undefined,
    fps: 45, dwellMs: 1600, rotation, cols: 2, rows: 1
  }
}

test('parent display snapshot excludes raw IDs, titles, tool data and extraneous look fields', async () => {
  const { snapshotForChild } = await adapter()
  const result = snapshotForChild(input())
  assert.deepEqual(result.rows.map((row) => row.id), [token1, token2])
  assert.deepEqual(result.rows.map((row) => row.name), ['当前会话', '监控 2'])
  assert.deepEqual(result.rows.map((row) => row.pose), [true, false])
  assert.equal(result.rows[0].childCount, 3)
  assert.equal(result.rows[1].isChild, true)
  assert.deepEqual(result.rows[0].look, { shape: 'cercle', color: 'encre', expression: 'neutre', size: 112 })
  const wire = JSON.stringify(result)
  for (const forbidden of [id1, id2, 'PRIVATE TITLE', 'SECOND TITLE', 'cat /secret', 'secret-path']) assert.equal(wire.includes(forbidden), false, forbidden)
  assert.deepEqual(Object.keys(result.ui.rotation).sort(), [...ACTIVITY].sort())
  assert.ok(validateSnapshot({ ...result, v: 1, kind: 'SNAPSHOT', nonce: 'c'.repeat(32), epoch: 'd'.repeat(32), seq: 1, sentAt: 1000 }, 1000))
})

test('deleted humming alias is rejected by the cross-origin animation whitelist', async () => {
  const { snapshotForChild } = await adapter()
  const valid = snapshotForChild(input())
  const envelope = { ...valid, v: 1, kind: 'SNAPSHOT', nonce: 'c'.repeat(32), epoch: 'd'.repeat(32), seq: 1, sentAt: 1000 }
  assert.ok(validateSnapshot(envelope, 1000))
  const obsolete = { ...envelope, ui: { ...envelope.ui, rotation: { ...envelope.ui.rotation, idle: [{ state: 'humming', plays: 1 }] } } }
  assert.ok(!validateSnapshot(obsolete, 1000), 'no frame may request a non-existent state')
})

test('per-cell editing target changes pose without leaking real session identity', async () => {
  const { snapshotForChild } = await adapter()
  const settings = input()
  settings.editTarget = id2
  assert.deepEqual(snapshotForChild(settings).rows.map((row) => row.pose), [false, true])
  settings.customizer = false
  assert.deepEqual(snapshotForChild(settings).rows.map((row) => row.pose), [false, false])
})

test('invalid or reused opaque tokens and invalid grid bounds fail closed', async () => {
  const { snapshotForChild } = await adapter()
  const settings = input()
  settings.tokenFor = (id) => id
  assert.equal(snapshotForChild(settings), null)
  settings.tokenFor = () => token1
  assert.equal(snapshotForChild(settings), null)
  settings.tokenFor = (id) => id === id1 ? token1 : token2
  settings.cols = 1
  assert.equal(snapshotForChild(settings), null)
  settings.cols = 2
  settings.shownIds = [...settings.shownIds, ...Array.from({length:8},(_,i)=>`extra-${i}`)]
  assert.equal(snapshotForChild(settings), null)
})

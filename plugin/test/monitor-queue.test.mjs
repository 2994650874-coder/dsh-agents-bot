import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const entry = fileURLToPath(new URL('../src/client/monitorQueue.ts', import.meta.url))
const source = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'esm' })
const { seedMonitorQueue, visitMonitorQueue, addMonitorQueue, removeMonitorQueue, clearMonitorQueue } =
  await import('data:text/javascript;base64,' + Buffer.from(source.outputFiles[0].text).toString('base64'))

const missing = new Set()
const state = (order, capacity) => ({ order, capacity })

test('seed preserves active head, deduplicates picks and clamps 1/5/9 capacities', () => {
  assert.deepEqual(seedMonitorQueue([], 'a'), state(['a'], 1))
  assert.deepEqual(seedMonitorQueue(['a', 'b', 'c', 'b', 'd', 'e'], 'a', 5), state(['a', 'b', 'c', 'd', 'e'], 5))
  assert.deepEqual(seedMonitorQueue(['a', 'b', 'c'], undefined), state(['a', 'b', 'c'], 4))
  assert.deepEqual(seedMonitorQueue(Array.from({length: 15}, (_, i) => String(i)), 'active'),
    state(['active', ...Array.from({length:8}, (_,i)=>String(i))], 9))
  assert.deepEqual(seedMonitorQueue(['a', 'b'], undefined, 1), state(['a'], 1))
  assert.deepEqual(seedMonitorQueue('abcdefghi'.split(''), undefined), state('abcdefghi'.split(''), 9))
})

test('capacity one visits never proactively evict an archived current cell', () => {
  const one = seedMonitorQueue([], 'a')
  assert.deepEqual(visitMonitorQueue(one, 'a', new Set(['a'])), one)
  assert.deepEqual(visitMonitorQueue(one, 'b', missing), state(['b'], 1))
  assert.deepEqual(one, state(['a'], 1), 'pure transitions cannot mutate previous snapshots')
})

test('known visits promote current cell, new visit at capacity evicts LRU', () => {
  const five = seedMonitorQueue(['b', 'c', 'd', 'e'], 'a')
  assert.deepEqual(visitMonitorQueue(five, 'c', missing), state(['c', 'a', 'b', 'd', 'e'], 5))
  assert.deepEqual(visitMonitorQueue(five, 'f', missing), state(['f', 'a', 'b', 'c', 'd'], 5))
  const nine = seedMonitorQueue('bcdefghi'.split(''), 'a')
  assert.deepEqual(visitMonitorQueue(nine, 'j', missing), state(['j', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 9))
})

test('full-capacity new visit prioritizes archived out-of-set cell before LRU tail', () => {
  const five = seedMonitorQueue(['b', 'c', 'd', 'e'], 'a')
  const unavailable = new Set(['b', 'd'])
  // Among multiple absent entries evict the least recent one, not the most recent or ordinary tail.
  assert.deepEqual(visitMonitorQueue(five, 'f', unavailable), state(['f', 'a', 'b', 'c', 'e'], 5))
  // Merely becoming archived must not remove the cell before a replacement is required.
  assert.deepEqual(visitMonitorQueue(five, 'a', unavailable), five)
  assert.deepEqual(five.order, ['a', 'b', 'c', 'd', 'e'])
})

test('all manual picks are evictable, including currently selected former picks', () => {
  const full = seedMonitorQueue(['b', 'c', 'd', 'e'], 'a')
  assert.deepEqual(visitMonitorQueue(full, 'f', new Set(['b'])), state(['f', 'a', 'c', 'd', 'e'], 5))
  const next = visitMonitorQueue(full, 'f', new Set(['a']))
  assert.deepEqual(next, state(['f', 'b', 'c', 'd', 'e'], 5))
})

test('undefined active never fabricates an entry or triggers an implicit visit', () => {
  const queue = seedMonitorQueue(['a', 'b'], undefined)
  assert.deepEqual(queue, state(['a', 'b'], 3))
  assert.deepEqual(visitMonitorQueue(queue, undefined, missing), queue)
  assert.deepEqual(clearMonitorQueue(queue, undefined), state([], 1))
})

test('manual add increases capacity even for already auto-visited identity', () => {
  const auto = visitMonitorQueue(seedMonitorQueue([], 'a'), 'b', missing)
  assert.deepEqual(addMonitorQueue(auto, 'b'), state(['b'], 2))
  assert.deepEqual(addMonitorQueue(seedMonitorQueue(['b'], 'a'), 'c'), state(['a', 'b', 'c'], 3))
  assert.deepEqual(addMonitorQueue(seedMonitorQueue('bcdefghi'.split(''), 'a'), 'j'),
    state(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'], 9), 'manual add at full cap is a no-op')
})

test('manual remove decrements capacity, protects active, and trims when removed pick is absent', () => {
  const five = seedMonitorQueue(['b', 'c', 'd', 'e'], 'a')
  assert.deepEqual(removeMonitorQueue(five, 'c', 'a'), state(['a', 'b', 'd', 'e'], 4))
  const previouslyEvicted = visitMonitorQueue(five, 'f', new Set(['b']))
  assert.deepEqual(removeMonitorQueue(previouslyEvicted, 'b', 'f'), state(['f', 'a', 'c', 'd'], 4))
  assert.deepEqual(removeMonitorQueue(state(['a', 'b'], 2), 'a', 'a'), state(['a'], 1))
  assert.deepEqual(removeMonitorQueue(state(['b'], 1), 'b', undefined), state([], 1))
})

test('clear returns one active cell or empty, without changing prior state', () => {
  const old = seedMonitorQueue(['b', 'c', 'd'], 'a')
  assert.deepEqual(clearMonitorQueue(old, 'x'), state(['x'], 1))
  assert.deepEqual(clearMonitorQueue(old, undefined), state([], 1))
  assert.deepEqual(old, state(['a', 'b', 'c', 'd'], 4))
})

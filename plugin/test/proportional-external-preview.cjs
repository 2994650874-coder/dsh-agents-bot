/** User preview: 34.16 / 19 proportional dot sizes, bounded trajectories. */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { BotEngine, STATE_BY_ID } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))
const frame = (state, t) => new BotEngine(100, state).sample(t)
const mag = d => Math.hypot(d.x, d.y)
const maxr = f => Math.max(...f.dots.filter(d => d.opacity > .1).map(d => d.r), 0)
const factor = (28 * 1.22) / 19
assert.ok(Math.abs(factor - 1.7978947368) < .000001)
const orbit = frame('orbit', 1.2)
assert.ok(maxr(orbit) >= 12 / 114.2705 * factor * 100 * .9, 'orbit five dots grow with the body percentage')
assert.ok(Math.max(...orbit.dots.map(mag)) >= 100, 'orbit track grows beyond the current 0.783R axis')
assert.ok(maxr(frame('burst', .95)) >= 0.068 * factor * 100 * .88, 'burst dark merging dots grow proportionally')
assert.ok(maxr(frame('loading', 1.8)) >= 6.5 / 114.2705 * factor * 100 * .98, 'loading six colored dots grow proportionally')
assert.ok(Math.max(...frame('loading', 1.8).dots.map(mag)) >= 105, 'loading colored orbit also expands')
assert.ok(maxr(frame('sending', 1)) >= 9, 'sending main black pulse grows to body-matched size')
assert.ok(maxr(frame('receiving', .6)) >= 10, 'receiving main black pulse grows to body-matched size')
for (const state of ['sending', 'receiving']) {
  const duration = STATE_BY_ID.get(state).duration
  let far = 0
  for (let t = .02; t < duration; t += .02) {
    const f = frame(state, t)
    for (const ring of f.rings) if (ring.opacity > .15) far = Math.max(far, ring.r)
  }
  assert.ok(far > 105, state + ' ring travels farther than its original 0.835R shock')
}
// Bounded instead of naively multiplying the whole scene by 1.798: all painted
// discs and rings retain >8 units' headroom in the 158-unit half-viewBox.
for (const state of ['orbit', 'burst', 'loading', 'sending', 'receiving']) {
  const duration = STATE_BY_ID.get(state).duration
  for (let t = 0; t <= duration; t += .02) {
    const f = frame(state, t)
    for (const d of f.dots.filter(d => d.opacity > .1)) {
      assert.ok(Math.abs(d.x) + d.r <= 150 && Math.abs(d.y) + d.r <= 150, `${state} dot leaves safe scene at ${t.toFixed(2)}s`)
    }
    for (const ring of f.rings.filter(r => r.opacity > .1)) {
      assert.ok(Math.abs(ring.cx || 0) + ring.r + ring.width / 2 <= 150 && Math.abs(ring.cy || 0) + ring.r + ring.width / 2 <= 150, `${state} ring leaves safe scene at ${t.toFixed(2)}s`)
    }
  }
}
assert.equal(frame('loading', 2.6).dots.length, 0, 'enlarged colored dots still fully merge by endpoint')
assert.equal(frame('burst', 1.6).dots.length, 0, 'enlarged burst particles finish merging before regrowth')
console.log('proportional-external-preview: size factor ' + factor.toFixed(4) + ', bounded motion and merge PASS')

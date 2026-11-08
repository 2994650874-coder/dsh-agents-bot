/** Regression: particle legibility around the search-sized shared ball, before installation. */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { BotEngine } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))
const frame = (state, t) => new BotEngine(100, state).sample(t)
const ballR = 100 * (28 / 114.2705) * 1.22
const extent = d => Math.hypot(d.x, d.y)
const outside = d => extent(d) + d.r - ballR
const clearOfBody = d => extent(d) - d.r - ballR

// The burst dots really render BEHIND the opaque body: a dark dot wholly within
// the enlarged silhouette is NOT visible even if its data exists in frame.dots.
for (const t of [.7, .95, 1.2]) {
  const f = frame('burst', t)
  assert.equal(f.dotsBehind, true)
  assert.ok(f.dots.some(d => d.opacity >= .3 && d.depth >= .65 && outside(d) >= 6),
    'burst at ' + t + 's must show an actual dark dot outside the body before absorption')
}
assert.equal(frame('burst', 1.6).dots.length, 0, 'burst dots still finish being absorbed')

// Front-painted black dots become visually indistinguishable *on* a black body.
const orbit = frame('orbit', 2.88)
assert.equal(orbit.dotsBehind, false)
assert.ok(orbit.dots.filter(d => d.opacity >= .65 && outside(d) >= 4).length >= 3,
  'orbit last spiral keeps at least three readable exterior lobes before merging')

const loading = frame('loading', 2.35)
assert.equal(loading.dotsBehind, true)
assert.ok(loading.dots.filter(d => d.color && d.opacity >= .8 && outside(d) >= 14).length >= 4,
  'loading colorful dots remain visible outside the body through the middle of absorption')
assert.ok(frame('loading', 2.6).dots.length === 0, 'loading still finishes absorption by its original endpoint')

const sent = frame('sending', 1).dots[0]
assert.ok(sent && clearOfBody(sent) >= 8, 'sending primary dark dot fully emerges from the body during its outbound gesture')
const received = frame('receiving', .6).dots[0]
assert.ok(received && clearOfBody(received) >= 8, 'receiving primary dark dot remains fully outside before its inward merge')
assert.ok(frame('sending', .5).dots.some(d => extent(d) < ballR), 'sending still starts from the core, not from a newly invented surface spawn')
console.log('small-ball-external-visibility: burst/orbit/loading/send/receive readable during merge PASS')

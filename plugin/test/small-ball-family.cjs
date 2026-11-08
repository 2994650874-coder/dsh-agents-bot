/** Shared small-ball body and leftward face, without mirroring decorations. */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { BotEngine, smallBall, eyePoses } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))

const defaultBall = smallBall()
const front = smallBall(undefined, 'front')
assert.deepEqual(front.gaze, { yaw: 0, pitch: 0, roll: 0 }, 'future-facing front option looks straight at the viewer')
assert.deepEqual(front.sil, defaultBall.sil, 'front option changes no shared ball body geometry')
assert.deepEqual(front.eyes, defaultBall.eyes, 'front option keeps the same eye shapes and size')
assert.equal(front.split, defaultBall.split, 'front option keeps the same eye spacing')
const face = eyePoses(front.gaze, 100, front.split)
assert.ok(Math.abs(face[0].x + face[1].x) < 1e-9 && Math.abs(face[0].y) < 1e-9 && Math.abs(face[1].y) < 1e-9, 'front eyes are horizontally symmetric and vertically centered')
assert.ok(face[0].x < 0 && face[1].x > 0 && face.every(eye => eye.depth > 0), 'front eyes face the viewer, not the back of the sphere')

const frame = (state, t = 1.2) => new BotEngine(100, state).sample(t)
function bodyRadius(f) {
  const nums = (f.bodyPath.match(/-?\d+(?:\.\d+)?/g) || []).map(Number)
  const xs = nums.filter((_, i) => i % 2 === 0), ys = nums.filter((_, i) => i % 2 !== 0)
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2
}
const eyeX = f => f.eyes.reduce((sum, eye) => sum + Number(eye.matrix.split(',')[4]), 0)
const search = frame('search')
assert.ok(Math.abs(bodyRadius(search) - 30) < 1, 'search small-ball radius remains the chosen 0.30 R')
assert.ok(eyeX(search) < -1, 'search small-ball face looks left')
for (const state of ['orbit', 'radar', 'progress', 'celebrate', 'loading', 'sending', 'receiving', 'uploading']) {
  const f = frame(state)
  assert.ok(Math.abs(bodyRadius(f) - bodyRadius(search)) < (state === 'celebrate' ? 2 : 1), state + ' uses the shared search-sized body (celebrate may breathe 5%)')
  assert.equal(f.eyes[0]?.d, search.eyes[0]?.d, state + ' shares the search eye silhouette and proportions')
  assert.ok(eyeX(f) < -1, state + ' small-ball face looks left like search')
}
const collapsed = frame('burst', 1)
assert.ok(Math.abs(bodyRadius(collapsed) - bodyRadius(search)) < 1, 'burst shrinks into the shared small-ball size')
const end = frame('burst', 2.55)
assert.ok(bodyRadius(end) > 80, 'burst still regrows to the full resting body')
assert.ok(eyeX(end) < -1, 'visible burst-tail eyes rejoin mirrored idle without a rightward snap')
const untouched = frame('comet', 1)
assert.ok(bodyRadius(untouched) < bodyRadius(search), 'comet dot is a separate animated speck, not a small-ball body')
console.log('small-ball-family: shared body, leftward face, burst recovery and comet exception PASS')

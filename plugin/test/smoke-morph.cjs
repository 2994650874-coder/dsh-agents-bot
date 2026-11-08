/** Interrupted shape/expression morphs must not jump at the setter timestamp. */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { BotEngine, SHAPE_BY_ID, STATE_BY_ID } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))
const shape = (id) => SHAPE_BY_ID.get(id).radii
const idle = STATE_BY_ID.get('idle').pose(0)
const pair = (w, h, tilt = 0) => [
  { w, h, tilt, open: 1 }, { w, h, tilt: -tilt, open: 1 }
]
const expressions = [
  { id: 'neutre', gaze: idle.gaze, split: idle.split, eyes: idle.eyes },
  { id: 'surpris', gaze: { yaw: 3, pitch: -3, roll: 0 }, split: 19, eyes: pair(.45, .47) },
  { id: 'triste', gaze: { yaw: 3, pitch: -13, roll: 0 }, split: 16, eyes: pair(.22, .4, -28) }
]
const snapshot = (f) => ({ bodyPath: f.bodyPath, eyes: f.eyes.map(({ d, matrix, alpha }) => ({ d, matrix, alpha })) })
let checks = 0
function uninterrupted(label, engine, update, at) {
  const before = snapshot(engine.sample(at))
  update(at)
  const after = snapshot(engine.sample(at))
  assert.deepEqual(after, before, label + ': bodyPath and eye geometry at setter time')
  const future = snapshot(engine.sample(at + .15))
  engine.sample(at + .3)
  assert.deepEqual(snapshot(engine.sample(at + .15)), future, label + ': out-of-order sample(t)')
  assert.deepEqual(snapshot(engine.sample(at)), after, label + ': repeat sample(t)')
  checks++
}

for (const [a, b, c] of [
  ['cercle', 'arche', 'triangle'],
  ['arche', 'goutte', 'capsule'],
  ['triangle', 'dome', 'cristal']
]) {
  const e = new BotEngine(100, 'idle', shape(a), expressions[1])
  e.setShape(shape(b), 1)
  uninterrupted(a + ' -> ' + b + ' -> ' + c, e, (t) => e.setShape(shape(c), t), 1.1)
  const final = snapshot(e.sample(2))
  assert.deepEqual(final, snapshot(new BotEngine(100, 'idle', shape(c), expressions[1]).sample(2)))
  checks++
}
for (const initialShape of ['arche', 'goutte']) {
  const e = new BotEngine(100, 'idle', shape(initialShape), expressions[0])
  e.setExpression(expressions[1], 1)
  uninterrupted(initialShape + ': neutre -> surpris -> triste', e, (t) => e.setExpression(expressions[2], t), 1.1)
  const final = snapshot(e.sample(2))
  assert.deepEqual(final, snapshot(new BotEngine(100, 'idle', shape(initialShape), expressions[2]).sample(2)))
  checks++
}
const both = new BotEngine(100, 'idle', shape('arche'), expressions[0])
both.setShape(shape('goutte'), 1)
both.setExpression(expressions[1], 1)
uninterrupted('expression interrupts shape', both, (t) => both.setExpression(expressions[2], t), 1.12)
uninterrupted('shape interrupts expression', both, (t) => both.setShape(shape('triangle'), t), 1.2)
assert.deepEqual(snapshot(both.sample(2)), snapshot(new BotEngine(100, 'idle', shape('triangle'), expressions[2]).sample(2)))
checks++
// For ordinary first setters, eyefit keeps its original independent shape and
// expression clocks. Four catalog corners reproduce the pre-fix trajectory;
// a single composite 0.45s clock fails these assertions (up to 14 R/100).
const weight = (t, start) => {
  const x = Math.max(0, Math.min(1, (t - start) / .45))
  return 1 - (1 - x) ** 5
}
const interpolate = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
for (const [a, b, first, last, delay] of [
  ['hexagone', 'nuage', 'confus', 'timide', 0],
  ['arche', 'goutte', 'neutre', 'surpris', .12],
  ['triangle', 'dome', 'surpris', 'triste', .12]
]) {
  // The first pair can use known catalog expression ids: the offset table is
  // keyed by id. The shape/face geometry in this test is only sampled by idle.
  const from = expressions.find(e => e.id === first) || { ...expressions[0], id: first }
  const to = expressions.find(e => e.id === last) || { ...expressions[0], id: last }
  const corner = (s, expression) => new BotEngine(100, 'idle', shape(s), expression).decalageAtTime(1, 'idle')
  const aa = corner(a, from), ab = corner(a, to)
  const ba = corner(b, from), bb = corner(b, to)
  const e = new BotEngine(100, 'idle', shape(a), from)
  e.setShape(shape(b), 1)
  e.setExpression(to, 1 + delay)
  for (const elapsed of [0, .03, .06, .12, .2, .3, .45, .6]) {
    const t = 1 + delay + elapsed
    const ex = weight(t, 1 + delay), sh = weight(t, 1)
    const expected = interpolate(interpolate(aa, ab, ex), interpolate(ba, bb, ex), sh)
    const actual = e.decalageAtTime(t, 'idle')
    assert.ok(Math.hypot(expected.x - actual.x, expected.y - actual.y) < 1e-12,
      a + ' -> ' + b + ' ' + first + ' -> ' + last + ': legacy dual-axis eyefit @' + t)
    checks++
  }
}
console.log('smoke-morph: ' + checks + ' continuity, dual-axis eyefit and settled-frame checks passed')

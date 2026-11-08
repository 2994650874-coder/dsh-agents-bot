/** Shared, state-level horizontal reflection for the three inward-facing animations. */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { BotEngine, STATE_BY_ID, SHAPE_BY_ID, mirrorPose, toPoints } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))

const targets = ['idle', 'search', 'waking']
for (const id of targets) assert.equal(STATE_BY_ID.get(id)?.mirrorX, true, id + ' should be mirrored for every Bot surface')
for (const id of ['wink', 'sleeping', 'wide', 'play', 'orbit'])
  assert.notEqual(STATE_BY_ID.get(id)?.mirrorX, true, id + ' must retain its authored direction')

// A horizontal reflection changes x, not y; test a NON-symmetric profile so a
// mistaken i -> (N-i) reversal cannot pass as a left/right mirror.
const idle = STATE_BY_ID.get('idle').pose(1)
const asymmetric = idle.sil.radii.map((_, i) => 0.7 + i * 0.007)
const raw = { ...idle, sil: { ...idle.sil, radii: asymmetric, cx: 0.17, rot: 0.23 },
  gaze: { ...idle.gaze, yaw: 19, roll: -11 },
  eyes: [{ w: 0.1, h: 0.2, open: 1, tilt: 12 }, { w: 0.2, h: 0.3, open: 0.6, tilt: -7 }],
  offX: 0.13,
  dots: [{ x: 0.42, y: 0.21, r: 0.02, opacity: 1 }],
  ribbons: [{ id: 'test', pts: [{ x: -0.4, y: 0.2, z: 0 }, { x: 0.1, y: 0.3, z: 0 }, { x: 0.3, y: 0.4, z: 0 }], width: 0.1, hue: 10, hueSpan: 0, opacity: 1 }]
}
const reflected = mirrorPose(raw)
const n = asymmetric.length
for (let i = 0; i < n; i++) assert.equal(reflected.sil.radii[i], asymmetric[(n / 2 - i + n) % n], 'reflect radius around vertical screen axis at '+i)
const outline = toPoints(raw.sil, 100), opposite = toPoints(reflected.sil, 100)
for (let i=0;i<n;i++) {
  const from=outline[(n/2-i+n)%n], to=opposite[i]
  assert.ok(Math.abs(to.x+from.x)<1e-9 && Math.abs(to.y-from.y)<1e-9, 'every physical contour point must mirror around vertical axis: '+i)
}
assert.equal(reflected.sil.cx, -raw.sil.cx)
assert.equal(reflected.sil.rot, -raw.sil.rot)
assert.equal(reflected.offX, -raw.offX)
assert.equal(reflected.gaze.yaw, -raw.gaze.yaw)
assert.equal(reflected.gaze.pitch, raw.gaze.pitch)
assert.equal(reflected.gaze.roll, -raw.gaze.roll)
assert.equal(reflected.eyes[0].w, raw.eyes[1].w)
assert.equal(reflected.eyes[0].tilt, -raw.eyes[1].tilt)
assert.equal(reflected.dots[0].x, -raw.dots[0].x)
assert.equal(reflected.dots[0].y, raw.dots[0].y)
assert.equal(reflected.ribbons[0].pts[0].x, -raw.ribbons[0].pts[0].x)
assert.equal(reflected.ribbons[0].pts[0].y, raw.ribbons[0].pts[0].y)
assert.deepEqual(mirrorPose(reflected), raw, 'applying mirror twice restores all pose geometry')

const eyeX = frame => frame.eyes.map(eye => Number(eye.matrix.split(',')[4])).reduce((a,b)=>a+b,0)
for (const id of targets) {
  const engine = new BotEngine(100, id)
  const t = id === 'waking' ? 3 : 1
  const frame = engine.sample(t)
  assert.ok(frame.eyes.length === 2, id + ' has two rendered eyes at t='+t)
  assert.ok(eyeX(frame) < -1, id + ' face should look left on every Bot surface')
}
for (const id of ['idle', 'search', 'waking']) {
  const def = STATE_BY_ID.get(id)
  for (let t=0; t<=def.duration; t+=0.2) {
    const pose = def.pose(t)
    assert.equal(pose.arcs.length, 0, id + ' reflection does not silently leave 3D arcs untouched')
    assert.equal(pose.rings.length, 0, id + ' reflection does not silently leave rings untouched')
    assert.equal(pose.notif, null, id + ' reflection does not silently leave a notification on the wrong side')
    // Waking's occasional starPath is symmetric about x=0; mirrored rotation is enough.
    for (const dot of pose.dots.filter(dot => dot.d)) {
      const points = [...dot.d.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)/g)].map(m => [Number(m[1]),Number(m[2])])
      assert.ok(points.length >= 5 && points.every(([x,y]) => points.some(([a,b]) => Math.abs(a+x)<0.0011 && Math.abs(b-y)<0.0011)), id + ' authored noncircle must be intrinsically symmetric')
    }
  }
}
const eyeCenter = eye => eye.matrix.match(/^matrix\(([^)]*)\)$/)[1].split(',').slice(4).map(Number)
for (const id of targets) for (const shapeName of ['galet', 'goutte']) {
  const def = STATE_BY_ID.get(id)
  const shape = SHAPE_BY_ID.get(shapeName).radii
  const t = id === 'waking' ? 2 : 1
  def.mirrorX = false
  const rawFrame = new BotEngine(100, id, shape).sample(t)
  def.mirrorX = true
  const mirrored = new BotEngine(100, id, shape).sample(t)
  assert.equal(rawFrame.eyes.length, mirrored.eyes.length, id+' / '+shapeName+' eye visibility')
  for (let i=0;i<rawFrame.eyes.length;i++) {
    const original = eyeCenter(rawFrame.eyes[rawFrame.eyes.length-1-i])
    const reflectedEye = eyeCenter(mirrored.eyes[i])
    assert.ok(Math.abs(reflectedEye[0]+original[0])<0.12 && Math.abs(reflectedEye[1]-original[1])<0.12,
      id+' / '+shapeName+' non-symmetric silhouette and eye correction must reflect: '+JSON.stringify({original,reflectedEye}))
  }
  assert.equal(rawFrame.dots.length, mirrored.dots.length)
  for(let i=0;i<rawFrame.dots.length;i++) {
    assert.ok(Math.abs(rawFrame.dots[i].x+mirrored.dots[i].x)<0.12 && Math.abs(rawFrame.dots[i].y-mirrored.dots[i].y)<0.12,
      id+' / '+shapeName+' firework dot '+i+' must follow the mirrored body')
    assert.equal(mirrored.dots[i].color,rawFrame.dots[i].color)
  }
  assert.equal(rawFrame.ribbons.length, mirrored.ribbons.length)
  for(let i=0;i<rawFrame.ribbons.length;i++) {
    const before=rawFrame.ribbons[i], after=mirrored.ribbons[i]
    assert.ok(Math.abs(before.grad.x1+after.grad.x1)<0.12 && Math.abs(before.grad.x2+after.grad.x2)<0.12 &&
      Math.abs(before.grad.y1-after.grad.y1)<0.12 && Math.abs(before.grad.y2-after.grad.y2)<0.12,
      id+' / '+shapeName+' ribbon gradient '+i+' must reflect, not change palette or timing')
    assert.deepEqual(after.grad.stops,before.grad.stops)
  }
}
const pointerDeparture = new BotEngine(100, 'idle')
pointerDeparture.setLook({ yaw: 26, pitch: 0, mix: 1, spin: 0, wander: 0 }, 0, 0)
const beforeWink = pointerDeparture.sample(2.399).eyes.map(eye => Number(eye.matrix.split(',')[4]))
pointerDeparture.setState('wink', 2.4)
const onWink = pointerDeparture.sample(2.4).eyes.map(eye => Number(eye.matrix.split(',')[4]))
for (let i=0;i<2;i++) assert.ok(Math.abs(onWink[i]-beforeWink[i])<5,
  'idle pointer gaze must not jump on first wink frame: '+JSON.stringify({beforeWink,onWink}))

for (const yaw of [-26,26]) {
  const incoming = new BotEngine(100, 'idle')
  incoming.setLook({ yaw, pitch: 0, mix: 1, spin: 0, wander: 0 }, 0, 0)
  incoming.sample(2.399)
  incoming.setState('wink', 2.4)
  const beforeIdle = incoming.sample(3.999).eyes.map(eye => Number(eye.matrix.split(',')[4]))
  incoming.setState('idle', 4)
  const onIdle = incoming.sample(4).eyes.map(eye => Number(eye.matrix.split(',')[4]))
  for (let i=0;i<2;i++) assert.ok(Math.abs(onIdle[i]-beforeIdle[i])<5,
    'pointer must rejoin mirrored idle gradually, not teleport on first frame: '+JSON.stringify({yaw,beforeIdle,onIdle}))
}

// Burst keeps its particle geometry unmirrored, but its restored eyes now share
// the search small-ball face so returning to idle never flashes rightward.
// A real absolute pointer target can still legitimately ask it to look right.
const burstToIdle = new BotEngine(100, 'burst')
assert.ok(eyeX(burstToIdle.sample(2.599)) < -1, 'burst tail uses the shared leftward face')
burstToIdle.setState('idle', 2.6)
assert.ok(eyeX(burstToIdle.sample(2.6)) < -1, 'first idle morph frame preserves the leftward burst face')
assert.ok(eyeX(burstToIdle.sample(3.06)) < -1, 'idle after burst must settle into mirrored leftward gaze without pointer')
const burstReset = new BotEngine(100, 'burst')
burstReset.reset('idle', 2.6)
assert.ok(eyeX(burstReset.sample(2.61)) < -1, 'rotation reset into idle also uses the mirrored face')
const burstWithPointer = new BotEngine(100, 'burst')
burstWithPointer.setState('idle', 2.6)
burstWithPointer.setLook({ yaw: 26, pitch: 20, mix: 1, spin: 0, wander: 0 }, 2.6)
assert.ok(eyeX(burstWithPointer.sample(3.06)) > 1, 'explicit rightward pointer target overrides mirrored idle as designed')

console.log('mirror-three-states: state mask, asymmetric pose, painted eyes and decorations PASS')

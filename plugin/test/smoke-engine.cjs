/** 回归：鼠标目光只控制静息表情；长时运行仍能眨眼。 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')
const { BotEngine, liveliness } = require(path.join(__dirname, '..', '..', '.test-build', 'tail-engine.cjs'))

const pointer = { yaw: 26, pitch: 20, mix: 1, spin: 0, wander: 0 }
const eyes = (frame) => frame.eyes.map(({ matrix, d }) => [matrix, d])
const tracked = new BotEngine(100, 'idle')
tracked.setLook(pointer, 0, 0)
assert.notDeepEqual(eyes(tracked.sample(1)), eyes(new BotEngine(100, 'idle').sample(1)), 'idle 仍响应鼠标')
for (const state of ['wink', 'waking', 'sleeping']) {
  const plain = new BotEngine(100, 'idle')
  tracked.reset(state, 1)
  plain.reset(state, 1)
  for (const at of [1, 1.1, 1.3]) {
    assert.deepEqual(eyes(tracked.sample(at)), eyes(plain.sample(at)), state + ' 不得继承鼠标目光 @' + at)
  }
}

const lid = (t) => liveliness(t).lid
assert.ok(lid(1.44) < 1, '第一周期存在眨眼')
for (const at of [0.4, 1.44, 1.5, 899, 905]) {
  assert.ok(Math.abs(lid(at) - lid(at + 910)) < 1e-10, '跨 910 秒周期仍确定 @' + at)
}
assert.ok(lid(911.44) < 1 && lid(1821.44) < 1, '15 分钟之后仍会眨眼')
assert.equal(lid(910), 1, '周期边界没有未闭合的眨眼')
console.log('smoke-engine: 鼠标目光隔离、长时眨眼、确定性通过')

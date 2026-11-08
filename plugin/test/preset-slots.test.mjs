import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

/**
 * 「新增监控不撞脸」判据。
 *
 * 把 store.ts 整份打成一个可在 Node 里加载的包（localStorage 缺失时
 * load()/persist() 都走 try/catch，模块能安全初始化），直接测生产函数。
 *
 * 覆盖两条：
 *   1. 同一帧里不同会话拿到互不相同的顺位（避免重复 / 看错）。
 *   2. 已认领的会话换格后仍用原顺位（既有「换格不换脸」行为不变）。
 */
const entry = fileURLToPath(new URL('../src/client/store.ts', import.meta.url))
const compiled = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'silent',
  legalComments: 'none'
})
const { presetPositionFor, syncPresetSlots } = await import(
  'data:text/javascript;base64,' + Buffer.from(compiled.outputFiles[0].text).toString('base64')
)

const positions = (m) => [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))

// 每个用例前清空模块级认领表（import 一次后两函数共享同一 Map）
function reset() {
  // 借一个全新的空画面 + 随后真实画面无法清空已知 id，改用一次性大集合把旧 id 挤掉：
  // sync 只保留「出现在 shownIds 里的」已知 id，其余释放。
  // 这里用一个不可能与用例冲突的前缀，保证上一用例的 id 全部被释放。
  syncPresetSlots(['__reset__'])
}

test('同一帧里各会话顺位互不相同', () => {
  reset()
  const m = syncPresetSlots(['a', 'b', 'c', 'd', 'e'])
  assert.deepEqual(positions(m), [['a', 0], ['b', 1], ['c', 2], ['d', 3], ['e', 4]])
  assert.equal(new Set(m.values()).size, 5, 'no two sessions may share a preset slot')
})

test('两个会话曾以同一格位首次露面时，同步后自动去重', () => {
  reset()
  // 复现旧代码的碰撞：两个不同 id 都以 firstPosition=2 认领
  presetPositionFor('x', 2)
  presetPositionFor('y', 2)
  assert.equal(presetPositionFor('x', 99), 2)
  assert.equal(presetPositionFor('y', 99), 2, '旧行为：两者都占第 2 顺位，会撞脸')
  const m = syncPresetSlots(['x', 'y'])
  assert.equal(new Set(m.values()).size, 2, '同步后必须拆到不同顺位')
  assert.equal(m.get('x'), 2, '先来的保留原顺位')
  assert.notEqual(m.get('y'), 2, '后来的顺延到空位')
})

test('换格不换脸：队列重排后已认领 id 保留原顺位', () => {
  reset()
  const first = syncPresetSlots(['a', 'b', 'c'])
  assert.deepEqual(positions(first), [['a', 0], ['b', 1], ['c', 2]])
  const reordered = syncPresetSlots(['c', 'a', 'b'])
  assert.equal(reordered.get('a'), 0)
  assert.equal(reordered.get('b'), 1)
  assert.equal(reordered.get('c'), 2, 'c 从第 3 格挪到第 1 格，顺位仍是 2')
  assert.equal(new Set(reordered.values()).size, 3)
})

test('新增监控只补空位，不改已有会话', () => {
  reset()
  syncPresetSlots(['a', 'b'])
  const grown = syncPresetSlots(['a', 'b', 'c', 'd'])
  assert.equal(grown.get('a'), 0)
  assert.equal(grown.get('b'), 1)
  assert.equal(grown.get('c'), 2)
  assert.equal(grown.get('d'), 3)
  assert.equal(new Set(grown.values()).size, 4)
})

test('空画面不清空认领表（当前会话暂未识别时外观不重排）', () => {
  reset()
  syncPresetSlots(['a', 'b'])
  const kept = syncPresetSlots([])
  assert.equal(kept.get('a'), 0)
  assert.equal(kept.get('b'), 1)
  assert.deepEqual(positions(syncPresetSlots(['a', 'b'])), [['a', 0], ['b', 1]])
})

test('sync 写回模块 Map，presetPositionFor 读到同一结果', () => {
  reset()
  const m = syncPresetSlots(['a', 'b', 'c'])
  for (const [id, pos] of m) {
    assert.equal(presetPositionFor(id, 99), pos, '既有读取点必须与同步结果一致')
  }
})

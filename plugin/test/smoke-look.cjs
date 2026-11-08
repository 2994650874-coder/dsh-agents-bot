/**
 * 外观选项顺序 + 顺位预设的测试。
 *
 * 锁两件事：
 *   1. 身形 / 表情在面板上的**排列顺序**是用户点名的那个顺序
 *   2. 第 N 格的**默认组合**按顺位走，且水滴不进顺位
 *
 * 这两件事都只有「看起来不对」这一个症状 —— 不会报错、不会崩，
 * 只会让用户每次加对话都要手动调一遍。所以必须钉死。
 *
 * 用法：node plugin/test/smoke-look.cjs
 */
'use strict'
const assert = require('node:assert/strict')
const path = require('node:path')

const PURE = require(path.join(__dirname, '..', '..', '.test-build', 'test-pure.cjs'))

let passed = 0
function check(label, fn) {
  try {
    fn()
    passed++
    console.log('  ok   ' + label)
  } catch (e) {
    console.log('  FAIL ' + label + '\n       ' + String(e.message).split('\n')[0])
    process.exitCode = 1
  }
}

const {
  SHAPE_OPTIONS,
  EXPRESSION_OPTIONS,
  PRESET_DEFAULT,
  PRESET_SIZE,
  PRESET_MIN,
  PRESET_MAX,
  presetLookAt,
  inShapePreset,
  sanitizePreset,
  EXPRESSION_PRESET_ORDER,
  DEFAULT_LOOK,
  MAX_MONITORED
} = PURE

const shapeIds = Object.keys(SHAPE_OPTIONS)
const exprIds = Object.keys(EXPRESSION_OPTIONS)

/* ══ 1. 排列顺序 ══════════════════════════════════════════════════════ */

console.log('身形排列顺序（用户点名的 8 个在前，搬来的 6 个接在后面，蛋和补水滴收尾）')

check('15 个身形一个不少', () => {
  /*
   * 14 -> 15 (2026-10-30) : l'etat `egg` a ete promu en FORME `oeuf`.
   * L'utilisateur : « 将（蛋）重构一下，变成身形，做不到就直接移除，适配颜色和表情 ».
   * C'etait un etat sans mouvement (une silhouette fixe tenue 1,8 s), donc
   * effectivement une forme. Elle herite maintenant des couleurs et des
   * expressions, ce qui est exactement ce qui lui manquait.
   */
  assert.equal(shapeIds.length, 15, `实际 ${shapeIds.length} 个：${shapeIds.join(',')}`)
})

check('前 7 个顺序与用户点名一致', () => {
  assert.deepEqual(shapeIds.slice(0, 7), [
    'cercle',
    'squircle',
    'hexagone',
    'nuage',
    'capsule',
    'triangle',
    'galet'
  ])
})

check('搬来的 6 个都在，且接在卵石之后', () => {
  const fromRef = ['bouclier', 'dome', 'arche', 'cylindre', 'gemme', 'cristal']
  for (const id of fromRef) assert.ok(shapeIds.includes(id), `少了 ${id}`)
  // 它们必须是连续的 6 个，且紧跟在 galet 之后
  const at = shapeIds.indexOf('bouclier')
  assert.equal(shapeIds.indexOf('galet'), at - 1, '搬来的形状应紧跟卵石')
  assert.deepEqual(shapeIds.slice(at, at + 6), fromRef)
})

check('水滴排在最后', () => {
  /*
   * 仍然成立，而且现在更有意义：水滴一直是「不参与顺位」的那个，位置不动。
   * 蛋（`oeuf`）插在它**前面**（2026-10-30），所以水滴还是最后一个 —— 新
   * 形状进来时把它放前面，正是为了不移动这个约定位置。
   */
  assert.equal(shapeIds[shapeIds.length - 1], 'goutte')
})

console.log('\n表情排列顺序（用户点名：中性、好奇、困惑、专注、害羞、困倦、难过、害怕）')

check('16 个表情一个不少', () => {
  assert.equal(exprIds.length, 16, `实际 ${exprIds.length} 个：${exprIds.join(',')}`)
})

check('点名的 8 个排在最前且顺序一致', () => {
  assert.deepEqual(exprIds.slice(0, 8), [
    'neutre',
    'curieux',
    'confus',
    'attentif',
    'timide',
    'somnolent',
    'triste',
    'effraye'
  ])
})

check('没点名的 8 个仍在（只是排后面）', () => {
  const rest = new Set(exprIds.slice(8))
  assert.equal(rest.size, 8)
  for (const id of ['surpris', 'excite', 'heureux', 'hilare', 'colere', 'mefiant', 'fier', 'blase']) {
    assert.ok(rest.has(id), `少了 ${id}`)
  }
})

/* ══ 2. 顺位表 ════════════════════════════════════════════════════════ */

/*
 * ── 2026-10-31：默认顺位改成「作者自己的那一份」────────────────────────
 *
 * 用户原话：「把我目前的动画映射和顺位分配顺位烧录成插件的默认」。
 *
 * 这条请求**推翻了下面几条旧断言**，而且推翻得很彻底：旧默认刻意不含水滴、
 * 不含拱门、图案顺序等于面板顺序。烧录进来的表里水滴在第 8 行、拱门在第 6 行、
 * 图案顺序是他自己排的（圆柱排第 5，而面板上圆柱排第 12）。
 *
 * 所以这一节的判据全部换掉：不再问「默认表排除了什么」，而问「默认表是不是
 * 就是作者存盘里那一份」。后者才是现在唯一有意义的事实。
 */

/** 作者存盘里的那一份顺位（2026-10-31 抄录，见 `look.ts` 的注释）。 */
const BURNED_PRESET = [
  ['squircle', 'brun', 'confus'],
  ['hexagone', 'rouge', 'curieux'],
  ['nuage', 'orange', 'attentif'],
  ['cylindre', 'ambre', 'timide'],
  ['arche', 'vert', 'somnolent'],
  ['dome', 'turquoise', 'blase'],
  ['goutte', 'bleu', 'effraye'],
  ['oeuf', 'violet', 'surpris']
]

console.log('\n顺位表（已烧录成作者的配置）')

check('顺位 8 行 + 第 1 格 = 监视上限 9', () => {
  // 第 1 格是当前窗口（跟全局走），不在表里。所以表长 = 9 - 1。
  assert.equal(PRESET_DEFAULT.length, PRESET_SIZE)
  assert.equal(PRESET_DEFAULT.length + 1, MAX_MONITORED)
})

check('默认表逐行等于作者存盘（图案 + 配色 + 表情三列）', () => {
  const got = PRESET_DEFAULT.map((r) => [r.shape, r.color, r.expression])
  assert.deepEqual(got, BURNED_PRESET)
})

check('水滴与拱门进了默认顺位（旧禁令作废）', () => {
  /*
   * 这两条原来是 `assert.ok(!shapes.includes('goutte'))` —— 反过来了。
   * 反向锁的意义在于：将来有人「顺手把水滴排除掉」，会立刻变红，被迫回来
   * 看一眼这条注释，而不是以为自己在清理垃圾。
   */
  const shapes = PRESET_DEFAULT.map((s) => s.shape)
  assert.ok(shapes.includes('goutte'), '水滴应当在默认顺位里（作者存盘第 8 行）')
  assert.ok(shapes.includes('arche'), '拱门应当在默认顺位里（作者存盘第 6 行）')
})

check('9 个格子身形互不相同（顺位够长，不会转回去重复）', () => {
  const got = []
  for (let i = 0; i < MAX_MONITORED; i++) got.push(presetLookAt(i, DEFAULT_LOOK).shape)
  assert.equal(new Set(got).size, MAX_MONITORED, `出现重复：${got.join(',')}`)
})

check('inShapePreset 对水滴和拱门都是 true（它们已经在表里了）', () => {
  assert.equal(inShapePreset('goutte'), true)
  assert.equal(inShapePreset('arche'), true)
  assert.equal(inShapePreset('triangle'), false, '三角不在作者的顺位里')
})

check('第 8、9 格是水滴 + 蛋（不再是穹顶 + 宝石）', () => {
  assert.equal(presetLookAt(7, DEFAULT_LOOK).shape, 'goutte')
  assert.equal(presetLookAt(8, DEFAULT_LOOK).shape, 'oeuf')
})

check('表情顺位 16 个（用户没要求排除任何表情）', () => {
  assert.equal(EXPRESSION_PRESET_ORDER.length, 16)
})

check('顺位行数上下限是 2~8', () => {
  assert.equal(PRESET_MIN, 2)
  assert.equal(PRESET_MAX, 8)
})

/* ══ 3. 逐格组合 ══════════════════════════════════════════════════════
   默认全局是「圆 + 中性」，所以第 1 格起依次是作者存盘里的 8 行。
   第 1 格永远是全局（不在表里），第 2 格起 = `BURNED_PRESET`。 */

console.log('\n逐格组合（锚点 = 全局默认 圆+中性）')

for (let i = 0; i < BURNED_PRESET.length; i++) {
  // 三列：图案 / 配色 / 表情。配色不参与这条断言（下一节单独锁），所以跳过。
  const [shape, , expression] = BURNED_PRESET[i]
  check(`第 ${i + 2} 格 = ${SHAPE_OPTIONS[shape]} + ${EXPRESSION_OPTIONS[expression]}`, () => {
    const got = presetLookAt(i + 1, DEFAULT_LOOK)
    assert.equal(got.shape, shape, `身形是 ${got.shape}`)
    assert.equal(got.expression, expression, `表情是 ${got.expression}`)
  })
}

check('第 1 格 = 圆 + 中性（全局默认，不在表里）', () => {
  const got = presetLookAt(0, DEFAULT_LOOK)
  assert.equal(got.shape, 'cercle')
  assert.equal(got.expression, 'neutre')
})

check('第 1 格就是全局本身（同一个对象引用）', () => {
  assert.equal(presetLookAt(0, DEFAULT_LOOK), DEFAULT_LOOK)
})

check('第 10 格绕回表头第 1 行', () => {
  // 8 行循环：第 10 格 → (10-1) % 8 = 0 → 表第 1 行
  const got = presetLookAt(9, DEFAULT_LOOK)
  assert.equal(got.shape, PRESET_DEFAULT[0].shape)
  assert.equal(got.expression, PRESET_DEFAULT[0].expression)
})

/* ══ 4. 配色参与顺位、尺寸不参与 ══════════════════════════════════════
   2026-10-31 之前配色也照抄全局 —— 9 个格子颜色全一样。用户要求
   「自动分配顺位需要增加颜色的可选槽」，所以配色从这一版起进顺位表。
   尺寸仍然只有全局一份（不许进顺位）：尺寸由格子布局算出来，逐格指定
   会和「格子多大」打架。 */

console.log('\n配色参与顺位 / 尺寸不参与')

check('第 5 格的配色来自顺位表，尺寸仍是全局的', () => {
  const base = { ...DEFAULT_LOOK, color: 'rouge', size: 120 }
  // 第 5 格 = index 4 → 表第 3 行（圆柱 + 琥珀 + 害羞），别用 PRESET_DEFAULT[4]
  const got = presetLookAt(4, base)
  assert.equal(got.size, 120, '尺寸必须照抄全局')
  assert.equal(got.shape, BURNED_PRESET[3][0])
  assert.equal(got.color, BURNED_PRESET[3][1], `配色是 ${got.color}`)
  assert.equal(got.expression, BURNED_PRESET[3][2])
})

check('改全局配色不影响第 2 格以后', () => {
  const a = { ...DEFAULT_LOOK, color: 'encre' }
  const b = { ...DEFAULT_LOOK, color: 'creme' }
  for (let i = 1; i < MAX_MONITORED; i++) {
    assert.equal(
      presetLookAt(i, a).color,
      presetLookAt(i, b).color,
      `第 ${i + 1} 格的配色跟着全局转了`
    )
  }
})

check('第 1 格（= 当前窗口）配色仍跟随全局', () => {
  const other = { ...DEFAULT_LOOK, color: 'creme' }
  assert.equal(presetLookAt(0, other).color, 'creme')
})

check('默认顺位配色不重复，且都不含黑（用户要求黑色排在最前但不进顺位首位）', () => {
  const colors = PRESET_DEFAULT.map((r) => r.color)
  assert.equal(new Set(colors).size, colors.length, `有重复配色：${colors.join(',')}`)
  assert.notEqual(colors[0], DEFAULT_LOOK.color, '第 2 格不该再和全局撞成墨黑')
})

check('顺位表里的每个配色都在配色选项里', () => {
  const colorIds = Object.keys(PURE.COLOR_OPTIONS)
  for (const row of PRESET_DEFAULT) {
    assert.ok(colorIds.includes(row.color), `顺位里的配色 ${row.color} 不在选项里`)
  }
})

/* ══ 5. 顺位是「表里写什么就是什么」═════════════════════════════════
   改版前顺位以全局为锚点往后走，改全局整排跟着转。现在逐行可编辑，
   锚点会让「填的是第 3 行、显示在第 5 格」，所以改成直接查表。
   这一节钉死新判据：**改全局不影响第 2 格以后。** */

console.log('\n顺位是显式的（改全局不动第 2 格以后）')

check('全局换成「三角 + 难过」后，第 2 格仍是表里写的「圆角方 + 好奇」', () => {
  const base = { ...DEFAULT_LOOK, shape: 'triangle', expression: 'triste' }
  const got = presetLookAt(1, base)
  assert.equal(got.shape, PRESET_DEFAULT[0].shape, `身形是 ${got.shape}`)
  assert.equal(got.expression, PRESET_DEFAULT[0].expression, `表情是 ${got.expression}`)
})

check('全局换任何值，9 格身形序列都不变', () => {
  const before = []
  for (let i = 0; i < MAX_MONITORED; i++) before.push(presetLookAt(i, DEFAULT_LOOK).shape)
  const other = { ...DEFAULT_LOOK, shape: 'goutte', expression: 'hilare' }
  for (let i = 1; i < MAX_MONITORED; i++) {
    assert.equal(presetLookAt(i, other).shape, before[i], `第 ${i + 1} 格跟着全局转了`)
  }
})

check('第 1 格跟随全局（改全局只有它变）', () => {
  const other = { ...DEFAULT_LOOK, shape: 'goutte', expression: 'hilare' }
  assert.equal(presetLookAt(0, other).shape, 'goutte')
  assert.equal(presetLookAt(0, other).expression, 'hilare')
})

/* ══ 5b. 用户改过的表立刻生效 ════════════════════════════════════════ */

console.log('\n用户改过的表立刻生效')

check('改第 1 行 → 第 2 格跟着变', () => {
  const custom = [{ shape: 'gemme', expression: 'colere' }, ...PRESET_DEFAULT.slice(1)]
  const got = presetLookAt(1, DEFAULT_LOOK, custom)
  assert.equal(got.shape, 'gemme')
  assert.equal(got.expression, 'colere')
})

check('表短了 → 从头重复', () => {
  const custom = [
    { shape: 'gemme', expression: 'colere' },
    { shape: 'dome', expression: 'fier' }
  ]
  assert.equal(presetLookAt(1, DEFAULT_LOOK, custom).shape, 'gemme')
  assert.equal(presetLookAt(2, DEFAULT_LOOK, custom).shape, 'dome')
  // 第 4 格绕回第 1 行
  assert.equal(presetLookAt(3, DEFAULT_LOOK, custom).shape, 'gemme')
})

check('空表 → 回落默认表（不会崩）', () => {
  const got = presetLookAt(1, DEFAULT_LOOK, [])
  assert.equal(got.shape, PRESET_DEFAULT[0].shape)
})

/* ══ 5c. sanitizePreset 挡住坏存盘 ═══════════════════════════════════ */

console.log('\n坏存盘防线（sanitizePreset）')

check('非数组 → 回落默认', () => {
  for (const junk of [null, undefined, 0, 'x', {}]) {
    assert.deepEqual(sanitizePreset(junk), PRESET_DEFAULT)
  }
})

check('空数组 → 回落默认（不能返回空表）', () => {
  assert.deepEqual(sanitizePreset([]), PRESET_DEFAULT)
})

check('不存在的图案 id → 整行丢弃', () => {
  const got = sanitizePreset([{ shape: 'nope', expression: 'neutre' }])
  assert.deepEqual(got, PRESET_DEFAULT)
})

check('不存在的表情 id → 整行丢弃', () => {
  const got = sanitizePreset([{ shape: 'cercle', expression: 'nope' }])
  assert.deepEqual(got, PRESET_DEFAULT)
})

check('合法的行原样保留', () => {
  const good = [{ shape: 'gemme', color: 'violet', expression: 'colere' }]
  assert.deepEqual(sanitizePreset(good), good)
})

/* 2026-10-31：配色是新字段。老存盘里没有它，若当成坏行整份丢弃，
   用户升级后会看到「调好的顺位全变了」—— 比少个颜色严重得多。
   这里钉死「缺色按行号补默认色」。 */
check('老存盘（没有 color 字段）不丢行，按行号补默认色', () => {
  const legacy = [
    { shape: 'gemme', expression: 'colere' },
    { shape: 'dome', expression: 'fier' }
  ]
  const got = sanitizePreset(legacy)
  assert.equal(got.length, 2, `行数变成 ${got.length}`)
  assert.equal(got[0].color, PRESET_DEFAULT[0].color)
  assert.equal(got[1].color, PRESET_DEFAULT[1].color)
  assert.equal(got[0].shape, 'gemme')
  assert.equal(got[0].expression, 'colere')
})

check('配色 id 写坏了 → 补默认色，不丢行', () => {
  const got = sanitizePreset([{ shape: 'cercle', color: 'nope', expression: 'neutre' }])
  assert.equal(got.length, 1)
  assert.equal(got[0].color, PRESET_DEFAULT[0].color)
})

check('超出上限的行被截断', () => {
  const many = Array.from({ length: 20 }, () => ({ shape: 'cercle', expression: 'neutre' }))
  assert.equal(sanitizePreset(many).length, PRESET_MAX)
})

/* ══ 6. 面板顺序 = 顺位表顺序 ═════════════════════════════════════════
   否则「面板上第 2 个身形」和「第 2 格拿到的身形」对不上，用户看着会错位。

   注意：只有**前 7 项**需要和面板顺序完全一致 —— 那是用户点名的顺序。
   第 8、9 位（穹顶、宝石）是后来为了凑够 9 个（= 监视上限）补进来的，
   它们在面板上的位置在 14 个选项里更靠后，和顺位第 8、9 位不一致。
   这是有意的：面板顺序按「用户点名的在前」排，顺位按「第 N 格够不够用」排。 */

console.log('\n面板顺序与顺位表一致')

check('顺位表里的每个图案、表情都在面板选项里', () => {
  /*
   * ── 顺序一致性这条已经作废（2026-10-31）────────────────────────────
   * 旧断言是 `shapeIds.slice(1,7) === PRESET_DEFAULT.slice(0,6)`，即「面板前 6
   * 个身形 = 顺位表前 6 个」。它成立的前提是默认表**照着面板顺序排**。
   *
   * 烧录进来的表是作者自己排的：圆柱排顺位第 4 行，而在面板里圆柱排第 12。
   * 两者不需要再一致 —— 「顺位是我自己的编排」正是他现在要的语义。
   *
   * 但**可达性**必须保留：顺位里写的每个 id 都得能在下拉里选到，否则第 N 格
   * 会取到一个用户根本改不掉的形状。
   */
  for (const row of PRESET_DEFAULT) {
    assert.ok(shapeIds.includes(row.shape), `顺位里的 ${row.shape} 不在面板选项里`)
  }
  for (const row of PRESET_DEFAULT) {
    assert.ok(exprIds.includes(row.expression), `顺位里的 ${row.expression} 不在表情选项里`)
  }
})

check('面板前 8 个表情 = 表情顺序前 8 个', () => {
  assert.deepEqual(exprIds.slice(0, 8), EXPRESSION_PRESET_ORDER.slice(0, 8))
})

/* ══ 7. 子代理计数：fork 出来的会话不能被算成子代理 ═══════════════════
   实机症状：「小框写 ×3，但页面上只有 2 个子代理」。

   根因：`countDescendants` 原来只判 `parentId !== undefined`，
   而**分叉（fork）出来的会话也带 parentId**。它出现在会话列表里、
   能勾选、能继续对话，是普通会话，不是子代理。

   这一节的假数据照着本机 `~/.dsh/sessions` 的真实形态搭：
   同一个父会话名下 2 个 origin=subagent + 1 个 fork 副本（origin 缺失）。 */

console.log('\n子代理计数：fork 副本不算子代理')

const { countDescendants, isRealChild } = PURE

/** 造一个「和宿主 projectList() 同形」的列表快照。 */
function snap({ ids, byId }) {
  return { ids, byId }
}

check('两个真子代理 + 一个 fork 副本 → 只数 2 个（不算 fork）', () => {
  // ids 里只有普通会话（含 fork 副本）；子代理只在 byId 里 —— 这是宿主真实形态
  const list = snap({
    ids: ['root', 'forked'],
    byId: {
      root: { id: 'root' },
      forked: { id: 'forked', parentId: 'root' }, // fork：有 parentId，无 origin，在 ids 里
      s1: { id: 's1', parentId: 'root', origin: 'subagent' }, // 真子代理：只在 byId
      s2: { id: 's2', parentId: 'root', origin: 'subagent' } // 真子代理：只在 byId
    }
  })
  assert.equal(countDescendants(list, 'root'), 2, '把 fork 副本算进去了')
})

check('只有 fork 副本时数 0（不是 1）', () => {
  const list = snap({
    ids: ['root', 'forked'],
    byId: {
      root: { id: 'root' },
      forked: { id: 'forked', parentId: 'root' }
    }
  })
  assert.equal(countDescendants(list, 'root'), 0)
})

check('子代理只在 byId、不在 ids 里 —— 仍然数得到（不能退回只扫 ids）', () => {
  const list = snap({
    ids: ['root'],
    byId: {
      root: { id: 'root' },
      s1: { id: 's1', parentId: 'root', origin: 'subagent' }
    }
  })
  assert.equal(countDescendants(list, 'root'), 1)
})

check('孙代理（子代理再派）递归也算进根会话', () => {
  const list = snap({
    ids: ['root'],
    byId: {
      root: { id: 'root' },
      s1: { id: 's1', parentId: 'root', origin: 'subagent' },
      s2: { id: 's2', parentId: 's1', origin: 'subagent' }
    }
  })
  assert.equal(countDescendants(list, 'root'), 2)
})

check('isRealChild：origin=subagent 一律算', () => {
  const inIds = new Set(['x'])
  assert.equal(isRealChild({ parentId: 'p', origin: 'subagent' }, 'x', inIds), true)
})

check('isRealChild：无 parentId 一律不算', () => {
  const inIds = new Set()
  assert.equal(isRealChild({ origin: 'subagent' }, 'x', inIds), false)
  assert.equal(isRealChild(undefined, 'x', inIds), false)
})

check('isRealChild：有父会话但 origin 是未知值 → 不算（宁可少数）', () => {
  const inIds = new Set()
  assert.equal(isRealChild({ parentId: 'p', origin: 'something-new' }, 'x', inIds), false)
})

console.log('')
if (process.exitCode) {
  console.log('有失败项')
} else {
  console.log(`全部通过（${passed} 项）`)
}

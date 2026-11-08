/**
 * 把 preview/_shapes-snippet.txt 里的 6 个身形插进 plugin/src/bot/skins.ts。
 *
 * 为什么要单独一个脚本而不是手改：这 6 行各 500+ 字符的浮点数组，
 * 手抄必然出错且不报错。脚本做三件事：
 *   1. 插在 `goutte` 之后（数组末尾）
 *   2. 把 `ShapeId` 字面量联合补上这 6 个 id
 *   3. 插完回读校验：每个新身形确实有 64 个半径
 *
 * 幂等：已经插过就跳过，不会插两遍。
 *
 * 用法（在 grokbot 目录下）：node tools/apply-shapes.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SKINS = resolve(ROOT, 'plugin/src/bot/skins.ts')
const SNIPPET = resolve(ROOT, 'preview/_shapes-snippet.txt')

const IDS = ['bouclier', 'dome', 'arche', 'cylindre', 'gemme', 'cristal']

const snippet = readFileSync(SNIPPET, 'utf8').trimEnd()
let src = readFileSync(SKINS, 'utf8')

// ── 幂等检查 ──────────────────────────────────────────────────────────
if (IDS.every((id) => src.includes(`id: '${id}'`))) {
  console.log('已经插过了，跳过')
  process.exit(0)
}

// ── 1. 插数组项 ───────────────────────────────────────────────────────
const ANCHOR = "  { id: 'goutte', radii: droplet }\n]"
if (!src.includes(ANCHOR)) {
  console.error('找不到数组末尾锚点 —— skins.ts 的结构变了，先看一眼再改')
  process.exit(1)
}
src = src.replace(ANCHOR, "  { id: 'goutte', radii: droplet },\n" + snippet + '\n]')

// ── 2. 补 ShapeId 字面量联合 ──────────────────────────────────────────
const TYPE_ANCHOR = "  | 'goutte'\n"
if (!src.includes(TYPE_ANCHOR)) {
  console.error('找不到 ShapeId 联合的末尾 —— 结构变了')
  process.exit(1)
}
src = src.replace(TYPE_ANCHOR, "  | 'goutte'\n" + IDS.map((id) => `  | '${id}'`).join('\n') + '\n')

writeFileSync(SKINS, src, 'utf8')

// ── 3. 回读校验 ───────────────────────────────────────────────────────
const after = readFileSync(SKINS, 'utf8')
let ok = true
for (const id of IDS) {
  const m = after.match(new RegExp(`id: '${id}', radii: \\[([^\\]]+)\\]`))
  if (!m) {
    console.error(`✗ ${id} 没插进去`)
    ok = false
    continue
  }
  const n = m[1].split(',').length
  if (n !== 64) {
    console.error(`✗ ${id} 有 ${n} 个半径，应该是 64`)
    ok = false
  } else {
    console.log(`  ok  ${id}  64 个半径`)
  }
}
const shapesCount = (after.match(/id: '[a-z]+', radii:/g) ?? []).length
console.log(`\nSHAPES 数组现在有 ${shapesCount} 项`)
console.log(ok ? '插入成功' : '插入有问题，看上面的 ✗')
process.exitCode = ok ? 0 : 1

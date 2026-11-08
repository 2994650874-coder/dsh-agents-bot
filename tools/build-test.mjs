#!/usr/bin/env node
/**
 * 构建测试用的纯函数包：把可测的纯逻辑单独打成一个 CJS 文件。
 *
 * ── 为什么需要它 ────────────────────────────────────────────────────
 * 插件产物 `lib/client.js` 是 ModuleLoader bundle，只导出 `apply`/`inject`，
 * 内部的纯函数（轮播调度、活动推导）拿不到。而这两块恰恰是最需要
 * 测试的地方 —— 它们错了只会表现为「有时候状态不对」，不会报错。
 *
 * 三条路，只有第三条是对的：
 *  1. 在测试里把逻辑抄一遍 → 测的是抄本，不是产品代码。抄本和产品
 *     各自演化，测试永远绿，bug 永远在。
 *  2. 给 bundle 加一个 `__test` 导出 → 测试钩子进了生产产物。
 *  3. **单独打一个测试包** ← 选这个。同一个源文件、同一份逻辑，
 *     只是入口不同。
 *
 * 产物落在 **`.test-build/`（grokbot 根目录下）而不是 `plugin/lib/`**：
 * `plugin/lib/` 是发布产物（package.json 的 `files` 收 `lib`），
 * 把测试专用的包塞进去等于往用户装的东西里加一份没人用的 120 KB。
 *
 * 用法（在 grokbot 目录下）：node tools/build-test.mjs
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PLUGIN = resolve(ROOT, 'plugin')
const OUT_DIR = resolve(ROOT, '.test-build')

/**
 * 测试入口：把要测的纯函数转出去。
 *
 * 用虚拟入口而不是新建一个 src 文件 —— 那会变成「为了测试而存在的
 * 生产源码」，将来没人敢删。
 */
const ENTRY = `
export { slotAt, slotIndexOf, cycleLength, playLengthOf, describeRotation } from './src/client/rotation'
export { deriveActivity, activityOfTool } from './src/client/derive'
export {
  DEFAULT_ROTATION, ACTIVITY_ORDER, ACTIVITY_LABEL, ANIMATION_OPTIONS, PREVIEW_STATES,
  MAX_ROTATION_ITEMS, MIN_PLAYS, MAX_PLAYS, SLEEP_OPTIONS, DEFAULT_SLEEP_MINUTES
} from './src/client/activities'
export { gridOf, orientationOf, MAX_MONITORED } from './src/client/store'
export { STATES, STATE_BY_ID, SEQUENCE, POSES } from './src/bot/states'
export {
  SHAPE_OPTIONS, EXPRESSION_OPTIONS, COLOR_OPTIONS, SHAPE_IDS,
  PRESET_DEFAULT, PRESET_SIZE, PRESET_MIN, PRESET_MAX, presetLookAt, inShapePreset,
  sanitizePreset, EXPRESSION_PRESET_ORDER, DEFAULT_LOOK
} from './src/client/look'
export { activeSessionOf, unavailableSessionIds, countDescendants, isRealChild, deriveAgents, avatarProjectionOf } from './src/client/agents'
`

const result = await build({
  stdin: {
    contents: ENTRY,
    resolveDir: PLUGIN,
    sourcefile: 'test-pure-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8'
})

mkdirSync(OUT_DIR, { recursive: true })
const body = result.outputFiles[0].text
writeFileSync(resolve(OUT_DIR, 'test-pure.cjs'), body, 'utf8')
console.log(`built .test-build/test-pure.cjs  ${(body.length / 1024).toFixed(1)} KB  (test-only)`)

/**
 * 第二个测试包，只导出引擎本身。
 *
 * `smoke-tail.cjs` 要断言的是「收尾那一帧的身体形状」，那只能靠真实采样，
 * 纯函数表拿不到。单独打一个包而不是塞进 `test-pure.cjs`：引擎会拖进
 * shape/profiles/face 一整套，和平纯逻辑的加载代价不是一个量级，
 * 只给需要它的那个测试加。
 */
const ENGINE_ENTRY = `
export { BotEngine } from './src/bot/engine'
export { liveliness, eyePoses } from './src/bot/face'
export { STATES, STATE_BY_ID, smallBall } from './src/bot/states'
export { mirrorPose } from './src/bot/mirror'
export { toPoints } from './src/bot/shape'
export { SHAPE_BY_ID } from './src/bot/skins'
`
const engineResult = await build({
  stdin: {
    contents: ENGINE_ENTRY,
    resolveDir: PLUGIN,
    sourcefile: 'test-engine-entry.ts',
    loader: 'ts'
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8'
})
const engineBody = engineResult.outputFiles[0].text
writeFileSync(resolve(OUT_DIR, 'tail-engine.cjs'), engineBody, 'utf8')
console.log(`built .test-build/tail-engine.cjs  ${(engineBody.length / 1024).toFixed(1)} KB  (test-only)`)


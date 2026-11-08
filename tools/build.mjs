#!/usr/bin/env node
/**
 * 构建插件产物：plugin/src → plugin/lib
 *
 * 产出一组配对构建产物，均不可手改：
 *   plugin/lib/client.js          —— 浏览器半侧，DSH ModuleLoader bundle
 *   plugin/lib/index.js           —— Host 半侧，普通 ESM Cordis 模块
 *   plugin/lib/offscreen/         —— 独立子页 index.html / app.js / owner.js
 *
 * 浏览器半侧的外部依赖只能是外壳 PLATFORM_MODULES 基座里的东西
 * （react / react-dom / @deepseek-ai/cordis / dsh-client-store / ui-slots /
 *  ui-primitives / ui-dockkit / zod / @tanstack/react-virtual）。
 * 其余一律打进 bundle —— 所以 bloub 引擎原样内联，不给 profile 加依赖。
 *
 * Host 半侧反过来：**什么都不外置**。它只用 Node 内置能力，零 import，
 * 所以整份源码原样编成 lib/index.js，profile 不需要额外解析任何模块。
 *
 * ── 为什么 Host 半侧也走构建 ────────────────────────────────────────
 * 它原先是手写的 lib/index.js（一个空 apply）。接上投影单元后有了真逻辑，
 * 手写就意味着「源码在 lib 里、没有 src 可读、没有类型可查」。改成
 * src/host/index.ts → lib/index.js 之后，两半的链路一致：改 src，跑构建。
 *
 * 先在隔离目录验证：node tools/build.mjs --out-dir=.test-build/release
 * 正式构建（另获授权时）：node tools/build.mjs
 */
import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, resolve, relative, isAbsolute, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..') // grokbot/
const PLUGIN = resolve(ROOT, 'plugin')
const stageArg = process.argv.slice(2)
if (stageArg.length > 1 || (stageArg.length === 1 && !stageArg[0].startsWith('--out-dir='))) throw Error('usage: node tools/build.mjs [--out-dir=.test-build/release]')
const staging = stageArg.length === 1
const OUT = staging ? resolve(ROOT, stageArg[0].slice('--out-dir='.length)) : resolve(PLUGIN, 'lib')
const relStage = relative(resolve(ROOT, '.test-build'), OUT)
if (staging && (!stageArg[0].slice('--out-dir='.length) || relStage === '' || relStage === '..' || relStage.startsWith('..\\') || relStage.startsWith('../') || isAbsolute(relStage))) throw Error('staged output must be a subdirectory of grokbot/.test-build')
if (staging) {
  let cursor = ROOT
  for (const segment of relative(ROOT, OUT).split(sep)) {
    cursor = join(cursor, segment)
    try { if (lstatSync(cursor).isSymbolicLink()) throw Error('staged output cannot traverse a symbolic link') }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
}
const PARENT_ORIGIN = 'dsh-app://app' // confirmed Desktop G1 origin; not URL-derived
const CHILD_ORIGIN = 'http://127.0.0.1:49383'
const capability = randomBytes(32).toString('hex')
/*
 * `JSON.parse` 在文件带 UTF-8 BOM 时会抛 `Unexpected token`，所以解析前先剥掉。
 * 文件本身**不该**有 BOM（DSH 读 manifest 时同样会因此判定「包不可用」）；
 * 这里的容错只是为了「有人用 Windows 编辑器保存时又加上了」时构建不至于中断，
 * 不是让带 BOM 的文件变得可用。
 */
const PKG = JSON.parse(readFileSync(resolve(PLUGIN, 'package.json'), 'utf8').replace(/^\uFEFF/, ''))
const NAME = PKG.name

/** 外壳基座里已有的模块：不打包，运行时 require 交给 ModuleLoader 解析。 */
const PLATFORM = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  'zod',
  '@tanstack/react-virtual',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit'
]


/* ── 浏览器半侧 ─────────────────────────────────────────────────────── */

const clientResult = await build({
  entryPoints: [resolve(PLUGIN, 'src/client/index.tsx')],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  external: PLATFORM,
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
  define: {
    __BOT_ISOLATION_CAPABILITY__: JSON.stringify(capability),
    __BOT_ISOLATION_PARENT_ORIGIN__: JSON.stringify(PARENT_ORIGIN)
  }
})

const clientBody = clientResult.outputFiles[0].text

/** 包成 ModuleLoader bundle：id 必须等于 loader entry 名，否则外壳会报
 *  "loaded without registering <name>"。 */
const bundle = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(NAME)},
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
${clientBody
  .split('\n')
  .map((l) => (l.length > 0 ? '    ' + l : l))
  .join('\n')}
    return module.exports
  }
})
`


/* ── Host 半侧 ──────────────────────────────────────────────────────── */

const hostResult = await build({
  entryPoints: [resolve(PLUGIN, 'src/host/index.ts')],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8'
})

const hostBody = hostResult.outputFiles[0].text

/* ── Offscreen 子页：与父 bundle 共用一次构建的 origin / 归属凭据 ── */
const childResult = await build({
  entryPoints: [resolve(PLUGIN, 'src/isolation/main.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
  minify: true,
  define: {__CHILD_ORIGIN__: JSON.stringify(CHILD_ORIGIN), __PARENT_ORIGIN__: JSON.stringify(PARENT_ORIGIN)}
})
const childBody = childResult.outputFiles[0].text
const html = readFileSync(resolve(PLUGIN, 'src/isolation/index.html'), 'utf8')
if (!html.includes('<script src="./owner.js" defer></script><script src="./app.js" defer></script>')) throw Error('offscreen HTML entries changed; refusing to publish mismatched artifacts')
const owner = '(()=>{let n=0;const send=()=>{if(n++>=40){clearInterval(timer);return}if(window.location.origin!=='+JSON.stringify(CHILD_ORIGIN)+'||window.parent===window){clearInterval(timer);return}window.parent.postMessage({v:1,kind:"G2_OWNER",capability:'+JSON.stringify(capability)+'},'+JSON.stringify(PARENT_ORIGIN)+')};const timer=setInterval(send,500);send()})()\n'
// Build all outputs before the first write; a staged build never mutates plugin/lib.
if (staging) for (const name of ['offscreen', 'client.js', 'index.js', 'offscreen/index.html', 'offscreen/app.js', 'offscreen/owner.js']) {
  try { if (lstatSync(resolve(OUT, name)).isSymbolicLink()) throw Error('staged artifact cannot be a symbolic link: ' + name) }
  catch (error) { if (error.code !== 'ENOENT') throw error }
}
mkdirSync(resolve(OUT, 'offscreen'), {recursive:true})
writeFileSync(resolve(OUT, 'client.js'), bundle, 'utf8')
writeFileSync(resolve(OUT, 'index.js'), hostBody, 'utf8')
writeFileSync(resolve(OUT, 'offscreen/index.html'), html, 'utf8')
writeFileSync(resolve(OUT, 'offscreen/app.js'), childBody, 'utf8')
writeFileSync(resolve(OUT, 'offscreen/owner.js'), owner, 'utf8')
console.log((staging ? 'staged ' : 'built ') + OUT + ' (paired parent, Host and offscreen assets; no activation)')


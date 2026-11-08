/**
 * 把判据报错的格放大画出来，旁边放同状态的圆做对照。
 *
 * 每行：可疑格（大图）+ 圆（同状态同表情，大图）+ 两格并排的说明。
 *
 * 用法：node tools/build-shape-fails.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BOT_SRC = resolve(ROOT, 'plugin/src/bot')
const BOT_TMP = resolve(ROOT, 'preview', '_bot6')
const REF = resolve(ROOT, 'refs', 'grok-icon-study', 'animation.html')
const PROFILE_SAMPLES = 64

// 复用 build-shape-six 已经注入好的 preview/_bot6；若不存在就先跑那个
try {
  readFileSync(resolve(BOT_TMP, 'skins.ts'), 'utf8')
} catch {
  console.error('preview/_bot6/skins.ts 不存在，先跑 node tools/build-shape-six.mjs')
  process.exit(1)
}

const { build } = await import('esbuild')

const redirectBot = {
  name: 'redirect-bot',
  setup(b) {
    b.onResolve({ filter: /\/bot\/[a-zA-Z]+$/ }, (args) => {
      const name = args.path.replace(/^.*\/bot\//, '')
      return { path: resolve(BOT_TMP, name + '.ts') }
    })
  }
}

await build({
  entryPoints: [resolve(ROOT, 'tools/shape-fails.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/shape-fails.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8',
  plugins: [redirectBot]
})

writeFileSync(
  resolve(ROOT, 'preview', 'shape-fails.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>可疑格放大</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./shape-fails.js"></script></body></html>`,
  'utf8'
)
console.log('built preview/shape-fails.html')

/**
 * 30px 缩略图检阅：现有 8 个 + 用户点名的 6 个，各 4 个表情。
 *
 * 这个页面模拟右栏「外观」面板里真实的身形缩略图（`size: 30`），
 * 用来回答「眼睛在缩略图上还分得开吗」。
 *
 * 用法：node tools/build-shape-thumb.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const BOT_TMP = resolve(ROOT, 'preview', '_bot6')

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
  entryPoints: [resolve(ROOT, 'tools/shape-thumb.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/shape-thumb.js'),
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
  resolve(ROOT, 'preview', 'shape-thumb.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>缩略图检阅</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./shape-thumb.js"></script></body></html>`,
  'utf8'
)
console.log('built preview/shape-thumb.html')

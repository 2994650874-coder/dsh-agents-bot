/** 状态检阅板的构建。只用于验证，不进插件产物。 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/board.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/board.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/board.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>状态检阅板</title></head>
<body><div id="root"></div><script src="./board.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/board.html')

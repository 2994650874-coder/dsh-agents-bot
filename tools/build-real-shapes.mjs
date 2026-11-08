/** 真源码 14 身形检阅页的构建：node tools/build-real-shapes.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/shape-real.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/shape-real.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/shape-real.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>真源码身形检阅</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./shape-real.js"></script></body></html>`,
  'utf8'
)
console.log('built preview/shape-real.html')

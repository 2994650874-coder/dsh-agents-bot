/** 帧预算争用页的构建：node tools/build-contention.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/contention.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/contention.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/contention.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>帧预算争用</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./contention.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/contention.html')

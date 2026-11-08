/** 重渲染成本对照页的构建：node tools/build-rerender.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/rerender.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/rerender.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/rerender.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>重渲染成本对照</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./rerender.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/rerender.html')

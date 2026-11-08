/** 图标尺寸对照页的构建：node tools/build-icon-sizes.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/icon-sizes.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/icon-sizes.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/icon-sizes.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>子代理图标尺寸对照</title>
<style>html,body{margin:0}#root{padding:14px}</style></head>
<body><div id="root"></div><script src="./icon-sizes.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/icon-sizes.html')

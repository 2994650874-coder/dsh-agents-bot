/**
 * arche vs 已有身形：三档真实尺寸下的对比。
 *
 * 用法：node tools/build-arche-look.mjs
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/arche-look.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/arche-look.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/arche-look.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>arche 尺寸对比</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./arche-look.js"></script></body></html>`,
  'utf8'
)
console.log('built preview/arche-look.html')

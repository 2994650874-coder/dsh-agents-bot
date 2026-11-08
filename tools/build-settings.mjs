/** 设置页预览的构建：node tools/build-settings.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/settings.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/settings.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/settings.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>设置页预览</title>
<style>html,body{margin:0;height:100%}#root{height:100%}</style></head>
<body><div id="root"></div><script src="./settings.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/settings.html')

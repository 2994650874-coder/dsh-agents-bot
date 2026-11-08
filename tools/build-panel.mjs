/** 右栏面板预览的构建：node tools/build-panel.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/panel.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/panel.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/panel.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>右栏面板预览</title>
<style>html,body{margin:0;height:100%}#root{height:100%}</style></head>
<body><div id="root"></div><script src="./panel.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/panel.html')

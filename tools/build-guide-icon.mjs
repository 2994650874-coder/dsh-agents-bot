/** 引导页入口图标验证页的构建：node tools/build-guide-icon.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/guide-icon.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/guide-icon.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/guide-icon.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>引导页入口图标</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./guide-icon.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/guide-icon.html')

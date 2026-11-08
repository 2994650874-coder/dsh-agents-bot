/**
 * 预览构建：把 tools/preview.tsx 打成一份可以直接用 file:// 打开的页面。
 *
 * 用途：在没有 DSH 外壳的情况下看「引擎 + React 渲染 + 面板布局」对不对。
 * 只用于开发验证，不进插件产物。
 *
 * 用法（在 grokbot 目录下）：node tools/build-preview.mjs
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/preview.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/preview.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/index.html'),
  `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>dsh-agents-bot 预览</title>
<style>html,body{margin:0;height:100%}#root{height:100%}</style></head>
<body><div id="root"></div><script src="./preview.js"></script></body></html>
`,
  'utf8'
)

console.log('built preview/index.html + preview/preview.js')

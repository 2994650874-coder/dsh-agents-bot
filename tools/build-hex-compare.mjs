/** 六边形对照页的构建：node tools/build-hex-compare.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/hex-compare.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/hex-compare.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/hex-compare.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>两个「六边形」对照</title>
<style>html,body{margin:0}</style></head>
<body><div id="root"></div><script src="./hex-compare.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/hex-compare.html')

/** 设置页试片区版式候选稿的构建：node tools/build-settings-sketches.mjs */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/settings-sketches.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/settings-sketches.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/settings-sketches.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>设置页试片区 · 版式候选</title>
</head><body><div id="root"></div><script src="./settings-sketches.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/settings-sketches.html')

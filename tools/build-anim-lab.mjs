/**
 * 构建「动画实验室」预览页：node tools/build-anim-lab.mjs
 *
 * 产物：preview/anim-lab.html（自包含，双击即可打开）
 *
 * ── 为什么要独立一个页面，而不是改 settings.html ─────────────────────
 * `settings.html` 是**静态镜像**，它的用处是「设置页长什么样」——加了控制条
 * 就不再是镜像了。`settings-sketches.html` 是**决策留档**（A/B/C/D 四个候选），
 * 更不能动：那是「为什么选 B」的证据。
 *
 * 所以新开一个页面，职责单一：**交互测试台**。三个页面各管一件事，
 * 谁也不覆盖谁。
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

await build({
  entryPoints: [resolve(ROOT, 'tools/anim-lab.tsx')],
  bundle: true,
  outfile: resolve(ROOT, 'preview/anim-lab.js'),
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'warning',
  charset: 'utf8'
})

writeFileSync(
  resolve(ROOT, 'preview/anim-lab.html'),
  `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>动画实验室 · dsh-agents-bot</title>
<style>html,body{margin:0;height:100%}#root{height:100%}</style></head>
<body><div id="root"></div><script src="./anim-lab.js"></script></body></html>`,
  'utf8'
)

console.log('built preview/anim-lab.html')

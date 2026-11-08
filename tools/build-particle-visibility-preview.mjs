/** Source-only frozen particle timeline, never writes installed plugin/lib. */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
await build({ entryPoints: [resolve(root, 'tools/particle-visibility-preview.tsx')], bundle: true, outfile: resolve(root, 'preview/particle-visibility.js'), format: 'iife', platform: 'browser', target: 'chrome120', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, charset: 'utf8' })
writeFileSync(resolve(root, 'preview/particle-visibility.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>五态外部粒子逐帧预览</title><style>body{margin:0;background:#f3f5f9;color:#252b35;font-family:"Microsoft YaHei","Segoe UI",sans-serif}main{max-width:1140px;margin:auto;padding:22px}h1{font-size:22px;margin:0 0 7px}p{font-size:12px;color:#636c79;margin:0 0 14px}section{background:#fff;border:1px solid #dbe2e9;border-radius:12px;margin:0 0 11px;padding:7px 12px 10px}h2{font-size:13px;margin:2px 0 0}.frames{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}figure{display:flex;align-items:center;flex-direction:column;margin:0}figure svg{display:block}figcaption{font-size:11px;color:#555;margin-top:-10px}</style></head><body><div id="root"></div><script src="./particle-visibility.js"></script></body></html>`, 'utf8')
console.log('built preview/particle-visibility.html')

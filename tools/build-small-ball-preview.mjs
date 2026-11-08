/** Build a source-only small-ball visual board; never touch plugin/lib. */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
await build({ entryPoints: [resolve(root, 'tools/small-ball-preview.tsx')], bundle: true, outfile: resolve(root, 'preview/small-ball-family.js'), format: 'iife', platform: 'browser', target: 'chrome120', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, charset: 'utf8' })
writeFileSync(resolve(root, 'preview/small-ball-family.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>共用小球源码预览</title><style>body{margin:0;font-family:"Microsoft YaHei","Segoe UI",sans-serif;background:#f5f6fa;color:#252a34}main{max-width:1050px;margin:auto;padding:23px 26px 35px}h1{font-size:23px;margin:0 0 8px}p{font-size:13px;color:#5d6475;margin:0 0 18px}section{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px}figure{min-width:0;margin:0;background:white;border:1px solid #dce1e9;border-radius:12px;display:flex;align-items:center;flex-direction:column;padding:8px 0 12px}figure svg{display:block}figcaption{font-size:14px;font-weight:600;margin-top:-4px}</style></head><body><div id="root"></div><script src="./small-ball-family.js"></script></body></html>`, 'utf8')
console.log('built preview/small-ball-family.html')

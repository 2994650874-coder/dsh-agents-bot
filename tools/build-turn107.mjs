#!/usr/bin/env node
/**
 * 第 107 轮看板：上传（一左一右飞入 + 平稳吸收）与庆祝（保持一发）。
 *
 * ── 为什么不复用 `build-anim-board.mjs` 生成的页面 ─────────────────────
 * 那个页面把 23 个状态全排开，一次看不过来，而且这一轮只动了两个状态。
 * 这里只取需要看的那两个，按时间铺开 —— 用户要判断的是「动作对不对」，
 * 不是「一共有几个动画」。
 *
 * ── 为什么按时间铺开而不是「挑几张好看的」────────────────────────────
 * 手册 §2.3：看板的作用是让人判断节奏。只给「关键时刻」的图会掩盖中间
 * 发生了什么 —— 而这一轮的 bug（半径来回反弹）恰恰藏在中间。
 *
 * 产物：preview/turn107.html（**本轮新建**，不是历史看板重建）
 */
import { build } from 'esbuild'
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PLUGIN = resolve(ROOT, 'plugin')

const ENTRY = `
import { BotEngine } from './src/bot/engine'
import { STATE_BY_ID } from './src/bot/states'
export { BotEngine, STATE_BY_ID }
`

const r = await build({
  stdin: { contents: ENTRY, resolveDir: PLUGIN, sourcefile: 'b107.ts', loader: 'ts' },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'B',
  platform: 'browser',
  target: 'chrome110',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
  minify: true
})

const js = r.outputFiles[0].text

const HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>第 107 轮 · 上传与庆祝</title>
<style>
  html,body{margin:0;background:#f3efe6;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  h1{font-size:15px;margin:16px 14px 4px}
  .sub{font-size:11.5px;color:#777;margin:0 14px 12px}
  h2{font-size:13px;margin:18px 14px 6px;color:#444}
  .row{display:flex;gap:6px;padding:0 14px 6px;flex-wrap:wrap}
  .cell{background:#fff;border:1px solid #e0dbd0;border-radius:8px;padding:4px;text-align:center;flex:0 0 auto}
  .cell svg{display:block;background:#f3efe6;border-radius:5px}
  .t{font-size:9.5px;color:#999;margin-top:2px;font-variant-numeric:tabular-nums}
</style></head>
<body>
<h1>第 107 轮 · 上传 / 庆祝</h1>
<p class="sub">上传：两颗球一左一右飞入，环绕后平稳滑入小球。庆祝：保持一发（按你的要求先看看）。</p>
<div id="out"></div>
<script>${js}</script>
<script>
const R = 114.2705
const SIZE = 118

function frame(engine, state, t) {
  const f = engine.sample(t)
  let inner = ''

  // 弧（彗星带）
  if (f.arcs && f.arcs.length) {
    for (const a of f.arcs) {
      const oc = Math.max(0, Math.min(1, a.opacity ?? 1))
      if (oc <= 0.01) continue
      inner += '<path d="' + a.d + '" fill="none" stroke="#2b2b2b" stroke-width="' +
        (a.width ?? 1) + '" opacity="' + oc + '"/>'
    }
  }
  // 环
  if (f.rings && f.rings.length) {
    for (const g of f.rings) {
      const oc = Math.max(0, Math.min(1, g.opacity ?? 1))
      if (oc <= 0.01) continue
      inner += '<circle cx="' + (g.cx ?? 0) + '" cy="' + (g.cy ?? 0) + '" r="' + g.r +
        '" fill="none" stroke="#2b2b2b" stroke-width="' + g.width + '" opacity="' + oc + '"/>'
    }
  }
  // 身体
  if (f.bodyPath) inner += '<path d="' + f.bodyPath + '" fill="#0a0a0c"/>'
  // 眼睛
  if (f.eyes) {
    for (const e of f.eyes) {
      inner += '<ellipse cx="' + (e.cx ?? 0) + '" cy="' + (e.cy ?? 0) + '" rx="' + e.rx +
        '" ry="' + e.ry + '" fill="#fff" transform="matrix(' + (e.matrix ?? '1,0,0,1,0,0') + ')"/>'
    }
  }
  // 点（彩球 / 烟花 / 环绕点）
  if (f.dots && f.dots.length) {
    for (const d of f.dots) {
      const oc = Math.max(0, Math.min(1, d.opacity ?? 1))
      if (oc <= 0.01 || d.r <= 0) continue
      inner += '<circle cx="' + d.x + '" cy="' + d.y + '" r="' + d.r + '" fill="' +
        (d.color || '#2b2b2b') + '" opacity="' + oc + '"/>'
    }
  }

  return '<svg width="' + SIZE + '" height="' + SIZE + '" viewBox="-158 -158 316 316">' + inner + '</svg>'
}

const out = document.getElementById('out')

function board(title, state, times) {
  const h = document.createElement('h2')
  h.textContent = title
  out.appendChild(h)
  const row = document.createElement('div')
  row.className = 'row'
  const eng = new B.BotEngine(R, state, null, null)
  for (const t of times) {
    const cell = document.createElement('div')
    cell.className = 'cell'
    cell.innerHTML = frame(eng, state, t) + '<div class="t">' + t.toFixed(2) + ' s</div>'
    row.appendChild(cell)
  }
  out.appendChild(row)
}

// 上传：起飞（0.2）→ 到达轨道（1.1）→ 环绕（1.5/2.0）→ 吸收（2.4/2.7/2.9）
board('上传 · 起飞是一左一右', 'uploading', [0.21, 0.45, 0.7, 1.1])
board('上传 · 环绕与平稳吸收', 'uploading', [1.4, 1.8, 2.2, 2.5, 2.7, 2.85, 2.98])

// 庆祝：一发，看展开到散尽
board('庆祝 · 一发（2.9 s）', 'celebrate', [0.15, 0.4, 0.7, 1.1, 1.5, 1.9, 2.3, 2.7])
</script>
</body></html>`

writeFileSync(resolve(ROOT, 'preview', 'turn107.html'), HTML, 'utf8')
console.log('built preview/turn107.html')

#!/usr/bin/env node
/**
 * 第 87 轮改动看板：把四个改过的动画按时间铺开成一串真实帧。
 *
 * ── 为什么是「时间串」而不是前后对照 ──────────────────────────────────
 * 我是从旧参数推不出改前画面的 —— 旧常量已经被替换掉了，任何「改前」
 * 都只能是伪造。伪造出来的对照图比没有更糟：它会让用户相信一个我没测过的
 * 画面。
 *
 * 所以这里只画**真实存在的东西**：当前引擎在 t = 0 → duration 的连续采样。
 * 这张图能直接回答用户的问题：
 *   · 烟花散得开不开（看第一行末尾几帧有没有铺到画面边缘）
 *   · 庆祝的球大不大（看第二行，和第六行的 orbit 比）
 *   · 微粒有没有颜色（看第三行，是不是五彩）
 *   · 检索是不是小球 + 彩色光线（看第四行）
 *   · 动画会不会持续（整条时间轴都有内容，末尾回到开头）
 *
 * 产物：preview/turn87.html
 * 用法：node tools/build-turn87.mjs
 */
import { build } from 'esbuild'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const PLUGIN = resolve(ROOT, 'plugin')
const OUT = resolve(ROOT, 'preview')

const ENTRY = `
import { BotEngine } from './src/bot/engine'
import { STATE_BY_ID } from './src/bot/states'
export { BotEngine, STATE_BY_ID }
`

const r = await build({
  stdin: { contents: ENTRY, resolveDir: PLUGIN, sourcefile: 't87.ts', loader: 'ts' },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'T87',
  platform: 'browser',
  target: 'chrome110',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
  minify: true
})

const js = r.outputFiles[0].text

const ROWS = [
  { id: 'waking', title: '苏醒', sub: '烟花要散到画面边缘（改前封顶 1.22 半径，只跑 0.22）' },
  { id: 'celebrate', title: '庆祝', sub: '小球 + 连发烟花（改前是满尺寸球在转）' },
  { id: 'loading', title: '加载', sub: '彩色流动微粒（改前漏了 color 字段，是单色墨环）' },
  { id: 'search', title: '检索', sub: '小球 + 彩色光线注入（改前是满尺寸摆动 + 偶发白点）' },
  { id: 'orbit', title: '环绕', sub: '参照：0.166 半径的小球，celebrate / search 现在和它同尺寸' },
  { id: 'radar', title: '雷达', sub: '参照：同上' }
]

/** 每行铺几帧。8 帧足够看清「一圈」的起承转合。 */
const FRAMES = 8

const HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>第 87 轮改动 · 逐帧</title>
<style>
  html,body{margin:0;background:#efece4;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  h1{font-size:15.5px;margin:0;padding:14px 18px 2px;color:#222}
  .sub{font-size:11.5px;color:#777;padding:0 18px 14px}
  .row{background:#fff;border:1px solid #ddd8cc;border-radius:11px;margin:0 18px 11px;padding:9px 11px 7px}
  .hd{font-size:12.5px;font-weight:700;color:#222}
  .hd .en{font-weight:400;color:#aaa;font-size:10.5px;margin-left:5px}
  .nt{font-size:10.5px;color:#8a8578;margin:1px 0 5px}
  .strip{display:flex;gap:3px;align-items:flex-start}
  .fr{text-align:center;flex:1;min-width:0}
  .fr svg{display:block;margin:0 auto;background:#fff;border-radius:6px}
  .fr .t{font-size:9px;color:#aaa;margin-top:1px;font-variant-numeric:tabular-nums}
</style></head>
<body>
<h1>第 87 轮 · 四个改过的动画，按时间铺开</h1>
<div class="sub">每格是引擎在那一刻的真实一帧（同一渲染器、无后期）。时间轴走完一圈会自己回到开头 —— 这就是第 5 条 / 循环播放。</div>
<div id="rows"></div>
<script>${js}</script>
<script>
const VB = 158, R = 100, FRAMES = ${FRAMES}
const ROWS = ${JSON.stringify(ROWS)}
const host = document.getElementById('rows')

function draw(el, f) {
  const ink = '#111'
  let s = ''
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) s += '<path d="'+a.back+'" stroke="url(#g'+a.id+')" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
  s += '</g>'
  s += '<path d="'+f.bodyPath+'" fill="'+ink+'" opacity="'+f.bodyAlpha+'"/>'
  for (const e of f.eyes) s += '<path d="'+e.d+'" transform="'+e.matrix+'" fill="#fff" opacity="'+e.alpha+'"/>'
  for (const d of f.dots) {
    if (d.d) s += '<path d="'+d.d+'" transform="translate('+d.x+' '+d.y+') rotate('+(d.rot||0)+') scale('+R+')" fill="'+(d.color||ink)+'" opacity="'+d.opacity+'"/>'
    else s += '<circle cx="'+d.x+'" cy="'+d.y+'" r="'+d.r+'" fill="'+(d.color||ink)+'" opacity="'+d.opacity+'"/>'
  }
  s += '<g fill="none" stroke-linecap="round">'
  for (const rg of f.rings) {
    const rr = rg.r, cx = rg.cx||0, cy = rg.cy||0
    let d = ''
    if (rg.sweep >= 0.999) {
      d = 'M'+(cx-rr)+' '+cy+'A'+rr+' '+rr+' 0 1 1 '+(cx+rr)+' '+cy+'A'+rr+' '+rr+' 0 1 1 '+(cx-rr)+' '+cy
    } else {
      const a0 = rg.from*Math.PI*2 - Math.PI/2, a1 = (rg.from+rg.sweep)*Math.PI*2 - Math.PI/2
      d = 'M'+(cx+Math.cos(a0)*rr)+' '+(cy+Math.sin(a0)*rr)+'A'+rr+' '+rr+' 0 '+(rg.sweep>0.5?1:0)+' 1 '+(cx+Math.cos(a1)*rr)+' '+(cy+Math.sin(a1)*rr)
    }
    s += '<path d="'+d+'" stroke="'+(rg.color||ink)+'" stroke-width="'+rg.width+'" opacity="'+rg.opacity+'"/>'
  }
  s += '</g>'
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) s += '<path d="'+a.front+'" stroke="url(#g'+a.id+')" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
  s += '</g>'
  let defs = '<defs>'
  for (const a of f.arcs) {
    defs += '<linearGradient id="g'+a.id+'" gradientUnits="userSpaceOnUse" x1="'+a.grad.x1+'" y1="'+a.grad.y1+'" x2="'+a.grad.x2+'" y2="'+a.grad.y2+'">'
    a.grad.stops.forEach((c,i)=>{ defs += '<stop offset="'+(i/(a.grad.stops.length-1))+'" stop-color="'+c+'"/>' })
    defs += '</linearGradient>'
  }
  defs += '</defs>'
  el.innerHTML = defs + s
}

for (const row of ROWS) {
  const def = T87.STATE_BY_ID.get(row.id)
  const box = document.createElement('div'); box.className = 'row'
  box.innerHTML = '<div class="hd">'+row.title+'<span class="en">'+row.id+'</span></div><div class="nt">'+row.sub+'</div>'
  const strip = document.createElement('div'); strip.className = 'strip'
  box.appendChild(strip)

  for (let k = 0; k < FRAMES; k++) {
    /*
     * 采样点从 0 均匀铺到 duration（不含末端，否则最后一帧就是收尾空壳）。
     * 引擎是时间的纯函数，所以每一个都是确定可复现的。
     */
    const t = (def.duration / FRAMES) * k
    const cell = document.createElement('div'); cell.className = 'fr'
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg')
    svg.setAttribute('viewBox', (-VB)+' '+(-VB)+' '+(VB*2)+' '+(VB*2))
    svg.setAttribute('width','118'); svg.setAttribute('height','118')
    cell.appendChild(svg)
    const lab = document.createElement('div'); lab.className='t'; lab.textContent = t.toFixed(2)+'s'
    cell.appendChild(lab)
    strip.appendChild(cell)

    const e = new T87.BotEngine(R, row.id, null, null)
    draw(svg, e.sample(t))
  }
  host.appendChild(box)
}
window.__ready = true
</script></body></html>`

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'turn87.html'), HTML, 'utf8')
console.log('built preview/turn87.html  ' + (HTML.length / 1024).toFixed(1) + ' KB')

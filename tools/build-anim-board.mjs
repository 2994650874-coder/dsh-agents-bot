#!/usr/bin/env node
/**
 * 建一个「我们的新动画」看板页：一个 HTML，把所有状态并排播放。
 *
 * 为什么不复用 preview/index.html：那个页面挂的是 AvatarPanel，要经过
 * 面板状态、轮播、CSS 一堆东西，截图容易截到空态。这里只要引擎本身，
 * 一页看完，所见即引擎。
 *
 * 产物：preview/anim-board.html
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
import { STATES, POSES } from './src/bot/states'
import { STYLE } from './src/client/style'
export { BotEngine, STATES, POSES, STYLE }
`

const r = await build({
  stdin: { contents: ENTRY, resolveDir: PLUGIN, sourcefile: 'board-entry.ts', loader: 'ts' },
  bundle: true, write: false, format: 'iife', globalName: 'BOARD',
  platform: 'browser', target: 'chrome110', logLevel: 'warning',
  legalComments: 'none', charset: 'utf8', minify: true
})

const js = r.outputFiles[0].text

const HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>我们的动画看板</title>
<style>
  html,body{margin:0;background:#f3efe6;font-family:-apple-system,"Segoe UI",sans-serif}
  #grid{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;padding:14px}
  .cell{background:#fff;border:1px solid #e0dbd0;border-radius:10px;padding:8px;text-align:center}
  .cell .nm{font-size:12px;color:#333;margin-top:4px;font-weight:600}
  .cell .en{font-size:10px;color:#999}
  .cell svg{display:block;margin:0 auto;background:#f3efe6;border-radius:6px}
</style></head>
<body><div id="grid"></div>
<script>${js}</script>
<script>
const VB = 158, R = 100
const grid = document.getElementById('grid')
const cells = []
const WANT = BOARD.STATES.map(s => s.id).filter(id => id !== 'hexagon')
const LABEL = ${JSON.stringify({
  idle:'空闲', thinking:'思考', wink:'眨眼', wide:'等待', alert:'出错',
  notify:'完成', exclaim:'惊叹', bounce:'弹跳', egg:'蛋', play:'写文件',
  search:'检索', orbit:'环绕', radar:'雷达', progress:'进度',
  celebrate:'庆祝', loading:'加载', humming:'低吟', waking:'苏醒',
  sleeping:'睡眠', sending:'发送', receiving:'接收', uploading:'上传',
  burst:'爆发', comet:'跑命令'
})}

for (const id of WANT) {
  const cell = document.createElement('div')
  cell.className = 'cell'
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg')
  svg.setAttribute('viewBox', (-VB)+' '+(-VB)+' '+(VB*2)+' '+(VB*2))
  svg.setAttribute('width','150'); svg.setAttribute('height','150')
  cell.appendChild(svg)
  const nm = document.createElement('div'); nm.className='nm'; nm.textContent = LABEL[id] || id
  const en = document.createElement('div'); en.className='en'; en.textContent = id
  cell.appendChild(nm); cell.appendChild(en)
  grid.appendChild(cell)
  const e = new BOARD.BotEngine(R, id, null, null)
  cells.push({ id, svg, e, t0: performance.now() })
}

function draw(cell, t) {
  const f = cell.e.sample(t)
  const ink = '#111'
  let s = ''
  // 弧的后半
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) {
    s += '<path d="'+a.back+'" stroke="url(#g'+a.id+')" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
  }
  s += '</g>'
  // 身体（用墨色直接填，眼睛用背景色挖出来）
  s += '<path d="'+f.bodyPath+'" fill="'+ink+'" opacity="'+f.bodyAlpha+'"/>'
  // 眼睛：用纸色画回去
  for (const e of f.eyes) {
    s += '<path d="'+e.d+'" transform="'+e.matrix+'" fill="#f3efe6" opacity="'+e.alpha+'"/>'
  }
  // 点
  for (const d of f.dots) {
    if (d.d) s += '<path d="'+d.d+'" transform="translate('+d.x+' '+d.y+') rotate('+(d.rot||0)+') scale('+R+')" fill="'+(d.color||ink)+'" opacity="'+d.opacity+'"/>'
    else s += '<circle cx="'+d.x+'" cy="'+d.y+'" r="'+d.r+'" fill="'+(d.color||ink)+'" opacity="'+d.opacity+'"/>'
  }
  // 环
  s += '<g fill="none" stroke-linecap="round">'
  for (const rg of f.rings) {
    let d = ''
    const r = rg.r, cx = rg.cx||0, cy = rg.cy||0
    if (rg.sweep >= 0.999) {
      d = 'M'+(cx-r)+' '+cy+'A'+r+' '+r+' 0 1 1 '+(cx+r)+' '+cy+'A'+r+' '+r+' 0 1 1 '+(cx-r)+' '+cy
    } else {
      const a0 = rg.from*Math.PI*2 - Math.PI/2, a1 = (rg.from+rg.sweep)*Math.PI*2 - Math.PI/2
      const x0 = cx+Math.cos(a0)*r, y0 = cy+Math.sin(a0)*r
      const x1 = cx+Math.cos(a1)*r, y1 = cy+Math.sin(a1)*r
      d = 'M'+x0+' '+y0+'A'+r+' '+r+' 0 '+(rg.sweep>0.5?1:0)+' 1 '+x1+' '+y1
    }
    s += '<path d="'+d+'" stroke="'+(rg.color||ink)+'" stroke-width="'+rg.width+'" opacity="'+rg.opacity+'"/>'
  }
  s += '</g>'
  // 弧的前半
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) {
    s += '<path d="'+a.front+'" stroke="url(#g'+a.id+')" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
  }
  s += '</g>'
  // 渐变
  let defs = '<defs>'
  for (const a of f.arcs) {
    defs += '<linearGradient id="g'+a.id+'" gradientUnits="userSpaceOnUse" x1="'+a.grad.x1+'" y1="'+a.grad.y1+'" x2="'+a.grad.x2+'" y2="'+a.grad.y2+'">'
    a.grad.stops.forEach((c,i)=>{ defs += '<stop offset="'+(i/(a.grad.stops.length-1))+'" stop-color="'+c+'"/>' })
    defs += '</linearGradient>'
  }
  defs += '</defs>'
  cell.svg.innerHTML = defs + s
}

/*
 * 两种模式：
 *   ?mode=live  —— 真的播放（t 在 [0, duration) 内循环，不越过动画时长）
 *   默认        —— 冻结在 POSES[id]，即「这个动画最可读的那一刻」
 *
 * 默认冻结，是因为看板的用途是「一眼看完所有动画长什么样」，
 * 而且是可复现的：每次截图都是同一张。live 模式留给动态检查。
 *
 * 注意 t 绝不能超过 state 的 duration：progress / loading 这类动画
 * 在结束时会把装饰淡出到 0，越过时长就会截到一个空壳。
 */
const LIVE = new URLSearchParams(location.search).get('mode') === 'live'
const DUR = {}
for (const s of BOARD.STATES) DUR[s.id] = s.duration

function loop() {
  const now = performance.now()
  for (const c of cells) {
    const dur = DUR[c.id] || 2
    const t = LIVE ? ((now - c.t0) / 1000) % dur : Math.min(BOARD.POSES[c.id], dur * 0.98)
    draw(c, t)
  }
  if (LIVE) requestAnimationFrame(loop)
}
loop()
window.__ready = true
</script></body></html>`

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'anim-board.html'), HTML, 'utf8')
console.log('built preview/anim-board.html  ' + (HTML.length/1024).toFixed(1) + ' KB')
#!/usr/bin/env node
/**
 * 第 92 轮改动看板：12 个改过的动画，每个按时间铺成一串真实帧。
 *
 * ── 为什么不能用「打开页面截图」的办法 ────────────────────────────────
 * 我先写的那版就是开 `anim-lab.html`、翻到目标动画、每 N 毫秒截一张。它给出
 * 了一张**假的**看板：`loading` 在 0.7 s 和 0.9 s 两格是空的（只有一个点），
 * 而引擎在那一刻明明有环 —— 差的是浏览器截图延迟和入场 morph 的重叠。
 *
 * 所以改成和 `turn87.mjs` 同一套办法：直接用引擎在 t 处采样、同步画进 SVG。
 * 引擎是时间的纯函数，每个格子都是精确可复现的那一帧，没有任何时钟误差。
 *
 * ── 这一轮为什么要看「过程」而不是单帧 ────────────────────────────────
 * 12 条改动里，超过一半说的是**过程**：结束时怎么收、睁眼分几段、绕几圈再吸。
 * 单帧看不出来，连起来才看得出来。
 *
 * 用法：node tools/build-turn92.mjs
 * 产物：preview/turn92.html
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
  stdin: { contents: ENTRY, resolveDir: PLUGIN, sourcefile: 't92.ts', loader: 'ts' },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'T92',
  platform: 'browser',
  target: 'chrome110',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
  minify: true
})

const js = r.outputFiles[0].text

/**
 * 每一行 = 一个动画。
 *
 * `frames` 是该铺几帧：短的动画（1,2 s）铺 8 帧就够密，长的（6 s）需要更多
 * 才看得出节奏，但太多会让每格小到看不见。一律取 8，只有极短的取 6。
 */
const ROWS = [
  { id: 'search', title: '① 检索', sub: '线条改成有锥度 + 渐变（不再硬条）；结尾全部吸回，最后一帧 0 条', frames: 8, tail: true },
  { id: 'orbit', title: '② 环绕', sub: '结尾五个点融合进小球（不再渐变消失）', frames: 8 },
  { id: 'radar', title: '③ 雷达', sub: '波纹速度 ×0.8（周期 1.3 → 1.625 s）', frames: 8 },
  { id: 'celebrate', title: '④ 庆祝', sub: '小球本身不转；烟花 ×0.7，总时长 4.2 → 6.0 s', frames: 8 },
  { id: 'loading', title: '⑤ 加载 · 短版 1.2 s', sub: '黑框慢开（42% 时长）；结尾先吸微粒、再收框', frames: 8, tail: true },
  { id: 'loading-long', title: '⑤ 加载 · 长版 3.1 s', sub: '同上，但整段拉长到 2.4 × 1.3', frames: 6, tail: true },
  { id: 'humming', title: '⑥ 低吟', sub: '去掉黑圆框；彩色小球放大（身体 +22%，微粒 ×1.45）', frames: 6 },
  { id: 'waking', title: '⑦ 苏醒', sub: '睁眼分三段；半睁时左右扫视；睁到最大时略微超出再回正', frames: 8 },
  { id: 'sending', title: '⑧ 发送', sub: '珠子与黑框统一尺寸；速度 ×0.8（周期 1.5 → 1.875 s）', frames: 8 },
  { id: 'receiving', title: '⑧ 接收', sub: '同上，方向相反', frames: 8 },
  { id: 'uploading', title: '⑨ 上传', sub: '从画外飘来 → 绕好几圈 → 吸进小球（不再原地淡出）', frames: 8, tail: true },
  { id: 'play', title: '⑪ 写文件', sub: '不再画三角形；跟随身形 + 一条扫过的线 + 专注表情', frames: 8 }
]

const HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>第 92 轮改动 · 逐帧</title>
<style>
  html,body{margin:0;background:#efece4;font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  h1{font-size:15.5px;margin:0;padding:14px 18px 2px;color:#222}
  .sub{font-size:11.5px;color:#777;padding:0 18px 14px;line-height:1.7;max-width:1100px}
  .row{background:#fff;border:1px solid #ddd8cc;border-radius:11px;margin:0 18px 11px;padding:9px 11px 7px}
  .hd{font-size:12.5px;font-weight:700;color:#222}
  .hd .en{font-weight:400;color:#aaa;font-size:10.5px;margin-left:5px}
  .nt{font-size:10.5px;color:#8a8578;margin:1px 0 5px}
  .strip{display:flex;gap:3px;align-items:flex-start}
  .fr{text-align:center;flex:1;min-width:0}
  .fr svg{display:block;margin:0 auto;background:#fff;border-radius:6px}
  .fr .t{font-size:9px;color:#aaa;margin-top:1px;font-variant-numeric:tabular-nums}
  .fr.end .t{color:#c8892a;font-weight:700}
</style></head>
<body>
<h1>第 92 轮 · 12 个改过的动画，按时间铺开</h1>
<div class="sub">每格是引擎在那一刻的真实一帧 —— 不是截图，是同一渲染器按时间采样画出来的，所以每一格都精确可复现。
标橙的时间是收尾那一帧，用来看「结束干不干净」。这一轮大半的改动说的是过程（怎么收、分几段、绕几圈），单帧看不出来，连起来才看得出来。</div>
<div id="rows"></div>
<script>${js}</script>
<script>
const VB = 158, R = 100
const ROWS = ${JSON.stringify(ROWS)}
const host = document.getElementById('rows')

/** 圆环的路径，和产品渲染同一个算法（见 decor.ts 的 ringPath）。 */
function ringD(rr, cx, cy, sweep, from) {
  if (sweep >= 0.999) {
    return 'M'+(cx-rr)+' '+cy+'A'+rr+' '+rr+' 0 1 1 '+(cx+rr)+' '+cy+'A'+rr+' '+rr+' 0 1 1 '+(cx-rr)+' '+cy
  }
  const a0 = from*Math.PI*2 - Math.PI/2, a1 = (from+sweep)*Math.PI*2 - Math.PI/2
  return 'M'+(cx+Math.cos(a0)*rr)+' '+(cy+Math.sin(a0)*rr)+
    'A'+rr+' '+rr+' 0 '+(sweep>0.5?1:0)+' 1 '+(cx+Math.cos(a1)*rr)+' '+(cy+Math.sin(a1)*rr)
}

let gid = 0
function draw(el, f) {
  const ink = '#111'
  const defs = []
  let s = ''

  /* 弧的后半（被身体遮住） */
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) {
    defs.push('<linearGradient id="gx'+(gid++)+'" gradientUnits="userSpaceOnUse" x1="'+a.grad.x1+'" y1="'+a.grad.y1+'" x2="'+a.grad.x2+'" y2="'+a.grad.y2+'">'
      + a.grad.stops.map((c,i)=>'<stop offset="'+(i/(a.grad.stops.length-1))+' " stop-color="'+c+'"/>').join('') + '</linearGradient>')
    const g = 'url(#gx'+(gid-1)+')'
    s += '<path d="'+a.back+'" stroke="'+g+'" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
    a.__g = g
  }
  s += '</g>'

  /* 身体 */
  s += '<path d="'+f.bodyPath+'" fill="'+ink+'" opacity="'+f.bodyAlpha+'"/>'

  /* 眼睛（白色，代表 mask 挖出来的洞） */
  for (const e of f.eyes) s += '<path d="'+e.d+'" transform="'+e.matrix+'" fill="#fff" opacity="'+e.alpha+'"/>'

  /* 粒子：有 grad 的走渐变，和产品一致 */
  for (const d of f.dots) {
    let fill = d.color || ink
    if (d.grad) {
      const id = 'dg'+(gid++)
      defs.push('<linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="0">'
        + d.grad.map((c,i)=>'<stop offset="'+(i/(d.grad.length-1))+' " stop-color="'+c+'"/>').join('') + '</linearGradient>')
      fill = 'url(#'+id+')'
    }
    if (d.d) s += '<path d="'+d.d+'" transform="translate('+d.x+' '+d.y+') rotate('+(d.rot||0)+') scale('+R+')" fill="'+fill+'" opacity="'+d.opacity+'"/>'
    else s += '<circle cx="'+d.x+'" cy="'+d.y+'" r="'+d.r+'" fill="'+fill+'" opacity="'+d.opacity+'"/>'
  }

  /* 环 */
  s += '<g fill="none" stroke-linecap="round">'
  for (const rg of f.rings) {
    s += '<path d="'+ringD(rg.r, rg.cx||0, rg.cy||0, rg.sweep, rg.from)+'" stroke="'+(rg.color||ink)+'" stroke-width="'+rg.width+'" opacity="'+rg.opacity+'"/>'
  }
  s += '</g>'

  /* 弧的前半 */
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) s += '<path d="'+a.front+'" stroke="'+a.__g+'" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
  s += '</g>'

  el.innerHTML = '<defs>'+defs.join('')+'</defs>' + s
}

for (const row of ROWS) {
  const def = T92.STATE_BY_ID.get(row.id)
  const box = document.createElement('div'); box.className = 'row'
  box.innerHTML = '<div class="hd">'+row.title+'<span class="en">'+row.id+' · '+def.duration.toFixed(2)+' s</span></div><div class="nt">'+row.sub+'</div>'
  const strip = document.createElement('div'); strip.className = 'strip'
  box.appendChild(strip)

  const n = row.frames
  for (let k = 0; k < n; k++) {
    /*
     * 采样点从 0 铺到 duration，最后一格**落在 duration 上**（不是
     * duration - step）：这一轮最要紧的判据就是「收尾那一帧还剩什么」，
     * 少采那一格等于把要验的东西跳过去。
     */
    const t = (def.duration / (n - 1)) * k
    const cell = document.createElement('div')
    cell.className = 'fr' + (k === n - 1 ? ' end' : '')
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg')
    svg.setAttribute('viewBox', (-VB)+' '+(-VB)+' '+(VB*2)+' '+(VB*2))
    svg.setAttribute('width','118'); svg.setAttribute('height','118')
    cell.appendChild(svg)
    const lab = document.createElement('div'); lab.className='t'; lab.textContent = t.toFixed(2)+'s'
    cell.appendChild(lab)
    strip.appendChild(cell)

    const e = new T92.BotEngine(R, row.id, null, null)
    draw(svg, e.sample(t))
  }
  host.appendChild(box)
}
window.__ready = true
</script></body></html>`

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'turn92.html'), HTML, 'utf8')
console.log('built preview/turn92.html  ' + (HTML.length / 1024).toFixed(1) + ' KB')

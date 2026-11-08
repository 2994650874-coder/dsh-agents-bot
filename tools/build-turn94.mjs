#!/usr/bin/env node
/**
 * 绗?95 杞敼鍔ㄧ湅鏉匡細6 涓敼杩囩殑鍔ㄧ敾锛屾瘡涓寜鏃堕棿閾烘垚涓€涓茬湡瀹炲抚銆?
 *
 * 鈹€鈹€ 涓轰粈涔堜笉鑳界敤銆屾墦寮€椤甸潰鎴浘銆嶁攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
 * 绗?92 杞俯杩囪繖涓潙锛氭埅鍥炬湁寤惰繜锛屽拰鍏ュ満 morph 涓€鍙狅紝`loading` 鍦?0.7 s 閭ｆ牸
 * 鎷嶆垚浜嗙┖鐨勶紝鑰屽紩鎿庨偅涓€鍒绘槑鏄庢湁鐜?鈥斺€?涓€寮犵湅璧锋潵涓撲笟銆佸唴瀹瑰畬鍏ㄩ敊鐨勫浘銆?
 * 杩欓噷鍜?`build-turn92.mjs` 鍚屼竴濂楀姙娉曪細鐩存帴鍦?t 澶勮皟寮曟搸閲囨牱銆佸悓姝ョ敾杩?SVG銆?
 * 寮曟搸鏄椂闂寸殑绾嚱鏁帮紝姣忎竴鏍奸兘鏄簿纭彲澶嶇幇鐨勯偅涓€甯с€?
 *
 * 鈹€鈹€ 杩欎竴杞负浠€涔堝繀椤婚摵銆岃繃绋嬨€嶁攢鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
 * 浜旀潯閲屾湁鍥涙潯璇寸殑鏄繍鍔ㄦ湰韬細绾挎€庝箞婊戣繘鏉ャ€佺粨灏炬€庝箞鍚搞€佹棆杞€熷害銆佽儢鐦︺€?
 * 浠讳綍鍗曞抚閮界瓟涓嶄簡锛屽彧鏈夎繛璧锋潵鎵嶇瓟寰椾簡銆?
 *
 * 鐢ㄦ硶锛歯ode tools/build-turn94.mjs
 * 浜х墿锛歱review/turn94.html
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
import { SHAPE_BY_ID } from './src/bot/skins'
export { BotEngine, STATE_BY_ID, SHAPE_BY_ID }
`

const r = await build({
  stdin: { contents: ENTRY, resolveDir: PLUGIN, sourcefile: 't94.ts', loader: 'ts' },
  bundle: true,
  write: false,
  format: 'iife',
  globalName: 'T94',
  platform: 'browser',
  target: 'chrome110',
  logLevel: 'warning',
  legalComments: 'none',
  charset: 'utf8',
  minify: true
})

const js = r.outputFiles[0].text

/**
 * 姣忎竴琛?= 涓€涓敼鍔ㄧ殑鍔ㄧ敾銆?
 *
 * `frames` 鏄寜鏃堕棿閾哄嚑鏍笺€傝鍒欙細鑳芥暣闄ゅ嚭銆屽叧閿妭鐐广€嶇殑閭ｄ釜鏁般€?
 * `focus` 鏄繖涓€琛岃鍥炵瓟鐨勯棶棰橈紝鍐欏湪鏍囬涓嬮潰 鈥斺€?鐪嬫澘鐨勪綔鐢ㄦ槸鍥炵瓟闂锛?
 * 不是摆一排好看的小图。
 */
const ROWS = [
  {
    id: 'waking',
    title: '① 苏醒',
    sub: '跟随身形：整排都是拱门轮廓 —— 睁眼、烟花、收尾全不变，只有轮廓跟着用户选的形状走',
    frames: 7,
    shape: 'arche'
  },
  {
    id: 'sleeping',
    title: '② 睡眠',
    sub: '跟随身形：同样是拱门 —— 下陷、呼吸、闭眼全部保留',
    frames: 6,
    shape: 'arche'
  },
  {
    id: 'search',
    title: '③ 检索（原名「低吟」）',
    sub: '这个动画本身没改，只是换了名字并挪到「眨眼」后面；放这里确认它还是原来那套彩线绕圈',
    frames: 9
  }
]



const HTML = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>第 100 轮改动 · 逐帧</title>
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
<h1>第 100 轮 · 改名 + 跟随身形</h1>
<div class="sub">每格是引擎在那一刻的真实一帧 —— 不是截图，是同一渲染器按时间采样画出来的，所以每一格都精确可复现。标橙的时间是收尾那一帧，用来看「收得干不干净」。</div>
<div class="nt" style="padding:0 18px 12px;font-size:11px;color:#8a8578">上一轮那三条改动的结论已经合并进这一页：检索（原低吟）保留原样、加载彩球全程不透明、上传吸收慢一半。这一页只放本轮真正动过的两件事。</div>
<div id="rows"></div>
<script>${js}</script>
<script>
const VB = 158, R = 100
const ROWS = ${JSON.stringify(ROWS)}
const host = document.getElementById('rows')
const HTMLNS = 'http://www.w3.org/2000/svg'

/** 鍦嗙幆鐨勮矾寰勶紝鍜屼骇鍝佹覆鏌撳悓涓€涓畻娉曪紙瑙?decor.ts 鐨?ringPath锛夈€?*/
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

  /* 鈹€鈹€ 鈶?寮х殑鍚庡崐锛堝厛鐢伙紝琚韩浣撻伄浣忥級鈹€鈹€ */
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) {
    defs.push('<linearGradient id="gx'+(gid++)+'" gradientUnits="userSpaceOnUse" x1="'+a.grad.x1+'" y1="'+a.grad.y1+'" x2="'+a.grad.x2+'" y2="'+a.grad.y2+'">'
      + a.grad.stops.map((c,i)=>'<stop offset="'+(i/(a.grad.stops.length-1))+' " stop-color="'+c+'"/>').join('') + '</linearGradient>')
    const g = 'url(#gx'+(gid-1)+')'
    s += '<path d="'+a.back+'" stroke="'+g+'" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
    a.__g = g
  }
  s += '</g>'

  /* 鈹€鈹€ 鈶?甯﹀瓙鐨勫悗鍗婏紙鍚屾牱琚韩浣撴尅浣忥紝杩欏氨鏄€岀粫鍒扮悆鍚庨潰銆嶇殑鏉ユ簮锛夆攢鈹€ */
  for (const rb of (f.ribbons || [])) {
    /*
     * 鈹€鈹€ Pourquoi on cree le gradient ICI et pas au moment de peindre 鈹€鈹€鈹€鈹€鈹€
     * Defaut trouve a la mesure (2026-10-31) : la version precedente ne creait
     * le degrade que dans cette boucle, ET seulement si 'rb.back' etait non
     * vide. Or une trainee de 'search' a TOUJOURS 'back' vide : elle est plate
     * (z = 0 partout, cf. 'rayRibbons'), donc entierement devant. Resultat :
     * aucun degrade n'etait cree, 'rb.__g' restait indefini, et la boucle 7
     * sautait le ruban 鈥?les sept rayons etaient dessines nulle part. La planche
     * montrait une rangee de 'search' totalement vide alors que l'engine en
     * produisait sept par image.
     *
     * Le degrade appartient au RUBAN, pas a l'un de ses morceaux : on le cree des
     * qu'il y a quelque chose a peindre, puis on peint 'back' et 'front'
     * separement avec la meme reference.
     */
    if (!rb.back && !rb.front) continue
    const id = 'rg'+(gid++)
    defs.push('<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+rb.grad.x1+'" y1="'+rb.grad.y1+'" x2="'+rb.grad.x2+'" y2="'+rb.grad.y2+'">'
      + rb.grad.stops.map((c,i)=>'<stop offset="'+(i/(rb.grad.stops.length-1))+' " stop-color="'+c+'"/>').join('') + '</linearGradient>')
    rb.__g = 'url(#'+id+')'
    if (rb.back) s += '<path d="'+rb.back+'" fill="'+rb.__g+'" opacity="'+rb.opacity+'"/>'
  }

  /* 鈹€鈹€ 鈶?韬綋鍚庨潰閭ｅ眰绮掑瓙锛堟绱㈢殑褰╃嚎鍦ㄨ繖閲岋紝鎵€浠ヤ細琚皬鐞冩埅鏂級鈹€鈹€ */
  function dotsMarkup() {
    let o = ''
    for (const d of f.dots) {
      let fill = d.color || ink
      if (d.grad) {
        const id = 'dg'+(gid++)
        defs.push('<linearGradient id="'+id+'" x1="0" y1="0" x2="1" y2="0">'
          + d.grad.map((c,i)=>'<stop offset="'+(i/(d.grad.length-1))+' " stop-color="'+c+'"/>').join('') + '</linearGradient>')
        fill = 'url(#'+id+')'
      }
      if (d.d) o += '<path d="'+d.d+'" transform="translate('+d.x+' '+d.y+') rotate('+(d.rot||0)+') scale('+R+')" fill="'+fill+'" opacity="'+d.opacity+'"/>'
      else o += '<circle cx="'+d.x+'" cy="'+d.y+'" r="'+d.r+'" fill="'+fill+'" opacity="'+d.opacity+'"/>'
    }
    return o
  }
  if (f.dotsBehind) s += '<g>'+dotsMarkup()+'</g>'

  /* 鈹€鈹€ 鈶?韬綋锛氬厛鐢ㄧ焊鑹查摵涓€灞傚悓褰㈢姸锛堝牭浣忕溂鐫涚殑娲烇級锛屽啀涓婂ⅷ 鈹€鈹€ */
  s += '<path d="'+f.bodyPath+'" fill="#fff" opacity="'+f.bodyAlpha+'"/>'
  s += '<path d="'+f.bodyPath+'" fill="'+ink+'" opacity="'+f.bodyAlpha+'"/>'
  for (const e of f.eyes) s += '<path d="'+e.d+'" transform="'+e.matrix+'" fill="#fff" opacity="'+e.alpha+'"/>'

  /* 鈹€鈹€ 鈶?韬綋鍓嶉潰閭ｅ眰绮掑瓙 鈹€鈹€ */
  if (!f.dotsBehind) s += '<g>'+dotsMarkup()+'</g>'

  /* 鈹€鈹€ 鈶?鐜紙闆疯揪銆侀粦妗嗐€佽繘搴︼級鈹€鈹€ */
  s += '<g fill="none" stroke-linecap="round">'
  for (const rg of f.rings) {
    s += '<path d="'+ringD(rg.r, rg.cx||0, rg.cy||0, rg.sweep, rg.from)+'" stroke="'+(rg.color||ink)+'" stroke-width="'+rg.width+'" opacity="'+rg.opacity+'"/>'
  }
  s += '</g>'

  /* 鈹€鈹€ 鈶?甯﹀瓙鐨勫墠鍗婏紙鍦ㄨ韩浣撲箣鍚庯紝鎵€浠ヨ繖涓€娈垫槸銆屼粠鐞冨墠闈㈢粡杩囥€嶏級鈹€鈹€ */
  for (const rb of (f.ribbons || [])) {
    if (!rb.front || !rb.__g) continue
    s += '<path d="'+rb.front+'" fill="'+rb.__g+'" opacity="'+rb.opacity+'"/>'
  }

  /* 鈹€鈹€ 鈶?寮х殑鍓嶅崐 鈹€鈹€ */
  s += '<g fill="none" stroke-linecap="round">'
  for (const a of f.arcs) s += '<path d="'+a.front+'" stroke="'+a.__g+'" stroke-width="'+a.width+'" opacity="'+a.opacity+'"/>'
  s += '</g>'

  el.innerHTML = '<defs>'+defs.join('')+'</defs>' + s
}

for (const row of ROWS) {
  const def = T94.STATE_BY_ID.get(row.id)
  const box = document.createElement('div'); box.className = 'row'
  box.innerHTML = '<div class="hd">'+row.title+'<span class="en">'+row.id+' 路 '+def.duration.toFixed(2)+' s</span></div><div class="nt">'+row.sub+'</div>'
  const strip = document.createElement('div'); strip.className = 'strip'
  box.appendChild(strip)

  const n = row.frames
  for (let k = 0; k < n; k++) {
    /*
     * 閲囨牱鐐逛粠 0 閾哄埌 duration锛屾渶鍚庝竴鏍?*钀藉湪 duration 涓?*锛堜笉鏄?
     * duration - step锛夛細鏈€瑕佺揣鐨勫垽鎹槸銆屾敹灏鹃偅涓€甯ц繕鍓╀粈涔堛€嶏紝灏戦噰閭ｄ竴鏍?
     * 绛変簬鎶婅楠岀殑涓滆タ璺宠繃鍘汇€?
     */
    const t = (def.duration / (n - 1)) * k
    const cell = document.createElement('div')
    cell.className = 'fr' + (k === n - 1 ? ' end' : '')
    const svg = document.createElementNS(HTMLNS,'svg')
    svg.setAttribute('viewBox', (-VB)+' '+(-VB)+' '+(VB*2)+' '+(VB*2))
    svg.setAttribute('width','118'); svg.setAttribute('height','118')
    cell.appendChild(svg)
    const lab = document.createElement('div'); lab.className='t'; lab.textContent = t.toFixed(2)+'s'
    cell.appendChild(lab)
    strip.appendChild(cell)

/*
     * 鈹€鈹€ row.shape : une ligne peut demander une FORME pr茅cise 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
     * C'est ce qui rend 芦 璺熼殢鍥惧舰 禄 visible sur une planche fig茅e : deux
     * moteurs identiques, l'un en cercle, l'autre en arche, au m锚me instant.
     * Sans 莽a il faudrait d茅crire le changement en mots, et une planche qui
     * d茅crit au lieu de montrer ne sert 脿 rien.
     */
    const radii = row.shape ? T94.SHAPE_BY_ID.get(row.shape).radii : null
    const e = new T94.BotEngine(R, row.id, radii, null)
    if (radii) e.setShape(radii, 0)
    draw(svg, e.sample(t))
  }
  host.appendChild(box)
}
window.__ready = true
</script></body></html>`

mkdirSync(OUT, { recursive: true })
writeFileSync(resolve(OUT, 'turn94.html'), HTML, 'utf8')
console.log('built preview/turn94.html  ' + (HTML.length / 1024).toFixed(1) + ' KB')


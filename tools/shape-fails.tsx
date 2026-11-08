/**
 * 可疑格放大页：每一行是「可疑身形 + 同状态的圆」，同尺寸并排。
 *
 * 挑的是判据报出来的最可疑几组：
 *   · arche / idle / surpris      （唯一在 idle 就报错的）
 *   · arche / notify / neutre     （notify 系列）
 *   · bouclier / swirl / effraye  （swirl 系列）
 *   · dome / notify / neutre      （多出凹陷）
 *
 * 用法：node tools/build-shape-fails.mjs && node tools/shoot-shape-fails.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'

const CASES = [
  { shape: 'arche', state: 'idle', expr: 'surpris', note: 'idle 就报错，最可疑' },
  { shape: 'arche', state: 'notify', expr: 'neutre', note: 'notify' },
  { shape: 'bouclier', state: 'swirl', expr: 'effraye', note: 'swirl' },
  { shape: 'dome', state: 'notify', expr: 'neutre', note: '多出凹陷' },
  { shape: 'cylindre', state: 'swirl', expr: 'neutre', note: 'swirl' },
  { shape: 'gemme', state: 'swirl', expr: 'neutre', note: 'swirl' },
  { shape: 'cristal', state: 'swirl', expr: 'neutre', note: 'swirl' }
] as const

const SIZE = 120

function Row({ c }: { c: (typeof CASES)[number] }) {
  return (
    <div className="row">
      <div className="meta">
        <b>{c.shape}</b>
        <span>{c.state}</span>
        <span>{c.expr}</span>
        <em>{c.note}</em>
      </div>
      <div className="pair">
        <div className="box">
          <Bot
            state={c.state}
            look={{ shape: c.shape, color: 'encre', expression: c.expr, size: SIZE }}
            frozenAt={1.1}
            paper="#ffffff"
          />
          <span>这个身形</span>
        </div>
        <div className="box">
          <Bot
            state={c.state}
            look={{ shape: 'cercle', color: 'encre', expression: c.expr, size: SIZE }}
            frozenAt={1.1}
            paper="#ffffff"
          />
          <span>圆（对照）</span>
        </div>
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="page">
      <div className="head">
        <b>判据报可疑的格，放大 4 倍</b>
        <span className="hint">
          左边是该身形，右边是同状态同表情的圆做对照。看眼睛是不是被轮廓吃掉了。
        </span>
      </div>
      {CASES.map((c) => (
        <Row key={`${c.shape}-${c.state}-${c.expr}`} c={c} />
      ))}
    </div>
  )
}

const style = document.createElement('style')
style.textContent = `
html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
.page{padding:20px 24px 40px}
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.head b{font-size:14px}
.hint{font-size:11px;color:#8b929e}
.row{display:flex;align-items:center;gap:22px;padding:10px 0;border-top:1px solid #eef0f4}
.meta{width:150px;flex-shrink:0;display:flex;flex-direction:column;gap:2px}
.meta b{font-size:12px;color:#3964fe}
.meta span{font-size:10px;color:#8b929e;font-family:ui-monospace,monospace}
.meta em{font-size:10px;color:#b26a00;font-style:normal;margin-top:3px}
.pair{display:flex;gap:20px}
.box{display:flex;flex-direction:column;align-items:center;gap:3px}
.box span{font-size:9.5px;color:#b0b7c3}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

/**
 * 6 身形 × 5 状态 × 16 表情的全矩阵。
 *
 * 判据：每格数「封闭白洞」必须 = 2（两只眼睛都在轮廓内）。
 *
 * 为什么状态也要全铺：能换身形的状态有 5 个，每个的身体姿态不同
 * （`wink` 会压扁、`wide` 会放大、`notify` 会弹一下），眼睛余量随之变化。
 * 只测 `idle` 会漏掉「某个状态才翻车」的情况。
 *
 * 用法：node tools/build-shape-six.mjs && node tools/probe-shape-six.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { SHAPES } from '../plugin/src/bot/skins'
import { EXPRESSIONS } from '../plugin/src/bot/expressions'

/** 引擎里能换身形的 5 个状态（baseBody=true）。 */
const STATES = ['idle', 'wink', 'wide', 'notify', 'swirl'] as const

const SIZE = 44

function App() {
  const shapes = SHAPES.map((s) => s.id)
  return (
    <div className="page">
      <div className="head">
        <b>{shapes.length} 身形 × {STATES.length} 状态 × {EXPRESSIONS.length} 表情</b>
        <span className="hint">
          判据：每格两只眼睛都必须完整落在轮廓内（数封闭白洞 = 2）
        </span>
      </div>
      {shapes.map((shape) => (
        <section key={shape}>
          <h3>{shape}</h3>
          {STATES.map((state) => (
            <div className="row" key={state}>
              <span className="rowlabel">{state}</span>
              <div className="cells">
                {EXPRESSIONS.map((e) => (
                  <div className="cell" key={e.id} data-shape={shape} data-state={state} data-expr={e.id}>
                    <Bot
                      state={state}
                      look={{ shape, color: 'encre', expression: e.id, size: SIZE }}
                      frozenAt={1.1}
                      paper="#ffffff"
                    />
                    <span className="cap">{e.id}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}

const style = document.createElement('style')
style.textContent = `
html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
.page{padding:18px 22px 40px}
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.head b{font-size:14px}
.hint{font-size:11px;color:#8b929e}
section{margin-bottom:16px;border-top:1px solid #eef0f4;padding-top:8px}
h3{font-size:12px;margin:0 0 6px;color:#3964fe;font-weight:600}
.row{display:flex;align-items:center;gap:8px;margin-bottom:3px}
.rowlabel{width:52px;flex-shrink:0;font-size:10px;color:#8b929e;font-family:ui-monospace,monospace}
.cells{display:flex;gap:3px;flex-wrap:nowrap}
.cell{display:flex;flex-direction:column;align-items:center;width:46px}
.cap{font-size:7px;color:#b0b7c3;font-family:ui-monospace,monospace;line-height:1}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

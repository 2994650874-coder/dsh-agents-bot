/**
 * 用**真实源码**的 14 个身形 × 6 个表情，验眼睛是否完整。
 *
 * 和 `shape-six.tsx` 的区别：那个 import 的是 `preview/_bot6` 注入副本，
 * 这个 import 的是 `plugin/src/bot/skins` —— 真源码。加形状之后必须用它，
 * 否则测的是副本而不是用户会拿到的东西。
 *
 * 用法：node tools/build-real-shapes.mjs && node tools/probe-real-shapes-eyes.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { SHAPES } from '../plugin/src/bot/skins'

/** 挑 6 个表情：4 个最挑眼睛的 + 2 个极端（最宽/最窄的眼形）。 */
const EXPRS = ['neutre', 'surpris', 'effraye', 'colere', 'attentif', 'somnolent']
const SIZE = 44

function App() {
  const shapes = SHAPES.map((s) => s.id)
  return (
    <div className="page">
      <div className="head">
        <b>真源码的 {shapes.length} 个身形 × {EXPRS.length} 个表情</b>
        <span className="hint">判据：每格封闭白洞 = 2（两只眼都在轮廓内）</span>
      </div>
      {shapes.map((shape) => (
        <div className="row" key={shape}>
          <span className="rowlabel">{shape}</span>
          <div className="cells">
            {EXPRS.map((expr) => (
              <div className="cell" key={expr} data-shape={shape} data-expr={expr}>
                <Bot
                  state="idle"
                  look={{ shape, color: 'encre', expression: expr, size: SIZE }}
                  frozenAt={1.1}
                  paper="#ffffff"
                />
                <span>{expr}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

const style = document.createElement('style')
style.textContent = `
html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
.page{padding:18px 22px 36px}
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:14px}
.head b{font-size:14px}
.hint{font-size:11px;color:#8b929e}
.row{display:flex;align-items:center;gap:8px;padding:3px 0;border-top:1px solid #f2f4f7}
.rowlabel{width:70px;flex-shrink:0;font-size:10px;color:#3964fe;font-family:ui-monospace,monospace}
.cells{display:flex;gap:4px}
.cell{display:flex;flex-direction:column;align-items:center;width:46px}
.cell span{font-size:7px;color:#b0b7c3;font-family:ui-monospace,monospace}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)
;(window as never as { __shapes: string[] }).__shapes = shapes

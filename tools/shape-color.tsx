/**
 * 12 配色 × 6 身形。
 *
 * 判据：每格渲染出来的主色 = 该配色声明的 hex（允许 ±6 抗锯齿误差）。
 * 颜色不参与几何，所以这个矩阵只验「颜色真的传下去了」。
 *
 * 用法：node tools/build-shape-color.mjs && node tools/probe-shape-color.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { SHAPES } from '../plugin/src/bot/skins'
import { COLORS } from '../plugin/src/bot/skins'

const PICK = ['bouclier', 'dome', 'arche', 'cylindre', 'gemme', 'cristal']
const SIZE = 56

function App() {
  const shapes = SHAPES.map((s) => s.id).filter((id) => PICK.includes(id))
  return (
    <div className="page">
      <div className="head">
        <b>{COLORS.length} 配色 × {shapes.length} 身形</b>
        <span className="hint">判据：渲染主色 = 声明的 hex</span>
      </div>
      {COLORS.map((c) => (
        <div className="row" key={c.id}>
          <span className="rowlabel">{c.id}</span>
          <code className="hex">{c.hex}</code>
          <div className="cells">
            {shapes.map((shape) => (
              <div className="cell" key={shape} data-shape={shape} data-color={c.id} data-hex={c.hex}>
                <Bot
                  state="idle"
                  look={{ shape, color: c.id, expression: 'neutre', size: SIZE }}
                  frozenAt={1.1}
                  paper="#ffffff"
                />
                <span>{shape}</span>
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
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:12px}
.head b{font-size:14px}
.hint{font-size:11px;color:#8b929e}
.row{display:flex;align-items:center;gap:10px;padding:4px 0;border-top:1px solid #f2f4f7}
.rowlabel{width:74px;flex-shrink:0;font-size:10px;color:#4a5160;font-family:ui-monospace,monospace}
.hex{width:66px;flex-shrink:0;font-size:9px;color:#b0b7c3;font-family:ui-monospace,monospace}
.cells{display:flex;gap:8px}
.cell{display:flex;flex-direction:column;align-items:center;gap:1px;width:58px}
.cell span{font-size:7px;color:#b0b7c3;font-family:ui-monospace,monospace}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

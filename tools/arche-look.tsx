/**
 * arche / goutte / 三角 / 圆 在三个真实尺寸下，表情 surpris。
 *
 * 这三档尺寸都是真实用到的：
 *   30px  = 外观面板里的身形缩略图（AvatarPanel 的 `size: 30`）
 *   96px  = 格子里主 bot 的默认尺寸（DEFAULT_LOOK.size）
 *   200px = 用户把面板拉宽、或截图放大时看到的
 *
 * 用法：node tools/build-arche-look.mjs && node tools/shoot-arche-look.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'

const SHAPES = ['cercle', 'arche', 'goutte', 'triangle', 'cristal', 'cylindre']
const SIZES = [30, 96, 200]

function App() {
  return (
    <div className="page">
      <div className="head">
        <b>surpris（惊讶）下，各身形在三档真实尺寸的样子</b>
        <span className="hint">30 = 外观面板缩略图 · 96 = 格子里主图 · 200 = 放大</span>
      </div>
      {SHAPES.map((shape) => (
        <div className="row" key={shape}>
          <span className="rowlabel">{shape}</span>
          <div className="sizes">
            {SIZES.map((size) => (
              <div className="box" key={size}>
                <Bot
                  state="idle"
                  look={{ shape, color: 'encre', expression: 'surpris', size }}
                  frozenAt={1.1}
                  paper="#ffffff"
                />
                <span>{size}px</span>
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
.page{padding:20px 24px 40px}
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:14px}
.head b{font-size:14px}
.hint{font-size:11px;color:#8b929e}
.row{display:flex;align-items:center;gap:16px;padding:8px 0;border-top:1px solid #eef0f4}
.rowlabel{width:74px;flex-shrink:0;font-size:11px;color:#3964fe;font-family:ui-monospace,monospace}
.sizes{display:flex;align-items:flex-end;gap:26px}
.box{display:flex;flex-direction:column;align-items:center;gap:4px}
.box span{font-size:9px;color:#b0b7c3;font-family:ui-monospace,monospace}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

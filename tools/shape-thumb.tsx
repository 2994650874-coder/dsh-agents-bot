/**
 * 30px 缩略图：现有 8 个 + 点名 6 个，各 4 个表情。
 *
 * 尺寸就是右栏「外观」面板里真实用的 `size: 30`，一格不多一格不少 ——
 * 这个页面要回答的是「用户在实际面板里看不看得清两只眼睛」。
 *
 * 用法：node tools/build-shape-thumb.mjs && node tools/shoot-shape-thumb.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { SHAPES } from '../plugin/src/bot/skins'

const EXPRS = ['neutre', 'surpris', 'effraye', 'colere']
/** 面板里真实用的缩略图尺寸（AvatarPanel 的 `size: 30`）。 */
const THUMB = 30

function App() {
  const shapes = SHAPES.map((s) => s.id)
  return (
    <div className="page">
      <div className="head">
        <b>30px 缩略图（面板里的真实尺寸）× 4 个表情</b>
        <span className="hint">
          判据：两只眼睛在缩略图上还能分辨成两个（数白洞 = 2）
        </span>
      </div>
      {EXPRS.map((expr) => (
        <section key={expr}>
          <h3>{expr}</h3>
          <div className="grid">
            {shapes.map((shape) => (
              <div className="cell" key={shape} data-shape={shape} data-expr={expr}>
                <Bot
                  state="idle"
                  look={{ shape, color: 'encre', expression: expr, size: THUMB }}
                  frozenAt={1.1}
                  paper="#ffffff"
                />
                <span>{shape}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const style = document.createElement('style')
style.textContent = `
html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
.page{padding:20px 24px 40px}
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:14px;flex-wrap:wrap}
.head b{font-size:14px}
.hint{font-size:11px;color:#8b929e}
section{margin-bottom:14px;border-top:1px solid #eef0f4;padding-top:8px}
h3{font-size:11px;margin:0 0 6px;color:#3964fe;font-weight:600}
.grid{display:flex;gap:16px;flex-wrap:wrap}
.cell{display:flex;flex-direction:column;align-items:center;gap:3px;width:34px}
.cell span{font-size:7.5px;color:#b0b7c3;font-family:ui-monospace,monospace}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

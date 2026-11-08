/**
 * 状态检阅板：把引擎的 14 个状态并排渲染，每个取 4 个时刻。
 *
 * 这是验证「引擎搬过来了、每个状态都真的不一样」最直接的证据 ——
 * 不依赖 DSH 外壳，也不依赖数据。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-board.mjs
 *   然后用浏览器打开 preview/board.html
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { DEFAULT_LOOK } from '../plugin/src/client/look'
import { PREVIEW_STATES } from '../plugin/src/client/activities'
import { STYLE } from '../plugin/src/client/style'

const TIMES = [0.35, 0.9, 1.6, 2.4]

function Board() {
  const [size, setSize] = useState(96)
  return (
    <div className="board">
      <div className="board-head">
        <b>引擎状态检阅板</b>
        <span className="hint">每格 = 一个状态 × 四个时刻（t=0.35/0.9/1.6/2.4s）</span>
        <label className="rng">
          尺寸
          <input type="range" min={64} max={150} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
      </div>
      <div className="rows">
        {PREVIEW_STATES.map((s) => (
          <div className="row" key={s.id}>
            <div className="row-name">
              <code>{s.id}</code>
              <span>{s.label}</span>
            </div>
            <div className="row-cells">
              {TIMES.map((t) => (
                <div className="cell" key={t}>
                  <Bot state={s.id} look={{ ...DEFAULT_LOOK, size }} frozenAt={t} paper="#ffffff" />
                  <span className="t">{t}s</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
  .board{padding:24px 28px 60px}
  .board-head{display:flex;align-items:baseline;gap:14px;margin-bottom:18px;flex-wrap:wrap}
  .board-head b{font-size:15px}
  .hint{font-size:11.5px;color:#8b929e}
  .rng{margin-left:auto;font-size:11.5px;color:#8b929e;display:flex;align-items:center;gap:8px}
  .rows{display:flex;flex-direction:column;gap:6px}
  .row{display:flex;align-items:center;gap:18px;padding:8px 0;border-top:1px solid #eef0f4}
  .row-name{width:110px;flex-shrink:0;display:flex;flex-direction:column;gap:2px}
  .row-name code{font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
  .row-name span{font-size:10.5px;color:#8b929e}
  .row-cells{display:flex;gap:14px;align-items:center}
  .cell{display:flex;flex-direction:column;align-items:center;gap:2px}
  .cell .t{font-size:9.5px;color:#b0b7c3;font-family:ui-monospace,monospace}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
  `
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<Board />)

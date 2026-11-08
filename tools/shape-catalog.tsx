/**
 * 新身形检阅页：19 个身形 × 3 个最挑眼睛的表情，并排看。
 *
 * 判据不是「好看」，是**眼睛不能顶出轮廓**。挑的三个表情是眼睛最宽/最偏的：
 * `effraye`（害怕，眼白最大）、`colere`（生气，眼形压扁）、`somnolent`（困倦，
 * 半闭且下移）。历史上 `capsule` + `effraye` 就是在这里翻车的。
 *
 * 用法：node tools/build-shape-catalog.mjs && node tools/shoot-shape-catalog.mjs
 */
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { SHAPE_OPTIONS } from '../plugin/src/client/look'
import { SHAPES } from '../plugin/src/bot/skins'

/**
 * 身形清单**从引擎的 SHAPES 取**，不是从 `look.ts` 的 SHAPE_OPTIONS 取。
 *
 * 因为新注入的 11 个只在引擎里、还没有中文名（`look.ts` 的 SHAPE_LABEL 是
 * 另一张表）。这个检阅页要验的是「引擎画得对不对」，所以以引擎为准；
 * 名字缺失就显示 id —— 那恰恰说明「加身形还要顺手补名字」这件事。
 */
const SHAPES_ALL = SHAPES.map((s) => s.id)
const labelOf = (id: string) => SHAPE_OPTIONS[id] ?? id

const EXPRS = ['effraye', 'colere', 'somnolent'] as const
const SIZES = [30, 64]

function App() {
  const shapes = SHAPES_ALL
  return (
    <div className="page">
      <div className="head">
        <b>{shapes.length} 个身形 × 3 个最挑眼睛的表情</b>
        <span className="hint">
          判定：眼睛不能顶出轮廓、不能压到边。30px 是面板里真实用的尺寸，64px 用来看细节。
        </span>
      </div>
      {EXPRS.map((expr) => (
        <section key={expr}>
          <h3>{expr}</h3>
          <div className="grid">
            {shapes.map((shape) => (
              <div className="cell" key={shape} data-shape={shape} data-expr={expr}>
                <div className="pair">
                  {SIZES.map((size) => (
                    <Bot
                      key={size}
                      state="idle"
                      look={{ shape, color: 'encre', expression: expr, size }}
                      frozenAt={1.1}
                      paper="#ffffff"
                    />
                  ))}
                </div>
                <span className="cap">{labelOf(shape)}</span>
                <code className="id">{shape}</code>
              </div>
            ))}
          </div>
        </section>
      ))}
      <p className="foot">
        配色只取一个（墨黑）—— 眼睛是 mask 挖的洞，颜色不影响「顶不顶出轮廓」。
        名字显示成 id 的，就是还没补中文名的新身形。
      </p>
    </div>
  )
}

const style = document.createElement('style')
style.textContent = `
html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
.page{padding:22px 26px 50px}
.head{display:flex;align-items:baseline;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.head b{font-size:15px}
.hint{font-size:11.5px;color:#8b929e}
section{margin-bottom:20px}
h3{font-size:12px;margin:0 0 8px;color:#4a5160;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:7px}
.cell{border:.5px solid #e6e9ef;border-radius:8px;padding:6px 3px 5px;display:flex;flex-direction:column;align-items:center;gap:2px;background:#fff}
.pair{display:flex;align-items:center;gap:1px}
.cap{font-size:9.5px;color:#333}
.id{font-size:8px;color:#b0b7c3;font-family:ui-monospace,monospace}
.foot{font-size:11px;color:#8b929e;margin-top:6px}
:root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe}
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

// 供截图脚本读：以引擎的 SHAPES 为准（19 个），不是 look.ts 的 8 个
;(window as never as { __shapes: string[] }).__shapes = SHAPES_ALL

/**
 * 两个「六边形」的对照：动画状态 hexagon vs 身形 hexagone。
 *
 * 为什么要有这一页：设置页的试片里有一个「六边形」，右栏外观的身形里也有一个
 * 「六边形」。名字一样，但它们来自两份**完全不同的**数据：
 *
 *   · 动画 hexagon   ← `bot/profiles.ts`，参考视频逐帧量出来的 64 个半径
 *   · 身形 hexagone  ← `bot/skins.ts`，`regularPolygonProfile(6, 1.04, 0.26, 0)` 解析生成
 *
 * 这一页把两者并排画出来，让「它们不是同一个东西」变成看得见的事实，
 * 而不是文档里的一句话。
 *
 * 用法：node tools/build-hex-compare.mjs && 打开 preview/hex-compare.html
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { DEFAULT_LOOK } from '../plugin/src/client/look'
import { STYLE } from '../plugin/src/client/style'

const SIZES = [96, 200, 320]

function App() {
  const [size, setSize] = useState(200)
  const anim = { ...DEFAULT_LOOK, shape: 'cercle', size }
  const shape = { ...DEFAULT_LOOK, shape: 'hexagone', size }

  return (
    <div className="cmp">
      <div className="cmp-head">
        <b>两个「六边形」</b>
        <label className="rng">
          尺寸
          <input type="range" min={64} max={320} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
      </div>

      <div className="cmp-row">
        <div className="cmp-item" data-kind="anim">
          <div className="cmp-cap">动画状态 hexagon（试片里那个）</div>
          <div className="cmp-bot">
            <Bot state="hexagon" look={anim} frozenAt={0.8} paper="#ffffff" />
          </div>
          <div className="cmp-src">
            来源 <code>profiles.ts</code> · 参考视频逐帧量
            <br />
            峰谷比 1.147 · 顶点在 28°/90°/146°/208°/270°/326°
            <br />
            <b>顶点朝上下，左右是平边</b>
          </div>
        </div>

        <div className="cmp-item" data-kind="shape">
          <div className="cmp-cap">身形 hexagone（外观里那个）</div>
          <div className="cmp-bot">
            <Bot state="idle" look={shape} frozenAt={1.1} paper="#ffffff" />
          </div>
          <div className="cmp-src">
            来源 <code>skins.ts</code> · 解析式生成
            <br />
            峰谷比 1.112 · 顶点在 0°/60°/120°/180°/240°/300°
            <br />
            <b>顶点朝左右，上下是平边</b>
          </div>
        </div>
      </div>

      <div className="cmp-note">
        两者都是 64 个半径的径向轮廓，但数值不同（归一化后逐点最大差 12.6%）、
        朝向相差 30°、圆角程度也不同。所以「试片里的六边形」不能靠「身形里已经有六边形」来替代 ——
        它们是两幅各自独立的画。
      </div>

      <div className="cmp-strip">
        {SIZES.map((s) => (
          <div className="cmp-pair" key={s}>
            <Bot state="hexagon" look={{ ...anim, size: s }} frozenAt={0.8} paper="#ffffff" />
            <Bot state="idle" look={{ ...shape, size: s }} frozenAt={1.1} paper="#ffffff" />
            <span>{s}px</span>
          </div>
        ))}
      </div>

      {/* ── 表情兼容性：这一节直接回答「六边形能不能当身形用」 ──────────
          动画 hexagon 的 StateDef 里 baseFace = false，表情被它自己逐帧量出来的
          眼睛覆盖掉，改「静息表情」对它毫无作用；
          身形 hexagone 走 idle（baseFace = true），表情照常生效。
          两张图一模一样 vs 明显不同，就是判据。 */}
      <div className="cmp-emotion">
        <b>能不能兼容表情？</b>
        <div className="cmp-emotion-row">
          <div className="cmp-item">
            <div className="cmp-cap">动画 hexagon · 中性</div>
            <Bot state="hexagon" look={{ ...anim, expression: 'neutre', size: 120 }} frozenAt={0.8} paper="#ffffff" />
          </div>
          <div className="cmp-item">
            <div className="cmp-cap">动画 hexagon · 生气</div>
            <Bot state="hexagon" look={{ ...anim, expression: 'colere', size: 120 }} frozenAt={0.8} paper="#ffffff" />
          </div>
          <div className="cmp-verdict bad">完全一样 → 不兼容表情</div>
        </div>

        <div className="cmp-emotion-row">
          <div className="cmp-item">
            <div className="cmp-cap">身形 hexagone · 中性</div>
            <Bot state="idle" look={{ ...shape, expression: 'neutre', size: 120 }} frozenAt={1.1} paper="#ffffff" />
          </div>
          <div className="cmp-item">
            <div className="cmp-cap">身形 hexagone · 生气</div>
            <Bot state="idle" look={{ ...shape, expression: 'colere', size: 120 }} frozenAt={1.1} paper="#ffffff" />
          </div>
          <div className="cmp-verdict good">眼睛变了 → 兼容表情</div>
        </div>
      </div>
    </div>
  )
}

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif;color:#1c1f24}
  .cmp{padding:22px 26px 50px;max-width:900px}
  .cmp-head{display:flex;align-items:baseline;gap:16px;margin-bottom:16px}
  .cmp-head b{font-size:15px}
  .rng{margin-left:auto;font-size:11.5px;color:#8b929e;display:flex;align-items:center;gap:8px}
  .cmp-row{display:flex;gap:22px;flex-wrap:wrap}
  .cmp-item{flex:1;min-width:240px;border:1px solid #e6e9ef;border-radius:10px;padding:14px;text-align:center}
  .cmp-cap{font-size:12px;font-weight:600;margin-bottom:10px}
  .cmp-bot{display:flex;align-items:center;justify-content:center;min-height:210px;
    background:repeating-conic-gradient(#f7f8fa 0 25%, #fff 0 50%) 0 0/16px 16px;border-radius:8px}
  .cmp-src{margin-top:10px;font-size:10.5px;line-height:1.6;color:#4a5160;text-align:left}
  .cmp-src code{font-family:ui-monospace,Consolas,monospace;font-size:10px;background:#f1f3f7;padding:1px 4px;border-radius:3px}
  .cmp-note{margin-top:18px;font-size:11.5px;line-height:1.7;color:#4a5160;
    background:#f7f8fa;border-left:3px solid #3964fe;padding:10px 14px;border-radius:0 6px 6px 0}
  .cmp-strip{display:flex;gap:26px;margin-top:26px;align-items:flex-end;flex-wrap:wrap;
    border-top:1px solid #eef0f4;padding-top:18px}
  .cmp-pair{display:flex;align-items:flex-end;gap:6px}
  .cmp-pair span{font-size:9.5px;color:#b0b7c3;align-self:flex-end}
  .cmp-emotion{margin-top:26px;border-top:1px solid #eef0f4;padding-top:18px}
  .cmp-emotion > b{font-size:13px}
  .cmp-emotion-row{display:flex;gap:14px;align-items:center;margin-top:12px;flex-wrap:wrap}
  .cmp-emotion-row .cmp-item{flex:0 0 auto;min-width:0;width:150px;padding:10px}
  .cmp-emotion-row .cmp-bot{min-height:130px}
  .cmp-emotion-row .cmp-cap{font-size:11px;margin-bottom:6px}
  .cmp-verdict{font-size:12px;font-weight:600;padding:8px 14px;border-radius:8px;white-space:nowrap}
  .cmp-verdict.bad{color:#b3261e;background:#fdeceb;border:1px solid #f6c9c5}
  .cmp-verdict.good{color:#1a7f4b;background:#e8f7ef;border:1px solid #bfe6d2}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;
    --dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;
    --dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;
    --dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;
    --dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}
  `
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

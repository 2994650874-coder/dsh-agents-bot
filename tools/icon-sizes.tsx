/**
 * 图标尺寸实测：把子代理图标在 8~28px 各档真实渲染，量眼睛在屏幕上的像素。
 *
 * 为什么要独立一页：之前用「手动改 DOM 的 width/height 属性」来试尺寸，
 * 结果和真实构建对不上（半闭眼/睁眼混着量，比值差了整整一倍）。这里直接
 * 用同一份 Bot 组件、同一套 CSS（scale 1.58 + EYES_OPEN_AT），尺寸是唯一变量。
 *
 * 用法：node tools/build-icon-sizes.mjs && node tools/probe-kids-icon.mjs
 */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { DEFAULT_LOOK } from '../plugin/src/client/look'
import { EYES_OPEN_AT } from '../plugin/src/bot/face'
import { STYLE } from '../plugin/src/client/style'

const SIZES = [8, 10, 11, 12, 13, 14, 16, 18, 20, 24, 28]

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;background:#fff;font-family:-apple-system,"Segoe UI",sans-serif}
  #root{padding:14px}
  .wrap{display:flex;align-items:flex-end;gap:14px;flex-wrap:wrap}
  .item{text-align:center}
  /* 和 .davf-kids-bot 完全一致：定正方形 + overflow 裁 + scale 1.58 */
  .box{display:grid;place-items:center;overflow:hidden;background:#f7f8fa;
    border:1px solid #d5dae3;border-radius:5px;margin:0 auto}
  .box svg{transform:scale(1.58);transform-origin:center}
  .cap{font-size:9px;color:#666;margin-top:3px;line-height:1.3}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;
    --dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;
    --dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;
    --dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;
    --dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}
  `
document.head.appendChild(style)

function Root() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  if (!ready) return null
  return (
    <div className="wrap">
      {SIZES.map((s) => (
        <div className="item" key={s}>
          <div className="box" data-size={s} style={{ width: s, height: s }}>
            <Bot
              state="idle"
              look={{ ...DEFAULT_LOOK, size: s }}
              paper="transparent"
              frozenAt={EYES_OPEN_AT}
            />
          </div>
          <div className="cap">{s}px</div>
        </div>
      ))}
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)

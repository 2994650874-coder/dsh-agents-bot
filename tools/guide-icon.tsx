/**
 * 引导页入口图标的验证页：把「活动 AI」那张卡片的图标单独画出来，
 * 放在和宿主一样的两档尺寸、明暗两种底色下，看它是不是真的认得出。
 *
 * 为什么要单独一页：宿主的引导页在真 DSH 里，插件预览环境没有那个页面。
 * 但图标本身只依赖 `{ size, className }` 两个入参，把它按宿主的方式
 * 摆出来就够了 —— 判据是「眼睛看得见」和「暗色下不是黑斑」。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-guide-icon.mjs
 *   node tools/shoot-guide-icon.mjs
 */
import { createRoot } from 'react-dom/client'
import { GuideIcon } from '../plugin/src/client/GuideIcon'

/** 宿主的 `.entryIcon` 样式：26px 框、颜色取 label-secondary。 */
const CSS = `
html,body{margin:0;font-family:-apple-system,"Segoe UI",sans-serif}
body{background:#fff;padding:28px}
h2{font-size:13px;margin:0 0 12px;color:#4a5160;font-weight:600}
.grid{display:flex;gap:36px;flex-wrap:wrap;margin-bottom:28px}
.box{display:flex;flex-direction:column;align-items:center;gap:8px}
.cap{font-size:11px;color:#8b929e}
.entryIcon{width:26px;height:26px;color:#4a5160;flex:none;
  display:flex;justify-content:center;align-items:center}
.dark{background:#1c1f24;color:#e6e9ef;padding:24px;border-radius:10px}
.dark .entryIcon{color:#b9c0cc}
.dark .cap{color:#8b929e}
.dark h2{color:#b9c0cc}
/* 宿主真实卡片的样子，用来看整体比例 */
.card{display:flex;align-items:center;gap:14px;padding:14px 20px;width:380px;
  border:.5px solid #e6e9ef;border-radius:12px;background:#fff;cursor:pointer}
.card .t{font-size:13px;color:#1c1f24}
.darkcard{background:#23262c;border-color:#33373f}
.darkcard .t{color:#e6e9ef}
`

/** 一个尺寸档。 */
function Cell({ size, label }: { size: number; label: string }) {
  return (
    <div className="box">
      <span className="entryIcon">
        <GuideIcon size={size} />
      </span>
      <span className="cap">{label}</span>
    </div>
  )
}

function App() {
  return (
    <>
      <h2>引导页入口图标（宿主 .entryIcon，26px 框）</h2>
      <div className="grid">
        <Cell size={22} label="22px（无描述时）" />
        <Cell size={26} label="26px（有描述时）" />
        <Cell size={16} label="16px（更小的场合）" />
      </div>

      <h2>放进真实卡片的样子</h2>
      <div className="grid">
        <div className="card">
          <span className="entryIcon">
            <GuideIcon size={26} />
          </span>
          <span className="t">活动 AI</span>
        </div>
      </div>

      <div className="dark">
        <h2>暗色主题（必须看得见，不能是一块黑斑）</h2>
        <div className="grid">
          <Cell size={22} label="22px" />
          <Cell size={26} label="26px" />
          <div className="card darkcard">
            <span className="entryIcon">
              <GuideIcon size={26} />
            </span>
            <span className="t">活动 AI</span>
          </div>
        </div>
      </div>
    </>
  )
}

const style = document.createElement('style')
style.textContent = CSS
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(<App />)

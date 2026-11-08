/**
 * 「动画实验室」—— 镜像设置页 + 可交互播放台的预览页。
 *
 * ── 用户要什么（2026-10-30）──────────────────────────────────────────
 *   「做一个镜像的测试台，和动画样片.html 可以互动，然后修改都在上面进行」
 *
 * ── 和现有两个页面的分工 ─────────────────────────────────────────────
 *   · `settings.html`        —— **静态镜像**：挂真 `SettingsPage`，点芯片才动。
 *                                用来确认「设置页长什么样、版式对不对」。
 *   · `settings-sketches.html` —— **决策留档**：A/B/C/D 四个候选，永不改动。
 *   · `动画样片.html`         —— **上游原版**：把作者的 animation.html 原样跑起来，
 *                                用来对照「原版应该是什么样」。
 *   · 本页 `anim-lab.html`    —— **交互测试台**：镜像我们的真实现，但加了一排
 *                                播放控制（上一个 / 播放中 / 下一个 / 定住），
 *                                像样片那样能来回翻着看每个动画。
 *
 * ── 为什么它必须镜像真组件而不是自己画一遍 ───────────────────────────
 * 手抄一份渲染逻辑，抄本和产品各自演化，测试台会「看起来对、实际不对」。
 * 所以这里直接 `import { SettingsPage }`，和 `settings.html` 是同一份源码；
 * 只在外围加控制条，不碰组件内部。
 *
 * ── 镜像的关键：走 store 的公开写入函数 ───────────────────────────────
 * 翻页要改「试片正在播哪个动画」。真组件读的是 `store` 里的 `preview`，
 * 所以这里调 `setPreview()` —— 和用户在设置页点芯片走的是**同一条路**。
 * 不走 localStorage 直写：那会绕过 store 的规范化和订阅，两边状态会不同步。
 *
 * 用法：
 *   node tools/build-anim-lab.mjs
 *   打开 preview/anim-lab.html
 *   可选参数 ?w=960 控制镜像容器宽度（默认 960，即 DSH 设置页最宽值）
 */
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { SettingsPage } from '../plugin/src/client/Settings'
import { STYLE } from '../plugin/src/client/style'
import { ANIMATION_OPTIONS } from '../plugin/src/client/activities'
import { playLengthOf } from '../plugin/src/client/rotation'
import { setPreview, useUi } from '../plugin/src/client/store'

const params = new URLSearchParams(location.search)
const W = Number(params.get('w') ?? 960)

/** 控制条停在第几个动画（0 基）。 */
let cursor = 0

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;height:100%;background:var(--dsw-alias-bg-layer-3,#eef1f6);
    font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  #root{height:100%}
  .fake-form{position:absolute;inset:0;overflow:auto;background:var(--dsw-alias-bg-layer-1);
    padding-bottom:88px}
  .fake-form-inner{width:${W}px;max-width:100%;margin:0 auto;padding:20px 24px 40px;box-sizing:border-box}
  .fake-form-title{font-size:14px;font-weight:600;margin:0 0 4px;color:var(--dsw-alias-label-primary)}
  .fake-form-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);margin:0 0 18px;line-height:1.6}
  /* 默认的 DSH 变量（没有宿主时用这套） */
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;
    --dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;
    --dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;
    --dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;
    --dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}

  /* ── 播放控制条：和动画样片.html 同一套位置和手感 ────────────────
     固定在底部，深色，主按钮金色 —— 这样从样片页切过来不用重新学。 */
  #lab-bar{position:fixed;left:0;right:0;bottom:0;z-index:99999;
    background:rgba(20,20,20,.94);color:#fff;
    font:14px/1.5 system-ui,-apple-system,"Microsoft YaHei",sans-serif;
    padding:10px 16px 12px;box-shadow:0 -2px 18px rgba(0,0,0,.28)}
  #lab-bar .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  #lab-bar .name{font-size:17px;font-weight:700;color:#ffd479}
  #lab-bar .idx{color:#8b8b8b;font-size:13px;font-variant-numeric:tabular-nums}
  #lab-bar button{font:inherit;font-size:15px;padding:7px 16px;border-radius:8px;
    border:1px solid #4a4a4a;background:#2c2c2c;color:#fff;cursor:pointer}
  #lab-bar button:hover{background:#3d3d3d;border-color:#6a6a6a}
  #lab-bar button.main{background:#c8892a;border-color:#c8892a;color:#1a1a1a;font-weight:700}
  #lab-bar .tip{color:#8b8b8b;font-size:12px;margin-top:6px;line-height:1.5}
  #lab-bar .chk{display:inline-flex;align-items:center;gap:5px;color:#b9b9b9;font-size:13px}
  #lab-bar select{font:inherit;font-size:13px;padding:5px 8px;border-radius:7px;
    border:1px solid #4a4a4a;background:#2c2c2c;color:#fff}
  `
document.head.appendChild(style)

/**
 * 控制条。
 *
 * ── 为什么「自动」用 setInterval 而不是 requestAnimationFrame ────────
 * 这里要做的是「每 N 秒换一个动画」，是秒级的事，不需要贴屏幕刷新
 * （60Hz 调一次只是白烧 CPU）。rAF 该用在动画本身上 —— 那是 Bot 组件
 * 内部已经在做的事，这里不重复。
 *
 * ── 为什么定时器长度按动画时长走 ────────────────────────────────────
 * 每个动画长度不同（眨眼 1.6 秒、庆祝 4.2 秒）。固定 6 秒会让短的播完
 * 停住、长的被截断。用 `playLengthOf(id)` 正好一整遍，和设置页的「一遍」
 * 是同一个口径。
 */
function LabBar() {
  const preview = useUi('preview')
  const [auto, setAuto] = useState(false)

  /** 当前实际在播的动画（"跟随真实状态" 时在设置页是 idle）。 */
  const cur = preview ?? 'idle'
  const idx = ANIMATION_OPTIONS.findIndex((o) => o.id === cur)

  const go = (delta: number) => {
    const n = ANIMATION_OPTIONS.length
    cursor = ((idx < 0 ? 0 : idx) + delta + n) % n
    setPreview(ANIMATION_OPTIONS[cursor]!.id)
  }

  useEffect(() => {
    if (!auto) return
    const len = playLengthOf(ANIMATION_OPTIONS[idx]?.id ?? 'idle')
    // 多留 0.15 秒，让「播完一遍」看得完整
    const ms = Math.round((len + 0.15) * 1000)
    const t = window.setTimeout(() => go(1), ms)
    return () => window.clearTimeout(t)
  }, [auto, idx])

  const len = playLengthOf(ANIMATION_OPTIONS[idx]?.id ?? 'idle')

  return (
    <div id="lab-bar">
      <div className="row">
        <span className="name">{ANIMATION_OPTIONS[idx]?.label ?? cur}</span>
        <span className="idx">
          {idx < 0 ? `自定义 ${cur}` : `(${idx + 1} / ${ANIMATION_OPTIONS.length})`} · {cur} · 一遍 {len.toFixed(1)} 秒
        </span>
        <span style={{ flex: 1 }} />
        <label className="chk">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          自动播放
        </label>
        <button onClick={() => go(-1)}>← 上一个</button>
        <button className="main" onClick={() => go(1)}>下一个 →</button>
        <button onClick={() => setPreview(null)}>跟随真实状态</button>
      </div>
      <div className="tip">
        试片区会跟着动 —— 这是真设置页组件，翻页走的是和点芯片<strong>同一条</strong> store 写入。
        勾「自动播放」按每个动画自己的长度循环。
      </div>
    </div>
  )
}

function Root() {
  return (
    <>
      <div className="fake-form">
        <div className="fake-form-inner">
          <h3 className="fake-form-title">dsh-agents-bot · 动画实验室</h3>
          <p className="fake-form-sub">
            下方是<strong>真实设置页组件</strong>的镜像（与 <code>settings.html</code> 同一份源码）。
            底部控制条可以逐个翻动画 —— 改的只是「试片在看哪个」，不写任何产品配置。
            <br />
            最宽 960px 是 DSH 设置页的真实上限；窄屏用 <code>?w=620</code> 之类参数模拟。
          </p>
          <SettingsPage />
        </div>
      </div>
      <LabBar />
    </>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)

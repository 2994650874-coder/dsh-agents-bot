/**
 * 设置页预览：在没有 DSH 外壳的情况下看设置页长什么样。
 *
 * 为什么单独一个预览页而不是塞进 panel.html：设置页挂在「设置 → 插件 →
 * 组合包详情」里，它的容器是一个**宽表单区**（不是右栏那种窄轨道）。
 * 两者尺寸语义完全不同，混在一个页面里测不出来。
 *
 * 容器宽度可从 URL 参数指定：
 *   preview/settings.html            默认 720（插件页典型宽度）
 *   preview/settings.html?w=420      窄（插件页在窄面板里）
 *
 * 用假 store —— 设置页只读 store 里的配置，不需要任何 session 数据。
 * 这也是一条断言：设置页**不该**依赖 session hook。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-settings.mjs
 *   然后用浏览器打开 preview/settings.html
 */
import { createRoot } from 'react-dom/client'
import { SettingsPage } from '../plugin/src/client/Settings'
import { STYLE } from '../plugin/src/client/style'

const params = new URLSearchParams(location.search)
const W = Number(params.get('w') ?? 720)

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;height:100%;background:var(--dsw-alias-bg-layer-3,#eef1f6);
    font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif}
  #root{height:100%}
  /* 复刻插件详情页的表单区：白底、内边距、可滚动。
     设置页自己不画卡片边框 —— 它本身就该像页面里的一段内容。 */
  .fake-form{position:absolute;inset:0;overflow:auto;background:var(--dsw-alias-bg-layer-1)}
  .fake-form-inner{width:${W}px;max-width:100%;margin:0 auto;padding:20px 24px 40px;box-sizing:border-box}
  .fake-form-title{font-size:14px;font-weight:600;margin:0 0 4px;color:var(--dsw-alias-label-primary)}
  .fake-form-sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);margin:0 0 18px}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;--dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;--dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;--dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;--dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}
  `
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <div className="fake-form">
    <div className="fake-form-inner">
      <h3 className="fake-form-title">dsh-agents-bot</h3>
      <p className="fake-form-sub">（模拟「设置 → 插件 → dsh-agents-bot」详情页里的表单区）</p>
      <SettingsPage />
    </div>
  </div>
)

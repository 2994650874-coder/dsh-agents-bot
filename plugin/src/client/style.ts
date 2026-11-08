/**
 * 面板样式。
 *
 * 全部用 `--dsw-alias-*` 主题 token，不写死颜色 —— DSH 有明暗两套主题，
 * 写死的话暗色下会瞎。这些 token 由 `ui-theme` 挂在 body 上。
 *
 * 三套外观共用这里：
 *   `.davf*` 是右栏面板（现在的正式形态，挂在 `sidebar.right.pane.tab`）
 *   `.dav`   是旧的栏内面板（只剩预览工具在用）
 *   浮窗形态的样式已随实现封存到 `archive/float-window/float.css` ——
 *   本文件里**没有** `.davf` 根节点、`.davf-edge`、`.davf[data-dragging]`，
 *   因为面板不再自己定位、不再可拖可拉。别加回来。
 */
export const STYLE = `
/* ══ 右栏面板 ══════════════════════════════════════════════════════
   宿主给正文的容器（.tabBody）是 height:100%;display:flex;flex-direction:column。
   所以根节点只要 flex:1 就能填满 —— 不写绝对定位、不写 100vh、不写边框圆角
   （那是浮窗为了「像一张卡片」才需要的；嵌在栏里时它本身就是栏的一部分）。 */
/* G1: frame-wide transparent shell never grabs input; only the clipped Bot disc does.
   Explicit no-drag overrides chrome row drag rules. No rectangular iframe hit box. */
.davf-g1-shell{position:fixed;inset:0;z-index:20;pointer-events:none;background:transparent}
.davf-g1-entity{position:absolute;width:var(--davf-main-size,96px);height:var(--davf-main-size,96px);pointer-events:none}
.davf-g1-entity>svg{pointer-events:none}
.davf-g1-hit{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;
  border-radius:50%;clip-path:circle(39.58% at 50% 50%);pointer-events:auto;cursor:grab;touch-action:none;
  -webkit-app-region:no-drag}
.davf-g1-hit:active{cursor:grabbing}
.davf-g1-hit:focus-visible{outline:3px solid var(--dsw-alias-state-business-primary,#3964fe);outline-offset:-5px}
.davf-g1-feedback{position:absolute;left:50%;top:calc(var(--davf-main-size,96px) - 6px);transform:translateX(-50%);white-space:nowrap;
  font:11px/1.5 sans-serif;color:var(--dsw-alias-label-primary);pointer-events:none}
@media (prefers-reduced-motion: reduce){.davf-g1-entity,.davf-g1-hit{transition:none!important;animation:none!important}}
.davf-g2-error{position:fixed;bottom:8px;left:8px;right:8px;margin:auto;max-width:260px;text-align:center;pointer-events:none;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border-radius:6px;font-size:11px;line-height:1.5}
.davf-g2-placeholder{flex:1;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);font-size:12px}.davf-g2-placeholder:not(.is-compact){gap:96px}.davf-g2-placeholder svg{max-width:96px;max-height:96px}.davf-g2-placeholder.is-compact .davf-g2-still{display:none}.davf-g2-placeholder-copy{width:100%;max-width:260px;padding:0 8px;box-sizing:border-box;text-align:center}.davf-g2-placeholder-title{display:block;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.5}.davf-g2-placeholder-subtitle{display:block;margin-top:3px;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.5}.davf-g2-placeholder-hint{display:block;margin-top:16px;font-size:12px;line-height:1.6}.davf-g2-still{color:var(--dsw-alias-label-tertiary,#8b94a5);opacity:.48;pointer-events:none}
.davf-g2-switch{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:1px 4px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;-webkit-app-region:no-drag}
.davf-g2-switch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3964fe);outline-offset:2px}
.davf-g2-switch-track{width:31px;height:15px;border-radius:999px;display:flex;align-items:center;padding:2px;box-sizing:border-box;background:var(--dsw-alias-border-l1,#a0a6b0);transition:background .16s}
.davf-g2-switch-thumb{width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .16s}
.davf-g2-switch[aria-checked=true] .davf-g2-switch-track{background:var(--dsw-alias-state-business-primary,#3964fe)}
.davf-g2-switch[aria-checked=true] .davf-g2-switch-thumb{transform:translateX(16px)}
.davf-g2-switch-error{padding:2px 10px;font-size:10px;color:var(--dsw-alias-state-error-primary,#e0563f)}
@media(prefers-reduced-motion:reduce){.davf-g2-switch,.davf-g2-switch-thumb,.davf-g2-switch-track,.davf-g2-placeholder{animation:none!important;transition:none!important}}
.davf-panel{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;
  overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px}

/* 顶部一行：标题 + 计数 + 胶囊。不再是拖动条，所以没有 cursor:grab。 */
.davf-bar{display:flex;align-items:center;gap:9px;height:38px;padding:0 10px 0 12px;
  flex-shrink:0;user-select:none;-webkit-user-select:none;
  border-bottom:1px solid var(--dsw-alias-border-l2)}
.davf-title{font-size:12.5px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
.davf-count{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:baseline;gap:1px}
.davf-count-total{opacity:.55}
.davf-overflow{margin-left:4px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.06));font-size:10px;color:var(--dsw-alias-label-secondary)}

/* 胶囊长条：监视 + 外观 */
.davf-capsule{margin-left:auto;display:flex;align-items:center;gap:1px;padding:2px;
  border-radius:999px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-1);cursor:default}
/* 规格（1×1 / 1×2）已从标题栏移除 —— 那只是当初验证格子逻辑用的显示，
   对用户没有信息量。gridOf() 仍然决定布局，只是不再把它写出来。 */
.davf-cap{border:0;background:transparent;color:var(--dsw-alias-label-secondary);
  font:inherit;font-size:10.5px;line-height:1;padding:4px 8px;border-radius:999px;
  cursor:pointer;white-space:nowrap;transition:background .13s,color .13s}
.davf-cap:hover{background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary)}
.davf-cap.is-on{background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
.davf-cap-quiet{color:var(--dsw-alias-label-tertiary);font-size:10px}

.davf-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;overflow:hidden}
.davf-isolation-empty,.davf-isolation-error{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:12px;text-align:center;font-size:11px;color:var(--dsw-alias-label-secondary)}
.davf-isolation-error button{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}
/* Before owner + first ACK, this is a single parent-side preview, never the real monitor grid. */
.davf-isolation-startup{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:4px;min-height:0;overflow:hidden;pointer-events:none;background:var(--davf-isolated-canvas,#f6f8fb);
  color:var(--davf-isolated-label,#171717);font-size:11px}
.davf-isolation-startup-portrait{flex:0 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;max-width:100%;max-height:55%}
.davf-isolation-startup-portrait svg{max-width:100%;max-height:100%}
.davf-isolation-startup-note{line-height:18px;text-align:center;white-space:nowrap;opacity:.72}
.davf-isolation-startup-pill{box-sizing:border-box;width:82px;height:16px;margin-top:5px;display:flex;align-items:center;
  justify-content:center;gap:3px;border:1px solid color-mix(in srgb,var(--davf-isolated-label,#171717) 35%,var(--davf-isolated-canvas,#f6f8fb));border-radius:999px;
  background:var(--davf-isolated-canvas,#f6f8fb);color:var(--davf-isolated-label,#171717);font-size:9px;line-height:14px}
.davf-isolation-startup-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#3964fe)}

/* 移除按钮：默认隐形，悬停格子才出现 —— 否则多格时满屏都是 ✕ */
.davf-cell-remove{position:absolute;right:5px;top:5px;width:17px;height:17px;display:grid;place-items:center;
  border:0;border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);
  font-size:9px;line-height:1;cursor:pointer;opacity:0;transition:opacity .15s,color .15s,background .15s}
.davf-cell-remove:hover{background:var(--dsw-alias-state-error-primary,#e0563f);color:#fff}

/* 外观面板开着时，每格顶部那枚「改它」小胶囊。
   只在外观面板开着时出现，所以平时不占视觉。 */
.davf-cell-tag{position:absolute;left:50%;top:2px;transform:translateX(-50%);
  border:1px solid var(--dsw-alias-border-l2);border-radius:999px;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);
  font:inherit;font-size:9.5px;line-height:1;padding:3px 7px;cursor:pointer;white-space:nowrap;
  transition:.14s;z-index:1}
.davf-cell-tag:hover{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  color:var(--dsw-alias-state-business-primary,#3964fe)}
.davf-cell-tag.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
/* Real titles stay parent-only; mirror the child portrait and pill rows to share one centered baseline. */
.davf-isolated-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:3px;box-sizing:border-box;min-width:0;min-height:0;padding:6px 4px;border:1px solid transparent}
.davf-isolated-portrait-space{flex:0 1 auto;min-height:0;width:100%;margin-bottom:12px}
.davf-isolated-cell.is-dense .davf-isolated-portrait-space{margin-bottom:3px}
.davf-isolated-name{font-weight:600;flex:0 0 18px;width:calc(100% - 8px);height:18px;z-index:2;max-width:100%;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box;text-align:center;pointer-events:none;
  background:var(--davf-isolated-canvas,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);
  font-size:12.5px;line-height:18px;letter-spacing:.01em}
.davf-isolated-cell.is-pair .davf-isolated-name{transform:translateY(-32px)}
.davf-isolated-cell.is-spacious .davf-isolated-name{transform:translateY(-40px)}
.davf-isolated-name + .davf-isolated-meta-space{margin-top:5px}
.davf-isolated-meta-space{flex:0 0 16px;width:82px;height:16px}
.davf-caret{color:var(--dsw-alias-label-tertiary);margin-right:3px}

/* ══ 监视选择器 / 外观面板（共用同一套矩形框）═════════════════════════
   两者都用 .davf-picker 的外框，视觉上是一对。
   之前外观是裸列表、从下往上长，和选择器对不上，是用户报的问题。 */
.davf-picker{flex:0 0 auto;max-height:58%;min-height:0;display:flex;flex-direction:column;
  border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
  background:var(--dsw-alias-bg-layer-2);overflow:hidden;
  animation:davf-picker-in .2s ease-out both}
/* 都是从「上方」滑下来 —— 两个面板方向必须一致 */
@keyframes davf-picker-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}

/* 外观面板比选择器高一点：它有四行，58% 会挤 */
.davf-custbox{max-height:64%;container-type:inline-size;min-width:0}
.davf-custbody{padding:8px 10px 10px;display:flex;flex-direction:column;gap:9px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}

.davf-picker-head{display:flex;align-items:baseline;gap:8px;padding:8px 10px 7px;flex-shrink:0;
  border-bottom:1px solid var(--dsw-alias-border-l2)}
.davf-picker-head>span:first-child{font-size:11.5px;font-weight:600}
.davf-picker-hint{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.davf-picker-body{flex:1;min-height:0;overflow:auto;padding:4px 4px 6px}
.davf-picker-empty{padding:18px 12px;text-align:center;font-size:11.5px;color:var(--dsw-alias-label-tertiary)}

/* 工作区一行：可折叠，右边显示「已选/总数」 */
.davf-ws-head{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;
  padding:6px 7px;border-radius:7px;font:inherit;font-size:11.5px;cursor:pointer;
  color:var(--dsw-alias-label-primary);text-align:left;transition:background .13s}
.davf-ws-head:hover{background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.05))}
.davf-ws-caret{width:10px;flex-shrink:0;font-size:9px;color:var(--dsw-alias-label-tertiary)}
.davf-ws-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}
.davf-ws-count{flex-shrink:0;font-family:ui-monospace,Consolas,monospace;font-size:10px;
  color:var(--dsw-alias-label-tertiary)}
.davf-ws-body{display:flex;flex-direction:column;gap:1px;padding:1px 0 4px 14px}

/* 一条会话：勾选框 + 名字 + 状态 */
.davf-pick-row{display:flex;align-items:center;gap:7px;width:100%;border:0;background:transparent;
  padding:5px 8px;border-radius:7px;font:inherit;font-size:11.5px;cursor:pointer;
  color:var(--dsw-alias-label-secondary);text-align:left;transition:background .13s,color .13s}
.davf-pick-row:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.05));
  color:var(--dsw-alias-label-primary)}
.davf-pick-row:disabled{opacity:.42;cursor:not-allowed}
.davf-pick-row.is-on{color:var(--dsw-alias-label-primary)}
.davf-pick-row.is-active{cursor:default}
.davf-pick-box{flex-shrink:0;width:13px;height:13px;display:grid;place-items:center;
  border:1px solid var(--dsw-alias-border-l1);border-radius:4px;
  font-size:9px;line-height:1;color:#fff;transition:.13s}
.davf-pick-box.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  background:var(--dsw-alias-state-business-primary,#3964fe)}
/* 当前窗口那个格子：用淡蓝底 + 点，表示「已在内、不可取消」 */
.davf-pick-box.is-active{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  background:transparent;color:var(--dsw-alias-state-business-primary,#3964fe);font-size:13px}
.davf-pick-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.davf-pick-tag{flex-shrink:0;padding:0 4px;border-radius:999px;font-size:9px;line-height:1.5;
  background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
.davf-pick-act{flex-shrink:0;font-size:10px;color:var(--dsw-alias-label-tertiary)}

/* 外观面板内部的行。外框由 .davf-picker/.davf-custbox 提供，
   这里只管行内排版 —— 不再自己当容器（之前那样会从下往上长）。 */
.davf-cust-row{display:flex;gap:9px;align-items:flex-start;min-width:0}
.davf-cust-label{flex:0 0 34px;padding-top:4px;font-size:10px;font-weight:600;letter-spacing:.08em;
  text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.davf-chips{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.davf-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 8px;
  font:inherit;font-size:11px;cursor:pointer;transition:.13s;white-space:nowrap}
.davf-chip:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.davf-chip.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
/* 表情 16 项排 6+5+5：后两行居中，比 6+6+4 更均衡。
   12 列中每项占两列，首项从第 2 列起可让五项两边各留一列。 */
.davf-expressions{display:grid;flex:1;grid-template-columns:repeat(12,minmax(0,1fr));gap:5px;min-width:0}
.davf-expressions .davf-chip{grid-column:span 2;min-width:0;padding:3px 1px;font-size:9px;overflow:hidden;text-overflow:ellipsis;text-align:center}
.davf-expressions .davf-chip:nth-child(7),.davf-expressions .davf-chip:nth-child(12){grid-column:2 / span 2}
.davf-expressions .davf-cust-note{grid-column:1/-1}
/* 行尾的小字说明：试片只影响哪一格、帧率是全局的、表情只在空闲可见。
   不换行、不抢焦点，只是让「为什么只有一个格子变了」有答案。 */
.davf-cust-note{font-size:10px;color:var(--dsw-alias-label-tertiary);
  line-height:1.5;padding-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* 面板底部整行说明：允许换行（它是完整句子，不是行尾标签） */
.davf-cust-foot{white-space:normal;padding-top:8px;
  border-top:1px solid var(--dsw-alias-border-l2)}
/* 形状 15 项与设置页一致，按行填充三排（5+5+5）。
   minmax(0,1fr) 和按钮内部省略避免极窄右栏横向溢出。 */
.davf-shapes{display:grid;flex:1;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;min-width:0}
.davf-shape{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px 3px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-tertiary);font:inherit;font-size:9px;line-height:1.2;
  cursor:pointer;transition:.13s;white-space:nowrap;min-width:0;overflow:hidden}
.davf-shape span{max-width:100%;overflow:hidden;text-overflow:ellipsis}
.davf-shape svg{max-width:100%}
.davf-shape:hover{border-color:var(--dsw-alias-border-l1)}
.davf-shape.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);color:var(--dsw-alias-label-primary)}
/* 主窗口的尺寸与编辑目标在同一外观卡片内，按尺寸→目标→形状依次展开。 */
.davf-main-size{min-width:0;padding:2px 0 6px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.davf-main-size-label{display:block;margin-bottom:5px;font-size:10.5px;font-weight:600;
  color:var(--dsw-alias-label-secondary)}
.davf-main-size-control{min-width:0;display:flex;flex-direction:column;gap:4px;font-size:11px}
.davf-main-size-control input[type=range]{width:100%;margin:0;accent-color:var(--dsw-alias-state-business-primary,#3964fe)}
.davf-main-size-control .davf-cust-note{padding-top:0;white-space:normal}
.davf-look-target{display:flex;min-width:0;gap:3px;padding:3px;border:1px solid var(--dsw-alias-border-l2);
  border-radius:9px;background:var(--dsw-alias-bg-layer-1)}
.davf-look-target-choice{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;
  padding:5px 2px;border:1px solid transparent;border-radius:6px;background:transparent;
  color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
.davf-look-target-choice[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
.davf-look-target-choice strong{font-size:13px;font-weight:700;line-height:1.3}
.davf-look-target-choice small{font-size:10px;line-height:1.3;color:var(--dsw-alias-label-tertiary)}
.davf-look-target-choice:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3964fe);outline-offset:1px}
.davf-colors{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
.davf-color{width:17px;height:17px;border-radius:50%;border:2px solid transparent;padding:0;cursor:pointer;
  transition:.13s;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.davf-color:hover{transform:scale(1.12)}
.davf-color.is-on{border-color:var(--dsw-alias-label-primary);transform:scale(1.08)}

/* 116px 级窄栏无法同时容纳五个完整图标/文字：此时以可读和可点为先，
   两列纵向滚动；正常宽度仍保持形状 5+5+5、表情 6+5+5 三排。 */
@container (max-width:256px){
  .davf-picker-head{flex-wrap:wrap;gap:2px;padding:6px 4px}
  .davf-picker-hint{margin-left:0;white-space:normal;overflow-wrap:anywhere;min-width:0}
  .davf-custbody{padding:5px 4px;gap:5px}
  .davf-cust-row{display:block}
  .davf-cust-label{display:block;padding:0 0 3px}
  .davf-shapes,.davf-expressions{width:100%;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
  .davf-expressions .davf-chip,.davf-expressions .davf-chip:nth-child(7),
  .davf-expressions .davf-chip:nth-child(12){grid-column:span 1}
  .davf-shape{padding:3px 0}
  .davf-shape svg{width:24px;height:24px}
  .davf-cust-note{white-space:normal;overflow-wrap:anywhere}
}

/* ══ 栏内面板（预览工具仍在用） ═════════════════════════════════════ */
.dav-host{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-size:13px;overflow:hidden}
.dav-root{flex:1;min-height:0;display:flex;align-items:stretch}

.dav-stage{min-width:0;min-height:0;display:flex;flex-direction:column;padding:20px 22px 22px;overflow:hidden}
.dav-stage-head{display:flex;align-items:baseline;gap:8px;margin-bottom:16px;flex-shrink:0}
.dav-stage-title{font-size:13px;font-weight:600;letter-spacing:.02em}
.dav-stage-count{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary)}
.dav-grid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px;align-content:start;padding-right:4px}

.dav-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 8px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;transition:border-color .16s,background .16s}
.dav-card:hover{border-color:var(--dsw-alias-border-l1)}
.dav-card-bar{position:absolute;left:0;top:0;bottom:0;width:3px;opacity:.9}
.dav-card-bot{width:92px;height:92px;display:grid;place-items:center;flex-shrink:0}
.dav-card-meta{min-width:0;width:100%;text-align:center}
.dav-card-name{font-size:12px;font-weight:550;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
.dav-caret{color:var(--dsw-alias-label-tertiary);margin-right:3px}
.dav-card-act{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:3px;font-size:10.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dav-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}

.dav-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--dsw-alias-label-tertiary);text-align:center;padding:0 30px}
.dav-empty p{max-width:300px;font-size:12px;line-height:1.75;margin:0}
.dav-empty-bot{opacity:.8}

.dav-split{flex:0 0 5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0}
.dav-split:after{content:"";position:absolute;left:2px;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l2)}
.dav-split:hover:after{background:var(--dsw-alias-state-business-primary,#3964fe)}

.dav-side{flex:1 1 0;min-width:240px;max-width:420px;min-height:0;overflow:auto;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.dav-cust{padding:20px 18px 28px;display:flex;flex-direction:column;gap:20px}
.dav-cust-head{font-size:13px;font-weight:600}
.dav-sec{display:flex;flex-direction:column;gap:9px}
.dav-sec-title{font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}

.dav-chips{display:flex;flex-wrap:wrap;gap:6px}
.dav-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:7px;padding:4px 9px;font:inherit;font-size:11.5px;cursor:pointer;transition:.14s}
.dav-chip:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.dav-chip.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}

.dav-shapes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.dav-shape{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer;transition:.14s}
.dav-shape:hover{border-color:var(--dsw-alias-border-l1)}
.dav-shape.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);color:var(--dsw-alias-label-primary)}

.dav-colors{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
.dav-color{aspect-ratio:1;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;transition:.14s;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
.dav-color:hover{transform:scale(1.08)}
.dav-color.is-on{border-color:var(--dsw-alias-label-primary);transform:scale(1.06)}

.dav-range{width:100%;accent-color:var(--dsw-alias-state-business-primary,#3964fe)}

/* ══ 设置页 ════════════════════════════════════════════════════════
   挂在「设置 → 插件 → dsh-agents-bot」的组合包详情页里。
   容器是插件页自己的表单区，所以这里不写边框/圆角/背景 —— 它本身
   就该像页面里的一段内容，而不是又一张卡片。
   宽度按容器自适应（插件页可能是窄栏也可能是宽面板）。 */
.davs{display:flex;flex-direction:column;gap:18px;padding:4px 0 8px;min-width:0;
  container-type:inline-size;color:var(--dsw-alias-label-primary);font-size:12.5px}
.davs-title{margin:0;font-size:12.5px;font-weight:600}
.davs-desc{margin:5px 0 0;font-size:11.5px;line-height:1.65;color:var(--dsw-alias-label-tertiary);max-width:62em}
.davs-section{display:flex;flex-direction:column;gap:2px;padding-top:14px;
  border-top:1px solid var(--dsw-alias-border-l2)}
.davs-section .davs-desc{margin-bottom:8px}

.davs-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);border-radius:7px;padding:5px 10px;
  font:inherit;font-size:11.5px;cursor:pointer;transition:.13s;white-space:nowrap;flex-shrink:0}
.davs-btn:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}

/* 二级确认态（「恢复默认」被点过一次）。
   为什么要变红边框：这两枚按钮干的是一键抹掉全部手工配置，没有撤销。
   进入确认态后必须**一眼看出它已经变了**，否则用户以为第一次没点中、
   再点一次 —— 那正好就是执行。红色是唯一不靠读字就能分辨的信号。 */
.davs-btn.is-armed{border-color:#d0553f;color:#d0553f;font-weight:600}
.davs-btn.is-armed:hover{border-color:#d0553f;color:#d0553f}

/* ── 试片 ────────────────────────────────────────────────────────────
   版式 = 左预览 / 右三组按钮，三组各压成三行（用户 2026-10-30 选定 B）。

   ── 为什么预览是 288px ───────────────────────────────────────────────
   量过：旧版预览框 96px，右侧按钮区 297px —— 右侧正好是左侧三倍，
   这就是用户说的「上下差太多」。三倍正好补齐，所以 288px 不是凑的。

   ── 为什么三组要压成固定三行 ─────────────────────────────────────────
   自然换行时三组的行数各不相同（动画 3 行、图案 2 行、表情 2 行），
   三块高度参差；固定三行后三块等高，视线扫下来是整齐的格子。
   实测上下差从 74px 降到 22px。

   ── 为什么列数要算，不能写死 ─────────────────────────────────────────
   行数固定时列数必须是 ceil(芯片数 / 行数)，否则标签会被挤扁。
   用 grid-auto-flow:column 先竖后横更是错的：阅读顺序会从
   「空闲 思考 眨眼」变成「空 思 眨」。列数由组件算好，经 --cols 传入。 */
.davs-preview{display:flex;gap:16px;align-items:stretch;padding:12px 14px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
  background:var(--dsw-alias-bg-layer-1)}
/* 左边那个**框**跟着右边长高，里面那个 bot 仍是 288px。
   为什么要分成两件事（2026-10-31）：加了「配色」以后右侧成了四组，
   总高 368px，而框还是写死的 288px —— 右边探出一截，正是用户第 100 轮
   报的「上下差太多」的形状。把框改成 stretch + min-height，两边永远齐平；
   而 bot 的绘制尺寸不变，288 那条「旧值 96 的三倍」的判据仍然成立。 */
.davs-preview-bot{flex-shrink:0;width:288px;min-height:288px;align-self:stretch;
  display:flex;align-items:center;justify-content:center;border-radius:10px;
  background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);
  padding:8px;box-sizing:border-box}

/* 三组按钮：每组成一块卡片，块内芯片排成固定三行的网格。 */
.davs-groups{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1}
.davs-group{display:flex;flex-direction:column;gap:4px;min-width:0;
  border:1px solid var(--dsw-alias-border-l2);border-radius:8px;
  padding:5px 8px;background:var(--dsw-alias-bg-layer-1)}
.davs-group-head{display:flex;align-items:baseline;gap:6px;font-size:10.5px;
  font-weight:600;color:var(--dsw-alias-label-secondary)}
.davs-group-cur{font-weight:400;color:var(--dsw-alias-label-tertiary)}
/* 列数由 --cols 给（= ceil(芯片数 / 3)），按行填充 —— 保证正好三行
   且保持从左到右的阅读顺序。 */
.davs-group-chips{display:grid;gap:4px;
  grid-template-columns:repeat(var(--cols,8),minmax(0,1fr))}
.davs-group-chips .davs-chip{padding:2px 4px;text-align:center;min-width:0}

/* ── 配色那一组：一行 12 枚「色点 + 名字」─────────────────────────────
   为什么单独一套：配色是 12 个，压三行会把右边撑得比左边高 128px
   （用户第 100 轮报的「上下差太多」又回来了）。压一行只要 368px 上下，
   和 288px 的预览基本齐平。

   ── 列数用 auto-fit 而不是写死 12 ─────────────────────────────────
   写死 repeat(12, 1fr) 在容器 773px 时会把每列压到 33px，「写文件」
   这种三字标签就被省略了（实测 4 枚被截）。改成 auto-fit + 最小 44px：
   宽的时候自然排成一行（960 容器下正好 12 枚一行），窄的时候自动折成
   两行 —— 折行只是长高一点，不会被截断。 */
.davs-group-chips-swatch{grid-template-columns:repeat(auto-fit,minmax(44px,1fr));gap:3px}
.davs-chip-swatch{display:flex;align-items:center;justify-content:center;gap:3px;
  padding:2px 3px;min-width:0}
.davs-chip-swatch .davs-swatch{width:8px;height:8px;border-radius:50%;flex-shrink:0;
  box-shadow:inset 0 0 0 1px rgba(0,0,0,.14)}
/* 选中态是实心蓝，色点会被蓝色盖住 —— 加一圈白描边把它顶出来。 */
.davs-chip-swatch.is-on .davs-swatch{box-shadow:0 0 0 1.5px #fff}

/* ── 轮播行 ── */
.davs-rows{display:flex;flex-direction:column;gap:1px;
  border:1px solid var(--dsw-alias-border-l2);border-radius:10px;overflow:hidden}
.davs-row{display:flex;align-items:center;gap:12px;padding:7px 12px;
  background:var(--dsw-alias-bg-layer-1);min-width:0}
.davs-row:nth-child(even){background:var(--dsw-alias-bg-layer-2)}
.davs-row[data-changed]{box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#3964fe)}
.davs-row-name{display:flex;align-items:center;gap:7px;flex-shrink:0;width:7.5em}
.davs-row-label{font-size:12px;font-weight:500;white-space:nowrap}
.davs-link{border:0;background:transparent;padding:0;font:inherit;font-size:10px;
  color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;white-space:nowrap}
.davs-link:hover{text-decoration:underline}

.davs-row-slots{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
.davs-slot{display:flex;align-items:center;gap:4px}
.davs-select{font:inherit;font-size:11.5px;padding:3px 5px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);cursor:pointer;max-width:8em}
.davs-select:hover{border-color:var(--dsw-alias-border-l1)}
.davs-times{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
.davs-num{font:inherit;font-size:11.5px;width:3.1em;padding:3px 4px;border-radius:6px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);text-align:center}
.davs-num:hover{border-color:var(--dsw-alias-border-l1)}
.davs-icon{width:19px;height:19px;display:flex;align-items:center;justify-content:center;
  border:1px dashed var(--dsw-alias-border-l1);background:transparent;border-radius:6px;
  color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:.13s}
.davs-icon:hover{border-style:solid;color:var(--dsw-alias-label-primary);
  border-color:var(--dsw-alias-state-business-primary,#3964fe)}
.davs-total{margin-left:auto;font-size:10.5px;color:var(--dsw-alias-label-tertiary);
  white-space:nowrap;font-variant-numeric:tabular-nums}

/* 自动分配顺位：每格一个「序号 + 下拉 + 减号」。
   用 grid 三列而不是 flex：序号要右对齐成一条竖线，下拉要等宽 ——
   flex 下每个下拉按自己内容定宽，看起来参差不齐。 */
.davs-order{display:grid;grid-template-columns:auto minmax(0,1fr) auto;
  gap:5px 7px;align-items:center;margin-top:8px;max-width:260px}
.davs-order-row{display:contents}
.davs-order-no{font-size:10.5px;color:var(--dsw-alias-label-tertiary);
  text-align:right;font-variant-numeric:tabular-nums;min-width:1.2em}
.davs-order .davs-select{max-width:none;width:100%}
.davs-icon:disabled{opacity:.35;cursor:not-allowed}
.davs-icon:disabled:hover{border-style:dashed;color:var(--dsw-alias-label-tertiary);
  border-color:var(--dsw-alias-border-l1)}
.davs-order-add{grid-column:2;justify-self:start}

/* ── 可折叠卡片（动画映射）──────────────────────────────────────────
   用户要求「做成和自动分配顺位一样的可折叠形态，用一个胶囊包裹」。
   所以整块包在一条圆角边框里，标题行右侧放展开/收起胶囊。
   胶囊本身复用 .davs-chip（is-on 表示已展开），和顺位那块完全一致。 */
.davs-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
  padding:12px 14px 14px;display:flex;flex-direction:column;gap:2px}
.davs-card-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}
.davs-card-tools{display:flex;align-items:center;gap:8px;flex-shrink:0}
/* 折叠时给一句摘要，避免「一片空白、不知道是收起来了还是坏了」 */
.davs-fold-note{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary)}

/* ── 顺位行（模仿动画映射的行结构）──────────────────────────────────
   左边一列「第 N 格」= 那边的一列活动名；右边是「图案 + 表情」= 那边的
   「动画 + 遍数」。用同一套 .davs-row / .davs-row-slots，所以两块的
   行高、间距、悬停底色完全一致 —— 这正是用户要的「结构一样」。 */
.davs-rows-preset{margin-top:8px}
.davs-rows-preset .davs-row-name{width:5.5em}
.davs-row-label-dim{color:var(--dsw-alias-label-tertiary);font-weight:400}
/* 缩略图：24px 只够分辨轮廓，够用且不把行撑高 */
.davs-preset-thumb{flex-shrink:0;width:24px;height:24px;display:flex;
  align-items:center;justify-content:center}
.davs-rows-preset .davs-select{max-width:7.5em}
/* 配色下拉比图案/表情窄一点：色名都是两三个字，不需要 7.5em。
   行里现在有四个控件（图案 / 配色 / 表情 / 试播 / 减号），窄下来才排得开。 */
.davs-rows-preset .davs-select-color{max-width:5em}
.davs-row-add{background:transparent !important}
.davs-row-add .davs-row-slots{align-items:center}

/* ── 行尾「试播」小按钮 ──────────────────────────────────────────────
   为什么不是 .davs-icon（那个是 ＋ / − 的虚线方框）：试播是**动词**，
   要带字。虚线框里放两个字会挤成一团，所以复用 .davs-btn 的描边样式，
   只把它压到和下拉等高、字更小 —— 它在行尾属于「附属动作」，
   不该比左边的下拉更抢眼。 */
.davs-btn-try{padding:2px 7px;font-size:10.5px;line-height:1.5;
  border-radius:6px;white-space:nowrap;flex-shrink:0}

/* ── 芯片组（休眠阈值 / 帧率 / 试片选择）── */
.davs-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
.davs-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);border-radius:7px;padding:4px 9px;
  font:inherit;font-size:11.5px;cursor:pointer;transition:.13s;white-space:nowrap}
.davs-chip:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
.davs-chip.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
.davs-chip-sm{font-size:10.5px;padding:2px 7px}

/* ── 折叠胶囊 ────────────────────────────────────────────────────────
   和「选中某项」的芯片**必须长得不一样**：is-on 的实心蓝在这里会读成
   「当前选中了展开」，而它其实只是个开合开关。所以这里不用实心，
   改用描边 + 一个朝下/朝上的小箭头表达状态。 */
.davs-chip-toggle{display:inline-flex;align-items:center;gap:4px;
  border-radius:999px;padding:3px 10px}
.davs-chip-toggle::after{content:'▾';font-size:9px;line-height:1;opacity:.65;
  transform:translateY(-1px);transition:transform .13s}
.davs-chip-toggle.is-on{background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l1)}
.davs-chip-toggle.is-on:hover{border-color:var(--dsw-alias-state-business-primary,#3964fe);
  color:var(--dsw-alias-label-primary)}
.davs-chip-toggle.is-on::after{content:'▴'}
.davs-note{font-size:10.5px;color:var(--dsw-alias-label-tertiary);line-height:1.5}

.davs-foot{margin:0;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l2);
  font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.6}

/* 以实际插件表单宽度而非桌面窗口宽度判定窄栏；设置页可嵌在宽窗口的小侧面板。 */
@container (max-width:560px){
  .davs-row{flex-direction:column;align-items:flex-start;gap:6px}
  .davs-row-name{width:auto}
  .davs-total{margin-left:0}
}

/* ── 窄容器：三行网格会挤坏标签，退回「上下排 + 自然换行」────────────
   ── 断点 780px 是量出来的，不是挑的 ──────────────────────────────────
   三行网格每列要放得下最宽的标签（「跑命令」「圆角方」约 45px）。
   按钮区宽 = 容器宽 - 288(方块) - 16(gap) - 28(padding)，8 列时
   每列 ≈ (按钮区 - 7*4 - 16)/8。实测：
       容器 775 → 按钮区 443 → 每列 50px  ✅ 零省略
       容器 701 → 按钮区 369 → 每列 41px  ✂「写文件」「跑命令」被省
       容器 628 → 按钮区 296 → 每列 32px  ✂ 同上
       容器 554 → 按钮区 222 → 每列 22px  ✂ 41 个芯片全挤坏
   所以这条路只在容器 ≥ 780px 成立。
   DSH 设置页最宽 960px（PluginManagerPage.module.css 的 max-width），
   窗口足够宽时正好落在这个区间里 —— 960 下按钮区 598px，每列 69px，宽裕。

   780 以下改成方块在上、三组在下铺满整宽：那时按钮区有整个容器宽
   （例如容器 474 时约 442px），比挤在右侧的 142px 好得多。 */
@container (max-width:779px){
  .davs-preview{flex-direction:column;align-items:stretch}
  .davs-preview-bot{width:100%;max-width:288px;margin:0 auto}
  /* 行数不再固定：固定三行在窄容器里必然挤坏标签，自然换行至少可读 */
  .davs-group-chips{grid-template-columns:repeat(auto-fill,minmax(54px,1fr))}
}

@media (max-width:720px){
  .dav-root{flex-direction:column}
  .dav-side{max-width:none;border-left:0;border-top:1px solid var(--dsw-alias-border-l2)}
}
`

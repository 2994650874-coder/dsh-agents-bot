/**
 * 设置页「试片区」版式候选稿 —— 只看版式，不改产品代码。
 *
 * ── 用户的原话（2026-10-30）──────────────────────────────────────────
 *   「能不能让预览的高度变成如今的三倍，然后左侧是预览，右侧是三组按钮，
 *    然后每组按钮你也重新看一下，是做成双行还是三行（上下差不多，现在上下
 *    差太多了），就是取得一个视觉上的平衡点，可以预览稍大一点。」
 *
 * ── 现状是量出来的，不是估的 ────────────────────────────────────────
 *   probe-settings-preview.mjs 在真 SettingsPage 上量到（设置页宽 440）：
 *     预览框 96px  ·  右侧按钮区 297px  ·  相差 201px
 *   也就是右侧比左侧高**三倍**，这就是「上下差太多」。三倍正好是用户说的
 *   「预览变成三倍」—— 放大之后两边自然齐平。他的判断是准的。
 *
 * ── 三个必须一起看的量 ──────────────────────────────────────────────
 *   1. 预览和按钮区的高度差（越小越平衡）
 *   2. 按钮区被迫折成几行（行数越多越乱）
 *   3. 设置页要多宽才放得下（288px 的预览是方的，占宽也占高）
 *
 * 第 3 点是真正的约束：设置页宽 440 时，预览占 288 + 间距 16，
 * 按钮区只剩约 110px，芯片会碎成一列。所以宽度的答案是**必须变宽**，
 * 或者预览缩小。候选 D 就是「不占宽」的那条路。
 *
 * 芯片标签全部从产品代码取，不手抄 —— 手抄的稿子会「看起来放得下」。
 *
 * 用法（在 grokbot 目录下）：
 *   node tools/build-settings-sketches.mjs
 *   打开 preview/settings-sketches.html?w=620
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Bot } from '../plugin/src/client/Bot'
import { STYLE } from '../plugin/src/client/style'
import { ANIMATION_OPTIONS } from '../plugin/src/client/activities'
import { SHAPE_OPTIONS, EXPRESSION_OPTIONS, DEFAULT_LOOK } from '../plugin/src/client/look'

const params = new URLSearchParams(location.search)
const W = Number(params.get('w') ?? 620)

const style = document.createElement('style')
style.textContent =
  STYLE +
  `
  html,body{margin:0;background:#eef1f6;font-family:-apple-system,"Segoe UI",sans-serif}
  body{padding:16px}
  .sk-root{display:flex;flex-direction:column;gap:16px;align-items:flex-start}
  .sk-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);
    border-radius:10px;width:${W}px;display:flex;flex-direction:column;overflow:hidden}
  .sk-card-head{padding:8px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);
    font-size:12px;font-weight:600;background:var(--dsw-alias-bg-layer-2);
    display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
  .sk-tag{font-size:10px;font-weight:600;color:#fff;background:#3964fe;
    border-radius:4px;padding:1px 5px}
  .sk-tag-b{background:#3fbe86}
  .sk-tag-c{background:#f5b13f}
  .sk-tag-d{background:#9a72ee}
  .sk-why{font-size:10.5px;font-weight:400;color:var(--dsw-alias-label-tertiary)}
  .sk-body{padding:12px 14px 16px}
  :root{--dsw-alias-label-primary:#1c1f24;--dsw-alias-label-secondary:#4a5160;
    --dsw-alias-label-tertiary:#8b929e;--dsw-alias-bg-layer-1:#fff;
    --dsw-alias-bg-layer-2:#f7f8fa;--dsw-alias-bg-layer-3:#f1f3f7;
    --dsw-alias-border-l1:#d5dae3;--dsw-alias-border-l2:#e6e9ef;
    --dsw-alias-state-business-primary:#3964fe;--dsw-alias-state-error-primary:#e0563f}

  /* 通用：左预览 / 右三组 */
  .sk-split{display:flex;gap:14px;align-items:flex-start}
  .sk-prev{flex-shrink:0;display:flex;flex-direction:column;align-items:center;
    gap:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
    background:var(--dsw-alias-bg-layer-2);padding:8px}
  .sk-groups{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}
  .sk-group{display:flex;flex-direction:column;gap:4px;min-width:0;
    border:1px solid var(--dsw-alias-border-l2);border-radius:8px;
    padding:5px 8px;background:var(--dsw-alias-bg-layer-1)}
  .sk-group-head{display:flex;align-items:baseline;gap:6px;font-size:10.5px;
    font-weight:600;color:var(--dsw-alias-label-secondary)}
  .sk-group-cur{font-weight:400;color:var(--dsw-alias-label-tertiary)}

  /* 芯片：自然换行 */
  .sk-chips{display:flex;flex-wrap:wrap;gap:4px}
  /*
   * 芯片：固定行数的网格。
   *
   * ── 为什么列数要算出来，不能靠 grid-auto-flow:column ────────────────
   * 第一版用了 grid-auto-flow:column 配固定 3 行，结果芯片被**先竖着填满
   * 一列再换下一列**：阅读顺序从「空闲 思考 眨眼…」变成「空 思 眨…」，
   * 完全乱了。那是画错了，不是版式问题。
   *
   * 正确做法：行数固定，**列数由芯片总数算出来**
   * （列数 = ceil(总数 / 行数)），网格用默认的按行填充 —— 这样既保证
   * 正好 N 行，又保持从左到右的阅读顺序。列数用内联 --cols 传入。
   *
   * ── 但固定列数会把宽标签挤扁 ────────────────────────────────────────
   * 24 个动画分 3 行 = 8 列，每列只有约 30px，而「跑命令」要 40px 以上。
   * 实测：不裁切就会溢出成第 4 行，裁切就变成「空…」。所以**行数不能
   * 只看美观，要由「最宽的标签 × N 列」倒推**。候选稿如实展示这个代价，
   * 不拿 ellipsis 掩盖它 —— 掩盖了就变成「看起来能用」。
   */
  .sk-chips-grid{display:grid;gap:4px;
    grid-template-columns:repeat(var(--cols,8),minmax(0,1fr))}

  /* D：预览在上、三组在下排三列 */
  .sk-d{display:flex;flex-direction:column;gap:12px}
  .sk-d-top{display:flex;align-items:center;gap:16px;
    border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
    background:var(--dsw-alias-bg-layer-2);padding:10px}
  .sk-d-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}

  .sk-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
    color:var(--dsw-alias-label-secondary);border-radius:6px;padding:2px 6px;
    font:inherit;font-size:10.5px;cursor:pointer;white-space:nowrap;
    text-align:center;min-width:0}
  .sk-chip.is-on{border-color:#3964fe;background:#3964fe;color:#fff}
  .sk-label{font-size:12px;font-weight:600;margin:0}
  .sk-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary);margin:0;line-height:1.5}
  `
document.head.appendChild(style)

/* 真实标签，全部从产品代码取。 */
const ANIMS = ANIMATION_OPTIONS.map((o) => ({ id: o.id as string, label: o.label }))
const SHAPES = Object.entries(SHAPE_OPTIONS as Record<string, string>)
const EXPRS = Object.entries(EXPRESSION_OPTIONS as Record<string, string>)

/**
 * 三组按钮。
 *
 * `rows` 给出时用固定行数的网格（「双行 / 三行」就是这个意思 ——
 * 每组的芯片排满固定行数，组的高度因此可预测，不会因为标签长短而跳）；
 * 不给时用自然换行（现状）。
 */
function Groups({ rows, cur }: { rows?: 2 | 3; cur?: boolean }) {
  const [anim, setAnim] = useState('orbit')
  const [shape, setShape] = useState('circle')
  const [expr, setExpr] = useState('neutral')

  const cls = rows ? 'sk-chips sk-chips-grid' : 'sk-chips'

  const group = (
    title: string,
    curLabel: string,
    items: { id: string; label: string }[],
    value: string,
    onPick: (id: string) => void
  ) => {
    /*
     * 列数由「总数 / 行数」算出并向上取整 —— 这是保持阅读顺序从左到右的
     * 关键（见 style 里 `sk-chips-grid` 的说明）。在函数体内算，因为每组
     * 的芯片数量不同（动画 24、图案 14、表情 16）。
     */
    const cols = rows ? Math.ceil(items.length / rows) : 0
    const st = rows
      ? ({ ['--cols' as never]: cols } as React.CSSProperties)
      : undefined
    return (
      <div className="sk-group" data-group={title}>
        <div className="sk-group-head">
          {title}
          {cur ? <span className="sk-group-cur">{curLabel}</span> : null}
        </div>
        <div className={cls} style={st} data-rows={rows ?? 0}>
          {items.map((it) => (
            <button
              key={it.id}
              className={`sk-chip${value === it.id ? ' is-on' : ''}`}
              onClick={() => onPick(it.id)}
            >
              {it.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {group('动画', ANIMS.find((a) => a.id === anim)?.label ?? '', ANIMS, anim, setAnim)}
      {group('图案', SHAPES.find((s) => s[0] === shape)?.[1] ?? '', SHAPES.map(([id, label]) => ({ id, label })), shape, setShape)}
      {group('表情', EXPRS.find((e) => e[0] === expr)?.[1] ?? '', EXPRS.map(([id, label]) => ({ id, label })), expr, setExpr)}
    </>
  )
}

function BotBox({ size, state = 'orbit' }: { size: number; state?: string }) {
  return (
    <div
      style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      data-bot={size}
    >
      <Bot state={state as never} look={{ ...DEFAULT_LOOK, size }} paper="transparent" />
    </div>
  )
}

function Card({ tag, cls, title, why, children }: {
  tag: string
  cls: string
  title: string
  why: string
  children: React.ReactNode
}) {
  return (
    <div className="sk-card" data-card={tag}>
      <div className="sk-card-head">
        <span className={`sk-tag ${cls}`}>{tag}</span>
        {title}
        <span className="sk-why">{why}</span>
      </div>
      <div className="sk-body">{children}</div>
    </div>
  )
}

function Root() {
  return (
    <div className="sk-root">
      <Card
        tag="A"
        cls=""
        title="预览 288 · 右三组自然换行"
        why="芯片沿用现状的自然换行，不强制行数"
      >
        <div className="sk-split">
          <div className="sk-prev">
            <BotBox size={288} />
            <p className="sk-label">试片 · 环绕</p>
            <p className="sk-hint">一遍约 3.4 秒</p>
          </div>
          <div className="sk-groups">
            <Groups cur />
          </div>
        </div>
      </Card>

      <Card
        tag="B"
        cls="sk-tag-b"
        title="预览 288 · 右三组各压成三行"
        why="每组固定三行，组高可预测；标签长短不再影响版式"
      >
        <div className="sk-split">
          <div className="sk-prev">
            <BotBox size={288} />
            <p className="sk-label">试片 · 环绕</p>
          </div>
          <div className="sk-groups">
            <Groups rows={3} cur />
          </div>
        </div>
      </Card>

      <Card
        tag="C"
        cls="sk-tag-c"
        title="预览 288 · 右三组各压成两行"
        why="最省高度的一版；每行芯片较多，要求设置页够宽"
      >
        <div className="sk-split">
          <div className="sk-prev">
            <BotBox size={288} />
            <p className="sk-label">试片 · 环绕</p>
          </div>
          <div className="sk-groups">
            <Groups rows={2} cur />
          </div>
        </div>
      </Card>

      <Card
        tag="D"
        cls="sk-tag-d"
        title="预览 288 在上 · 三组在下排三列"
        why="预览不占横向空间，窄设置页也能用；上下最平衡"
      >
        <div className="sk-d">
          <div className="sk-d-top">
            <BotBox size={288} />
            <div>
              <p className="sk-label">试片 · 环绕</p>
              <p className="sk-hint">一遍约 3.4 秒</p>
              <p className="sk-hint">下方三列分别选 动画 / 图案 / 表情</p>
            </div>
          </div>
          <div className="sk-d-cols">
            <Groups rows={3} />
          </div>
        </div>
      </Card>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<Root />)

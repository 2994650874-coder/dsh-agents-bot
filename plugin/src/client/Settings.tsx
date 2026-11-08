/**
 * 设置页：通用配置。
 *
 * ── 它在哪 ──────────────────────────────────────────────────────────
 * 「设置 → 插件 → dsh-agents-bot」详情页里，描述与组件列表之间。
 * 走的是 `plugins.bundle.config` slot（keyed，键 = 包名），和官方那几个
 * 设置页、以及 dsh-connect-workbuddy 同一个位置 —— 不是 `plugins.item`
 * （那个是「官方插件」分组里的卡片，只有官方四个页面用）。
 *
 * ── 为什么这里只有「通用」的东西 ────────────────────────────────────
 * 分界线一句话：**设置页是对整个通用的，右栏留下的是针对个体的。**
 *
 *  · 帧率、每个活动配哪个动画、休眠阈值 = 「这台机器上所有 agent 都这样
 *    反应」→ 配置，放这里
 *  · 身形、配色、表情 = 「我喜欢这个 bot 长这样」→ 审美，留右栏
 *
 * 试片也在这里，因为它服务于「动画映射」—— 配置和预览必须挨着，
 * 否则配完要来回切。右栏的格子本身就在实时显示真实状态，不需要第二个
 * 预览位。
 *
 * ── 为什么不走宿主设置文档（configForms）──────────────────────────────
 * 官方设置页和 workbuddy 都通过 `ctx.configForms` 把偏好写进宿主设置
 * 文档。那是因为它们管的是 **Host 侧行为**（provider、执行器超时），
 * Host 必须读到。
 *
 * 这里的帧率和动画映射是**纯渲染偏好**，Host 不需要知道。所以继续用
 * localStorage（帧率本来就在那儿），换来三件事：
 *  1. 不依赖 `configForms` 服务 —— 它缺席时页面照样能用
 *  2. 不用处理 `whileServed` 的异步镜像（workbuddy 为此踩过 issue #46：
 *     镜像晚到导致绑定永远 unavailable，勾选框点了没反应）
 *  3. 不在「设置 → 插件」里多出一份重复的通用表单
 *
 * 代价：换一台机器不跟着走。对「我喜欢这个 bot 长这样」这类偏好，
 * 这恰恰是想要的行为。
 *
 * ── 一条硬约束 ──────────────────────────────────────────────────────
 * **不要在这里读 `useSessions` / `useSessionStatus`。** 设置页是 root
 * 作用域的 slot，没有 session 绑定；那几个 hook 是 per-session 的。
 * 预览用的 bot 只需要 store 里的配置，不需要真实 agent。
 */
import { useEffect, useMemo, useState } from 'react'
import { Bot } from './Bot'
import {
  ACTIVITY_LABEL,
  ACTIVITY_ORDER,
  ANIMATION_OPTIONS,
  DEFAULT_ROTATION,
  MAX_PLAYS,
  MAX_ROTATION_ITEMS,
  MIN_PLAYS,
  SLEEP_OPTIONS,
  type Activity,
  type Rotation
} from './activities'
import { cycleLength, describeRotation, describeShort, playLengthOf } from './rotation'
import { COLOR_OPTIONS, EXPRESSION_OPTIONS, inkOf, PRESET_MAX, PRESET_MIN, SHAPE_OPTIONS } from './look'
import { EYES_OPEN_AT } from '../bot/face'
import { STATE_BY_ID } from '../bot/states'
import {
  addPresetRow,
  DWELL_OPTIONS,
  FPS_OPTIONS,
  playRotationInPreview,
  presetChanged,
  previewSlotOf,
  removePresetAt,
  resetAllRotation,
  resetPreset,
  resetRotation,
  rotationChanged,
  setDwellMs,
  setFps,
  setPresetAt,
  setPreview,
  setPreviewColor,
  setPreviewExpression,
  setPreviewShape,
  setRotation,
  setSleepMinutes,
  stopPreviewRotation,
  useUi
} from './store'

/**
 * 动画 id → 中文名。用 `ANIMATION_OPTIONS` 推，不另列。
 */
const ANIMATION_LABEL = new Map(ANIMATION_OPTIONS.map((o) => [o.id, o.label]))

/**
 * 点了要先确认一次的按钮（二级确认）。
 *
 * ── 为什么需要它（2026-10-31）────────────────────────────────────────
 * 用户：「动画映射和自动分配顺位的恢复默认都增加一个二级确定，不然很容易
 * 点到」。
 *
 * 这不是多余的谨慎：这两个按钮都是**一键抹掉全部手工配置**，而且它们就躺在
 * 收起胶囊左边 —— 想点「收起」时手指偏一格就中了。`恢复默认` 一旦点下去
 * 没有撤销，也没有二次机会（旧值直接被覆盖）。
 *
 * ── 为什么不用 window.confirm ────────────────────────────────────────
 * 原生弹窗会**阻塞渲染线程**，而设置页里有一个 60fps 的预览 bot 在跑；
 * 弹窗期间它停住，关掉之后跳一帧。用内联的两段式按钮就没有这个问题，
 * 而且样式和页面一致。
 *
 * ── 交互 ─────────────────────────────────────────────────────────────
 * 第一次点 → 文字变成确认语（红色边框），3 秒内再点才真的执行；
 * 超时或点别处就退回原样。不做成「两枚按钮并排」是因为标题行右侧空间
 * 只够一枚，硬塞会把它挤成两行。
 */
function ConfirmButton({
  className,
  label,
  confirmLabel,
  title,
  onConfirm
}: {
  className?: string
  label: string
  confirmLabel: string
  title?: string
  onConfirm: () => void
}) {
  const [armed, setArmed] = useState(false)

  /*
   * 3 秒后自动退回。为什么要超时：否则「误点一次」之后按钮进确认态并且
   * 一直停在那儿，下次再误点一下就真的执行了 —— 等于把防误触变成了延迟
   * 误触。收回的计时器必须在卸载/重新进入时清掉，否则会对着已卸载的组件
   * setState。
   */
  useEffect(() => {
    if (!armed) return
    const id = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(id)
  }, [armed])

  return (
    <button
      className={`${className ?? ''}${armed ? ' is-armed' : ''}`}
      title={armed ? '再点一次才会执行' : title}
      onClick={() => {
        if (!armed) {
          setArmed(true)
          return
        }
        setArmed(false)
        onConfirm()
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  )
}

export function SettingsPage() {
  const rotation = useUi('rotation')
  const fps = useUi('fps')
  const dwellMs = useUi('dwellMs')
  const sleepMinutes = useUi('sleepMinutes')
  const preview = useUi('preview')
  const previewShape = useUi('previewShape')
  const previewColor = useUi('previewColor')
  const previewExpression = useUi('previewExpression')
  const previewRotation = useUi('previewRotation')
  const look = useUi('look')

  const changedCount = ACTIVITY_ORDER.filter((a) => rotationChanged(a)).length

  /**
   * 「动画映射」整块可折叠。
   *
   * ── 默认收起（2026-10-31 改）────────────────────────────────────────
   * 用户原话：「动画映射我每次从插件-设置点进去，他都是展开的，能做成那种
   * 静态的默认页面，点进去默认是关的，而且我一离开设置页面就回弹收起吗？」
   *
   * 原来默认展开，理由是「它是最常改的一块，收起来等于每次进来都多点一下」。
   * 用户的实际使用否掉了这条：13 行 × (两个下拉 + 倍率 + 时长) 展开后把
   * 下面的「自动分配顺位」「休眠」「帧率」全推到屏幕外，进来第一眼看到的
   * 是一堵表单墙。他进来多数时候只是想**看**一眼，不是要改。
   *
   * 「离开就回弹」不需要额外代码：这个值本来就**不持久化**（`useState`，
   * 组件卸载即丢）。所以「默认 false」同时兑现了两个要求 —— 首次进来是收起的，
   * 改完离开再回来又是收起的。
   *
   * 为什么不持久化仍然是正确的：记住「上次收着」会让下次进来发现内容不见了，
   * 却不知道是折叠了还是坏了。
   */
  const [mapOpen, setMapOpen] = useState(false)

  /**
   * 试片的实际外观：点过的用点的，没点过的跟全局。
   *
   * 这个合并只在这里做一次，下面 `Preview` 直接拿它渲染**和高亮** ——
   * 高亮因此天然和画面一致，不会出现「画面是三角、高亮还停在圆」。
   */
  const previewLook = useMemo(
    () => ({
      ...look,
      shape: previewShape ?? look.shape,
      color: previewColor ?? look.color,
      expression: previewExpression ?? look.expression
    }),
    [look, previewShape, previewColor, previewExpression]
  )

  return (
    <div className="davs">
      {/* ── 试片（两块共用）──────────────────────────────────────────
          v0.3.11 起从「动画映射」内部挪到最上面。它现在同时服务下面的两块：
          「动画映射」看动作（左列动画芯片），「自动分配顺位」看图案 + 配色 +
          表情（下面三列）。一块顶两块，不用两边各放一个。

          放最上面还有一条实际好处：两块卡片都收起时它照样在，
          不会「一收起来就什么都不剩」。 */}
      <Preview preview={preview} rotation={previewRotation} look={previewLook} />

      {/* ── 动画映射（可折叠）────────────────────────────────────────
          用户要求「做成和自动分配顺位一样的可折叠形态，用一个胶囊包裹」。
          所以标题行右边放一枚胶囊（展开/收起），内容整体收在下面。
          `data-block` 是给验证脚本的稳定锚点：两块卡片长得一样，
          按标题文字找容易串，按这个属性找不会。 */}
      <section className="davs-card" data-block="map">
        <div className="davs-card-head">
          <div>
            <h4 className="davs-title">动画映射</h4>
            <p className="davs-desc">
              每个活动播哪几个动画、各播几遍。最多两项轮播 —— 配一项就是固定播，配两项就交替。
              按「遍」而不是「秒」，是因为每个动画长度不同（眨眼 1.6 秒、检索 3.4 秒），
              按遍数配所见即所得，而且不会被截断。
            </p>
          </div>
          <div className="davs-card-tools">
            {/*
              ── 为什么按钮现在**无条件显示**（2026-10-31 修）──────────────
              原来这里是 `{changedCount > 0 ? <按钮/> : null}`，即「有改动才出现」。
              那个条件在同一天变成了 bug：

              用户要求「把我目前的动画映射烧录成插件默认」，于是
              `DEFAULT_ROTATION` 就是**他自己的配置**。他的存盘 == 新默认，
              `changedCount` 恒为 0，按钮**永远不出现** —— 他报的就是
              「两个恢复默认的按钮不见了」。

              这不是「烧录和按钮谁对谁错」，是两者叠加才出的事：单独任何一个都正常。
              修法取「按钮常驻」而不是「撤掉烧录」，因为：
                · 他明确要的是「新人装上就长这样」，那条已生效
                · 他要按钮「一直在、点了才弹二次确认」——常驻才符合这句话
                · 「没改动时藏起来」本来只是个减少视觉噪音的小优化，
                  代价是让人以为功能没了，不划算
            */}
            <ConfirmButton
              className="davs-btn"
              label="恢复默认"
              confirmLabel={`确认恢复 ${ACTIVITY_ORDER.length} 个活动？`}
              title={
                changedCount > 0
                  ? `把所有活动恢复成默认（当前 ${changedCount} 项已改）`
                  : '把所有活动恢复成默认（当前没有改动）'
              }
              onConfirm={resetAllRotation}
            />
            <button
              className={`davs-chip davs-chip-toggle${mapOpen ? ' is-on' : ''}`}
              onClick={() => setMapOpen((v) => !v)}
              title={mapOpen ? '收起这一块' : '展开这一块'}
            >
              {mapOpen ? '收起' : '展开调整'}
            </button>
          </div>
        </div>

        {mapOpen ? (
          <>
            <div className="davs-rows">
              {ACTIVITY_ORDER.map((activity) => (
                <RotationRow
                  key={activity}
                  activity={activity}
                  rotation={rotation[activity]}
                  changed={rotationChanged(activity)}
                />
              ))}
            </div>
          </>
        ) : (
          <p className="davs-fold-note">
            已收起 · {ACTIVITY_ORDER.length} 个活动
            {changedCount > 0 ? ` · ${changedCount} 项已改` : ''}
          </p>
        )}
      </section>

      {/* ── 自动分配顺位：放在动画映射和休眠之间 ──────────────────────
          它和上面那些行的区别：上面是「一个活动播什么动画」，这里是
          「一格长什么样」。两者都是「配一次、之后自动」，所以挨在一起；
          但它管的是外观不是动画，所以单独一段。 */}
      <PresetSection />

      {/* ── 休眠阈值：单独一行，不是动画 ────────────────────────────────
          它是「多久没动静就切到休眠」的判据，不是某个活动的播放列表，
          所以视觉上和上面那些轮播行分开。 */}
      <div className="davs-section">
        <h4 className="davs-title">休眠</h4>
        <p className="davs-desc">
          一个 agent 多久没有活动之后，就画成休眠状态。
        </p>
        <div className="davs-chips">
          {SLEEP_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={`davs-chip${sleepMinutes === o.id ? ' is-on' : ''}`}
              onClick={() => setSleepMinutes(o.id)}
            >
              {o.label}
            </button>
          ))}
          <span className="davs-note">无活动超过这个时长即进入休眠</span>
        </div>
      </div>

      {/* ── 帧率 ──────────────────────────────────────────────────────── */}
      <div className="davs-section">
        <h4 className="davs-title">帧率</h4>
        <p className="davs-desc">
          整个面板共用一档，不按 agent 区分。这是上限不是实际帧率 —— 屏幕刷新率是天花板，
          这里只负责往下压。
        </p>
        <div className="davs-chips">
          {FPS_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={`davs-chip${fps === o.id ? ' is-on' : ''}`}
              title={o.hint}
              onClick={() => setFps(o.id)}
            >
              {o.label}
            </button>
          ))}
          <span className="davs-note">
            {FPS_OPTIONS.find((o) => o.id === fps)?.hint ?? ''}
          </span>
        </div>
      </div>

      {/* ── 动画停留（节流）───────────────────────────────────────────── */}
      <div className="davs-section">
        <h4 className="davs-title">动画停留</h4>
        <p className="davs-desc">
          每个动画至少显示这么久，才允许换成下一个。工具调用本身很短（读文件约 8 毫秒、
          改文件约 26 毫秒），而对应动画要 2~3.4 秒 —— 不节流时一半以上的动画播不完，
          看起来像一闪而过。开启后画面会平滑一些，代价是极短的活动可能被合并掉。
        </p>
        <div className="davs-chips">
          {DWELL_OPTIONS.map((o) => (
            <button
              key={o.id}
              className={`davs-chip${dwellMs === o.id ? ' is-on' : ''}`}
              title={o.hint}
              onClick={() => setDwellMs(o.id)}
            >
              {o.label}
            </button>
          ))}
          <span className="davs-note">
            {DWELL_OPTIONS.find((o) => o.id === dwellMs)?.hint ?? ''}
          </span>
        </div>
      </div>

      <p className="davs-foot">
        形状、配色、表情属于单个 bot 的外观，在右栏「活动 AI → 外观」里调。
      </p>
    </div>
  )
}

/**
 * 自动分配顺位：第 2~9 格各长什么样。
 *
 * ── 为什么它放在设置页而不是右栏 ────────────────────────────────────
 * 右栏的外观面板是「调**这一个** bot 长什么样」，是审美；
 * 这里是「加格子时**自动**拿什么」，是规则。规则属于设置。
 *
 * ── 结构为什么照抄「动画映射」────────────────────────────────────────
 * 用户明确要求「模仿上面的动画映射的结构，前面是预设的图案，后面是表情」。
 * 照抄的是**行结构**：左边一列是「这一行是谁」（那里是活动名，这里是格号），
 * 右边一列是「配什么」（那里是动画 + 遍数，这里是图案 + 表情），行尾一个减号。
 *
 * 好处不只是好看：两块长得一样，用户不用学第二套操作。
 *
 * ── 每行前面为什么有一张小图 ────────────────────────────────────────
 * 「穹顶」「害羞」这两个词看不出配起来长什么样。下拉框只给名字，
 * 缩略图给样子 —— 而且它是「图案 + 配色 + 表情」的真实组合，不是图案单独一张。
 *
 * 试片也能看组合，但试片一次只能看一个：核对 8 行要来回切 16 次。
 * 缩略图负责扫一眼，试片负责放大看，两者不重复。
 *
 * ── 配色槽是 2026-10-31 加的（用户要求）───────────────────────────
 * 在那之前配色只能全局调，9 个格子颜色全一样 —— 网格里最缺的其实不是
 * 图案差异，是颜色差异。加了槽以后每行多一个下拉。
 *
 * 下拉里用色名（「棕」「红」……），不是色值：用户认的是名字。
 * 想验证「这个色到底什么样」就看左边那枚 24px 缩略图，它已经是真实配色。
 *
 * ── 第 1 格为什么不在这里 ──────────────────────────────────────────
 * 第 1 格永远是当前窗口，外观由右栏「外观 · 全局」决定。这里从第 2 格开始。
 * 所以 8 行 + 第 1 格 = 9 格 = 监视上限。
 */
function PresetSection() {
  const preset = useUi('preset')
  const look = useUi('look')
  const changed = presetChanged()
  const [expanded, setExpanded] = useState(false)

  /** 能选的图案 / 配色 / 表情：全部（包括默认不在表里的水滴、拱门、墨黑）。 */
  const shapeOpts = Object.entries(SHAPE_OPTIONS)
  const colorOpts = Object.entries(COLOR_OPTIONS)
  const exprOpts = Object.entries(EXPRESSION_OPTIONS)

  const tooFew = preset.length < PRESET_MAX

  return (
    /* 和「动画映射」同一种外壳：圆角边框 + 标题行右侧工具区。
       v0.3.11 起两块真正长得一样 —— 之前只有动画映射有壳、收起胶囊
       还沉在标题下面，用户要求「收起挪到和动画映射一样的位置」。 */
    <section className="davs-card" data-block="preset">
      <div className="davs-card-head">
        <div>
          <h4 className="davs-title">自动分配顺位</h4>
          <p className="davs-desc">
            加第 N 个格子时，它长什么样 —— 每行一个「形状 + 配色 + 表情」。
            第 1 格永远是当前窗口，由右栏的「外观 · 全局」决定，不在这里。
            所以 {PRESET_MAX} 行正好覆盖第 2~{PRESET_MAX + 1} 格。
            行数少于格子数会「从头重复」。
          </p>
        </div>
        <div className="davs-card-tools">
          {/* 无条件显示，理由同「动画映射」那一处：烧录后 `changed` 恒为 false，
              带条件的按钮会永远消失。见那段长注释。 */}
          <ConfirmButton
            className="davs-btn"
            label="恢复默认"
            confirmLabel="确认恢复顺位？"
            title={changed ? '恢复成默认顺位（当前已改）' : '恢复成默认顺位（当前没有改动）'}
            onConfirm={resetPreset}
          />
          <button
            className={`davs-chip davs-chip-toggle${expanded ? ' is-on' : ''}`}
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? '收起这一块' : '展开这一块'}
          >
            {expanded ? '收起' : '展开调整'}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <div className="davs-rows davs-rows-preset">
            {preset.map((slot, i) => (
              <div className="davs-row" key={i}>
                <div className="davs-row-name">
                  <span className="davs-row-label">第 {i + 2} 格</span>
                </div>

                <div className="davs-row-slots">
                  {/* 缩略图：图案 + 配色 + 表情的真实组合。size 24 足够分辨轮廓，
                      再大就把这一行撑成两行高。frozenAt 用「第一次眨眼前」，
                      这样眼睛是睁着的（否则可能撞上眨眼，看着像闭眼）。 */}
                  <span className="davs-preset-thumb" title="这一格的实际样子">
                    <Bot
                      state="idle"
                      look={{
                        ...look,
                        shape: slot.shape,
                        color: slot.color ?? look.color,
                        expression: slot.expression,
                        size: 24
                      }}
                      frozenAt={EYES_OPEN_AT}
                      paper="transparent"
                    />
                  </span>

                  <select
                    className="davs-select"
                    value={slot.shape}
                    onChange={(e) => setPresetAt(i, { shape: e.target.value })}
                    title={`第 ${i + 2} 格用哪个形状`}
                  >
                    {shapeOpts.map(([optId, label]) => (
                      <option key={optId} value={optId}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {/* 配色：下拉里只有色名，真实颜色看左边缩略图。 */}
                  <select
                    className="davs-select davs-select-color"
                    value={slot.color ?? look.color}
                    onChange={(e) => setPresetAt(i, { color: e.target.value })}
                    title={`第 ${i + 2} 格用哪个配色`}
                  >
                    {colorOpts.map(([optId, label]) => (
                      <option key={optId} value={optId}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="davs-select"
                    value={slot.expression}
                    onChange={(e) => setPresetAt(i, { expression: e.target.value })}
                    title={`第 ${i + 2} 格用哪个表情`}
                  >
                    {exprOpts.map(([optId, label]) => (
                      <option key={optId} value={optId}>
                        {label}
                      </option>
                    ))}
                  </select>

                  {/* 「试播」：把这一行原样搬到上面的试片里 —— 图案 + 配色 + 表情
                      一次全带过去。用户原话：「每一行后面都追加一个试播，
                      然后直接反馈到预览去，这样就不用回到窗口去观察了」。 */}
                  <button
                    className="davs-btn davs-btn-try"
                    onClick={() => previewSlotOf({ ...slot, color: slot.color ?? look.color })}
                    title="把这一行的样子放到上面的试片里看"
                  >
                    试播
                  </button>

                  <button
                    className="davs-icon"
                    onClick={() => removePresetAt(i)}
                    disabled={preset.length <= PRESET_MIN}
                    title={preset.length <= PRESET_MIN ? `至少保留 ${PRESET_MIN} 行` : '去掉这一行'}
                  >
                    −
                  </button>
                </div>
              </div>
            ))}

            {preset.length < PRESET_MAX ? (
              <div className="davs-row davs-row-add">
                <div className="davs-row-name">
                  <span className="davs-row-label davs-row-label-dim">
                    第 {preset.length + 2} 格
                  </span>
                </div>
                <div className="davs-row-slots">
                  <button className="davs-icon davs-order-add" onClick={addPresetRow} title="加一行">
                    ＋
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* 「当前几行」只在展开时才有意义（收起时下面那句摘要已经说了），
              所以留在内容里，不占标题行。 */}
          <p className="davs-fold-note">
            当前 {preset.length} 行
            {tooFew ? ` · 少于 ${PRESET_MAX} 行，第 ${preset.length + 2} 格起会从头重复` : ' · 覆盖满 9 格'}
          </p>
        </>
      ) : (
        /* 和动画映射一样给一句摘要，避免「一片空白、不知道是收起来了还是坏了」 */
        <p className="davs-fold-note">
          已收起 · {preset.length} 行（第 2~{preset.length + 1} 格）
          {changed ? ' · 已改' : ''}
        </p>
      )}
    </section>
  )
}

/**
 * 试片：一个独立的 bot，显示当前选中的动画。
 *
 * 为什么单独一段而不是塞进某一行的右边：它要能预览**任何**动画，
 * 包括用户还没配到任何活动上的那些（比如「蛋」「六边形」）。
 *
 * 试片为空（=「跟随真实状态」）时这里显示第一项默认动画，因为设置页
 * 没有「真实状态」可跟随 —— 它不属于任何一个 agent。
 *
 * ── 为什么这里也有图案和表情 ────────────────────────────────────────
 * 试片原来只钉动画，图案和表情跟全局走。于是想看「宝石 + 惊讶」得先跑去
 * 右栏改全局、回来再看、再改回去 —— 三步。现在试片自带图案 + 表情，
 * 它就是一个自由预览台：任意动画 × 任意图案 × 任意表情。
 *
 * ── 为什么从「两个下拉」改成「两列平铺」─────────────────────────────
 * 下拉一次只露一个值，想比较「胶囊 + 害羞」和「穹顶 + 害怕」得点开两次、
 * 记住上一次的样子。用户要的就是「都展开、分别成两列」——
 * 形状一列、表情一列，15 + 16 个全部摊开，点一下即换，眼睛不用离开画像。
 *
 * ── 为什么没有「跟全局」这一项（v0.3.12）────────────────────────────
 * v0.3.11 的两列里，每列第一项都是「跟全局」。用户反馈：
 * 「把跟随全局去掉，那个出现在设置页面的预览里面只会造成干扰」。
 *
 * 说得对：那一项不是一种图案，也不是一种表情，它是**一个状态开关**混在
 * 一列外观选项里 —— 混进去以后，14 个图案变成 15 个，用户要在一堆形状名
 * 里先分辨出哪个不是形状。
 *
 * 去掉之后语义没丢，只是改成隐式的：没点过任何芯片时，高亮落在**全局当前
 * 值**上（默认是圆 + 中性），此时改全局它照样跟着变；点过之后就不再跟了。
 * 也就是说「跟随」仍然存在，只是不再需要一枚按钮来表达它。
 *
 * 顺位表那边的缩略图是「扫一眼 8 行」，这里负责「放大看一个」。
 * 两者不重复：缩略图 24px 只够分辨轮廓，看不出表情细节。
 *
 * ── 它现在服务两块 ──────────────────────────────────────────────────
 * v0.3.11 起试片挪到最上面，同时给「动画映射」（看动作）和
 * 「自动分配顺位」（看组合）当预览窗口，不再各放一个。
 */
/**
 * 试片方块边长。
 *
 * 288 = 旧值 96 的三倍。这不是「大一点好看」，是量出来的：旧版预览框
 * 96px、右侧按钮区 297px，右侧正好是左侧的三倍 —— 用户看到的「上下差
 * 太多」就是这个三倍差。三倍补齐后两边齐平。
 *
 * 上限由设置页决定：DSH 插件详情页每行 `width:100%; max-width:960px`
 * （`PluginManagerPage.module.css`），所以这里不会挤到按钮区。
 */
const PREVIEW_SIZE = 288

function Preview({
  preview,
  rotation,
  look
}: {
  preview: string | null
  rotation: Rotation | null
  look: Parameters<typeof Bot>[0]['look']
}) {
  const current = preview ?? 'idle'
  const length = playLengthOf(current as never)

  /**
   * 高亮用 `look.shape` / `look.color` / `look.expression`，不再单独传一份。
   *
   * 上游传进来的 `look` 是 `previewLook` —— 它已经把「用户点过的值」
   * 和「全局值」合并好了（见 `SettingsPage` 里的 `previewLook`）。
   * 所以「没点过 ⇒ 高亮 = 全局」「点过 ⇒ 高亮 = 点的那个」都自动成立，
   * 这里再收一份 shape/color/expression 只会多一条可能不同步的来源。
   */
  const curShape = look.shape
  const curColor = look.color
  const curExpr = look.expression

  /**
   * 动画组的「当前值」：试播整条轮播时显示那份摘要（「空闲 ×5 → 眨眼 ×1」），
   * 而不是钉在动画上的那一个名字。
   *
   * 为什么要区别：点「试播」之后画面的上半段在播空闲、下半段在眨眼，
   * 此时标题写着「眨眼」是错的。改成摘要，用户一眼能对上是哪一行。
   */
  const animCur = rotation ? describeShort(rotation) : (ANIMATION_LABEL.get(current as never) ?? current)

  return (
    <div className="davs-preview">
      {/* 左：大预览（288px）。版式见 style.ts 里 `.davs-preview` 的注释。
          给了 `rotation` 就让 Bot 自己轮播 —— 和面板格子走同一条实现，
          一个时钟、一份代码，试片里看到的就是窗口里会看到的。 */}
      <div className="davs-preview-bot">
        <Bot
          state={current as never}
          rotation={rotation ?? undefined}
          look={{ ...look, size: PREVIEW_SIZE }}
          paper="transparent"
        />
      </div>

      {/* 右：四组按钮，每组固定三行。
          为什么分成几块卡片而不是一堆散芯片：每组各有自己的标题和当前值，
          点动画和点表情是两件事，混在一起要在一堆芯片里先分辨哪个组。 */}
      <div className="davs-groups">
        <ChipGroup
          title="动画"
          cur={animCur as string}
          hint={rotation ? '试播这条轮播' : `一遍约 ${length.toFixed(1)} 秒`}
          items={ANIMATION_OPTIONS.map((o) => ({ id: o.id as string, label: o.label }))}
          /* 高亮仍钉在 `current` 上 —— 试播时它是轮播的第一项（见
             `playRotationInPreview`），所以高亮落在「从哪个动画开始播」，
             比一个都不亮更能说明画面在干什么。 */
          value={current}
          onPick={(id) => setPreview(id as never)}
        />
        <ChipGroup
          title="形状"
          cur={(SHAPE_OPTIONS as Record<string, string>)[curShape] ?? curShape}
          items={Object.entries(SHAPE_OPTIONS).map(([id, label]) => ({ id, label }))}
          value={curShape}
          onPick={setPreviewShape}
        />
        {/* 配色这一列是 2026-10-31 加的，和「自动分配顺位」的颜色槽同一天。
            顺位那边调完颜色只有 24px 缩略图能看，要看大图得点这里。

            ── 为什么只有它是一行色块，不是三行文字芯片 ──────────────────
            配色有 12 个，按三行排会让右边比左边高出 128px —— 那正是用户
            当初报的「上下差太多」。而颜色这个东西**自己会说话**：写「棕」
            不如直接给他一块棕色。所以这组改成一行 12 枚色块（色点 + 名字），
            一行的总高度就够，也不会把别的组挤变形。 */}
        <ChipGroup
          title="配色"
          cur={(COLOR_OPTIONS as Record<string, string>)[curColor] ?? curColor}
          items={Object.entries(COLOR_OPTIONS).map(([id, label]) => ({ id, label }))}
          value={curColor}
          onPick={setPreviewColor}
          swatch
        />
        <ChipGroup
          title="表情"
          cur={(EXPRESSION_OPTIONS as Record<string, string>)[curExpr] ?? curExpr}
          items={Object.entries(EXPRESSION_OPTIONS).map(([id, label]) => ({ id, label }))}
          value={curExpr}
          onPick={setPreviewExpression}
        />
      </div>
    </div>
  )
}

/**
 * 一组芯片：固定三行。
 *
 * ── 为什么固定三行，而不是让它自然换行 ────────────────────────────────
 * 自然换行时三组的行数各不相同（实测动画 3 行、图案 2 行、表情 2 行），
 * 三块高度参差，右栏底部空出一大块 —— 那正是用户要修的「上下差太多」。
 * 固定三行后三块等高，实测上下差 74px → 22px。
 *
 * ── 为什么列数要算 ──────────────────────────────────────────────────
 * 行数固定时列数必须等于 ceil(芯片数 / 3)。芯片数是 24 / 14 / 16，
 * 对应 8 / 5 / 6 列。用 `grid-auto-flow:column` 让它自己排会变成
 * 「先竖满一列再换列」，阅读顺序从「空闲 思考 眨眼」变成「空 思 眨」。
 *
 * 同时保留一个 `title`：万一容器窄到芯片放不下，浏览器会省略而不是溢出
 * （实测 960px 下三组都零省略；只有设置页被挤到 620px 以下才会碰到）。
 */
function ChipGroup({
  title,
  cur,
  hint,
  items,
  value,
  onPick,
  swatch = false
}: {
  title: string
  cur: string
  hint?: string
  items: { id: string; label: string }[]
  value: string
  onPick: (id: string) => void
  /**
   * 色块模式：一行、每枚带一个色点。
   *
   * 配色组专用。普通模式把芯片压成三行（为了和其它组等高），
   * 但配色只有 12 个、又多出一组，四组三行会把右边撑到 416px ——
   * 比左边 288px 高 128px。改成一行之后右边回到 344px 上下，
   * 和左边基本齐平（实测差 56px，比原来的 128px 好一半）。
   */
  swatch?: boolean
}) {
  const cols = Math.ceil(items.length / (swatch ? 1 : 3))
  return (
    <div className="davs-group" data-group={title}>
      <div className="davs-group-head">
        {title}
        <span className="davs-group-cur">{cur}</span>
        {hint ? <span className="davs-group-cur">{hint}</span> : null}
      </div>
      <div
        className={`davs-group-chips${swatch ? ' davs-group-chips-swatch' : ''}`}
        style={{ '--cols': cols } as unknown as import('react').CSSProperties}
      >
        {items.map((it) => (
          <button
            key={it.id}
            className={`davs-chip davs-chip-sm${value === it.id ? ' is-on' : ''}${
              swatch ? ' davs-chip-swatch' : ''
            }`}
            onClick={() => onPick(it.id)}
            title={`${title}：${it.label}`}
          >
            {swatch ? <span className="davs-swatch" style={{ background: inkOf(it.id) }} /> : null}
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 一行 = 一个活动。
 *
 * 每行最多两项，每项是「动画 + 播几遍」。第二项默认收起（点「＋」展开），
 * 因为绝大多数活动只需要一项 —— 13 行全展开成两行会很吵。
 */
function RotationRow({
  activity,
  rotation,
  changed
}: {
  activity: Activity
  rotation: Rotation
  changed: boolean
}) {
  const [expanded, setExpanded] = useState(rotation.length > 1)

  // 外部（比如「全部恢复默认」）把这项改回单项时，收起第二项。
  useEffect(() => {
    if (rotation.length <= 1) setExpanded(false)
  }, [rotation.length])

  const items = expanded ? rotation : rotation.slice(0, 1)
  const total = cycleLength(items)

  function patch(index: number, next: Partial<{ state: string; plays: number }>): void {
    const base = items.map((r) => ({ ...r }))
    const target = base[index]
    if (!target) return
    if (next.state !== undefined) target.state = next.state as never
    if (next.plays !== undefined) target.plays = next.plays
    setRotation(activity, base as Rotation)
  }

  function addSecond(): void {
    // 加第二项时默认取第一项之外的一个「有对比感」的动画：
    // 空闲配眨眼、思考配爆发、其余配空闲。没有硬编码表，用简单规则。
    const used = new Set(items.map((r) => r.state))
    const pick =
      activity === 'idle' && !used.has('wink')
        ? 'wink'
        : activity === 'thinking' && !used.has('burst')
          ? 'burst'
          : 'idle'
    setExpanded(true)
    setRotation(activity, [...items, { state: pick as never, plays: 1 }] as Rotation)
  }

  function removeSecond(): void {
    setExpanded(false)
    setRotation(activity, items.slice(0, 1) as Rotation)
  }

  return (
    <div className="davs-row" data-changed={changed ? '' : undefined}>
      <div className="davs-row-name">
        <span className="davs-row-label">{ACTIVITY_LABEL[activity]}</span>
        {changed ? (
          <button
            className="davs-link"
            onClick={() => resetRotation(activity)}
            title={`恢复默认：${describeRotation(DEFAULT_ROTATION[activity])}`}
          >
            已改 · 恢复
          </button>
        ) : null}
      </div>

      <div className="davs-row-slots">
        {items.map((item, i) => (
          <div className="davs-slot" key={i}>
            <select
              className="davs-select"
              value={item.state}
              onChange={(e) => patch(i, { state: e.target.value })}
              title="这个位置播哪个动画"
            >
              {ANIMATION_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="davs-times">×</span>
            <input
              className="davs-num"
              type="number"
              min={MIN_PLAYS}
              max={MAX_PLAYS}
              value={item.plays}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (!Number.isFinite(n)) return
                patch(i, { plays: Math.min(MAX_PLAYS, Math.max(MIN_PLAYS, Math.round(n))) })
              }}
              title="播几遍"
            />
            {i === 1 ? (
              <button className="davs-icon" onClick={removeSecond} title="去掉第二项">
                −
              </button>
            ) : null}
          </div>
        ))}

        {items.length < MAX_ROTATION_ITEMS ? (
          <button className="davs-icon" onClick={addSecond} title="加第二项轮播">
            ＋
          </button>
        ) : null}

        {/* 时长在前、试播在后：`margin-left:auto` 在 `.davs-total` 上，
            所以这两个一起被推到行尾。试播放最右是因为它是**动作**，
            动作在最右读起来像「这一行配完，按这里看效果」。

            用户原话：「动画映射的每一行后面，能不能都追加一个试播，
            然后直接反馈到预览去？这样就不用回到窗口去观察了？」
            播的是**这一整条**（空闲×5 → 眨眼×1 的交替节奏），不是只播第一项 ——
            只播第一项的话，配了两项的人还是得回窗口等。 */}
        <span className="davs-total" title="这一轮播完的总时长">
          一轮约 {total.toFixed(1)} 秒
        </span>
        <button
          className="davs-btn davs-btn-try"
          onClick={() => playRotationInPreview(rotation)}
          title={`在试片里播这一行：${describeRotation(rotation)}`}
        >
          试播
        </button>
      </div>
    </div>
  )
}

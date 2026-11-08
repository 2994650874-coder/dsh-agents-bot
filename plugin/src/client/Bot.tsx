/**
 * React 版的 BloubBot：把 `engine.sample(t)` 的输出画成 SVG。
 *
 * 图层顺序与 bloub 原版 `BloubBot.vue` 的 template 逐行对应，不能改：
 *   1. defs：mask（身体 + 眼睛挖洞）、每条弧的渐变
 *   2. 弧的后半（先画，被身体遮住 —— 这就是"3D 轨道"观感的全部来源）
 *   3. dotsBehind 的粒子
 *   4. 身体：先用 paper 色填一遍同形状的底，再用 mask 上墨色
 *   5. 其余粒子
 *   6. 通知圆点
 *   7. 弧的前半
 *
 * 第 4 步那个"底"不是多余：眼睛是 mask 里的洞，洞会漏出后面画的东西，
 * 而弧的后半和粒子正是画在后面的。少了它，一圈弧会从眼睛里透出来。
 */
import { useEffect, useRef, useState } from 'react'
import { BotEngine, type BotFrame } from '../bot/engine'
import { ringPath } from '../bot/decor'
import { mixHex } from '../bot/skins'
import { DEMI_VIEWBOX, RAYON } from '../bot/repere'
import { STATE_BY_ID, type StateId } from '../bot/states'
import { expressionOf, inkOf, shapeRadiiOf, type AvatarLook } from './look'
import { cycleLength, slotAt } from './rotation'
import type { Rotation } from './activities'
import { subscribeSharedFrames, subscribeSharedPointer, type PointerPosition } from './sharedFrameClock'

const VB = DEMI_VIEWBOX
const R = RAYON

let uidSeed = 0

export interface BotProps {
  state: StateId
  /**
   * 轮播：给一组动画，让 bot 自己按「播几遍」轮着播。
   *
   * 给了它之后 `state` 只作为**初始值**（第一帧之前），实际播什么由
   * `slotAt` 按时间算。不给就是老行为：死盯 `state`。
   *
   * 为什么把轮播放进 Bot 而不是让调用方自己定时切 `state`：
   * Bot 内部已经有 rAF 循环（每秒 45/60 次），切帧的判断搭在这上面是免费的。
   * 调用方自己开 setInterval 的话，9 个格子就是 9 个定时器，而且切帧
   * 最多会晚一个 tick（250ms 起），眨眼这种 1.6 秒的动画会明显不准。
   */
  rotation?: Rotation
  /** 轮播起点（毫秒，与 Bot 内部同一个时钟基准）。 */
  rotationStart?: number
  look: AvatarLook
  /** 冻结在某一时刻：不出动画循环，渲染一张确定的图（缩略图、试片用）。 */
  frozenAt?: number
  /** 背景色，用于粒子的景深混合与眼睛后面的底。 */
  paper?: string
  /**
   * 覆盖墨色。
   *
   * 只给「当图标用」的场合：图标要跟宿主的 `currentColor` 走（暗色主题下
   * 必须变浅，否则在深底上看不见）。头像本体一律不传，用外观里的配色。
   */
  ink?: string
  /** 是否跟随鼠标。多头像面板里默认关，避免几十条 pointermove 监听。 */
  follow?: boolean
  /** One opt-in frame/pointer group for the two Bots in the same main overlay. */
  frameGroup?: string
  /**
   * 每秒最多重画几次。缺省不限（跟随屏幕刷新率）。
   *
   * 到点才唤醒 rAF 而不是每屏空转；同帧组的主/消息 Bot 共用一次唤醒。
   *
   * 这个动画本身很慢（呼吸 3 秒一圈、形态过渡 0.45 秒），30Hz 都看不出断。
   */
  fps?: number
}

/** 一帧 SVG。拆出来是为了 `frozenAt` 时能直接复用同一段渲染。 */
function Frame({ frame, look, paper, maskId, uid, inkOverride }: {
  frame: BotFrame
  look: AvatarLook
  paper: string
  maskId: string
  uid: string
  /** 见 `BotProps.ink`：图标场合覆盖墨色。 */
  inkOverride?: string
}) {
  const ink = inkOverride ?? inkOf(look.color)

  /**
   * Les points a degrade.
   *
   * ── Pourquoi un `linearGradient` par point et pas un aplat (2026-10-30) ──
   * L'utilisateur a demande que les rayons de `search` prennent « 写文件那种线条 »,
   * qui est un trace a degrade. Un aplat se lit comme une barre dure ; le meme
   * trait avec une teinte qui glisse d'un bout a l'autre se lit comme un
   * filament. Voir `DotRender.grad`.
   *
   * `gradientUnits` par defaut (`objectBoundingBox`) est justement ce qu'on
   * veut : le degrade suit la boite englobante du tracé, donc l'axe de la
   * capsule, sans qu'on ait a lui dire ou il pointe. `x1=0 x2=1 y1=y2=0` va du
   * debut du chemin vers sa fin.
   *
   * L'id est derive de l'index et de `uid` : les points sont re-rendus a chaque
   * image, donc un id qui changerait d'une image a l'autre recreerait un
   * gradient 60 fois par seconde. Ici il ne depend que de la position dans la
   * liste, qui est stable.
   */
  const gradId = (i: number, behind: boolean) => `${uid}-d${behind ? 'b' : 'f'}${i}`

  const dotAttrs = (dot: BotFrame['dots'][number], i: number, behind: boolean) => {
    const fill =
      dot.color ?? (dot.depth === undefined ? ink : mixHex(paper, ink, dot.depth))
    const painted = dot.grad ? `url(#${gradId(i, behind)})` : fill
    return dot.d
      ? {
          fill: painted,
          opacity: dot.opacity,
          d: dot.d,
          transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R})`
        }
      : { fill: painted, opacity: dot.opacity, cx: dot.x, cy: dot.y, r: dot.r }
  }

  /** Un degrade par point qui en demande un, cote corps devant ou derriere. */
  const dotGrads = (behind: boolean) =>
    frame.dots.map((dot, i) =>
      dot.grad ? (
        <linearGradient
          key={gradId(i, behind)}
          id={gradId(i, behind)}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          {dot.grad.map((c, k) => (
            <stop key={k} offset={k / Math.max(1, dot.grad!.length - 1)} stopColor={c} />
          ))}
        </linearGradient>
      ) : null
    )

  return (
    <>
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={-VB}
          y={-VB}
          width={VB * 2}
          height={VB * 2}
        >
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, i) => (
            <path
              key={i}
              d={eye.d}
              transform={eye.matrix}
              opacity={eye.alpha}
              fill="#000"
            />
          ))}
          {frame.notch ? (
            <circle
              cx={frame.notch.x}
              cy={frame.notch.y}
              r={frame.notch.r}
              fill="#000"
            />
          ) : null}
        </mask>

        {/* un degrade par point allonge (rayons de `search`) */}
        {dotGrads(true)}
        {dotGrads(false)}

        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((c, i) => (
              <stop
                key={i}
                offset={i / (arc.grad.stops.length - 1)}
                stopColor={c}
              />
            ))}
          </linearGradient>
        ))}

        {/* 彩带（加载 / 低吟的肥厚流光）的线性渐变，沿带子自己的走向 */}
        {frame.ribbons.map((rb) => (
          <linearGradient
            key={`rb${rb.id}`}
            id={`${uid}-${rb.id}`}
            gradientUnits="userSpaceOnUse"
            x1={rb.grad.x1}
            y1={rb.grad.y1}
            x2={rb.grad.x2}
            y2={rb.grad.y2}
          >
            {rb.grad.stops.map((c, i) => (
              <stop
                key={i}
                offset={i / (rb.grad.stops.length - 1)}
                stopColor={c}
              />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* 弧的后半：先画，被身体遮住 */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`b${arc.id}`}
            d={arc.back}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {/* 带子的后半：同样先画，被身体挡住 —— 这就是「绕着球转」的全部来源 */}
      <g>
        {frame.ribbons.map((rb) => (
          <path
            key={`rbB${rb.id}`}
            d={rb.back}
            fill={`url(#${uid}-${rb.id})`}
            opacity={rb.opacity}
          />
        ))}
      </g>

      {frame.dotsBehind ? (
        <g>
          {frame.dots.map((dot, i) =>
            dot.d ? <path key={`pb${i}`} {...dotAttrs(dot, i, true)} /> : <circle key={`pb${i}`} {...dotAttrs(dot, i, true)} />
          )}
        </g>
      ) : null}

      <g opacity={frame.bodyAlpha}>
        {/* 眼睛是洞，洞会漏出后面的东西 —— 这层同形状的底把它堵上 */}
        <path d={frame.bodyPath} fill={paper} />
        <g mask={`url(#${maskId})`}>
          <rect x={-VB} y={-VB} width={VB * 2} height={VB * 2} fill={ink} />
        </g>
      </g>

      {!frame.dotsBehind ? (
        <g>
          {frame.dots.map((dot, i) =>
            dot.d ? <path key={`pf${i}`} {...dotAttrs(dot, i, false)} /> : <circle key={`pf${i}`} {...dotAttrs(dot, i, false)} />
          )}
        </g>
      ) : null}

      {frame.notif ? (
        <circle
          cx={frame.notif.x}
          cy={frame.notif.y}
          r={frame.notif.r}
          fill="#2496e8"
        />
      ) : null}

      {/* 环（雷达圈、进度槽、冲击波）：描边圆，不走渐变也不做深度排序 ——
          它们永远在身体外侧，压不到身体上。详见 `RingRender`。 */}
      <g fill="none" strokeLinecap="round">
        {frame.rings.map((ring) => (
          <path
            key={`r${ring.id}`}
            d={ringPath(ring, ring.cx, ring.cy)}
            stroke={ring.color ?? ink}
            strokeWidth={ring.width}
            opacity={ring.opacity}
          />
        ))}
      </g>

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path
            key={`f${arc.id}`}
            d={arc.front}
            stroke={`url(#${uid}-${arc.id})`}
            strokeWidth={arc.width}
            opacity={arc.opacity}
          />
        ))}
      </g>

      {/* 带子的前半：画在身体之后，所以这一段是「从球前面经过」 */}
      <g>
        {frame.ribbons.map((rb) => (
          <path
            key={`rbF${rb.id}`}
            d={rb.front}
            fill={`url(#${uid}-${rb.id})`}
            opacity={rb.opacity}
          />
        ))}
      </g>
    </>
  )
}

export function Bot({
  state,
  rotation,
  look,
  frozenAt,
  paper = '#ffffff',
  ink,
  follow = false,
  frameGroup,
  fps
}: BotProps) {
  const uidRef = useRef<string>('')
  if (uidRef.current === '') uidRef.current = `av${(uidSeed++).toString(36)}`
  const uid = uidRef.current
  const maskId = `bot-mask-${uid}`

  const engineRef = useRef<BotEngine | null>(null)
  if (engineRef.current === null) {
    // 有轮播就从轮播的第一项起步，否则从 `state` 起步 —— 这样挂载的第一帧
    // 不会出现「先画 state 再morph 到轮播项」的多余过渡。
    const first = rotation?.[0]?.state ?? state
    engineRef.current = new BotEngine(R, first, shapeRadiiOf(look.shape), expressionOf(look.expression))
  }
  const engine = engineRef.current

  const svgRef = useRef<SVGSVGElement | null>(null)
  const clockRef = useRef(0)
  const [frame, setFrame] = useState<BotFrame>(() => engine.sample(frozenAt ?? 0))

  /**
   * 轮播状态。
   *
   * 用 ref 而不是 state：`draw` 是每帧跑的回调，把它关进 state 会让整个
   * effect 重建（rAF 循环重启），代价远大于一次 ref 读取。
   *
   * 签名用内容而不是对象引用：调用方每次都新建一个数组字面量，
   * 比引用的话每帧都判定成「变了」，轮播就永远停在第一项。
   */
  const rotRef = useRef<{
    sig: string
    start: number
    rotation: Rotation | undefined
    /** 上一帧看到的「第几遍」，见下方 draw 里的重播判断。 */
    pass: number
    /** 上一帧看到的「第几轮」。单项轮播里 `pass` 恒为 0，靠它才能重播。 */
    cycle: number
    /** 配置变更后只重播一次；首项同名时 pass/cycle 无法触发 reset。 */
    pendingReset: boolean
  }>({
    sig: '',
    start: 0,
    rotation: undefined,
    pass: 0,
    cycle: 0,
    pendingReset: false
  })

  /**
   * ── 没有轮播时也要循环（v0.3.16）─────────────────────────────────────
   *
   * 引擎的 `sample(t)` 是**时间的纯函数**，但它不知道「一遍」有多长：
   * 每个状态在 `STATE_BY_ID.duration` 秒后就走完自己的时间轴。走完之后
   * 那些一次性动画就停在收尾姿态上 —— `orbit` / `search` / `celebrate`
   * 的收尾是一条已经淡出的装饰，屏幕上只剩一个静止的小球。
   *
   * 以前只有**配了轮播**的活动才循环（靠 `slotAt` 反复切回起点）。没配
   * 轮播的地方（设置页试片、`poseOverride` 冻结格）传的是裸 `state`，
   * 于是引擎一路往前跑、动画播一遍就没了 —— 用户报的「新增的动画，在播放后
   * 都不会持续」就是这个。
   *
   * 修法：把裸 `state` 合成一份「播一遍」的轮播。这样**所有**调用点都走
   * 同一条循环路径，不再有「有的循环、有的不循环」两套行为。
   */
  const effectiveRotation: Rotation = rotation ?? [{ state, plays: 1 }]

  const rotSig =
    effectiveRotation === undefined ? '' : effectiveRotation.map((r) => `${r.state}:${r.plays}`).join(',')

  // 放在渲染期（不是 effect）：`draw` 第一次跑的时候就要看到正确的起点。
  // 这段是幂等的 —— 同样的输入跑两遍结果一样，所以 StrictMode 双渲染也无害。
  if (rotRef.current.sig !== rotSig) {
    // 首次挂载已用首项初始化引擎；之后的配置变化才需要重播。
    rotRef.current.pendingReset = rotRef.current.sig !== ''
    rotRef.current.sig = rotSig
    rotRef.current.start = clockRef.current * 1000
    rotRef.current.pass = 0
    rotRef.current.cycle = 0
  }
  rotRef.current.rotation = effectiveRotation

  // 外观变化：形状与表情都在引擎里平滑过渡，不重建实例
  useEffect(() => {
    engine.setShape(shapeRadiiOf(look.shape), clockRef.current)
  }, [engine, look.shape])

  useEffect(() => {
    engine.setExpression(expressionOf(look.expression), clockRef.current)
  }, [engine, look.expression])

  /*
   * ── 这里原本有一个 `engine.setState(state)` 的 effect（v0.3.16 删除）──
   * 它是**唯一**能让裸 `state` 生效的路径（`rotation` 缺席时）。现在裸
   * `state` 被合成成单项轮播（见 `effectiveRotation`），切状态由 draw 里的
   * 轮播逻辑统一负责，这条 effect 就永远只会提前返回。
   *
   * 两处都写会互相打架：`setState` 带 morph、`reset` 不带，谁最后跑就听
   * 谁的，表现为「状态闪一下又回去」。所以删掉，不留一条永远不执行的分支。
   */

  /**
   * 冻结：出一张确定的图，不启动循环。
   *
   * ── 依赖里为什么必须有 shape / expression ──────────────────────────
   * 冻结模式下**没有动画循环**，`frame` 只在 effect 里被写一次。上面那两个
   * `setShape` / `setExpression` 只是改引擎里的**目标**，真正让画面变的是
   * `sample()` —— 而它原本只在这个 effect 里被调用。
   *
   * 少了这两个依赖，表现是：下拉框的值变了、引擎也知道新形状了，
   * 但画面停在挂载时那一帧，**缩略图死活不跟着变**。
   *
   * 早先的用量（外观面板的 14 个身形图）看不出这个问题 —— 那些 Bot 从挂载起
   * 形状就是固定的，永远不会变，所以"不重采样"一直没被触发。
   * 设置页顺位行要随下拉变，才把它暴露出来。
   *
   * 用 `look.shape` / `look.expression` 而不是整个 `look`：配色和尺寸不影响
   * `sample()` 的输出（那是 SVG 属性层面的事），跟着重采样纯属浪费。
   */
  useEffect(() => {
    if (frozenAt === undefined) return
    engine.reset(state, 0)
    // reset 会把形状/表情的目标也重来，所以先把当前外观重新喂一遍。
    engine.setShape(shapeRadiiOf(look.shape), 0)
    engine.setExpression(expressionOf(look.expression), 0)
    setFrame(engine.sample(frozenAt))
  }, [engine, state, frozenAt, look.shape, look.expression])

  // Each Bot keeps its own animation phase; main-overlay Bots only share the wakeup.
  useEffect(() => {
    if (frozenAt !== undefined) return
    const start = performance.now() - clockRef.current * 1000
    const advance = (now: number) => {
      const t = (now - start) / 1000
      clockRef.current = t

      /*
       * 轮播切帧。
       *
       * 判断搭在已有的 rAF 回调上，不另开定时器 —— 这是 9 个格子都不加
       * 开销的关键。`slotAt` 是纯函数，算一次约 0.1 微秒。
       *
       * 时钟用 `t*1000`（动画已跑的毫秒数），不是 `now`（performance.now
       * 的绝对值）。两者差一个 `start` 偏移，混用会让轮播整体偏到错误的
       * 位置 —— 这个 bug 的表现是「刚打开面板时动画是错的，过一会儿才对」。
       *
       * ── 四个触发条件，缺一不可 ────────────────────────────────────
       *
       * ① 该播的动画变了 → `setState` 切过去。
       *    `setState` 会触发 morph（引擎里要冻结当前姿态当过渡起点），
       *    每帧调等于每帧重启过渡，动画会卡在第一帧，所以必须比较。
       *
       * ② 同一个动画开始播**新的一遍**（`pass` 变了）→ `reset` 重来。
       *    这是那处「×2 之后变成圆」的根因修复。早先只判 ①，于是
       *    `检索 ×2` 的第 2 遍 state 没变、不 reset，引擎内部时间一路往前跑，
       *    画的是第 1 遍的收尾姿态：`orbit` 收尾是一条已经淡出的球 ——
       *    屏幕上就是一个静止的圆，用户选了三角身形也没用。用户报的
       *    「读取 →（动画）×2 → 空闲（异常的圆）→ 空闲（正常形状）」就是它。
       *
       * ③ **轮播播完一整轮**（`cycle` 变了）→ `reset` 重来。
       *
       *    ── 为什么非要第三条（v0.3.16）──────────────────────────────
       *    `pass` 只数**同一项内部的第几遍**。单项轮播（`plays: 1`）里它恒为
       *    0：每一轮都是「这一项的第 1 遍」，于是 `pass` 永远不变、`reset`
       *    永远不触发，引擎时间一路往前跑 —— 动画播完一遍就停在收尾姿态。
       *
       *    这正是用户报的「目前你新增的动画，在播放后都不会持续」。改成
       *    「所有调用点都合成一份轮播」（见 `effectiveRotation`）之后，单项
       *    轮播反而是**最常见**的形态，所以这条必须补上。
       *
       *    为什么用 `reset` 而不是 `setState`：`setState` 会保留前一个状态
       *    做 morph 过渡，重播要的是「从第 0 秒重新开始」，不能带过渡。
       *
       * ④ 配置签名变了 → 下一帧一次性 `reset` 到当前项/当前遍的起点。即使第一项
       *    与旧状态同名，也必须清掉旧相位；正常重画不触发此分支。
       */
      const rot = rotRef.current
      if (rot.rotation !== undefined) {
        const slot = slotAt(rot.rotation, rot.start, t * 1000)
        const cycleLen = cycleLength(rot.rotation)
        const cycle = cycleLen > 0 ? Math.floor((t * 1000 - rot.start) / 1000 / cycleLen) : 0
        if (rot.pendingReset) {
          // 对齐当前项/当前遍的起点：首帧即使延后跨项或跨遍，仍保留该项已过的相位。
          engine.reset(slot.state, t - slot.elapsed)
          rot.pendingReset = false
          rot.pass = slot.pass
          rot.cycle = cycle
        } else if (slot.state !== engine.state) {
          engine.setState(slot.state, t)
          rot.pass = slot.pass
          rot.cycle = cycle
        } else if (slot.pass !== rot.pass || cycle !== rot.cycle) {
          // 新的一遍 / 新的一轮：从头播，不等过渡
          engine.reset(slot.state, t)
          rot.pass = slot.pass
          rot.cycle = cycle
        }
      }

      if (follow) aim(t)
      setFrame(engine.sample(t))
    }
    if (frameGroup) return subscribeSharedFrames(frameGroup, fps, advance)

    // Legacy sidebar/preview path: unchanged per-instance, due-time rAF wakeup.
    const interval = fps && fps > 0 ? 1000 / fps : 0
    let nextDraw = 0
    let raf = 0
    let timer = 0
    let stopped = false
    const schedule = (now: number) => {
      if (stopped) return
      if (interval === 0 || nextDraw - now <= 1) { raf = requestAnimationFrame(draw); return }
      timer = window.setTimeout(() => {
        if (!stopped) raf = requestAnimationFrame(draw)
      }, nextDraw - now - 1)
    }
    const draw = (now: number) => {
      if (interval > 0) {
        nextDraw += interval
        if (nextDraw < now - interval) nextDraw = now + interval
      }
      advance(now)
      schedule(now)
    }
    schedule(performance.now())
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, frozenAt, follow, fps, frameGroup])

  /**
   * 跟随鼠标：只在带 baseFace 的状态里生效，其余状态里眼神本身就是动画。
   *
   * 判据用 `engine.state` 而不是 props 的 `state` —— 轮播时真正在播的是
   * 引擎里那个，props 的 `state` 只是初始值。用错了的表现是「轮播到眨眼
   * 时鼠标还在控制眼神」，而眨眼有自己的固定眼神，两者会打架。
   */
  function aim(t: number) {
    if (!STATE_BY_ID.get(engine.state)?.baseFace) return
    const box = svgRef.current?.getBoundingClientRect()
    if (!box || box.width === 0 || box.height === 0) return
    const cx = box.left + box.width / 2
    const cy = box.top + box.height / 2
    const nx = (lastPointer.current.x - cx) / Math.max(1, window.innerWidth / 2)
    const ny = (lastPointer.current.y - cy) / Math.max(1, window.innerHeight / 2)
    const clamp1 = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)
    engine.setLook(
      {
        yaw: clamp1(nx) * 26,
        // Screen y grows downward; engine pitch grows upward.
        pitch: -clamp1(ny) * 20,
        mix: lastPointer.current.seen ? 1 : 0,
        spin: 0,
        wander: lastPointer.current.seen ? 0.15 : 1
      },
      t
    )
  }

  const lastPointer = useRef<PointerPosition>({ x: 0, y: 0, seen: false })
  useEffect(() => {
    if (!follow) return
    if (frameGroup) return subscribeSharedPointer(frameGroup, point => { lastPointer.current = point })
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      lastPointer.current = { x: e.clientX, y: e.clientY, seen: true }
    }
    const onLeave = () => {
      lastPointer.current.seen = false
    }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [follow, frameGroup])

  return (
    <svg
      ref={svgRef}
      width={look.size}
      height={look.size}
      viewBox={`${-VB} ${-VB} ${VB * 2} ${VB * 2}`}
      role="img"
      aria-label="agent 头像"
      data-state={engine.state}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <Frame frame={frame} look={look} paper={paper} maskId={maskId} uid={uid} inkOverride={ink} />
    </svg>
  )
}

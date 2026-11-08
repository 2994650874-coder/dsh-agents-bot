/**
 * 右栏引导页里「活动 AI」那张入口卡片的图标。
 *
 * 原来没提供 `icon`，宿主用的是内置占位符 `CubeGlyph`（一个立方体线框），
 * 跟这个插件是干什么的毫无关系。这里换成插件自己的形象：那个会呼吸的圆脸 bot。
 *
 * ── 契约（照宿主 `EntryBox` 的实现写，别自创）──────────────────────
 *
 * 宿主这样渲染：
 *
 * ```js
 * const Icon = entry.icon ?? CubeGlyph
 * <Icon size={description === undefined ? 22 : 26} className={…} />
 * ```
 *
 * 所以 `icon` 是一个 **React 组件**，收到 `{ size, className }`。两点必须遵守：
 *
 * 1. **必须用 `currentColor`**。宿主把 `.entryIcon` 的 `color` 设成
 *    `--dsw-alias-label-secondary`，暗色主题下会自己变浅。写死墨黑的话
 *    深底上就是一块看不见的黑斑。
 * 2. **`className` 要落到根元素上**。宿主只在「没提供 icon」时传
 *    `placeholderInk`（更浅的一档灰），但将来可能加别的类，接了不会错。
 *
 * ── 为什么用 `frozenAt` 而不是让它动 ────────────────────────────────
 *
 * 引导页可能同时列出七八个入口，每个都开一个 rAF 循环去画呼吸动画是
 * 白花钱 —— 用户看的是「这卡片是什么」，不是看它动。冻结在睁眼那一帧
 * （`EYES_OPEN_AT`），得到一张确定的、看得清眼睛的静态图。
 *
 * ── 为什么表情用 `attentif` 而不是默认的 `neutre` ──────────────────
 *
 * `neutre` 的视线是 `REST_GAZE`（yaw 28.5° / pitch 28.6°），那是从参考
 * 视频逐帧量出来的「斜向上看」的静息姿态 —— 作为头像的一部分是对的，
 * 但缩到 22px 当图标时，眼睛挤在右上角，看起来像在翻白眼。
 * `attentif` 的视线是 yaw 4° / pitch 5°，几乎正对前方，眼睛居中。
 * 表情只在 `baseFace = true` 的状态生效，而 `idle` 正是其中之一。
 *
 * 尺寸换算：引擎 `viewBox` 半宽 158，身体半径 100。宿主要的是 22/26px 的
 * 方框，直接塞进去会有一圈透明边距、看着比邻居小一圈。用 `scale(1.58)`
 * （=158/100）把身体放大到撑满，再靠 `overflow:hidden` 裁掉溢出的空白。
 */
import { Bot } from './Bot'
import { EYES_OPEN_AT } from '../bot/face'
import { DEFAULT_LOOK } from './look'

/** 引擎半视口 / 身体半径，见文件头注释。 */
const FILL = 1.58

/**
 * 图标专用的外观：圆 + 墨黑 + **专注**。
 *
 * 只覆盖 `expression`，形状和配色仍取默认 —— 图标是品牌符号，
 * 不该跟着用户把面板调成什么样就变成什么样。
 */
const ICON_LOOK = { ...DEFAULT_LOOK, expression: 'attentif' }

export function GuideIcon({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: size,
        height: size,
        overflow: 'hidden'
      }}
    >
      <span
        style={{
          width: size,
          height: size,
          display: 'grid',
          placeItems: 'center',
          // 图标一律用宿主的文字色，不读外观配色
          color: 'currentColor'
        }}
      >
        <span style={{ display: 'block', transform: `scale(${FILL})`, transformOrigin: 'center' }}>
          <Bot
            state="idle"
            look={{ ...ICON_LOOK, size }}
            paper="transparent"
            ink="currentColor"
            frozenAt={EYES_OPEN_AT}
          />
        </span>
      </span>
    </span>
  )
}

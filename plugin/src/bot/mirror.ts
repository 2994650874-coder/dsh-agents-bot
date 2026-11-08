import type { EyeCfg, Pose } from './states'

/** Reflect authored poses before state morphing, not the finished SVG: a CSS flip
 * would reverse absolute pointer aim and snap back during idle -> wink. The three
 * opted-in states currently use circular dots and ribbons, not 3D arcs/rings. */
export function mirrorPose(pose: Pose): Pose {
  const n = pose.sil.radii.length
  if (n % 2 !== 0) throw new Error('horizontal reflection requires an even radial profile')
  const flipEye = (eye: EyeCfg): EyeCfg => eye.tilt === undefined
    ? { ...eye }
    : { ...eye, tilt: -eye.tilt }
  return {
    ...pose,
    sil: {
      ...pose.sil,
      // Screen y points down; reflection x -> -x maps theta to pi - theta.
      radii: pose.sil.radii.map((_, i) => pose.sil.radii[(n / 2 - i + n) % n]!),
      rot: -pose.sil.rot,
      cx: -pose.sil.cx
    },
    offX: -pose.offX,
    gaze: { ...pose.gaze, yaw: -pose.gaze.yaw, roll: -pose.gaze.roll },
    spin: -pose.spin,
    eyes: [flipEye(pose.eyes[1]), flipEye(pose.eyes[0])],
    dots: pose.dots.map(dot => ({ ...dot, x: -dot.x, ...(dot.rot === undefined ? {} : { rot: -dot.rot }) })),
    ribbons: pose.ribbons.map(ribbon => ({
      ...ribbon,
      pts: ribbon.pts.map(point => ({ ...point, x: -point.x }))
    })),
    notif: pose.notif ? { ...pose.notif, x: -pose.notif.x } : null
  }
}

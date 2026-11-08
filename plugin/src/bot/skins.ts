import { PROFILE_SAMPLES, PROFILES } from './profiles'
import {
  hullOfCircles,
  profileFromPolygon,
  regularPolygonProfile,
  superellipseProfile,
  unionOfCirclesProfile
} from './shape'

/**
 * Formes et couleurs proposees par le personnalisateur du bot.
 *
 * A la difference des silhouettes d'animation (`profiles.ts`), celles-ci ne sont
 * PAS relevees sur la video : elles sont construites analytiquement d'apres la
 * grille du personnalisateur d'origine. Deux sources distinctes, donc, et c'est
 * volontaire — les etats animes doivent rester fideles a la video, les formes de
 * base sont un choix d'utilisateur.
 */

/**
 * Les identifiants sont enumeres plutot que deduits du tableau : c'est ce qui
 * permet a la couche i18n de verifier A LA COMPILATION que chaque forme a bien
 * sa traduction dans les trois langues (`t(\`shapes.${id}\`)` ne compile que si
 * la cle existe). Un `as const` sur le tableau aurait le meme effet mais
 * rendrait `radii` en lecture seule, alors que le moteur le passe tel quel.
 */
export type ShapeId =
  | 'cercle'
  | 'galet'
  | 'squircle'
  | 'capsule'
  | 'triangle'
  | 'hexagone'
  | 'nuage'
  | 'goutte'
  | 'bouclier'
  | 'dome'
  | 'arche'
  | 'cylindre'
  | 'gemme'
  | 'cristal'
  | 'oeuf'

export interface BotShape {
  id: ShapeId
  radii: number[]
}

/** Ramene le rayon maximal a `max` pour que toutes les formes pesent pareil a l'oeil. */
function normalize(radii: number[], max = 1): number[] {
  const peak = Math.max(...radii)
  if (peak <= 0) return radii
  const k = max / peak
  return radii.map((r) => r * k)
}

const ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => (i / PROFILE_SAMPLES) * Math.PI * 2)

/** Galet : cercle deforme par deux harmoniques basses, donc irregulier mais lisse. */
const pebble = normalize(
  ANGLES.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
  1.02
)

/** Nuage : union de bosses, large en bas, deux lobes en haut. */
const cloud = normalize(
  unionOfCirclesProfile([
    { x: -0.44, y: 0.2, r: 0.54 },
    { x: 0.46, y: 0.2, r: 0.5 },
    { x: 0.02, y: 0.3, r: 0.6 },
    { x: -0.24, y: -0.3, r: 0.48 },
    { x: 0.3, y: -0.24, r: 0.44 }
  ]),
  1.02
)

/** Goutte : gros disque en bas, pointe effilee en haut. */
const droplet = normalize(
  profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
  1.04
)

/** Capsule couchee : enveloppe de deux disques cote a cote. */
const capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0)

export const SHAPES: BotShape[] = [
  { id: 'cercle', radii: new Array(PROFILE_SAMPLES).fill(1) },
  { id: 'galet', radii: pebble },
  // 1.15 et pas 1.02 : sur une superellipse le rayon maximal est la diagonale,
  // donc normaliser dessus donne une forme qui parait plus petite que le cercle.
  { id: 'squircle', radii: normalize(superellipseProfile(4.2), 1.15) },
  { id: 'capsule', radii: capsule },
  // -90deg : un sommet vers le haut de l'ecran (y est oriente vers le bas)
  { id: 'triangle', radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
  // 0deg : sommets a gauche et a droite, donc aretes du haut et du bas plates
  { id: 'hexagone', radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
  { id: 'nuage', radii: cloud },
  { id: 'goutte', radii: droplet },
  { id: 'bouclier', radii: [0.76811,0.76084,0.75865,0.76124,0.76949,0.78157,0.79819,0.81936,0.84429,0.87188,0.90064,0.92884,0.95461,0.97577,0.98909,0.99692,1,0.99692,0.98909,0.97577,0.95461,0.92884,0.90064,0.87188,0.84429,0.81936,0.79819,0.78157,0.76949,0.76124,0.75865,0.76084,0.76811,0.78193,0.80077,0.82766,0.86222,0.90641,0.9606,0.99446,0.9967,0.97565,0.94769,0.91951,0.89461,0.87383,0.85854,0.84954,0.84691,0.84954,0.85854,0.87383,0.89461,0.91951,0.94769,0.97565,0.9967,0.99446,0.9606,0.90641,0.86222,0.82766,0.80077,0.78193] },
  { id: 'dome', radii: [0.83827,0.86307,0.89144,0.92352,0.96,1,0.98119,0.86904,0.77967,0.7132,0.66306,0.62512,0.59673,0.57612,0.56211,0.55398,0.55131,0.55398,0.56211,0.57612,0.59673,0.62512,0.66306,0.7132,0.77967,0.86904,0.98119,1,0.96,0.92352,0.89144,0.86307,0.83827,0.81694,0.79823,0.78158,0.76786,0.75688,0.74846,0.74115,0.73521,0.73111,0.72861,0.72746,0.7257,0.72447,0.72393,0.72405,0.7249,0.72405,0.72393,0.72447,0.7257,0.72746,0.72861,0.73111,0.73521,0.74115,0.74846,0.75688,0.76786,0.78158,0.79823,0.81694] },
  { id: 'arche', radii: [0.60275,0.60566,0.61456,0.62987,0.65241,0.68345,0.72492,0.77974,0.85241,0.94916,1,0.94939,0.90631,0.875,0.85373,0.84137,0.83732,0.84137,0.85373,0.875,0.90631,0.94939,1,0.94917,0.85242,0.77974,0.72492,0.68345,0.65241,0.62987,0.61456,0.60567,0.60275,0.60567,0.61456,0.62987,0.65241,0.68345,0.72028,0.75943,0.79668,0.83115,0.86223,0.88946,0.91243,0.93074,0.94404,0.95213,0.95507,0.95213,0.94404,0.93074,0.91243,0.88946,0.86223,0.83115,0.79668,0.75943,0.72028,0.68345,0.65241,0.62987,0.61456,0.60566] },
  { id: 'cylindre', radii: [0.75553,0.75919,0.77034,0.78953,0.81778,0.85669,0.90867,0.97495,1,0.98632,0.96465,0.94201,0.92188,0.90609,0.89305,0.88555,0.8841,0.88555,0.89305,0.90609,0.92188,0.942,0.96465,0.98631,1,0.97495,0.90868,0.8567,0.81779,0.78954,0.77034,0.75919,0.75554,0.75919,0.77034,0.78954,0.81779,0.8567,0.90868,0.97495,1,0.98631,0.96465,0.942,0.92188,0.90609,0.89305,0.88555,0.8841,0.88555,0.89305,0.90609,0.92188,0.94201,0.96465,0.98632,1,0.97495,0.90867,0.85669,0.81778,0.78953,0.77034,0.75919] },
  { id: 'gemme', radii: [0.99114,0.97617,0.9556,0.93557,0.91816,0.90422,0.89422,0.88849,0.88695,0.8896,0.89664,0.90774,0.92283,0.94154,0.9627,0.98434,0.99999,0.98434,0.96271,0.94155,0.92282,0.90775,0.89665,0.88961,0.88696,0.8885,0.89424,0.90419,0.91814,0.93558,0.95558,0.97619,0.99116,0.97618,0.95559,0.93556,0.91815,0.9042,0.89424,0.8885,0.88697,0.88962,0.89666,0.90776,0.92282,0.94156,0.96272,0.98436,1,0.98435,0.96271,0.94156,0.92283,0.90775,0.89665,0.88961,0.88696,0.88849,0.89423,0.90423,0.91817,0.93555,0.9556,0.97616] },
  { id: 'cristal', radii: [0.71233,0.71577,0.72628,0.74438,0.77102,0.79921,0.81963,0.82976,0.82937,0.82635,0.82946,0.84072,0.8607,0.89044,0.9306,0.96686,0.98329,0.96688,0.93063,0.89048,0.86074,0.84076,0.8295,0.82638,0.8294,0.82977,0.81962,0.79919,0.77098,0.74435,0.72625,0.71574,0.7123,0.71574,0.72625,0.74435,0.76733,0.78944,0.80688,0.81852,0.82437,0.82553,0.82878,0.84003,0.85999,0.8897,0.93081,0.97924,1,0.97922,0.93077,0.88966,0.85995,0.83999,0.82874,0.8255,0.82434,0.81851,0.80689,0.78946,0.76735,0.74438,0.72628,0.71577] },
  /*
   * L'oeuf : la silhouette de l'ancien ETAT `egg`, promue au rang de forme.
   *
   * ── Pourquoi il demenage ici (2026-10-30) ─────────────────────────
   * « 将（蛋）重构一下，变成身形，做不到就直接移除，适配颜色和表情 ». L'etat
   * `egg` affichait une silhouette d'oeuf avec un visage fixe pendant 1,8 s ou
   * rien ne bougeait : ce n'est pas une animation, c'est une forme. En forme
   * ordinaire elle herite de ce qui lui manquait — les 12 couleurs, les 16
   * expressions, le morph de 0,45 s — et elle apparait dans le selecteur.
   *
   * Le profil est repris TEL QUEL de `profiles.ts` (`egg`), releve au pixel sur
   * la video de reference : c'est la meme geometrie, seule sa place change.
   * Il est normalise comme les autres pour que son pic soit a 1,0.
   */
  { id: 'oeuf', radii: normalize([...PROFILES.egg]) }
]

// Map indexee par `string` et non par `ShapeId` : les appelants interrogent avec
// une valeur relue du localStorage ou d'une prop, donc non validee.
export const SHAPE_BY_ID = new Map<string, BotShape>(SHAPES.map((s) => [s.id, s]))
export const DEFAULT_SHAPE = 'cercle'

export type ColorId =
  | 'encre'
  | 'creme'
  | 'brun'
  | 'rouge'
  | 'orange'
  | 'ambre'
  | 'vert'
  | 'turquoise'
  | 'bleu'
  | 'violet'
  | 'rose'
  | 'gris'

export interface BotColor {
  id: ColorId
  hex: string
}

/** Palette du personnalisateur d'origine. */
export const COLORS: BotColor[] = [
  { id: 'encre', hex: '#0a0a0c' },
  { id: 'brun', hex: '#8b5e3c' },
  { id: 'rouge', hex: '#e8483f' },
  { id: 'orange', hex: '#f08a24' },
  { id: 'ambre', hex: '#f0b429' },
  { id: 'vert', hex: '#3ecf8e' },
  { id: 'turquoise', hex: '#2fbfa0' },
  { id: 'bleu', hex: '#3b93f0' },
  { id: 'violet', hex: '#8b5cf6' },
  { id: 'rose', hex: '#e152b0' },
  { id: 'gris', hex: '#a3a3a3' },
  { id: 'creme', hex: '#f1efe9' }
]

export const COLOR_BY_ID = new Map<string, BotColor>(COLORS.map((c) => [c.id, c]))
export const DEFAULT_COLOR = 'encre'

/** Melange deux couleurs hex. Sert a la brume de profondeur des particules. */
export function mixHex(from: string, to: string, t: number): string {
  const parse = (h: string) => {
    const v = parseInt(h.slice(1), 16)
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
  }
  const a = parse(from)
  const b = parse(to)
  const c = a.map((x, i) => Math.round(x + (b[i]! - x) * t))
  return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

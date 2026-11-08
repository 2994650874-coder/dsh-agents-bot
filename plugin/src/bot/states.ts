import {
  COMET_DOT,
  COMET_RIBBONS,
  DOT_PEAK,
  DOT_R,
  DOT_X,
  NOTIF_ANGLE,
  NOTIF_DIST,
  NOTIF_MARGIN,
  NOTIF_POP,
  NOTIF_R,
  SWOOSH,
  particles,
  type ArcSpec,
  type DotRender,
  type RibbonSpec,
  type RingRender
} from './decor'
import { EYE_H, EYE_SPLIT, EYE_W, REST_GAZE, type HeadGaze } from './face'
import { TAU, clamp, easings } from './math'
import {
  BODY,
  EXTERIOR_DOT_SCALE,
  ballOffset,
  beltDots,
  beltRibbons,
  dockDots,
  firework,
  loadingAbsorbAt,
  loadingAbsorbFor,
  orbitDots,
  progressRings,
  radarRings,
  recvDots,
  recvRings,
  REACH,
  REF_R,
  sendDots,
  sendRings
} from './overlay'
import {
  circle,
  hullOfCircles,
  polyPath,
  profileFromPolygon,
  silhouette,
  type Silhouette
} from './shape'

export interface EyeCfg {
  /** largeur locale (axe court de la gelule), en unites de rayon de boule */
  w: number
  /** hauteur locale (axe long) */
  h: number
  /** 1 = ouvert, 0 = ferme */
  open: number
  /**
   * Inclinaison propre de la gelule, en degres, positif = le haut part a
   * droite. Appliquee APRES le repere tangent de la sphere. Sans elle, les deux
   * yeux penchent forcement du meme cote (le roulis de tete) et la colere comme
   * la tristesse, qui demandent des inclinaisons en miroir, sont hors de portee.
   */
  tilt?: number
}

/**
 * Les bornes du balayage de tete de `waking`.
 *
 * ── D'ou vient 1,5 s (2026-10-31) ─────────────────────────────────────
 * « 摇头的速度慢一点，大概0.6 ». Le geste durait 0,9 s ; a 0,6 x la vitesse il
 * en dure 0,9 / 0,6 = 1,5 s. Le DEPART reste a 1,05 s (fin de l'ouverture
 * lente), la fin s'etire donc a 2,55 s.
 *
 * Ces bornes sont nommees au lieu d'etre ecrites en dur parce qu'elles servent
 * TROIS fois : a decouper les phases du `pose`, a calculer la duree de l'etat,
 * et au test qui verifie que la gerbe part pendant le balayage. Trois copies
 * d'un meme nombre finissent toujours par diverger.
 */
const WAKE_SHAKE_START = 1.05
const WAKE_SHAKE_END = 2.55
/**
 * Instant de la gerbe de `waking`.
 *
 * « 苏醒演化应该在摇头的时候出现 » : la gerbe ne part plus a l'ouverture des yeux
 * mais PENDANT le balayage. 1,35 s = 0,3 s apres le debut du balayage, donc au
 * moment ou la tete est au premier point extreme de son aller-retour — la
 * gerbe est declenchee par le geste, pas par l'ouverture des paupieres.
 */
const WAKE_BURST_AT = WAKE_SHAKE_START + 0.3

export interface Pose {
  /** silhouette du corps, en unites de rayon de boule */
  sil: Silhouette
  /** decalage global du corps ET des yeux */
  offX: number
  offY: number
  gaze: HeadGaze
  /** demi-ecart des yeux sur la sphere, en degres */
  split: number
  /** [oeil interieur, oeil exterieur] */
  eyes: [EyeCfg, EyeCfg]
  /**
   * Rotation du bot dans le plan de l'ecran, en radians.
   *
   * ── Pourquoi ce champ existe ──────────────────────────────────────────
   * `sil.rot` ne suffit pas : ces animations forcant un corps CIRCULAIRE, une
   * rotation de silhouette ne se voit pas — un disque qui tourne est un disque.
   * Or c'est justement ce que l'utilisateur demande sur `celebrate` (« 急速空转 »)
   * et sur `search` (« 身形旋转 »). Ce qui tourne et qui se VOIT, c'est le
   * visage : les yeux orbitent autour du centre.
   *
   * Le moteur applique donc cette rotation aux DEUX yeux (position et repere),
   * apres les avoir poses sur la sphere. Sur une forme non circulaire, `sil.rot`
   * porte en plus la rotation du corps — les deux ensemble donnent le tour
   * complet.
   */
  spin: number
  /** opacite des yeux : sert aux etats sans visage */
  eyeAlpha: number
  bodyAlpha: number
  dots: DotRender[]
  arcs: ArcSpec[]
  /**
   * Bandes remplies : les « 肥厚的彩线 » de la ceinture de `loading` / `humming`.
   *
   * Voir `RibbonSpec` dans `decor.ts`. C'est une famille a part : ni un point,
   * ni un trait a epaisseur constante, ni un anneau.
   */
  ribbons: RibbonSpec[]
  /**
   * Cercles traces (non remplis) : anneaux de radar, jauge, ondes de choc.
   *
   * Troisieme famille de decor, et pas un detournement des deux autres — voir
   * `RingRender` dans `decor.ts` pour pourquoi `ArcSeed` et `DotRender` ne
   * savent pas le faire.
   */
  rings: RingRender[]
  notif: { x: number; y: number; r: number; notch: number } | null
  /** true = le decor passe derriere le corps (particules de l'eclatement) */
  dotsBehind: boolean
}

const pair = (w: number, h: number): [EyeCfg, EyeCfg] => [
  { w, h, open: 1 },
  { w, h, open: 1 }
]

function base(over: Partial<Pose> = {}): Pose {
  return {
    sil: circle(1),
    offX: 0,
    offY: 0,
    gaze: { ...REST_GAZE },
    split: EYE_SPLIT,
    eyes: pair(EYE_W, EYE_H),
    eyeAlpha: 1,
    bodyAlpha: 1,
    spin: 0,
    dots: [],
    arcs: [],
    ribbons: [],
    rings: [],
    notif: null,
    dotsBehind: false,
    ...over
  }
}

/** A front-facing option is reserved for future states; no current state uses it. */
export type SmallBallFacing = 'left-up' | 'original' | 'front'

/** One reusable small-ball body and face; each state keeps its own motion and decorations.
 * Search mirrors its whole pose later, so its authored face stays unmirrored here. */
export function smallBall(r = BODY.small, facing: SmallBallFacing = 'left-up'): Partial<Pose> {
  const gaze = facing === 'front' ? { yaw: 0, pitch: 0, roll: 0 }
    : facing === 'left-up' ? { ...REST_GAZE, yaw: -REST_GAZE.yaw, roll: -REST_GAZE.roll }
      : { ...REST_GAZE }
  return {
    sil: circle(r), gaze,
    eyes: pair(EYE_W * r * 1.35, EYE_H * r * 1.35),
    split: EYE_SPLIT * r * 1.35
  }
}

/* --------------------------------------------------- formes non radiales */

/**
 * Barre du "!" vertical : enveloppe convexe de deux cercles.
 * Mesure : cercle haut (0, -0.505) r 0.132, cercle bas (0, +0.130) r 0.075,
 * flancs rectilignes. Elle est donc tronconique (rapport haut/bas 1.76).
 */
const BAR_UPRIGHT_CY = -0.1875
const BAR_UPRIGHT = profileFromPolygon(
  hullOfCircles(0, -0.505, 0.132, 0, 0.13, 0.075),
  0,
  BAR_UPRIGHT_CY
)

/** Barre du "!" penche : capsule pure (largeur constante 0.269, longueur 0.776). */
const BAR_ITALIC = profileFromPolygon(hullOfCircles(0, -0.2535, 0.1345, 0, 0.2535, 0.1345), 0, 0)

const barUpright = (pose: Partial<Silhouette> = {}): Silhouette => ({
  radii: [...BAR_UPRIGHT],
  rot: 0,
  cx: 0,
  cy: BAR_UPRIGHT_CY,
  sx: 1,
  sy: 1,
  ...pose
})

const barItalic = (pose: Partial<Silhouette> = {}): Silhouette => ({
  radii: [...BAR_ITALIC],
  rot: 0,
  cx: 0,
  cy: 0,
  sx: 1,
  sy: 1,
  ...pose
})

/**
 * Le point du "!" penche n'est pas un disque : c'est une goutte, bout rond
 * (r 0.118) du cote de la barre et pointe effilee a l'oppose, longueur 0.300
 * dans l'axe du glyphe. Centree sur le barycentre du bout rond.
 */
const TEAR = polyPath(hullOfCircles(0, 0, 0.118, 0, 0.172, 0.012))

/* ------------------------------------------------------------------ etats */

export type StateId =
  | 'idle'
  | 'thinking'
  | 'wink'
  | 'wide'
  | 'alert'
  | 'notify'
  | 'exclaim'
  | 'bounce'
  | 'hexagon'
  | 'play'
  | 'search'
  | 'orbit'
  | 'radar'
  | 'progress'
  | 'burst'
  | 'comet'
  | 'celebrate'
  | 'loading'
  | 'waking'
  | 'sleeping'
  | 'sending'
  | 'receiving'
  | 'uploading'

export interface StateDef {
  id: StateId
  /** duree de maintien quand la sequence complete est jouee */
  duration: number
  /**
   * duree en dessous de laquelle l'animation est coupee avant d'aboutir : le
   * "!" ne revient pas, le corps reste eclate. Elle se lit dans les constantes
   * de `pose` ci-dessous, elle ne se choisit pas. Absente = l'etat ignore le
   * temps ou boucle, n'importe quelle duree lui va (voir `MIN_BLOCK`).
   */
  minDuration?: number
  /** duree du morph d'entree */
  morph: number
  /** true = l'entree est masquee par un clignement, comme dans la video */
  blinkIn: boolean
  /**
   * true = le corps est la silhouette "au repos", donc remplacable par la forme
   * choisie dans le personnalisateur. Les etats qui dessinent leur propre forme
   * (le "!", les points, l'oeuf, le triangle...) valent false : c'est cette forme
   * la qui EST l'animation.
   */
  baseBody: boolean
  /**
   * Poids (0..1) du « corps au repos » a l'instant local `t`.
   *
   * Pour les etats qui ne sont pas `baseBody` mais qui REVIENNENT au corps au
   * repos en fin d'animation : le moteur y melange la forme choisie dans le
   * personnalisateur. Sans ca ces etats finissaient sur une BOULE, et quelqu'un
   * qui a choisi une autre forme voyait le bot repasser par un rond a chaque
   * tour — le « cercle » qu'on croyait etre l'etat `idle`.
   *
   * 0 = la forme de l'animation (le triangle d'`orbit`, le point de `comet`),
   * 1 = le corps au repos, donc la forme choisie.
   */
  bodyRest?(local: number): number
  /**
   * true = l'etat porte le visage "au repos", donc remplacable par l'expression
   * choisie. Seul `idle` : les autres etats a visage ont une expression relevee
   * sur la video, c'est precisement ce qu'on reproduit.
   */
  baseFace: boolean
  /** Mirror this authored pose across the vertical screen axis on every Bot surface. */
  mirrorX?: boolean
  pose(local: number): Pose
}

/** Onde de pulsation qui parcourt les trois points de gauche a droite. */
function dotPulse(t: number, index: number): number {
  const p = ((((t - index * 0.5) / 1.5) % 1) + 1) % 1
  const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0
  return clamp(k * 2)
}

/**
 * Facteur de ralentissement des gerbes de `celebrate`.
 *
 * ── Pourquoi il porte sur l'horloge des feux et pas sur la duree de l'etat ──
 * L'utilisateur a demande « 烟花的效果放慢到 0.7 ». La tentation est de
 * multiplier la duree de l'etat par 1/0,7 = 1,43, mais ca rapprocherait les
 * quatre departs dans le temps REEL : la scene deviendrait plus dense au lieu
 * d'etre plus lente. En etalant plutot le temps que voient les gerbes
 * (`ft = t * 0,7`), chaque particule vit plus longtemps ET chaque gerbe garde sa
 * place — les deux effets demandes, sans le troisieme qu'on ne veut pas.
 *
 * ── 0,7 puis 0,49 (2026-10-31) ────────────────────────────────────────
 * « 庆祝再慢 0.7 » : c'est un SECOND facteur applique au premier, pas un
 * remplacement. Il a vu la version a 0,7 et demande de la ralentir encore, donc
 * 0,7 x 0,7 = 0,49. La duree suit : 6,0 / 0,7 = 8,6 s, sinon la derniere gerbe
 * serait coupee en pleine explosion — c'est exactement ce que `smoke-loop` avait
 * signale la premiere fois, et la raison est structurelle : on ne ralentit pas
 * un mouvement dont la duree d'affichage est fixe.
 */
const CELEBRATE_SLOW = 0.49

export const STATES: StateDef[] = [
  {
    id: 'idle',
    mirrorX: true,
    duration: 2.4,
    morph: 0.45,
    blinkIn: false,
    baseFace: true,
    baseBody: true,
    pose: () => base()
  },

  {
    id: 'thinking',
    duration: 2.6,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: (t) => {
      const mid = dotPulse(t, 1)
      // Les points lateraux sortent des flancs de la boule : dans la video ils
      // restent fusionnes avec elle 1-2 frames avant de se detacher.
      const emerge = 0.3 + 0.7 * easings.easeOutCubic(clamp(t / 0.3))
      return base({
        // la boule DEVIENT le point du milieu : le morph reste continu
        sil: circle(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1]! }),
        eyeAlpha: 0,
        dots: [0, 2].map((i) => {
          const k = dotPulse(t, i)
          return {
            x: DOT_X[i]! * emerge,
            y: 0,
            r: DOT_R * (1 + (DOT_PEAK - 1) * k),
            opacity: 0.55 + 0.45 * k
          }
        })
      })
    }
  },

  {
    id: 'wink',
    duration: 1.6,
    morph: 0.3,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: () =>
      base({
        gaze: { yaw: -5.37, pitch: 4.55, roll: 6.7 },
        split: 16.25,
        // L'oeil ferme n'est pas l'oeil ouvert ecrase : c'est un tiret
        // horizontal PLUS LARGE que l'oeil ouvert (0.447 contre 0.236).
        eyes: [
          { w: 0.236, h: 0.464, open: 1 },
          { w: 0.447, h: 0.089, open: 1 }
        ]
      })
  },

  {
    id: 'wide',
    duration: 1.8,
    morph: 0.55,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: () =>
      base({
        gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
        split: 18.43,
        eyes: pair(0.356, 0.875)
      })
  },

  {
    /*
     * ── 2026-10-31 : `alert` s'appelle desormais « 写文件 » (writing) ──
     *
     * L'utilisateur a renomme trois etats d'un coup, en gardant les dessins :
     *   play    → 环流   (le trait qui balaie le corps)
     *   alert   → 写文件 (la barre « ! » qui traverse et vibre)
     *   exclaim → 错误   (le « ! » vertical, immobile)
     *
     * L'id interne ne change pas : il est utilise par les tables de mesures,
     * les anciens enregistrements de rotation et les tableaux de bord
     * historiques (`turn*.html`). Seul le LIBELLE change — c'est une couche
     * d'affichage (`ANIMATION_OPTIONS`), pas une couche d'art.
     */
    id: 'alert',
    duration: 2.4,
    // le "!" revient en place a 1.6 + 0.4
    minDuration: 2,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      // Course mesuree : -0.087 -> +0.732 en 1.5 s, ease-in-out, micro-overshoot.
      const p = clamp(t / 1.5)
      const travel = easings.easeInOutCubic(p) * 0.82 - 0.087
      const back = t > 1.6 ? clamp((t - 1.6) / 0.4) : 0
      const x = travel * (1 - back) + 0.1 * back
      // Vibration secondaire a 2.5 Hz, barre et point en opposition de phase.
      const buzz = Math.sin(t * 2.5 * TAU) * 0.005
      const tilt = (17.7 * Math.PI) / 180
      return base({
        sil: barItalic({ rot: tilt, cx: x, cy: -0.325 - buzz }),
        eyeAlpha: 0,
        dots: [
          {
            // le point suit l'axe du glyphe, a 0.580 du centre de la barre
            x: x - Math.sin(tilt) * 0.58,
            y: -0.325 + Math.cos(tilt) * 0.58 + buzz * 2.8,
            r: 0.118,
            d: TEAR,
            rot: (tilt * 180) / Math.PI,
            opacity: 1
          }
        ]
      })
    }
  },

  {
    id: 'notify',
    duration: 2.2,
    morph: 0.5,
    blinkIn: true,
    baseFace: false,
    baseBody: true,
    pose: (t) => {
      // Pop du point bleu : pic a +14 % vers 0.3 s puis stabilisation.
      const p = clamp(t / 0.45)
      const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * 0.35)
      const r = NOTIF_R * (p < 1 ? pop : 1)
      const a = (NOTIF_ANGLE * Math.PI) / 180
      return base({
        // le regard part a l'oppose de la pastille
        gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
        split: 18.89,
        eyes: pair(0.505, 0.498),
        notif: {
          x: Math.cos(a) * NOTIF_DIST,
          y: Math.sin(a) * NOTIF_DIST,
          r,
          notch: r + NOTIF_MARGIN
        }
      })
    }
  },

  {
    /* Voir `alert` : renomme « 错误 » (l'id reste `exclaim`). */
    id: 'exclaim',
    duration: 2,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: () =>
      base({
        sil: barUpright(),
        eyeAlpha: 0,
        dots: [{ x: -0.012, y: 0.526, r: 0.113, opacity: 1 }]
      })
  },

  {
    /*
     * Le petit point qui rebondit.
     *
     * ── Pourquoi il s'appelait `sleep` et pourquoi ce n'est plus le cas ──
     * Il vient de la video de reference sous le nom « sommeil », mais sa
     * geometrie est un point de rayon 0.1585 qui monte et descend, sans visage :
     * c'est un BOND, pas un sommeil. L'utilisateur l'a fait remarquer (« 我们的
     * 那个 sleep 应该更接近于弹跳 ») et la mesure lui donne raison — ce n'est
     * pas une question de gout, c'est ce que le dessin fait.
     *
     * Il garde donc son dessin et prend le nom de ce qu'il fait. Le vrai
     * sommeil est desormais `sleeping`.
     *
     * Le mouvement vient de `ballOffset` (chute libre puis rebonds amortis) et
     * non d'une sinusoide : une sinusoide donne une oscillation molle, alors
     * qu'une balle au sol a une chute acceleree et un rebond. C'est la meme
     * physique que `bouncing` de la source, ce qui est coherent puisqu'il
     * s'agit du meme mouvement.
     */
    id: 'bounce',
    duration: 2.4,
    morph: 0.5,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) =>
      base({
        // le point : rayon mesure 0.1585, centre mesure a +0.11
        sil: circle(0.1585, { cy: 0.11 + ballOffset(t) * 0.68 }),
        eyeAlpha: 0
      })
  },

  {
    id: 'hexagon',
    duration: 1.6,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: true,
    pose: () =>
      base({
        sil: silhouette('hexagon'),
        gaze: { yaw: 23.11, pitch: 24.42, roll: -13.3 },
        split: 13.37,
        eyes: pair(0.177, 0.411)
      })
  },

  {
    /*
     * L'ecriture : le corps au repos, l'expression « 专注 », et un trait qui
     * balaie par-dessus.
     *
     * ── Ce qui a change (2026-10-30) ───────────────────────────────────
     * « 写文件的那个图案，能不用三角形吗？就直接跟随身形，相当于他的动画就是原动画
     * （一条线）+表情（专注） ». La version precedente forçait un TRIANGLE
     * (`spinningTriangle`) au milieu du balayage : c'etait une deuxieme
     * silhouette qui remplacait celle de l'utilisateur, sur une animation dont
     * le sujet est justement le TRAIT — l'arc qui passe. Le triangle ne servait
     * qu'a meubler le centre.
     *
     * Le corps devient donc `baseBody: true` : il suit la forme choisie dans le
     * personnalisateur, comme `idle`. Ce qui reste, c'est ce que l'utilisateur a
     * nomme lui-meme : un trait qui balaie (`SWOOSH`), et un visage concentre.
     *
     * ── Pourquoi `baseFace: false` alors que l'utilisateur dit « 表情（专注）» ──
     * Sa phrase decrit ce qu'il voit, pas un mecanisme : il veut que le visage
     * soit celui de la concentration, donc on pose l'expression `attentif`
     * (专注) EN DUR. Laisser `baseFace: true` donnerait le visage de repos
     * choisi par l'utilisateur, qui n'est pas concentre. L'expression codee ici
     * reprend mot pour mot celle de `EXPRESSIONS` (voir `expressions.ts`) : la
     * meme forme d'yeux, le meme regard.
     *
     * ── Renomme « 环流 » (2026-10-31) ──────────────────────────────────
     * Voir `alert` : l'id `play` ne change pas, seul le libelle affiche.
     * « 环流 » decrit ce qu'on voit (le trait qui fait le tour du corps) ; ce
     * n'est plus rattache a l'ecriture, qui prend desormais le dessin de `alert`.
     */
    id: 'play',
    duration: 2,
    morph: 0.5,
    baseFace: false,
    baseBody: true,
    blinkIn: true,
    pose: (t) => {
      // le trait reste present tout du long ; seule son intensite respire
      const fade = clamp(t / 0.35) * clamp((2.2 - t) / 0.5)
      return base({
        // corps au repos : c'est `posed()` qui y met la forme choisie
        sil: circle(1),
        gaze: { yaw: 4, pitch: 5, roll: -4 },
        split: 16,
        eyes: pair(0.21, 0.44),
        // le trait balaie de la droite vers la gauche par-dessus le corps :
        // c'est l'ancienne trajectoire de `SWOOSH`, conservee telle quelle
        arcs: SWOOSH.map((s, i) => ({
          id: `sw${i}`,
          seed: { ...s, cx: 0.45 - t * 0.42 },
          t,
          opacity: fade
        }))
      })
    }
  },

  {
    /*
     * Cinq points qui orbitent — la version « overlay » de la source.
     *
     * Remplace l'ancien `orbit` (un triangle qui tournait au milieu de six
     * ellipses). L'utilisateur a demande de le supprimer sans ambiguite
     * (« 原来的 orbit、漩涡两个都移除，太丑了 »), et la mesure dit pourquoi :
     * les ellipses de l'ancien etaient toutes a 1.3-1.4 rayon, donc six traits
     * rigides qui tournaient — ce qu'il decrit comme « un tas de lignes qui
     * tournent ». Ici il n'y a aucun trait, cinq disques qui varient en taille
     * et en opacite avec la profondeur, et le corps partage a ~0.30.
     *
     * Voir `overlay.ts` pour les mesures de rayon et le pourquoi du corps
     * retreci.
     */
    id: 'orbit',
    /*
     * ── 3,4 -> 3,0 s (2026-10-31) ─────────────────────────────────────
     * « 环绕的动画可以压缩到 3s 吗？不调整速度 ». La duree se raccourcit donc
     * sans toucher a la vitesse de rotation (`orbitDots` garde `t * 1,7`) :
     * c'est la fin qui est coupee, pas le geste qui accelere.
     *
     * Consequence mesuree et assumee : a duree constante le nombre de tours
     * DIMINUE (0,84 -> 0,74 tour sur toute la duree, et 0,59 tour avant que la
     * fusion ne commence). L'utilisateur croyait que l'animation faisait « deux
     * tours » ; la mesure dit 0,84, et c'est `uploading` qui tourne 3 fois. Il
     * n'a pas demande d'accelerer, donc on n'accelere pas.
     */
    duration: 3,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      /*
       * ── Plus d'enveloppe d'opacite (2026-10-30) ──────────────────────
       * `fade` servait a faire disparaitre les cinq points en fin d'etat. Elle
       * est remplacee par la FUSION dans la bille (voir `orbitDots`) : les
       * points convergent et s'y fondent, ce qui est une fin, alors qu'un fondu
       * d'opacite n'est qu'une disparition. L'utilisateur a demande exactement
       * ce changement (« 参考爆发，是融合起来、然后结束 »).
       *
       * Il reste un fondu d'ENTREE de 0,5 s : le decor ne doit pas etre la avant
       * que le corps soit arrive.
       */
      const fadeIn = clamp(t / 0.5)
      return base({
        // le corps devient la petite bille centrale
        ...smallBall(),
        eyeAlpha: 1,
        dots: orbitDots(t, fadeIn, 3).map((d) => ({ ...d, depth: undefined })),
        rings: []
      })
    }
  },

  {
    /*
     * L'echo de radar : trois anneaux qui partent du corps et s'elargissent.
     *
     * Le corps est une petite bille partagee (~0.30), tandis que les anneaux
     * s'etendent bien au-dela : c'est le cadrage le plus large du lot et donne
     * l'impression d'un balayage dans l'espace.
     */
    id: 'radar',
    duration: 3,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const fade = clamp(t / 0.4) * clamp((3 - t) / 0.4)
      const r = BODY.small
      return base({
        ...smallBall(r),
        /*
         * ── Encore plus lent (2026-10-31) ──────────────────────────────
         * « 雷达再慢 0.7 ». Le facteur est DANS `radarRings` (0,8 -> 0,56) et pas
         * applique ici : le temps des anneaux doit rester leur affaire, sinon la
         * duree de l'etat et celle de la pulsation divergent sans qu'on le voie.
         * Consequence a assumer : a 0,56 le tour passe de 1,63 s a 2,32 s, donc
         * l'etat de 3 s ne contient plus qu'environ 1,3 tour au lieu de 1,8.
         * Les trois anneaux restent visibles en permanence (ils sont dephases de
         * 1/3 de tour), donc rien ne « manque » a l'image.
         */
        rings: radarRings(t, fade, r)
      })
    }
  },

  {
    /*
     * La jauge : un cercle pale et un arc qui se remplit depuis midi.
     *
     * C'est l'animation qui remplace `swirl` sur l'activite « compression de
     * contexte » : un remplissage qui progresse est plus juste pour dire
     * « ca travaille » qu'un tourbillon decoratif.
     */
    id: 'progress',
    duration: 2.5,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const fade = clamp(t / 0.4) * clamp((2.5 - t) / 0.4)
      const r = BODY.small
      return base({
        ...smallBall(r),
        rings: progressRings(t, fade)
      })
    }
  },

  {
    /*
     * La fete : le petit bot fait un tour eclair sur lui-meme et tire des feux
     * d'artifice colores.
     *
     * ── Ce qui manquait ──────────────────────────────────────────────────
     * Une version precedente ne faisait que sauter en lachant huit points
     * blancs. C'etait « 原始的默认 » : le saut existe deja dans `bounce`, et
     * huit points d'une seule couleur ne se lisent pas comme une fete.
     *
     * ── Corps RETRECI, comme `orbit` / `radar` (corrige le 2026-10-30) ──
     * La version precedente gardait le corps PLEIN en invoquant une mesure de la
     * source. Mesure juste, conclusion fausse : a corps plein, les gerbes
     * partaient du bord de la silhouette et l'explosion se reduisait a un
     * liseré colle au corps — l'utilisateur a demande « 能换成和环绕和雷达差不多
     * 的缩小形态吗？不要原版那个硕大的球体在那边转 ».
     *
     * Le corps prend donc `BODY.small`, la meme valeur qu'`orbit` et `radar` : les
     * trois animations du meme groupe ont enfin la meme taille de bille, et les
     * gerbes ont toute la scene pour s'etendre. La lecture y gagne aussi — une
     * grosse bille qui tourne sur place fait « roue qui tourne », une petite
     * bille qui eclabousse fait « fete ».
     *
     * Les yeux suivent le corps (`1.5 x` comme ailleurs), sinon ils debordent.
     *
     * ── Un ecart assume, et pourquoi ─────────────────────────────────────
     * la source enchaine les gerbes sur l'horloge absolue. Ici elles sont posees
     * a des dates FIXES dans la duree de l'etat, pour que rejouer une date
     * redonne la meme image (le moteur est une fonction pure du temps).
     */
    id: 'celebrate',
    /*
     * ── 8,6 -> 2,9 s, et quatre gerbes -> deux (2026-10-31) ────────────
     * « 动画庆祝一遍约8.6秒，这个是提示错了吗？还是他真的8s？……3s差不多了吧？ »
     * puis, devant le choix : « A：两发同时炸，总长 2.9 秒 ».
     *
     * L'utilisateur avait raison de trouver 8,6 s long, et la mesure explique
     * pourquoi : l'ancienne version posait QUATRE gerbes a 0,05 / 0,95 / 1,85 /
     * 2,75 s. Chacune vit jusqu'a 2,86 s en temps reel (1,4 s a l'horloge des
     * feux divisee par 0,49), donc elles se CHEVAUCHAIENT en permanence : on
     * voyait quatre explosions qui n'en finissent pas, et la duree de 8,6 s
     * etait exactement le prix de ce chevauchement (il fallait laisser la
     * derniere finir).
     *
     * ── Ce qui change, et ce qui ne change pas ────────────────────────
     * `CELEBRATE_SLOW` reste 0,49 : la vitesse des feux est celle que
     * l'utilisateur a validee en deux temps (« 放慢到 0.7 » puis « 再慢 0.7 »).
     * On ne raccourcit que le NOMBRE de gerbes : deux au lieu de quatre, et
     * simultanees au lieu d'etalees. Deux puissances differentes (0,95 et 1,1)
     * suffisent a ce que l'oeil voie deux couronnes et non une seule.
     *
     * Donc 2,9 s n'est pas « la meme animation en plus rapide » : c'est une
     * explosion unique qui s'ouvre et s'eteint. Le rapport gerbes/duree change,
     * la vitesse non.
     */
    duration: 2.9,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      /*
       * Quatre gerbes, et leurs fenetres se CHEVAUCHENT.
       *
       * Une premiere version en posait trois, a 0,05 / 1,15 / 2,0 s. Chaque
       * particule vit au plus 0,85 s, donc il restait un trou entre 0,90 et
       * 1,15 s ou la scene etait vide : la planche d'apercu, qui fige une image,
       * est justement tombee dedans et l'animation a paru sans feux d'artifice.
       * Le defaut n'etait pas le nombre de gerbes mais le TROU entre elles.
       * Avec un depart tous les ~0,9 s, la scene est couverte en continu.
       *
       * `from` vaut le rayon de la bille : les particules naissent a son bord,
       * et `firework` calibre leur vitesse pour qu'elles atteignent le cadre
       * (voir `BURST_REACH`).
       *
       * ── Ralentissement a 0,7 (2026-10-30) ────────────────────────────
       * « 庆祝的小球他本身不用转，烟花的效果放慢到 0.7 试一下 ». Le facteur porte
       * sur le TEMPS VU PAR LES GERBES, pas sur l'etat : diviser la duree de
       * l'etat aurait aussi rapproche les quatre departs, et la scene serait
       * devenue plus dense au lieu d'etre plus lente. On etale donc l'horloge
       * des feux (`t * 0.7`) tout en gardant les quatre dates a leur place dans
       * le temps reel — les gerbes sont plus lentes ET aussi bien reparties.
       */
      const r = BODY.small
      const ft = t * CELEBRATE_SLOW
      /*
       * Deux gerbes, simultanees (2026-10-31).
       *
       * Les deux dates sont IDENTIQUES (0,05) : c'est ce qui donne « une seule
       * explosion » et permet de tenir en 2,9 s. Elles gardent deux puissances
       * et deux comptes differents (16 a 0,95 / 22 a 1,1) pour que la couronne
       * ne soit pas un simple cercle double — l'oeil doit lire deux nappes.
       */
      const dots: DotRender[] = [
        ...firework(ft, 0.05, 16, 0.95, 11, r),
        ...firework(ft, 0.05, 22, 1.1, 23, r)
      ]
      /*
       * ── La bille ne tourne plus (2026-10-30) ─────────────────────────
       * « 庆祝的小球他本身不用转 ». `wildSpin` faisait faire neuf tours au visage
       * en 3,8 s : c'etait juste quand la bille etait grosse (le tour se voyait
       * sur le corps), mais depuis qu'elle est retrecie a 0,166 le tour ne
       * porte plus que les deux yeux — et a cette taille, deux yeux qui
       * tournent autour d'un point se lisent comme un default d'affichage, pas
       * comme une fete. La fete, ce sont les gerbes ; la bille n'a qu'a rester
       * posee et palpiter.
       */
      const breathe = 1 + Math.sin(t * 6.2) * 0.05
      return base({
        ...smallBall(r),
        sil: circle(r * breathe, { cy: -Math.abs(Math.sin(t * 1.6)) * 0.025 }),
        dots
      })
    }
  },

  {
    /*
     * Le chargement : une bille minuscule que des billes colorees entourent en
     * tournant, puis qui sont aspirees a la fin.
     *
     * ── Une seule version depuis le 2026-10-31 ────────────────────────
     * L'utilisateur avait demande deux versions (1,2 s et 3,1 s) pour les
     * comparer, puis a tranche : « 我选择长 3.1 秒的那个，可以微调回 2.6 秒 ».
     * La version courte est donc retiree du panneau. Le chiffre 2,6 vient de
     * lui, et il tombe juste : c'est exactement 2,4 x 1,083, l'ecart a la
     * duree d'origine que reclame une ceinture lisible (voir `BELT_SPIN`).
     *
     * ── Les billes, et plus aucun anneau (2026-10-31) ─────────────────
     * Deux demandes successives ont vide cette animation jusqu'a un seul
     * materiau :
     *
     *   « 能换回我们之前那个圆形小球吗，turn87版本的，然后定义为（彩球） »
     *       -> le decor de points redevient des BILLES pleines (`beltDots`)
     *   « （加载）的黑框去掉 »
     *       -> l'anneau `whirlRing` disparait, et le corps reste seul au centre
     *
     * Il ne reste donc que la 彩球, ce qui est exactement la definition de cette
     * famille de materiau (voir README 3.5) : de petits disques pleins d'une
     * couleur fixe, qui tournent et se font avaler.
     *
     * ── Les deux bugs de la version d'origine, corriges ───────────────
     * « 那些小球本来是正常流动的，然后在末尾却突然变大，然后疯狂旋转吸收进去了 ».
     * Deux defauts distincts, et le rendu les avait tous les deux :
     *
     *   · le point devenait GEANT en fin de vie, parce que `spinup = 1 + 2,5
     *     pull` multipliait son rayon x3,5. Le facteur est supprime — la taille
     *     ne depend plus que du temps d'entree ;
     *   · il « 疯狂旋转 », meme cause. La rotation est maintenant strictement
     *     constante apres la montee initiale (voir `beltDots`).
     *
     * ── La fin : la matiere est avalee, et c'est tout ─────────────────
     * L'ancienne choregraphie en deux temps (« 彩色小球先吸回去，然后黑框收回 »)
     * a disparu avec le cadre qui la motivait. Il reste les billes qui rentrent
     * et s'eteignent en arrivant — la fenetre est donnee par `loadingAbsorbAt`,
     * qui FINIT a la fin de l'etat (avant, elle laissait les 20 % derniers vides).
     *
     * Tout le rythme interne est exprime en FRACTION de la duree : une constante
     * en secondes ferait manger la moitie de l'animation par l'ouverture.
     */
    id: 'loading',
    duration: 2.6,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const r = BODY.small
      return base({
        // le corps derive lentement : c'est le mouvement « ca cherche »
        ...smallBall(r),
        sil: circle(r, { cx: Math.sin(t * 0.9) * 0.03, cy: Math.sin(t * 1.3) * 0.02 }),
        /*
         * ── Plus d'anneau du tout (2026-10-31) ────────────────────────────
         * « （加载）的黑框去掉 ». C'etait `whirlRing` : un cercle TRACE a
         * `REACH`, epais de 4,5 px, qui s'ouvrait puis se refermait en tournant.
         *
         * Ce n'est pas le meme objet que le 黑圆框 de mesure (voir README 3.5) :
         * celui-la est un repere invisible. L'anneau de `loading`, lui, etait
         * bel et bien peint — c'est meme la premiere chose qu'on voyait de
         * l'animation, avant les billes. Il part donc, et avec lui le couplage
         * « les billes rentrent PUIS l'anneau se ferme » qui n'avait plus
         * d'objet : l'absorption occupe maintenant la fin de l'etat (voir
         * `loadingAbsorbAt`).
         *
         * `loading` n'a donc plus qu'une seule famille de decor : la 彩球.
         */
        /*
         * ── 彩球, pas 彩线 (2026-10-31) ────────────────────────────────
         * « 能换回我们之前那个圆形小球吗，turn87版本的，然后定义为（彩球）」.
         * `loading` repasse donc aux BILLES : six disques pleins, chacun d'une
         * couleur fixe, sur deux anneaux aplatis. C'est la definition du mot
         * 彩球 (voir `beltDots`).
         *
         * L'absorption est plus LONGUE que dans la version d'origine (`for` 0,3 s
         * au lieu de 0,2) : c'est la partie que l'utilisateur regarde, et sur
         * 2,6 s de duree totale une aspiration de 0,2 s passait inapercue.
         */
        /*
         * ── Plus d'enveloppe d'entree non plus (2026-10-31, 2e passe) ─────
         * Il y avait `fadeIn = clamp(t / (2,6 * 0,42))` : les six billes
         * montaient de 0 a 1 d'opacite sur la premiere seconde — c'est la moitie
         * « 弹出 » de « 他的弹出和消失都是叠加了一层类似于渐变透明 ».
         *
         * Elle avait une justification (eviter six disques qui apparaissent d'un
         * coup sur une image nue), mais elle n'est plus necessaire : les billes
         * naissent sur le 黑圆框, en dehors de la silhouette, et leur entree est
         * deja portee par `grow` dans `beltDots` (rayon qui pousse de 0 a sa
         * taille). La matiere « pousse », elle ne « se delave » pas.
         */
        dots: beltDots(t, 1, r, loadingAbsorbAt(2.6), loadingAbsorbFor(2.6)),
        /*
         * ── Les billes passent DERRIERE la bille (2026-10-31) ──────────
         * « （加载）的那个彩球……他的弹出和消失都是叠加了一层类似于渐变透明，
         *   我不需要 」
         *
         * Sans ce drapeau, la disparition des 彩球 ne peut etre obtenue qu'en
         * eteignant leur opacite : elles sont peintes APRES la silhouette, donc
         * rien ne les recouvre. En les passant derriere, la silhouette les coupe
         * et la fin se fait toute seule, par pure geometrie — les billes plongent
         * jusqu'a `bodyR * 0,3` et disparaissent sous le corps.
         *
         * C'est exactement le mecanisme deja utilise par `search` (`z = -1`) et
         * par `burst` (particules de l'eclatement).
         */
        dotsBehind: true
      })
    }
  },

  {
    /*
     * Le fredonnement : le corps se reduit et la ceinture de rubans tourne.
     *
     * ── Plus d'anneau (2026-10-30) ────────────────────────────────────
     * « 低吟去掉那个黑圆框 ». L'anneau (`progressRings`) etait un TRAIT de la
     * couleur du corps, trace a 0,888 R : a cette taille, un cercle noir fin se
     * lit comme un cerne d'enceinte, pas comme une jauge. Il ne portait aucune
     * information (il tournait sans se remplir) et il mangeait le cadre dont le
     * decor a besoin. Retire.
     *
     * ── La ceinture devient des rubans (2026-10-31) ───────────────────
     * C'est l'animation que l'utilisateur citait en reference : « 低吟……里面那种
     * 肥厚的彩线，才是我想要的 ». Les gros points de la version precedente
     * (9 px, x1,45) imitaient mal la bande de l'auteur — voir `beltRibbons`. Le
     * corps monte de 0,245 a 0,34 : sans l'anneau, la ceinture est le seul
     * decor, donc c'est elle qui doit remplir la scene, et elle a grossi aussi.
     */
    id: 'search',
    mirrorX: true,
    duration: 2.6,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      /*
       * 0,245 -> 0,30 : « 低吟去掉那个黑圆框，把彩色的小球放大 ». C'est le
       * CORPS qui garde son agrandissement ; ce sont les PARTICULES qui ont
       * change de nature ce tour-ci (des points -> des bandes de 0,16 R), donc
       * c'est elles qui portent le « 放大 » desormais. Grossir les deux encore
       * une fois deséquilibrerait le rapport corps/decor.
       */
      const r = BODY.small
      /*
       * ── Le fondu ne sert plus qu'au DEBUT (2026-10-31) ────────────────
       * « 结束的时候那个彩线结束，就像是原版那样 ». La version precedente
       * eteignait les rubans par `clamp((2,6 - t) / 0,5)` — une transparence qui
       * tombe, donc l'image s'efface. La source ne fait pas ca : chaque ruban a un
       * compteur `ret` qui le fait RENTRER dans sa particule en s'amincissant
       * (voir `beltRibbons`).
       *
       * Le fondu de sortie est donc retire du calcul d'opacite, et remplace par
       * `retractAt`. Il reste au debut, ou il sert a autre chose : eviter que le
       * premier ruban n'apparaisse a pleine opacite sur une image isolee.
       */
      const fade = clamp(t / 0.4)
      return base({
        ...smallBall(r, 'original'),
        sil: circle(r, {
          rot: Math.sin(t * 0.4) * 0.035,
          cx: Math.sin(t * 0.3) * 0.015,
          cy: Math.sin(t * 0.7) * 0.015
        }),
        // plus de `rings` : voir l'entete, l'anneau a ete retire
        // la ceinture de rubans : c'est le « fredonnement » visible
        /*
         * `1,85` + `0,45` = le resserrement se termine a 2,30 s, et le dernier
         * ruban (retard de 0,16 s) a 2,46 s — avant la fin de l'etat a 2,6 s.
         * Une premiere version partait de 2,1 s avec 0,5 s de duree : le dernier
         * ruban finissait a 2,76 s, donc APRES la coupe, et disparaissait d'un
         * coup au lieu de se ranger. La marge doit couvrir
         * `retractAt + 0,16 (etalement) + retractFor`.
         */
        ribbons: beltRibbons(t, fade, r, 'humming', Infinity, 0.2, 1.85, 0.45)
      })
    }
  },

  {
    /*
     * Le reveil : la bille dort, sursaute, ouvre grand les yeux, et tire UNE
     * gerbe de particules colorees.
     *
     * Trois temps, releves dans la source : endormi (0-0.5 s, paupieres
     * baissees, le corps monte de 6 px), le sursaut (0.5-1.2 s, les yeux
     * s'ouvrent d'un coup, le corps saute de 5 px), puis la retombee avec une
     * petite oscillation de rotation qui s'amortit.
     *
     * ── La gerbe, et d'ou elle vient ─────────────────────────────────────
     * Une version precedente n'en avait aucune, d'ou « 苏醒没有那个彩色的烟花 ».
     * Elle est pourtant explicite dans la source, dans la branche du sursaut :
     *
     *     if (!ctx.wakingBurst) ctx.wantBurst = [rand(9, 13), 0.8];
     *
     * soit 9 a 13 particules a puissance 0,8 — le nombre est tire au hasard chez
     * l'auteur, on prend 11 (le milieu) pour rester rejouable. Le jaillissement a
     * lieu au moment ou les yeux s'ouvrent, a 0,55 s.
     */
    id: 'waking',
    mirrorX: true,
    /*
     * 2,6 -> 3,2 s (2026-10-31).
     *
     * La tete met maintenant 1,5 s a balayer au lieu de 0,9 s (« 摇头的速度慢一点，
     * 大概0.6 »), donc tout ce qui vient apres se decale d'autant. La duree suit
     * `WAKE_SHAKE_END + 0,65` : le 0,65 couvre la fin de l'ouverture complete
     * (0,25 s) et la retombee amortie (0,4 s), qui n'ont pas bouge.
     *
     * Allonger la duree n'est pas cosmetique : sans ca la derniere image serait
     * coupee au milieu de la retombee, et l'etat suivant demarrerait sur un corps
     * encore en oscillation.
     */
    duration: 3.2,
    morph: 0.4,
    baseFace: false,
    /*
     * ── Le corps SUIT la forme choisie (2026-10-31) ──────────────────────
     * « （苏醒）（睡眠）目前也是固定死圆形的，帮我修一下，跟随图形 」
     *
     * Exact : c'etaient les deux derniers etats « plein corps » a dessiner un
     * cercle en dur. `baseBody: true` remplace le PROFIL de la silhouette par
     * celui du personnalisateur, en gardant le reste de la pose — c'est deja le
     * mecanisme d'`idle` et de `play`.
     *
     * Ce qui est conserve et pourquoi ca compte : `cy` (l'affaissement puis la
     * respiration) et `rot` passent par `sil`, et `baseBody` ne remplace QUE
     * `radii`. Une arche qui se reveille s'affaisse donc et respire exactement
     * comme le cercle le faisait.
     *
     * `bodyRest` n'est pas le bon outil : il sert aux etats qui NE SONT PAS le
     * corps au repos et y reviennent a la fin (`burst`, `comet`). Ici on est le
     * corps au repos du debut a la fin.
     */
    baseBody: true,
    blinkIn: false,
    pose: (t) => {
      let eyeOpen = 1
      let cy = 0
      let rot = 0
      /*
       * ── L'ouverture des yeux, en TROIS temps (2026-10-30) ────────────
       * « 苏醒的睁开眼的眼速度太快了，增加睁开眼的动画 ». Mesure du defaut : la
       * version precedente passait de 0,07 a 1,12 d'un coup a t = 0,5 s — une
       * image a 60 fps. Ca ne se lit pas comme « il ouvre les yeux », ca se lit
       * comme une coupure de montage.
       *
       * L'utilisateur a precise la forme qu'il voulait : « 在半睁的时候左右转一下，
       * 然后回到原来的视角，然后全睁……可以在那个转动的时候超出 ». Done :
       *   1. 0-0,55 s   : encore endormi, paupieres a 7 % ;
       *   2. 0,55-1,05 s: ouverture lente jusqu'a 55 % (le « 半睁 ») ;
       *   3. 1,05-1,95 s: le regard balaie gauche-droite a demi-ouvert, et
       *                   DEPASSE du cote qu'il regarde (l'oeil qui s'ouvre
       *                   encore continue de s'agrandir, d'ou l'effet « il
       *                   cligne puis ecarquille ») ;
       *   4. 1,95-2,2 s : retour au regard de repos, et ouverture complete avec
       *                   depassement a 1,12 puis retombee a 1,0.
       *
       * Le « 超出 » ne porte pas sur la largeur de l'oeil (ca ferait un oeil qui
       * grossit, pas un regard qui balaie) mais sur le JOINT : en plus de
       * l'ouverture, `eyeOpen` monte a 1,12 au passage, ce qui rend la paupiere
       * plus haute que la normale l'espace d'un dixieme de seconde. C'est le
       * geste qu'on fait en se reveillant.
       */
      let yaw = REST_GAZE.yaw
      let pitch = REST_GAZE.pitch
      let roll = REST_GAZE.roll
      let split = EYE_SPLIT
      if (t < 0.55) {
        // encore endormi : paupieres presque fermees
        eyeOpen = 0.07
        cy = 6 / 100
      } else if (t < 1.05) {
        // l'ouverture, lente : c'est la partie qui manquait
        const k = easings.easeOutCubic(clamp((t - 0.55) / 0.5))
        eyeOpen = 0.07 + (0.55 - 0.07) * k
        cy = 6 / 100 - (9 / 100) * k
      } else if (t < 2.55) {
        /*
         * ── Plus de balayage de tete (2026-10-31) ──────────────────────
         * « 把苏醒的摇头去掉吧，就正常的睁眼，然后烟花就好 ».
         *
         * Le balayage gauche-droite avait ete ajoute plus tot sur demande
         * explicite (« 半睁的时候左右转一下 »), puis ralenti, puis rallonge. Il
         * est maintenant retire : trois iterations pour un geste que
         * l'utilisateur ne veut plus. Le laisser « juste un peu » serait pire
         * que de le retirer — un mouvement de tete residuel se lit comme un
         * tremblement, pas comme une intention.
         *
         * Ce qui reste : l'ouverture des yeux en deux temps (0,55 -> 2,55 s,
         * jusqu'a la valeur pleine), le regard qui reste au repos, et la gerbe.
         * Les bornes gardent leur nom (`WAKE_SHAKE_*`) pour ne pas casser les
         * trois endroits qui les lisent — elles delimite simplement la duree de
         * l'OUVERTURE maintenant, pas celle d'un balayage.
         */
        const k = (t - WAKE_SHAKE_START) / (WAKE_SHAKE_END - WAKE_SHAKE_START)
        eyeOpen = 0.55 + 0.5 * clamp(k / 0.6)
        /*
         * ── `cy` repart de la valeur ou la phase precedente l'a laisse ──
         * La phase 0,55-1,05 s termine a `6/100 - 9/100 = -0,03`, et la suite
         * remettait `cy = 0` d'un coup : 3 px de saut sur une image, au debut de
         * l'ouverture complete. Ca ne se lit pas comme un mouvement, ca se lit
         * comme un tressautement — exactement la famille de defaut que
         * l'utilisateur a signalee en fin d'animation. La valeur remonte donc
         * vers 0 par la meme courbe, sur toute la duree de la phase : continue
         * aux deux bouts (-0,03 au debut, 0 a 2,55 s).
         */
        cy = -0.03 + 0.03 * easings.easeOutCubic(clamp(k))
      } else if (t < 2.85) {
        // ouverture complete, avec depassement
        eyeOpen = 1.05 + 0.07 * easings.easeOutCubic(clamp((t - WAKE_SHAKE_END) / 0.25))
      } else {
        // retombee : l'ouverture redescend a 1,0 sans rebond
        const et = clamp((t - 2.85) / 0.4)
        eyeOpen = 1.12 - 0.12 * easings.easeOutCubic(et)
      }
      /*
       * ── Le « decrochage » de fin d'animation (2026-10-31) ─────────────
       * « 他结束的时候，他的眼睛好像和标准位置有一点点差异，所以会一瞬间抖一下 ».
       * Mesure : trois discontinuites, sur un affichage a 60 fps cela fait un
       * saut d'une image — donc lisible comme un tic, pas comme un mouvement.
       *
       *   ① `split` sautait de x1,00 a x1,18 a 2,55 s. Le premier hump de
       *      « 超出 » (sin(k pi), k sur 1,05->2,55) finit exactement a x1,00,
       *      mais le phase suivante REINITIALISAIT le hump a x1,18 : l'ecart des
       *      yeux faisait 2,8 deg d'un coup, puis se refermait sur 0,25 s.
       *   ② `cy` sautait de 0 a +0,011 R a 2,85 s, en passant d'un `cy = 0` a un
       *      `sin(t * 0,9) * 0,02` demarre a la valeur du sinus au lieu de 0.
       *   ③ `rot` demarrait une oscillation a 3,75 Hz amplitude 0,1 rad (5,7 deg)
       *      qui ne ressemble plus a une retombee mais a un tremblement — et
       *      l'utilisateur a justement demande de supprimer tout ce qui bouge.
       *
       * Les trois sont traites ici, en UNE passe, parce que le defaut commun
       * est le meme : chaque phase recalculait sa propre valeur au lieu de
       * continuer une courbe unique. Le hump est donc maintenant une seule
       * fonction du temps sur TOUTE l'ouverture (0 a 2,85 s), egale a x1,00 a
       * chaque bout — donc continue partout et sans reinitalisation.
       */
      const ok = clamp((t - WAKE_SHAKE_START) / (2.85 - WAKE_SHAKE_START))
      split = EYE_SPLIT * (1 + Math.sin(ok * Math.PI) * 0.18)
      if (t >= 2.85) {
        // respiration qui part de 0 et revient a 0 : aucun saut possible
        cy = Math.sin(clamp((t - 2.85) / (3.2 - 2.85)) * Math.PI) * 0.02
      }
      /*
       * ── `EYE_W` PLEIN, et pas sa moitie (2026-10-31) ──────────────────
       * C'est la vraie cause du « 有一点点差异 » — les trois discontinuites
       * ci-dessus n'etaient que des accrocs pendant l'animation, celle-ci est
       * une difference PERMANENTE, donc elle se voit sur toute la duree et
       * surtout au raccord avec l'etat suivant.
       *
       * Mesure : `split` et `gaze` de `waking` valent exactement ceux du repos
       * (15,46 / 28,49 / 28,62 / -13) ; `sil` est un cercle de rayon 1 centre en
       * 0 ; `offX/offY/spin` sont a 0. Tout le visage est donc au standard…
       * sauf `w` : 0,093 contre 0,186, soit la moitie.
       *
       * L'origine est une erreur de recopie : `base()` passe des yeux
       * `pair(EYE_W, EYE_H)`, et cette pose ecrivait `EYE_W * 0.5` en croyant
       * que `EYE_W` etait une demi-largeur. Toutes les autres animations du
       * fichier ecrivent `pair(EYE_W * facteur, EYE_H * facteur)` — le facteur
       * y est local et vaut 1 au repos. Ici la moitie s'appliquait a la valeur
       * ABSOLUE, donc au repos aussi.
       *
       * Consequence visible : a la fin de `waking` les deux yeux sont deux fois
       * plus fins que partout ailleurs. Au passage vers `idle` (ou tout autre
       * etat), ils doublent de largeur d'une image a l'autre — c'est
       * exactement le « 一瞬间抖一下 » qu'il decrit.
       */
      return base({
        sil: circle(1, { cy, rot }),
        gaze: { yaw, pitch, roll },
        split,
        eyes: [
          { w: EYE_W, h: EYE_H * eyeOpen, open: 1 },
          { w: EYE_W, h: EYE_H * eyeOpen, open: 1 }
        ],
        /*
         * La gerbe du sursaut.
         *
         * ── Quand elle part (2026-10-31) ─────────────────────────────────
         * « 苏醒演化应该在摇头的时候出现 ». Elle partait a 0,55 s, c'est-a-dire
         * a l'ouverture des yeux — donc avant le balayage, sur un visage encore
         * endormi, ce qui se lisait comme deux evenements sans rapport.
         * `WAKE_BURST_AT` la place 0,3 s APRES le debut du balayage : la gerbe
         * est alors la consequence du geste, pas un feu d'artifice simultane.
         *
         * ── `from = 1` est ici ESSENTIEL (2026-10-30) ────────────────────
         * Ce corps est PLEIN (rayon 1). Les particules doivent donc naitre sur
         * la silhouette, comme dans la source qui les pose sur `Re`. Si on les
         * faisait partir d'un rayon plus petit (le cas des états à corps
         * réduit), elles jailliraient de l'interieur du corps noir et seraient
         * invisibles jusqu'a en sortir.
         *
         * C'est aussi ce qui rendait la gerbe « 不够大 » : partie de 1 R avec
         * une portee de 1,22 R, elle ne parcourait que 0,22 R — un liseré. La
         * portee est maintenant de 1,4 R (voir `BURST_REACH`).
         *
         * ── Pourquoi 20 particules et non 11 (2026-10-30) ────────────────
         * La source en tire 9 a 13 (aleatoire), et 11 est le milieu. Mais elle
         * les fait partir d'un corps de 114 px dans un cadre de 259 px, ou la
         * gerbe occupe presque tout : les 11 points suffisent a remplir. Ici
         * la gerbe est bien plus large par rapport aux points, donc 11
         * particules y apparaissent comme une pluie clairsemee — c'est ce que
         * la planche a montre. On prend 20 (le haut de la fourchette, et la
         * densite des plus grosses gerbes de la source) pour retrouver la
         * MEME densite apparente, pas le meme compte.
         */
        dots: firework(t, WAKE_BURST_AT, 20, 0.8, 5)
      })
    }
  },

  {
    /*
     * Le sommeil : le corps s'affaisse de 8 px, les yeux se ferment a 8 %,
     * la tete roule doucement, et le corps se gonfle au rythme d'une
     * respiration lente (0.55 rad/s).
     *
     * C'est le VRAI sommeil, celui que l'utilisateur voyait chez la source. Il
     * remplace l'ancien `sleep`, qui n'etait qu'un point qui saute (devenu
     * `bounce`).
     */
    id: 'sleeping',
    duration: 3,
    morph: 0.6,
    baseFace: false,
    /*
     * Meme correction que `waking` : « （苏醒）（睡眠）目前也是固定死圆形的，
     * 帮我修一下，跟随图形 ». Le sommeil est le corps au repos qui s'affaisse,
     * donc il doit avoir la forme de l'utilisateur — un cercle en dur faisait
     * reapparaitre la boule que `idle` venait justement d'eviter.
     *
     * `baseBody` ne remplace que `radii` : l'affaissement (`cy`, `cx`) et le
     * gonflement de l'expiration (`sy`) restent, donc le sommeil d'une arche se
     * lit exactement comme celui d'un cercle.
     */
    baseBody: true,
    blinkIn: false,
    pose: (t) => {
      const settle = clamp(t / 2)
      const breath = Math.sin(t * 0.55)
      const half = EYE_W * 0.5
      return base({
        sil: circle(1, {
          cy: (8 / 100) * settle + breath * 0.016,
          cx: -(2 / 100) * settle,
          // l'expiration gonfle le corps
          sy: 1 + breath * 0.016
        }),
        // paupieres a 8 % : deux fentes
        eyes: [
          { w: half, h: EYE_H * 0.08, open: 1 },
          { w: half, h: EYE_H * 0.08, open: 1 }
        ],
        gaze: { yaw: Math.sin(t * 0.25) * 2, pitch: 8, roll: -4 }
      })
    }
  },

  {
    /*
     * L'envoi : une impulsion part du corps en diagonale vers la droite et le
     * haut, avec un anneau de choc.
     *
     * C'est l'animation jumelle de `receiving` : meme code, sens inverse.
     * L'utilisateur a demande de garder les deux.
     *
     * ── Corps et anneau unifies, rythme ralenti (2026-10-30) ───────────
     * Le corps valait `BODY.bounce` (18 px) et l'anneau de choc s'arretait a
     * 0,48 R : les deux paraissaient petits a cote des autres animations du
     * meme groupe. Le corps prend `BODY.small` et l'anneau va jusqu'a la portee
     * du decor (voir `SHOCK_FAR`), et la periode passe de 1,5 s a 1,875 s.
     */
    id: 'sending',
    duration: 3,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const fade = clamp(t / 0.4) * clamp((3 - t) / 0.4)
      const r = BODY.small
      return base({
        ...smallBall(r),
        dots: sendDots(t, fade),
        rings: sendRings(t, fade)
      })
    }
  },

  {
    /*
     * La reception : l'inverse exact de `sending`. Un point arrive de
     * l'exterieur et se pose sur le corps, un anneau se referme.
     */
    id: 'receiving',
    duration: 3,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const fade = clamp(t / 0.4) * clamp((3 - t) / 0.4)
      const r = BODY.small
      return base({
        ...smallBall(r),
        dots: recvDots(t, fade),
        rings: recvRings(t, fade)
      })
    }
  },

  {
    /*
     * L'envoi vers le haut : deux points partent du coin bas-gauche, font le
     * tour de la bille, puis s'y font absorber.
     *
     * C'est le trajet depuis le COIN qui fait lire « ca monte », pas une
     * rotation de points autour du corps (voir `overlay.ts`).
     *
     * ── La ronde et l'absorption (2026-10-30) ──────────────────────────
     * « 从外面飘来的那个小球，是环绕着他转了好几圈，然后吸收进去，不是目前的渐变
     * 消失 ». La version precedente arrivait sur l'orbite puis s'y arretait et
     * s'effacait : une fin molle, qui ne raconte rien. Les particules tournent
     * maintenant plus de deux tours et plongent dans la bille a la fin — voir
     * `dockDots`, qui date sa plongee sur la duree de l'etat.
     */
    id: 'uploading',
    /*
     * ── 4 -> 3 s (2026-10-31) ─────────────────────────────────────────
     * « 上传目前是4s，能不能砍掉最开始只飞入一个球的部分，直接是两个球一起
     *   飞入旋转，然后卡在3s内 ». Les deux particules decollent maintenant au
     * meme instant (voir `dockDots`), ce qui libere la seconde et demie que le
     * decalage de 1,3 s occupait a ne montrer qu'un seul point.
     */
    duration: 3,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    pose: (t) => {
      const r = BODY.small
      // l'enveloppe ne sert qu'a l'entree : la sortie est jouee par la plongee
      const fadeIn = clamp(t / 0.4)
      return base({
        ...smallBall(r),
        // `3` = la duree de l'etat : `dockDots` y date sa plongee finale
        dots: dockDots(t, fadeIn, 3)
      })
    }
  },

  {
    id: 'burst',
    duration: 2.6,
    // le corps est recompose a 1.7 + 0.7
    minDuration: 2.4,
    morph: 0.4,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    /*
     * Le corps se recompose en boule pleine a 1,7 + 0,7 = 2,4 s. Comme pour
     * `orbit`, cette boule est le corps au repos : on y melange la forme choisie.
     *
     * Le tout DEBUT est aussi au repos (image 0 = boule pleine, avant
     * l'effondrement) : sans ca le bot apparait en rond une image sur deux a
     * chaque tour, ce qui suffit a faire clignoter la forme. Le poids retombe
     * donc a zero des le premier centieme, avant que l'effondrement ne se voie.
     */
    bodyRest: (t) =>
      Math.max(easings.easeOutQuint(clamp((t - 1.7) / 0.7)), 1 - clamp(t / 0.12)),
    pose: (t) => {
      // Collapse into the shared small ball, then regrow to the resting body.
      const collapse = 1 - (1 - BODY.small) * easings.easeOutQuint(clamp(t / 0.7))
      const regrow = easings.easeOutQuint(clamp((t - 1.7) / 0.7))
      return base({
        ...smallBall(collapse + (1 - collapse) * regrow),
        // Eyes reappear only as the full-size body returns, so retain its normal eye size.
        eyes: pair(EYE_W, EYE_H),
        split: EYE_SPLIT,
        eyeAlpha: clamp((t - 1.85) / 0.4),
        dots: particles(t, 1.45, BODY.small - 19 / REF_R, EXTERIOR_DOT_SCALE),
        dotsBehind: true
      })
    }
  },

  {
    id: 'comet',
    duration: 2.4,
    // le point se recompose a 1.85 + 0.6 = 2.45, soit 0.05 s apres la coupe de
    // la video : ce reliquat se termine pendant le fondu suivant, comme dans la
    // reference. On ne descend donc pas sous la duree mesuree.
    minDuration: 2.4,
    morph: 0.45,
    baseFace: false,
    baseBody: false,
    blinkIn: false,
    /*
     * Le point se recompose en boule pleine a 1,85 + 0,6 = 2,45 s. Comme pour
     * `burst`, c'est le corps au repos : on y melange la forme choisie, y compris
     * sur l'image 0 qui est une boule pleine avant la contraction.
     */
    bodyRest: (t) =>
      Math.max(easings.easeOutQuint(clamp((t - 1.85) / 0.6)), 1 - clamp(t / 0.12)),
    pose: (t) => {
      const collapse = 1 - (1 - COMET_DOT) * easings.easeOutQuint(clamp(t / 0.55))
      const regrow = easings.easeOutQuint(clamp((t - 1.85) / 0.6))
      const fade = clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3)
      return base({
        // Le point derive de 0.035 vers le bas puis remonte (wobble mesure).
        sil: circle(collapse + (1 - collapse) * regrow, {
          cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.035
        }),
        eyeAlpha: clamp((t - 2) / 0.35),
        arcs: COMET_RIBBONS.map((s, i) => ({ id: `cm${i}`, seed: s, t, opacity: fade }))
      })
    }
  }
]

export const STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]))

/** Ordre de lecture de la sequence complete, calque sur la video de reference. */
/**
 * Date, en temps local, ou chaque etat est le plus lisible : c'est la pose que
 * montrent les vignettes et la planche. Rendu deterministe, donc comparable
 * d'une execution a l'autre. Le type force a couvrir tout nouvel etat.
 */
export const POSES: Record<StateId, number> = {
  idle: 1,
  thinking: 1.1,
  wink: 0.8,
  wide: 0.8,
  alert: 0.75,
  notify: 0.9,
  exclaim: 0.8,
  bounce: 0.45,
  hexagon: 0.8,
  play: 0.9,
  orbit: 1.2,
  radar: 1.1,
  progress: 1.6,
  celebrate: 1.25,
  // 1,15 : l'anneau est entierement ouvert (42 % de 2,6 s = 1,09 s) et la
  // ceinture est a sa pleine portee, avant que le rentre ne commence (1,35 s).
  loading: 1.15,
  search: 1.2,
  // 1,45 : le milieu du balayage du regard, a demi-ouvert — c'est l'image qui
  // raconte le reveil
  waking: 1.45,
  sleeping: 2.4,
  sending: 1.0,
  receiving: 1.4,
  uploading: 1.6,
  burst: 0.45,
  comet: 1.15
}

export const SEQUENCE: StateId[] = [
  'idle',
  'thinking',
  'wink',
  'search',
  'wide',
  'alert',
  'notify',
  'exclaim',
  'bounce',
  'hexagon',
  'play',
  'orbit',
  'radar',
  'progress',
  'celebrate',
  'loading',
  'waking',
  'sleeping',
  'sending',
  'receiving',
  'uploading',
  'burst',
  'comet'
]

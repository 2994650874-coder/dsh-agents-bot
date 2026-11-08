import { clamp, createRng, loopNoise } from './math'

/**
 * Les yeux sont peints sur une sphere, pas poses a plat.
 *
 * Mesure sur la video : l'oeil le plus proche du bord fait 0.69 fois la largeur
 * de l'autre, et son aire 0.663 fois — exactement le facteur de profondeur
 * (z = 0.669) d'un point de sphere a cette distance du centre. On modelise donc
 * une vraie orientation de tete : chaque oeil recupere le repere tangent de la
 * sphere, projete en orthographique. La compression et l'inclinaison en
 * decoulent toutes seules, c'est ce qui donne le volume.
 *
 * Les constantes ci-dessous ne sont pas choisies a la main : elles sortent d'un
 * ajustement du modele sur les positions et tailles relevees image par image
 * (erreur residuelle ~1 px sur un rayon de 190 px).
 */

type Vec3 = [number, number, number]

/** Demi-ecart des yeux sur la sphere, en degres (separation totale ~31deg). */
export const EYE_SPLIT = 15.46
/** Taille de l'oeil au repos, en unites de rayon de boule. */
export const EYE_W = 0.186
export const EYE_H = 0.412

/** Orientation de tete au repos, ajustee sur les frames de reference. */
export const REST_GAZE: HeadGaze = { yaw: 28.49, pitch: 28.62, roll: -13 }

export interface EyePose {
  x: number
  y: number
  /** matrice tangente 2x2 : [a b c d] au sens SVG matrix(a,b,c,d,e,f) */
  a: number
  b: number
  c: number
  d: number
  /** composante z de la normale : > 0 = face visible */
  depth: number
}

export interface HeadGaze {
  /** lacet, degres, positif = regarde a droite */
  yaw: number
  /** tangage, degres, positif = regarde en haut */
  pitch: number
  /** roulis, degres, inclinaison de la tete */
  roll: number
}

const deg = (d: number) => (d * Math.PI) / 180

/** Fait tourner deux vecteurs d'un repere orthonorme dans leur plan commun. */
function spin(u: Vec3, v: Vec3, angle: number): [Vec3, Vec3] {
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  return [
    [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
    [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
  ]
}

/**
 * Repere de la tete puis des deux yeux.
 * Repere ecran : x a droite, y vers le bas, z vers le spectateur.
 * L'indice 0 est l'oeil interieur, l'indice 1 l'oeil exterieur.
 */
export function eyePoses(gaze: HeadGaze, scale: number, split = EYE_SPLIT): [EyePose, EyePose] {
  let f: Vec3 = [0, 0, 1]
  let right: Vec3 = [1, 0, 0]
  let down: Vec3 = [0, 1, 0]

  // lacet : forward bascule vers right
  ;[f, right] = spin(f, right, deg(gaze.yaw))
  // tangage : forward bascule vers le haut (donc a l'oppose de down)
  ;[down, f] = spin(down, f, deg(gaze.pitch))
  // roulis : la tete penche dans son propre plan
  ;[right, down] = spin(right, down, deg(gaze.roll))

  const build = (side: number): EyePose => {
    const [ef, er] = spin(f, right, deg(split * side))
    return {
      x: ef[0] * scale,
      y: ef[1] * scale,
      a: er[0],
      b: er[1],
      c: down[0],
      d: down[1],
      depth: ef[2]
    }
  }

  return [build(-1), build(1)]
}

/**
 * Vie au repos : derive lente du regard, saccades, clignements.
 *
 * Fonction pure du temps (aucun etat interne), donc pause, reprise et saut a
 * une date arbitraire donnent toujours la meme image. Les valeurs sont des
 * ECARTS a ajouter a la pose de l'etat courant.
 */
export interface Liveliness {
  dYaw: number
  dPitch: number
  dRoll: number
  /** 1 = oeil ouvert, 0 = ferme (ecrasement vertical en repere ecran) */
  lid: number
  driftX: number
  driftY: number
  breath: number
}

const BLINK_RNG = createRng(0x5eed)
/** Calendrier de clignements pre-tire : deterministe et sans etat. */
const BLINKS: number[] = (() => {
  const out: number[] = []
  let t = 1.4
  while (t < 900) {
    out.push(t)
    // 1.9 a 4.6 s entre deux clignements, plus un double clignement parfois
    t += 1.9 + BLINK_RNG() * 2.7
    if (BLINK_RNG() < 0.18) {
      out.push(t)
      t += 0.24
    }
  }
  return out
})()

/** Mesure : 1 a 2 frames a 10 fps. */
const BLINK_DUR = 0.18
// Dernier depart < 905 s ; 910 s laisse finir ce clignement avant le bouclage.
// Sans bouclage, les yeux restent ouverts apres les 15 premieres minutes.
const BLINK_PERIOD = 910

/**
 * L'instant ou les paupieres sont a demi fermees, pour dessiner une vignette
 * STATIQUE de clignement (le badge « sous-agents » de la grille).
 *
 * ── Pourquoi PAS le point de fermeture complete ──────────────────────────
 * A la taille du badge (~33 px) un ceil ferme mesure moins d'un demi-pixel de
 * haut : le visage n'est plus qu'un disque noir. Il faut donc une image ou les
 * deux yeux restent LISIBLES, c'est-a-dire un clignement PRIS EN COURS.
 *
 * 0,30 est la valeur de `blinkScale` qui laisse un trait net aux deux tailles
 * utiles : lisible a 33 px, encore manifestement « en train de cligner » a
 * 40 px. Ce n'est pas un choix esthetique libre : sous ~0,2 le trait disparait
 * a la taille du badge, au-dessus de ~0,45 on ne lit plus un clignement.
 *
 * Il se DERIVE du calendrier et non d'une valeur ecrite a la main : la table
 * `BLINKS` est tiree par un RNG et change si on touche a sa graine ou a ses
 * bornes. Un 1,48 code en dur continuerait alors de « marcher » en tombant
 * entre deux clignements, donc sur des yeux grands ouverts — le badge
 * afficherait un visage qui ne cligne pas, sans que rien ne signale l'erreur.
 *
 * Inversion de `blinkLid` sur sa branche de fermeture (k < 0,45) :
 *   lid = 1 - k / 0,45  =>  k = 0,45 * (1 - lid)
 */
const BLINK_STILL_LID = 0.45
export const BLINK_STILL_AT = BLINKS[0]! + 0.45 * (1 - BLINK_STILL_LID) * BLINK_DUR

/**
 * 睁眼的那一帧 —— 子代理图标用的就是这个。
 *
 * ── 为什么不用上面那个半闭帧 ──────────────────────────────────────
 * 半闭帧是给「眨眼指示器」设计的：那时候小框要表达「它在眨眼」。现在
 * 小框改成「子代理计数 + 固定图标」，图标要表达的是**这只 bot 是谁**，
 * 不是它此刻在眨眼。用户给的参考图也是睁眼圆脸。
 *
 * 取 `BLINKS[0] - 0.5`（第一次眨眼前 0.5 秒）：那一段一定在两次眨眼
 * 之间，lid 恒为 1（全睁）。同样**从日历反推**，不写死 0 —— 写死 0 在
 * 引擎改了预热/漂移后会落到某个眨眼窗口里，表现为图标偶尔变眯眼。
 */
export const EYES_OPEN_AT = Math.max(0, BLINKS[0]! - 0.5)

function blinkLid(t: number): number {
  // Le calendrier doit durer aussi longtemps que la session, sans etat mutable.
  // Les 910 premieres secondes restent exactement identiques aux captures existantes.
  const phase = t >= 0 ? t % BLINK_PERIOD : t
  for (let i = 0; i < BLINKS.length; i++) {
    const start = BLINKS[i]!
    if (phase < start) break
    const k = (phase - start) / BLINK_DUR
    if (k >= 0 && k <= 1) {
      // fermeture rapide, reouverture un peu plus lente
      return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55
    }
  }
  return 1
}

export interface LivelinessOptions {
  wander?: number
  blink?: boolean
  float?: boolean
}

export function liveliness(t: number, opt: LivelinessOptions = {}): Liveliness {
  const { wander = 1, blink = true, float = true } = opt

  // Periodes premieres entre elles : la derive ne se repete jamais a l'oeil.
  return {
    dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
    dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
    dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
    lid: blink ? blinkLid(t) : 1,
    // Au repos la video est quasiment immobile (centre stable a +-0.003, rayon
    // constant) : toute la vie passe par le regard et les clignements. On garde
    // juste de quoi ne pas figer completement l'image.
    driftX: float ? loopNoise(t, 7.9, 1.9) * 0.006 : 0,
    driftY: float ? loopNoise(t, 5.3, 0.3) * 0.007 : 0,
    // La largeur est constante, seule la hauteur respire tres legerement.
    breath: float ? 1 + Math.sin((t / 3.4) * Math.PI * 2) * 0.005 : 1
  }
}

/**
 * Le clignement est un ecrasement VERTICAL en repere ecran autour du centre de
 * l'oeil (mesure : la largeur de bbox est conservee, la hauteur tombe a ~0.35),
 * pas un retrecissement le long de l'axe incline de la gelule. On le compose
 * donc apres la matrice tangente, en n'affectant que les sorties en y.
 */
export function blinkScale(lid: number): number {
  return 0.06 + 0.94 * clamp(lid)
}

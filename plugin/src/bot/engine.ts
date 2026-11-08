import { arcRender, ribbonRender, type ArcRender, type DotRender, type RibbonRender, type RingRender } from './decor'
import { blendExpression, type BotExpression } from './expressions'
import { decalageDesYeux } from './eyefit'
import { blinkScale, eyePoses, liveliness } from './face'
import { TAU, clamp, easings, lerp, r2 } from './math'
import { mirrorPose } from './mirror'
import {
  blend,
  capsulePath,
  closedPath,
  radiusAtAngle,
  toPoints,
  type Point,
  type Silhouette
} from './shape'
import { STATES, STATE_BY_ID, type Pose, type StateDef, type StateId } from './states'

export interface RenderedEye {
  d: string
  matrix: string
  alpha: number
}

export interface BotFrame {
  bodyPath: string
  bodyAlpha: number
  eyes: RenderedEye[]
  dots: DotRender[]
  /** true = les points passent derriere le corps (particules de l'eclatement) */
  dotsBehind: boolean
  arcs: ArcRender[]
  /**
   * Bandes remplies (les « 肥厚的彩线 » de `loading` / `humming`).
   *
   * Quatrieme famille de decor, et pas un detournement des trois autres : un arc
   * est un TRAIT a epaisseur constante, un point est un disque, un anneau est un
   * cercle trace. Une bande dont l'epaisseur varie le long du trace n'est aucun
   * des trois — voir `RibbonSpec`.
   */
  ribbons: RibbonRender[]
  /**
   * Cercles traces (anneaux, jauges, ondes), deja convertis en unites de
   * viewBox et deja centres : le rendu n'a plus qu'a tracer.
   */
  rings: RenderedRing[]
  notif: { x: number; y: number; r: number } | null
  notch: { x: number; y: number; r: number } | null
}

/**
 * Un anneau pret a tracer. Meme partage des roles que `ArcRender` : l'etat
 * declare la geometrie en unites de rayon de boule, le moteur la convertit,
 * le composant la peint. Aucun des trois ne refait le calcul d'un autre.
 */
export interface RenderedRing {
  id: string
  /** rayon, en unites de viewBox */
  r: number
  /** epaisseur du trait, en unites de viewBox */
  width: number
  /** debut du trace, en fraction de tour depuis midi, sens horaire */
  from: number
  /** portion tracee, en fraction de tour */
  sweep: number
  opacity: number
  color?: string
  /** centre, en unites de viewBox */
  cx: number
  cy: number
}

/**
 * Ou le bot porte son regard quand quelque chose d'exterieur le pilote — le
 * pointeur de la souris, aujourd'hui.
 *
 * `yaw` et `pitch` sont des directions ABSOLUES, qui remplacent celles de la pose
 * a mesure que `mix` monte. Deux raisons, chacune un piege deja tombe :
 *
 * - c'est le MOTEUR qui doit faire ce melange, pas l'appelant, parce que lui seul
 *   connait la pose A CET INSTANT. Un appelant qui compenserait l'orientation de
 *   l'expression lirait sa valeur d'arrivee pendant que le morph est encore en
 *   cours, et les yeux sautaient a chaque changement d'humeur ;
 * - et il faut que ce soit absolu sur les DEUX axes. En relatif, la hauteur des
 *   yeux suivait celle de chaque expression — « neutre » regarde a +28,6deg quand
 *   les autres sont entre -9 et +9 — donc les yeux tombaient d'un coup au premier
 *   changement d'humeur. Ce qui fait le caractere d'une expression pendant le
 *   suivi, c'est la FORME de ses yeux (plisses, ronds, dissymetriques), pas
 *   l'endroit ou elle regarde : celui-la, c'est le curseur qui le decide.
 *
 * `mix` dit a quel point l'exterieur commande la DIRECTION (0 = pas du tout).
 *
 * `wander` dit, separement, ce qui reste de derive automatique. Les deux ne se
 * confondent pas : quand le pointeur bouge, la derive doit s'eteindre — cumulees,
 * le bot aurait l'air de chercher le curseur sans jamais le tenir. Mais quand il
 * n'y a PAS de pointeur (arrivee au clavier, au tactile, ou souris sortie de la
 * fenetre), la tete doit rester tournee ET continuer de vivre. Les confondre
 * figeait le regard des que la vue s'ouvrait.
 *
 * `spin` est un tour a parcourir EN CHEMIN, en degres, qu'on fait fondre vers 0
 * avec l'arrivee. Comme les yeux vivent sur une sphere, un tour les fait passer
 * derriere la boule et revenir de l'autre cote — et `-360deg` etant le meme
 * angle que `0`, il ne change rien a l'endroit ou ils se posent.
 */
export interface Look {
  yaw: number
  pitch: number
  mix: number
  spin: number
  wander: number
}

const NO_LOOK: Look = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 }

const lerpLook = (a: Look, b: Look, t: number): Look => ({
  yaw: lerp(a.yaw, b.yaw, t),
  pitch: lerp(a.pitch, b.pitch, t),
  mix: lerp(a.mix, b.mix, t),
  spin: lerp(a.spin, b.spin, t),
  wander: lerp(a.wander, b.wander, t)
})

const lerpEye = (a: Pose['eyes'][number], b: Pose['eyes'][number], t: number) => ({
  w: lerp(a.w, b.w, t),
  h: lerp(a.h, b.h, t),
  open: lerp(a.open, b.open, t),
  tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t)
})

/** Interpolation de deux poses. Le decor se croise en opacite, pas en geometrie. */
function blendAngle(a: number, b: number, t: number): number {
  let d = b - a
  while (d > Math.PI) d -= TAU
  while (d < -Math.PI) d += TAU
  return a + d * t
}

function blendPose(a: Pose, b: Pose, t: number): Pose {
  const out = 1 - t
  return {
    sil: blend(a.sil, b.sil, t),
    offX: lerp(a.offX, b.offX, t),
    offY: lerp(a.offY, b.offY, t),
    gaze: {
      yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
      pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
      roll: lerp(a.gaze.roll, b.gaze.roll, t)
    },
    split: lerp(a.split, b.split, t),
    /*
     * `spin` est un ANGLE, donc il se melange par le chemin le plus court.
     *
     * Sans ca, `celebrate` (qui accumule 9 tours, soit 54 rad) melange vers un
     * etat a 0 rad donnerait une interpolation lineaire de -54 rad : le visage
     * ferait neuf tours a l'envers en un dixieme de seconde pendant le fondu de
     * sortie. Avec le chemin le plus court, 54 rad et 0 rad sont la MEME image,
     * donc le melange part de l'angle equivalent le plus proche — invisible.
     * C'est exactement la regle deja appliquee a `sil.rot` dans `shape.ts`.
     */
    spin: blendAngle(a.spin, b.spin, t),
    eyes: [lerpEye(a.eyes[0], b.eyes[0], t), lerpEye(a.eyes[1], b.eyes[1], t)],
    eyeAlpha: lerp(a.eyeAlpha, b.eyeAlpha, t),
    bodyAlpha: lerp(a.bodyAlpha, b.bodyAlpha, t),
    dots: [
      ...a.dots.map((d) => ({ ...d, opacity: d.opacity * out })),
      ...b.dots.map((d) => ({ ...d, opacity: d.opacity * t }))
    ],
    arcs: [
      ...a.arcs.map((r) => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
      ...b.arcs.map((r) => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
    ],
    // Meme regle que les arcs : on croise en opacite, pas en geometrie. Une
    // bande interpolee entre deux animations n'existe dans aucune des deux.
    ribbons: [
      ...a.ribbons.map((r) => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
      ...b.ribbons.map((r) => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
    ],
    // Meme regle que les arcs : on croise en opacite, pas en geometrie. Un
    // rayon interpole entre deux animations n'existe dans aucune des deux.
    rings: [
      ...a.rings.map((r) => ({ ...r, id: `a${r.id}`, opacity: r.opacity * out })),
      ...b.rings.map((r) => ({ ...r, id: `b${r.id}`, opacity: r.opacity * t }))
    ],
    // la pastille appartient a un seul des deux etats, elle ne se melange pas
    notif: t < 0.5 ? a.notif : b.notif,
    dotsBehind: t < 0.5 ? a.dotsBehind : b.dotsBehind
  }
}

/**
 * Moteur sans horloge : `sample(t)` est une fonction pure du temps.
 *
 * Consequence pratique : pause, reprise, ralenti et saut a une date arbitraire
 * donnent exactement la meme image, et le rendu est testable sans DOM.
 */
export class BotEngine {
  /** rayon de la boule au repos, en unites de viewBox */
  readonly scale: number

  private cur: StateId
  private prev: StateId | null = null
  /**
   * Pose de depart FIGEE, posee seulement quand un changement d'etat arrive alors qu'un
   * fondu est deja en cours. Cf. `setState`.
   */
  private departFige: Pose | null = null
  private tCur = 0
  private tPrev = 0
  private blinkAt = -10
  private pts: Point[] = []
  private shape: number[] | null = null
  private shapePrev: number[] | null = null
  private shapeAt = -10
  /** Position des yeux figée lors du dernier changement d'apparence, par état. */
  private decalagePrev: Map<StateId, { x: number; y: number }> | null = null
  private decalageAt = -10
  private expr: BotExpression | null = null
  private exprPrev: BotExpression | null = null
  private exprAt = -10
  private look: Look = NO_LOOK
  private lookPrev: Look = NO_LOOK
  private lookAt = -10
  /** duree de rattrapage en cours ; voir `LOOK_MORPH`, sa valeur par defaut */
  private lookMorph = 0.24

  /** duree du morph quand on change la forme du corps */
  static readonly SHAPE_MORPH = 0.45

  /**
   * Duree de rattrapage du regard vers la cible. Plus court que `SHAPE_MORPH` :
   * un regard qui suit doit paraitre attentif, pas visqueux. Comme la cible est
   * reposee a chaque mouvement de souris, c'est cette duree qui donne au suivi
   * son inertie — le regard n'atteint jamais tout a fait un curseur qui bouge.
   */
  static readonly LOOK_MORPH = 0.24

  constructor(
    scale = 100,
    initial: StateId = 'idle',
    shape: number[] | null = null,
    expression: BotExpression | null = null
  ) {
    this.scale = scale
    this.cur = initial
    this.shape = shape
    this.expr = expression
  }

  /**
   * Expression de repos choisie dans le personnalisateur. Comme la forme, elle
   * glisse vers la nouvelle valeur au lieu de sauter.
   */
  setExpression(expression: BotExpression | null, now = 0) {
    if (expression === this.expr) return
    // Le fondu normal conserve ses deux axes eyefit independants. On ne fige
    // le decalage que si une cible a deja ete interrompue ou si l'expression
    // elle-meme est coupee avant sa fin.
    if ((this.decalagePrev && now - this.decalageAt < BotEngine.SHAPE_MORPH) ||
        (this.exprPrev && now - this.exprAt < BotEngine.SHAPE_MORPH)) {
      this.freezeDecalage(now)
    } else {
      this.decalagePrev = null
    }
    this.exprPrev = this.exprAtTime(now)
    this.expr = expression
    this.exprAt = now
  }

  /** Expression effective a l'instant `now`, morph en cours compris. */
  private exprAtTime(now: number): BotExpression | null {
    const to = this.expr
    const from = this.exprPrev
    if (!to || !from) return to
    const k = (now - this.exprAt) / BotEngine.SHAPE_MORPH
    if (k >= 1) return to
    return blendExpression(from, to, easings.easeOutQuint(clamp(k)))
  }

  /**
   * Forme choisie dans le personnalisateur. Elle ne remplace le corps que sur
   * les etats au repos (`baseBody`) : sur les autres, la silhouette EST
   * l'animation et ne doit pas etre ecrasee.
   *
   * Le changement se fait en morph, pas d'un coup : comme toutes les formes sont
   * echantillonnees aux memes angles, il suffit d'interpoler les rayons.
   */
  setShape(radii: number[] | null, now = 0) {
    if (radii === this.shape) return
    if ((this.decalagePrev && now - this.decalageAt < BotEngine.SHAPE_MORPH) ||
        (this.shapePrev && now - this.shapeAt < BotEngine.SHAPE_MORPH)) {
      this.freezeDecalage(now)
    } else {
      this.decalagePrev = null
    }
    this.shapePrev = this.shapeAtTime(now)
    this.shape = radii
    this.shapeAt = now
  }

  /**
   * Forme effective a l'instant `now`, morph en cours compris.
   *
   * Ne remet PAS `shapePrev` a null en fin de morph : `sample` doit rester une
   * fonction pure du temps, donc relire une date passee doit redonner l'image
   * intermediaire. On garde juste une reference de plus.
   */
  private shapeAtTime(now: number): number[] | null {
    const to = this.shape
    const from = this.shapePrev
    if (!to || !from) return to
    const k = (now - this.shapeAt) / BotEngine.SHAPE_MORPH
    if (k >= 1) return to
    const t = easings.easeOutQuint(clamp(k))
    // alloue seulement pendant le morph ; hors morph on rend le tableau tel quel
    return to.map((r, i) => lerp(from[i] ?? r, r, t))
  }

  /**
   * Nouvelle cible de regard, `null` pour revenir a celui de l'etat.
   *
   * Elle repart de la valeur COURANTE, et non de la cible precedente comme
   * `setShape` : cette methode est appelee a chaque mouvement de pointeur, et
   * repartir de l'ancienne cible ferait reculer le regard d'un cran avant
   * chaque rattrapage — le suivi tremblerait au lieu de glisser.
   *
   * Meme contrat que `setShape` par ailleurs : l'etat externe entre par un
   * setter horodate, jamais par une variable lue pendant `sample`, sinon le
   * moteur cesse d'etre une fonction pure du temps.
   */
  setLook(look: Look | null, now: number, morph = BotEngine.LOOK_MORPH) {
    /*
     * Une cible non finie est refusee. Le moteur GARDE la derniere : un `NaN`
     * pose une seule fois se propagerait a chaque image et le bot ne se
     * reposerait plus jamais. C'est arrive pour de vrai — un
     * `getBoundingClientRect` sur une boite de taille nulle donne `0 / 0` chez
     * l'appelant. Celui-la est corrige, mais le moteur n'a pas a dependre de la
     * prudence de ses appelants pour rester rejouable.
     */
    if (look && !Number.isFinite(look.yaw + look.pitch + look.mix + look.spin + look.wander)) {
      return
    }
    this.lookPrev = this.lookAtTime(now)
    this.look = look ?? NO_LOOK
    this.lookAt = now
    this.lookMorph = morph
  }

  /** Regard effectif a l'instant `now`, rattrapage en cours compris. */
  private lookAtTime(now: number): Look {
    const k = (now - this.lookAt) / this.lookMorph
    if (k >= 1) return this.look
    return lerpLook(this.lookPrev, this.look, easings.easeOutQuint(clamp(k)))
  }

  private posed(
    def: StateDef,
    t: number,
    shape: number[] | null,
    expr: BotExpression | null
  ): Pose {
    let pose = def.pose(t)
    if (def.baseBody && shape) {
      // on garde la pose (rotation, decalage, squash) et on n'echange que le profil
      pose = { ...pose, sil: { ...pose.sil, radii: shape } }
    } else if (def.bodyRest && shape) {
      /*
       * Etat qui retrouve le corps au repos en fin d'animation, sans etre
       * `baseBody` : on ne remplace pas le profil, on y MELANGE la forme choisie
       * au prorata `w`. C'est ce qui evite que le bot repasse par une boule a
       * chaque tour quand l'utilisateur a choisi autre chose.
       *
       * La rotation et le decentrage suivent la MEME pente. Sur une boule ils
       * sont invisibles, donc la video de reference peut les laisser courir ; sur
       * une arche ils se voient tout de suite (la forme tourne sur elle-meme en
       * fin de course). Le corps au repos est immobile par definition.
       */
      const w = clamp(def.bodyRest(t))
      if (w > 0) {
        const plat = pose.sil.radii.map((r, i) => r + (shape[i]! - r) * w)
        pose = {
          ...pose,
          sil: {
            ...pose.sil,
            radii: plat,
            rot: pose.sil.rot * (1 - w),
            cx: pose.sil.cx * (1 - w),
            cy: pose.sil.cy * (1 - w)
          }
        }
      }
    }
    if (def.baseFace && expr) {
      pose = { ...pose, gaze: expr.gaze, split: expr.split, eyes: expr.eyes }
    }
    return def.mirrorX ? mirrorPose(pose) : pose
  }

  /**
   * Geler la correction réellement affichée avant de changer une cible. Le rayon
   * interpolé n'a pas d'identité dans la table eyefit : seule sa correction
   * déjà interpolée peut servir d'origine à un morph interrompu.
   */
  private freezeDecalage(now: number) {
    this.decalagePrev = new Map(STATES.map(({ id }) => [id, this.decalageAtTime(now, id)]))
    this.decalageAt = now
  }

  /** Le chemin normal conserve les axes forme/expression independants. */
  private decalageAtTime(now: number, state: StateId): { x: number; y: number } {
    const surAxe = (
      debut: number,
      duree: number,
      a: { x: number; y: number },
      b: { x: number; y: number }
    ) => {
      if (a === b) return b
      const k = (now - debut) / duree
      if (k >= 1) return b
      const t = easings.easeOutQuint(clamp(k))
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
    }

    // The eyefit table measures the authored pose. Reflect its horizontal
    // correction too; freezeDecalage stores this final displayed coordinate.
    const eyeOffset = (radii: number[] | null, expression: string | null) => {
      const offset = decalageDesYeux(radii, state, expression)
      return STATE_BY_ID.get(state)?.mirrorX ? { x: -offset.x, y: offset.y } : offset
    }

    // Les rayons synthetiques d'un morph interrompu n'ont pas de clef eyefit.
    // Seul ce cas reprend la correction deja interpolee et figee.
    if (this.decalagePrev) {
      const from = this.decalagePrev.get(state)!
      const to = eyeOffset(this.shape, this.expr?.id ?? null)
      return surAxe(this.decalageAt, BotEngine.SHAPE_MORPH, from, to)
    }

    const parForme = (radii: number[] | null) =>
      surAxe(
        this.exprAt,
        BotEngine.SHAPE_MORPH,
        eyeOffset(radii, this.exprPrev?.id ?? null),
        eyeOffset(radii, this.expr?.id ?? null)
      )
    return surAxe(
      this.shapeAt,
      BotEngine.SHAPE_MORPH,
      parForme(this.shapePrev),
      parForme(this.shape)
    )
  }

  get state(): StateId {
    return this.cur
  }

  /**
   * Repart sur `id` SANS etat precedent, comme un moteur neuf pose sur cet etat.
   *
   * C'est ce que veut dire « rembobiner » pour ce moteur. `setState` seul ne peut pas le
   * faire : il garde l'etat quitte pour le fondre, ce qui est exactement son role en
   * lecture, et exactement ce qu'il ne faut pas quand on revient au debut d'une sequence.
   * Rejouer l'image 0 apres une passe complete melangeait le premier etat avec le DERNIER,
   * et l'export GIF s'ouvrait sur une boule sans yeux — la comete a un `eyeAlpha` nul.
   *
   * `sample` reste une fonction pure du temps : comme `setState`, ceci est un setter DATE,
   * appele par le pilote de la sequence, jamais pendant un echantillonnage.
   */
  reset(id: StateId, now: number) {
    this.cur = id
    this.prev = null
    this.departFige = null
    this.tCur = now
    this.tPrev = now
    this.blinkAt = -10
  }

  /**
   * Origine du fondu en cours : la pose figee s'il y en a une, sinon l'etat quitte evalue
   * a son propre temps ecoule — donc encore en train de s'animer, ce qui est voulu.
   */
  private origine(
    now: number,
    shape: number[] | null,
    expr: BotExpression | null
  ): Pose | null {
    if (this.departFige) return this.departFige
    if (!this.prev) return null
    const prevDef = STATE_BY_ID.get(this.prev)!
    return this.posed(prevDef, Math.max(0, now - this.tPrev), shape, expr)
  }

  /**
   * Pose composite a l'instant `now`, fondu en cours compris : exactement ce que `sample`
   * melange, avant la couche de vie au repos et de regard. Extraite pour que `setState`
   * puisse la figer.
   */
  private poseComposee(now: number): Pose {
    const def = STATE_BY_ID.get(this.cur)!
    const shape = this.shapeAtTime(now)
    const expr = this.exprAtTime(now)
    const pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr)
    const since = now - this.tCur
    if (since >= def.morph) return pose
    const origine = this.origine(now, shape, expr)
    if (!origine) return pose
    return blendPose(origine, pose, easings.easeOutQuint(clamp(since / def.morph)))
  }

  /**
   * Changement d'etat, date.
   *
   * Le moteur ne garde qu'UNE case d'historique, donc un changement qui arrive pendant un
   * fondu remplacait l'origine du melange par la pose PLEINE de l'etat qu'on quittait, au
   * lieu de l'image partiellement melangee qui etait a l'ecran. Mesure sur
   * `idle -> wide -> idle` a 100 ms : 35,9 px de saut contre 8,0 px de mouvement normal.
   *
   * On fige donc la pose composite courante et on melange depuis elle. Continu par
   * construction, quel que soit le nombre de changements enchaines.
   *
   * Et SEULEMENT dans ce cas. Figer a chaque changement arreterait net l'animation de
   * l'etat qu'on quitte pendant tout le fondu — le « ! » d'`alert` se figerait en pleine
   * course — alors qu'il n'y a rien a corriger hors morph : l'etat quitte y est deja
   * exactement l'image affichee. La lecture d'un montage, dont les blocs durent au moins
   * le plus long fondu (`MIN_BLOCK`), ne fige donc jamais rien et rend au bit ce qu'elle
   * rendait.
   */
  setState(id: StateId, now: number) {
    if (id === this.cur) return
    const morph = STATE_BY_ID.get(this.cur)!.morph
    const enPleinFondu = this.prev !== null && now - this.tCur < morph
    // A mirrored idle face may be following the pointer, whose absolute gaze
    // is applied AFTER pose composition. Preserve that displayed departure for
    // the first frame of the next authored state instead of snapping to the
    // mirrored default face when look is disabled on wink.
    const oldDef = STATE_BY_ID.get(this.cur)!
    const leavingLook = oldDef.mirrorX && oldDef.baseFace ? this.lookAtTime(now) : null
    const pointerDeparture = leavingLook !== null && leavingLook.mix > 0
    const departure = enPleinFondu || pointerDeparture ? this.poseComposee(now) : null
    this.departFige = departure && pointerDeparture && leavingLook ? {
      ...departure,
      gaze: { ...departure.gaze,
        yaw: lerp(departure.gaze.yaw, leavingLook.yaw, leavingLook.mix) - leavingLook.spin,
        pitch: lerp(departure.gaze.pitch, leavingLook.pitch, leavingLook.mix)
      }
    } : departure
    this.prev = this.cur
    this.tPrev = this.tCur
    this.cur = id
    this.tCur = now
    // Dans la video, chaque changement de forme est masque par un clignement.
    if (STATE_BY_ID.get(id)?.blinkIn) this.blinkAt = now
  }

  sample(now: number): BotFrame {
    const R = this.scale
    const def = STATE_BY_ID.get(this.cur)!
    const shape = this.shapeAtTime(now)
    const expr = this.exprAtTime(now)
    let pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr)
    let decalage = this.decalageAtTime(now, this.cur)

    // --- transition -------------------------------------------------------
    const since = now - this.tCur
    // L'etat precedent n'est jamais purge : `since < def.morph` suffit a
    // l'ignorer une fois le fondu passe, et l'oublier rendrait le moteur non
    // rejouable — relire une date d'avant la fin du fondu ne le retrouverait
    // plus. C'est l'optimisation qui parait innocente et qui casse tout.
    const origine = since < def.morph ? this.origine(now, shape, expr) : null
    if (origine) {
      // Ease-out exponentiel : c'est la courbe mesuree sur la video. Le corps
      // n'a pas d'overshoot (seuls la pastille et l'ouverture des yeux en ont).
      // Le ratio est borne : relire une date ANTERIEURE au changement d'etat
      // donnerait un ratio negatif, que l'ease-out extrapole — la silhouette
      // part alors trente fois trop loin.
      const ratio = easings.easeOutQuint(clamp(since / def.morph))
      pose = blendPose(origine, pose, ratio)
      // Le decalage des yeux suit la MEME courbe que la silhouette qui le motive. Il vient
      // de l'etat quitte, que `setState` renseigne toujours en meme temps que l'origine —
      // le test est la pour le typage, pas pour un cas reel.
      const quitte = this.prev
      if (quitte) {
        const avant = this.decalageAtTime(now, quitte)
        decalage = {
          x: lerp(avant.x, decalage.x, ratio),
          y: lerp(avant.y, decalage.y, ratio)
        }
      }
    }

    // --- vie au repos -----------------------------------------------------
    const alive = pose.eyeAlpha > 0.01
    // Le pointeur ne pilote que les etats baseFace. Sa cible reste en cache
    // quand Bot.aim cesse de tourner : les animations gardent leur propre regard.
    const look = def.baseFace ? this.lookAtTime(now) : NO_LOOK
    // Rejoining mirrored idle from an authored face must not apply a cached
    // pointer target at full strength on the first morph frame.
    const pointerBlend = origine && def.mirrorX && def.baseFace
      ? easings.easeOutQuint(clamp(since / def.morph)) : 1
    const lookMix = look.mix * pointerBlend
    const life = liveliness(now, { wander: alive ? look.wander : 0, blink: alive })
    const horizontal = def.mirrorX ? -1 : 1

    const gaze = {
      // Les deux visees REMPLACENT celles de la pose au lieu de s'y ajouter (voir
      // `Look`), et le tour se retranche en chemin. La derive s'ajoute APRES le
      // melange, sinon la cible l'annulerait en meme temps que la pose — or elle
      // doit survivre a une tete tournee sans pointeur.
      yaw: lerp(pose.gaze.yaw, look.yaw, lookMix) + life.dYaw * horizontal - look.spin * pointerBlend,
      pitch: lerp(pose.gaze.pitch, look.pitch, lookMix) + life.dPitch,
      // le roulis, lui, ne suit rien : la tete du bot est penchee de -13deg dans
      // la video, et la faire rouler avec le curseur casse cette signature
      roll: pose.gaze.roll + life.dRoll * horizontal
    }

    // clignement declenche par le changement d'etat, en plus du calendrier
    const forced = clamp((now - this.blinkAt) / 0.2)
    const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1
    const lid = Math.min(life.lid, forcedLid)

    const offX = pose.offX + life.driftX * horizontal
    const offY = pose.offY + life.driftY

    // --- corps ------------------------------------------------------------
    const sil: Silhouette = {
      ...pose.sil,
      cx: pose.sil.cx + offX,
      cy: pose.sil.cy + offY,
      sy: pose.sil.sy * life.breath
    }
    const bodyPath = closedPath(toPoints(sil, R, this.pts))

    // --- yeux -------------------------------------------------------------
    // Les yeux vivent sur une sphere de rayon 1 ; des que la silhouette n'est
    // plus un cercle, on les ramene au prorata du rayon reel dans leur
    // direction, sinon ils debordent et le masque les coupe.
    const bodyRadius = (x: number, y: number) =>
      radiusAtAngle(pose.sil.radii, Math.atan2(y, x) - pose.sil.rot)

    const eyes: RenderedEye[] = []
    if (pose.eyeAlpha > 0.01) {
      const poses = eyePoses(gaze, R, pose.split)
      /*
       * Rotation dans le plan de l'ecran (`pose.spin`).
       *
       * Elle s'applique au RE FERENTIEL de l'oeil, pas a son dessin : on tourne
       * sa position sur la sphere ET ses deux axes. Consequence, un oeil tourne
       * autour du centre du corps au lieu de simplement s'incliner — c'est ce
       * qui fait voir un « tour » sur une bille parfaitement ronde, ou une
       * rotation de silhouette ne se verrait pas du tout.
       *
       * Zero pour presque tous les etats : `cos(0)=1, sin(0)=0` redonne les
       * valeurs d'origine au bit pres, donc rien ne bouge pour les autres.
       */
      const cs = Math.cos(pose.spin)
      const sn = Math.sin(pose.spin)
      const rotX = (x: number, y: number) => x * cs - y * sn
      const rotY = (x: number, y: number) => x * sn + y * cs
      for (let i = 0; i < 2; i++) {
        const e = poses[i]!
        if (e.depth <= 0.02) continue
        const cfg = pose.eyes[i]!
        const ex = rotX(e.x, e.y)
        const ey = rotY(e.x, e.y)
        const fit = bodyRadius(ex, ey)
        // Inclinaison propre de l'oeil : on compose le repere tangent avec une
        // rotation dans le plan de l'oeil (Basis x Rot). C'est ce qui permet des
        // inclinaisons en miroir entre les deux yeux.
        const phi = ((cfg.tilt ?? 0) * Math.PI) / 180
        const cp = Math.cos(phi)
        const sp = Math.sin(phi)
        const ax = rotX(e.a * cp + e.c * sp, e.b * cp + e.d * sp)
        const ay = rotY(e.a * cp + e.c * sp, e.b * cp + e.d * sp)
        const cx2 = rotX(-e.a * sp + e.c * cp, -e.b * sp + e.d * cp)
        const cy2 = rotY(-e.a * sp + e.c * cp, -e.b * sp + e.d * cp)
        // Le clignement s'applique APRES tout ca : c'est un ecrasement vertical
        // a l'ecran, pas le long de l'axe de la gelule.
        const k = blinkScale(Math.min(lid, cfg.open))
        eyes.push({
          d: capsulePath(cfg.w * R, cfg.h * R),
          matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(cx2)},${r2(cy2 * k)},${r2(ex * fit + (offX + decalage.x) * R)},${r2(ey * fit + (offY + decalage.y) * R)})`,
          alpha: pose.eyeAlpha * clamp(e.depth / 0.12)
        })
      }
    }

    // --- decor ------------------------------------------------------------
    const dots = pose.dots
      .filter((p) => p.opacity > 0.01 && p.r > 0.0005)
      .map((p) => ({ ...p, x: (p.x + offX) * R, y: (p.y + offY) * R, r: p.r * R }))

    // la pastille est posee sur le contour : elle suit donc la forme aussi
    const nFit = pose.notif ? bodyRadius(pose.notif.x, pose.notif.y) : 1
    const nx = pose.notif ? (pose.notif.x * nFit + offX) * R : 0
    const ny = pose.notif ? (pose.notif.y * nFit + offY) * R : 0
    const notif = pose.notif ? { x: nx, y: ny, r: pose.notif.r * R } : null
    const notch = pose.notif ? { x: nx, y: ny, r: pose.notif.notch * R } : null

    return {
      bodyPath,
      bodyAlpha: pose.bodyAlpha,
      eyes,
      dots,
      dotsBehind: pose.dotsBehind,
      // Les etats declarent des arcs en unites de rayon de boule ; le moteur
      // est le seul a connaitre l'echelle du viewBox, donc c'est lui qui trace.
      arcs: pose.arcs
        .filter((a) => a.opacity > 0.01)
        .map((a) => arcRender(a.seed, a.t, R, a.id, a.opacity)),
      // Les bandes : le moteur est le seul a connaitre l'echelle du viewBox, donc
      // c'est lui qui les rasterise en coordonnees de viewBox, comme les arcs.
      ribbons: pose.ribbons
        .filter((r) => r.opacity > 0.01 && r.pts.length >= 3)
        .map((r) => ribbonRender(r, R)),
      /*
       * Les anneaux sont des cercles TRACES centres sur le corps. Contrairement
       * aux arcs, ils n'ont pas de repere 3D : le rayon et l'epaisseur sont deja
       * dans l'unite de rayon de boule, donc seule la conversion d'echelle reste
       * a faire — et c'est le moteur qui la fait, comme pour les arcs.
       *
       * Le centre suit `offX`/`offY` : un anneau de radar doit rester centre sur
       * le corps meme quand l'etat le decale.
       */
      rings: pose.rings
        .filter((r) => r.opacity > 0.01 && r.sweep > 0.0005)
        .map((r) => ({
          ...r,
          r: r.r * R,
          width: r.width * R,
          // les bornes du centre sont ajoutees ici pour que le rendu n'ait
          // qu'a tracer : le composant ne connait pas `offX`/`offY`
          cx: offX * R,
          cy: offY * R
        })),
      notif,
      notch
    }
  }
}


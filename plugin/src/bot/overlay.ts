/**
 * Les animations « overlay » : le corps devient une petite bille au centre et
 * le decor occupe la scene.
 *
 * ── Pourquoi ce fichier existe ──────────────────────────────────────────
 * Les douze etats historiques de ce dossier viennent d'une video de reference :
 * le corps GARDE sa taille au repos et les anneaux tournent a sa surface. Les
 * animations de ce fichier viennent d'une autre source, et leur principe est
 * l'inverse — mesure sur les deux implementations, pas suppose :
 *
 *     etat de la reference   rayon du corps   rayon du decor le plus loin
 *     idle                        114.3                —
 *     orbit (nouveau)              19.0              74.1   (3,2x le corps)
 *     radar                        19.0             110.2   (5,8x)
 *     progress                     22.9              84.1   (3,7x)
 *     loading                      15.0                —
 *     searching                    20.1              80.3   (4,0x)
 *
 * Autrement dit le corps retrecit jusqu'a ~1/6 et le decor prend le large. Tout
 * l'effet « fluide » de ces animations vient de la : de la place autour d'une
 * petite bille, pas d'un dessin de trait plus joli. Reproduire les anneaux en
 * gardant le corps a 100 % donne un resultat qui ne ressemble a rien, et c'est
 * exactement ce qu'on avait.
 *
 * ── D'ou viennent les nombres ──────────────────────────────────────────
 * `refs/grok-icon-study/animation.html`, tableaux `RADIUS`, `SCALE`,
 * `CYCLE_ON`, `SEND_MS`, `RECV_MS`, et les fonctions `paintOrbit` /
 * `paintRadar` / `paintProgress` / `paintDock` / `paintSend` / `paintRecv`.
 * Les rayons y sont en pixels d'un repere ou le corps au repos vaut
 * `Re = 114.2705`. On les divise par cette valeur : tout ce fichier s'exprime
 * ensuite en unites de rayon de boule, comme le reste du moteur.
 */

import { TAU, clamp, easings, r2 } from './math'
import type { DotRender, RibbonPoint, RibbonSpec, RingRender } from './decor'

/**
 * Rayon du corps au repos dans le repere de la source, en pixels.
 * C'est le diviseur qui ramene toutes les mesures en unites de rayon de boule.
 */
export const REF_R = 114.2705

/**
 * Rayon du decor, par animation, en unites de rayon de boule.
 *
 * ── Piege : ce n'est PAS le tableau `RADIUS` de la source ─────────────
 * Une premiere lecture a pris `RADIUS = { orbit: 19, ... }` pour le rayon du
 * decor. C'est faux, et ca a produit des points a 8,6 px du centre, donc
 * CACHES DERRIERE le corps (rayon 16,6) : l'animation paraissait vide.
 *
 * `RADIUS` servait a `wre`, le facteur d'echelle du corps dans la source
 * (`19 / Re` = 0.166) ; le `BODY.small` partage est plus grand. Le decor est ecrit dans
 * chaque fonction de peinture, et il est BIEN plus grand :
 *
 *     paintOrbit    Mt = 52 px        -> 0.455 rayon de boule
 *     paintRadar    bodyR -> 104 px   -> 0.910
 *     paintProgress Mt = 62 px        -> 0.543
 *     paintDock     orbite 42 px      -> 0.368
 *
 * D'ou le rapport de 3 a 6 fois le corps qui fait tout l'effet. Ces valeurs
 * sont relevees dans le corps des fonctions, pas dans un tableau.
 */
export const DECOR_R = {
  /** `paintOrbit` : `Mt = 52 * y1e(ze)` — mais y1e est l'easing d'entree, pas
   *  le rayon. Le rayon atteint est 52 px. */
  orbit: 52 / REF_R,
  /** `paintRadar` : les anneaux vont jusqu'a 104 px (`bodyR + (104 - bodyR) * e`). */
  radar: 104 / REF_R,
  /** `paintProgress` : `Mt = 62` px. */
  progress: 62 / REF_R,
  /** `paintDock` : orbite d'arrivee `Mt = 42` px. */
  dock: 42 / REF_R,
  /** `paintSend` / `paintRecv` : trajet `108 * ease` px, point de depart 108. */
  send: 108 / REF_R,
  receive: 108 / REF_R,
  /** `paintDots` n'a pas de rayon : les points sont poses a `+-DOT_GAP` = 62 px. */
  dots: 62 / REF_R,
  /** `paintWave` : `Dt = 44` px entre les points. */
  wave: 44 / REF_R
} as const

/**
 * Le rayon d'un point de decor, en unites de rayon de boule.
 * `Lt = 12` px dans `paintOrbit`.
 */
export const DOT_R_ORBIT = 12 / REF_R

/**
 * Portee commune originelle de reference : le rayon exterieur du cercle
 * arc-en-ciel de `comet` (« 跑命令 »), mesure a **0.888** rayon de boule.
 * Les animations proportionnelles orbit/loading/send/receive utilisent cette base
 * puis s'etendent davantage, sous une limite de cadre distincte.
 *
 * ── Pourquoi c'est un choix, pas une mesure ────────────────────────────
 * Rien dans la source n'impose cette valeur : mesure a l'ecran, l'orbite de la
 * source atteint 71,3 px pour une comete a 97 px, donc l'orbite est PLUS PETITE
 * que la comete chez l'auteur aussi. Mais l'utilisateur a tranche autrement —
 * « 他们的缩放，匹配的动画外轮廓起码要和其他几个原本的动态的半径相符合，比如和
 * 跑命令的那个那个彩圈的外轮廓差不多 ». C'etait la cible precedente ;
 * la nouvelle proposition agrandit cinq decors par rapport a leur corps.
 *
 * ── D'ou venait l'ecart ───────────────────────────────────────────────
 * Les rayons ci-dessus sont des rayons de PEINTURE, pas des rayons a l'ecran :
 * la source applique ensuite `overlayViewZoom`, qui zoome la vue entiere de
 * `OVERLAY_ZOOM[kind]` (1.14 pour l'orbite, 1.45 pour `whirl`...). Une premiere
 * version a dessine les rayons de peinture tels quels, donc trop petit — de 12 %
 * pour l'orbite et de 45 % pour `loading`.
 *
 * Les constantes `_R` sont calculees a partir de cette base, puis les cinq
 * animations demandant une proportion corps/decor nouvelle appliquent leurs
 * multiplicateurs bornes : le BORD exterieur ne reste donc pas a `REACH`.
 */
export const REACH = 0.888

/** The visible orbit grows relative to the larger shared body, but remains inside the tile. */
const EXTERIOR_TRACK_SCALE = 1.45
const ORBIT_R = (REACH - DOT_R_ORBIT) * EXTERIOR_TRACK_SCALE
/**
 * Demi-epaisseur d'une particule de la ceinture, en rayons de boule.
 *
 * ── 3,2 -> 6,5 px, puis 6,5 -> 9 px sur `humming` (2026-10-30) ─────────
 * L'utilisateur a deux fois de suite demande des particules plus lisibles :
 * d'abord « 加载的那个流动的微粒 » (d'ou 6,5), puis « 低吟……把彩色的小球放大 ».
 * La ceinture est ce qui se voit VRAIMENT de ces deux animations — l'anneau, lui,
 * est presque invisible — donc c'est elle qui porte la lecture, et sa taille doit
 * suivre la taille de la bille qu'elle entoure.
 */
const BELT_DOT_R = 6.5 / REF_R
/** Facteur de grossissement des particules de `humming` (l'utilisateur les a trouvees petites). */
const BELT_HUM_GROW = 1.4
/** Jauge de `progress` : epaisseur mesuree 5 px. */
const PROGRESS_W = 5 / REF_R
const PROGRESS_R = REACH - PROGRESS_W / 2
/** Orbite d'arrivee de `uploading`, legerement en retrait pour ne pas deborder. */
const DOCK_R = REACH - 7 / REF_R
/**
 * Duree de la plongee finale d'`uploading`, en secondes.
 *
 * ── 0,45 -> 0,90 : la plongee etait deux fois trop rapide (2026-10-31) ──
 * « 能让最后小球被吸收的速度降低吗？降低到0.5，因为他旋转和后面的速度明显
 * 不一样 ». Diagnostic exact : pendant la ronde, la particule tourne a
 * `DOCK_SPIN` = 5,6 rad/s et son rayon reste constant ; des que la plongee
 * commence, le RAYON s'effondre sur 0,45 s alors que la VITESSE ANGULAIRE ne
 * change pas. Deux vitesses differentes sur le meme objet, donc la transition se
 * lit comme un changement de regime.
 *
 * 0,5 est un facteur de VITESSE, pas une duree : la plongee va donc deux fois
 * moins vite, soit 0,45 / 0,5 = 0,90 s. (Confondre les deux — mettre 0,5
 * directement comme duree — aurait ACCELERE le geste. C'est la troisieme fois
 * que ce piege se presente dans ce projet.)
 *
 * Ce qui n'a PAS change : le nombre de tours (il depend de `span` et de
 * `DOCK_SPIN`), le point d'arrivee, et l'absence de fondu de sortie.
 */
const DOCK_DIVE_S = 0.9
/**
 * Vitesse angulaire de la ronde d'`uploading`, en radians par seconde.
 *
 * ── Pourquoi plus vite que la source (2026-10-30) ─────────────────────
 * La source tourne a 1,1 rad/s, soit un tour en 5,7 s. A cette vitesse, la
 * particule n'a le temps que d'un TIERS de tour avant que l'animation ne se
 * coupe — ce qui ne se lit pas comme « 环绕着他转了好几圈 » mais comme « elle
 * arrive et s'arrete ». Le rythme doit donc suivre la duree disponible, pas la
 * source : l'etat dure 4 s, la particule est en vol 0,9 s, il reste ~2,5 s de
 * ronde, et 5,6 rad/s y place environ deux tours et demi.
 *
 * C'est un choix assume, au meme titre que `RADAR_SPEED` : ce qui compte pour
 * l'utilisateur est le nombre de tours qu'il VOIT, pas la vitesse d'origine.
 */
const DOCK_SPIN = 5.6
/** Rayon du point d'envoi / de reception. */
const SEND_DOT_R = 10 / REF_R
/**
 * Distance de vol de l'impulsion.
 *
 * ── Pourquoi plus loin que `REACH` ────────────────────────────────────
 * L'impulsion s'efface en arrivant (`opacity = 1 - k^2`). Le point le plus
 * LOINTAIN qu'on voie encore appartient donc a `k = 0,92` et non a `k = 1` :
 * viser `REACH` avec le trajet complet donnerait une portee visible de 0,82
 * seulement, et l'animation paraitrait encore trop petite. On divise donc par
 * ce 0,92 pour que ce soit la partie VISIBLE qui atteigne `REACH`.
 */
const SEND_TRACK_SCALE = 1.30 // capped: proportional 1.798 would cross the tile
const SEND_TRAVEL = (REACH / 0.92) * SEND_TRACK_SCALE
/** Idem pour l'arrivee : `1 - k` et un fondu d'entree qui retardent le point. */
const RECV_TRACK_SCALE = 1.15 // receiving starts farther away than sending
const RECV_TRAVEL = (REACH / 0.79) * RECV_TRACK_SCALE

/**
 * @deprecated NE PAS UTILISER pour un rayon. Voir `DECOR_R`.
 *
 * Le tableau `SCALE` de la source pilote `overlayViewZoom`, un zoom applique a
 * la VUE entiere ; il ne change pas les rapports entre le corps et le decor, qui
 * sont ce qui compte ici. Le garder dans un calcul de rayon est le bug qui a
 * produit des points caches derriere le corps.
 *
 * Conserve uniquement pour documenter la table d'origine.
 */
export const DECOR_ZOOM_SOURCE = {
  orbit: 1.14,
  radar: 1.14,
  progress: 1.32,
  dock: 1.3,
  send: 1.12,
  receive: 1.12,
  whirl: 1.45,
  dots: 1.5,
  wave: 1.42
} as const

/** Duree d'un envoi / d'une reception, en secondes (source : `SEND_MS`, `RECV_MS`). */
export const SEND_S = 1.5
export const RECV_S = 1.7

/**
 * Cycles « le decor s'efface puis revient ».
 * `progress` et `spawning` respirent : visibles `on` secondes, absents `off`.
 * Source : `CYCLE_ON` / `CYCLE_OFF`.
 */
export const CYCLE_ON_S = 2.5
export const CYCLE_OFF_S = 1.5

/** Shared small-ball body in resting-radius units. The search-derived size is
 * 28/REF_R × 1.22. Orbit, radar, progress, celebrate, loading, sending,
 * receiving and uploading use it; burst only reaches it while collapsed.
 * Colored particles, comet specks and bounce dots have separate radii.
 * Attached rings and absorbed dots must start/end at BODY.small. */
/** Shared body size of the search small ball; decorative dots are not this body. */
const SMALL_BALL_R = (28 / REF_R) * 1.22
export const BODY = {
  small: SMALL_BALL_R,
  /** Legacy aliases for effects whose origin is the surface of the body. */
  loading: SMALL_BALL_R,
  bounce: 18 / REF_R,
  send: SMALL_BALL_R,
  receive: SMALL_BALL_R,
  hum: 28 / REF_R
} as const

/** New 34.16px body versus the reference 19px body: decorate in body-relative size. */
export const EXTERIOR_DOT_SCALE = BODY.small / (19 / REF_R)

/* ---------------------------------------------------------------- helpers */

/** Easing cubique de sortie, celui de la source (`Rc`). */
const outCubic = easings.easeOutCubic

/**
 * Easing a depassement, celui de la source (`y1e`).
 * `1 + 2.70158 (n-1)^3 + 1.70158 (n-1)^2` — c'est un ease-out-back : la valeur
 * depasse 1 puis revient. Il sert a faire « poper » le decor a l'entree.
 */
export function easeOutBack(n: number): number {
  const m = n - 1
  return 1 + 2.70158 * m * m * m + 1.70158 * m * m
}

/* ------------------------------------------------------------------ orbit */

/**
 * Duree, en secondes, de la FUSION des cinq points dans le corps en fin d'`orbit`.
 *
 * ── Pourquoi l'animation ne s'efface plus (2026-10-30) ────────────────
 * L'utilisateur : « 环绕的结束能不能参考爆发，是融合起来、然后结束，而不是渐变消失 ».
 * Il avait raison sur la lecture : un fondu d'opacite dit « l'image s'efface »,
 * une convergence dit « le mouvement aboutit ». Pour une boucle qui tourne
 * autour d'un noyau, la seule fin qui ait un sens est que la matiere REJOIGNE
 * le noyau — c'est ce que fait deja `burst` (les particules y plongent), et
 * c'est donc un geste qui existe deja dans le vocabulaire de ce jeu d'icones.
 *
 * Les cinq points spiralent donc vers la bille et se fondent DANS sa silhouette,
 * non plus vers le bord de la scene. Le rayon final vise `BODY.small` et non 0 :
 * a 0 ils se croiseraient tous au centre et seraient masques par le corps d'un
 * coup ; a `BODY.small` ils viennent mourir sur la surface, et l'oeil voit la
 * matiere entrer.
 */
/**
 * Duree de la fusion des cinq points dans la bille, en secondes.
 *
 * ── 0,72 -> 0,90 (2026-10-31) ─────────────────────────────────────────
 * « 小球从旋转往里吸收进去的那一段，可以稍微慢一点吗，比如08 ». Le 0,8 est un
 * MULTIPLICATEUR de duree, pas une duree : 0,72 / 0,8 = 0,90 s.
 *
 * C'est la troisieme fois cette semaine que le meme malentendu menace : quand
 * l'utilisateur dit « 慢一点，比如 0,8 », il donne un facteur de VITESSE. Appliquer
 * 0,8 comme une duree aurait ACCELERE le geste (0,72 -> 0,80 s de trajet pour la
 * meme distance, donc plus vite). Le test verrouille la duree, pas le chiffre.
 */
const ORBIT_MERGE_S = 0.9

/**
 * Cinq points qui tournent autour de la bille, puis s'y fondent.
 *
 * ── Ce qui fait la difference avec notre ancien `orbit` ────────────────
 * L'ancien tracait six ellipses 3D de rayon quasi constant (a = 1.3..1.4) :
 * six traits rigides qui tournaient, d'ou « un tas de lignes qui tournent ».
 * Ici il n'y a AUCUN trait : cinq disques, dont le rayon et l'opacite varient
 * avec leur profondeur (`cos` de l'angle). Ceux qui passent devant grossissent
 * et s'opacifient, ceux qui passent derriere retrecissent et palissent. Cette
 * variation par point est ce qui se lit comme un volume qui respire.
 *
 * Le chemin reste une ellipse vue de biais : `y` est compresse a 0.56 afin que les points restent distincts de la bille agrandie.
 * Les cinq points sont a 72 deg d'ecart et tournent a 0.0017 rad/ms (~3.7 s
 * par tour).
 *
 * `span` est la duree de l'etat : c'est elle qui date la fusion finale. Un
 * anneau qui ne saurait pas quand il finit ne peut pas converger.
 */
export function orbitDots(t: number, opacity: number, span: number): DotRender[] {
  const out: DotRender[] = []
  if (opacity <= 0.01) return out
  const grow = easeOutBack(clamp(t / 0.45))
  /*
   * Fusion : `merge` va de 0 a 1 sur les `ORBIT_MERGE_S` dernieres secondes, et
   * la courbe est un carre — donc l'acceleration vient a la fin, comme une
   * chute. Un `easeOut` les ferait arriver vite puis flotter, ce qui se lit
   * comme un ralenti et non comme une aspiration.
   */
  const merge = span > ORBIT_MERGE_S ? clamp((t - (span - ORBIT_MERGE_S)) / ORBIT_MERGE_S) : 0
  const pull = merge * merge
  const spin = t * 1.7
  for (let i = 0; i < 5; i++) {
    const a = spin + (i * TAU) / 5
    // The tilted orbit projects to different screen radii. Meet the body at
    // the actual silhouette for each angle instead of swallowing vertical dots
    // early at BODY.small * ellipseFlattening.
    const flatten = 0.56
    const projection = Math.hypot(Math.sin(a), flatten * Math.cos(a))
    const contact = BODY.small / projection
    const radius = ORBIT_R * grow + (contact - ORBIT_R * grow) * pull
    const front = Math.cos(a)
    // 0.5..1 : moitie du rayon quand le point est derriere
    const depth = 0.5 + 0.5 * clamp(front)
    out.push({
      x: Math.sin(a) * radius,
      y: -Math.cos(a) * radius * flatten,
      // les points retrecissent aussi en rejoignant la bille, sinon ils la
      // depasseraient au moment ou ils sont censes s'y fondre
      r: DOT_R_ORBIT * EXTERIOR_DOT_SCALE * depth * grow * (1 - pull * 0.45),
      /*
       * L'opacite ne tombe qu'a la toute fin, sur les 18 derniers pour cent de
       * la fusion : avant, ce sont bien cinq points qui se rapprochent et qu'on
       * doit continuer a voir. Les faire palir des le debut donnerait le fondu
       * qu'on cherche justement a ne plus avoir.
       */
      opacity: clamp((front + 0.4) / 0.6, 0.18, 1) * opacity * clamp((1 - merge) / 0.18)
    })
  }
  return out
}

/* ------------------------------------------------------------------ radar */

/**
 * Vitesse des ondes de radar, en MULTIPLICATEUR du rythme d'origine.
 *
 * ── Pourquoi 0,8 puis 0,56 (2026-10-30, 2026-10-31) ───────────────────
 * L'utilisateur, deux fois : « 雷达波纹的速度太快了，放到 0.8 试一下 » puis,
 * apres l'avoir vu tourner, « 雷达再慢 0.7 ». Le second est un SECOND facteur
 * applique au premier (0,8 x 0,7 = 0,56), pas un remplacement : il a vu la
 * version a 0,8 et a demande de la ralentir encore.
 *
 * Le rythme d'origine vient de la source (`now / 1300`, un anneau tous les
 * 1,3 s). A 0,56 la periode passe a 2,32 s. C'est assume : les trois anneaux
 * sont dephases de 1/3 de tour, donc l'ecran n'est jamais vide meme quand un
 * anneau met plus de deux secondes a faire le tour.
 */
const RADAR_SPEED = 0.56

/**
 * Trois anneaux qui partent du corps et s'elargissent en palissant : l'echo
 * d'un radar. Chaque anneau est decale d'un tiers de periode (1,3 s / 0,8 = 1,63 s).
 *
 * L'epaisseur decroit avec l'expansion (`3.4 * (1 - e * 0.55)`), ce qui evite
 * l'effet « trois cercles figes » : un anneau qui s'eloigne doit s'affiner.
 */
export function radarRings(t: number, opacity: number, bodyR: number): RingRender[] {
  const out: RingRender[] = []
  if (opacity <= 0.01) return out
  const grow = outCubic(clamp(t / 0.45))
  /*
   * ── Pourquoi `RADAR_FAR` depasse `REACH` ────────────────────────────
   * Chaque anneau s'efface en s'eloignant (`opacity = (1 - e) * 0,9`), donc le
   * plus lointain qu'on voie encore n'est pas celui qui va le plus loin : a
   * `e = 0,48` il ne reste plus que 47 % d'opacite, et l'anneau au-dela n'est
   * plus qu'une trace. Regler `far = REACH` donnait une portee VISIBLE de 0,78
   * au lieu de 0,89. On pousse donc le trajet a `REACH / 0,88` pour que la
   * partie reellement visible atteigne `REACH`.
   */
  const far = REACH / 0.88
  for (let i = 0; i < 3; i++) {
    // `t` est le temps local de l'etat ; la source utilise l'horloge absolue,
    // mais un decalage constant ne change rien a l'image (les trois anneaux
    // sont deja repartis par `i / 3`). `RADAR_SPEED` ralentit les trois ensemble.
    const e = ((t * RADAR_SPEED) / 1.3 + i / 3) % 1
    const r = bodyR + (far - bodyR) * e
    out.push({
      id: `radar${i}`,
      r: r * grow,
      width: (3.4 / REF_R) * (1 - e * 0.55) * grow,
      from: 0,
      sweep: 1,
      opacity: opacity * (1 - e) * 0.9
    })
  }
  return out
}

/* --------------------------------------------------------------- progress */

/**
 * Une jauge : un cercle de fond tres pale plus un arc qui se remplit, sens
 * horaire depuis midi, puis s'efface.
 *
 * C'est le seul decor qui utilise `from`/`sweep` de `RingRender` a autre chose
 * que le tour complet : le remplissage EST l'animation.
 */
export function progressRings(t: number, opacity: number): RingRender[] {
  if (opacity <= 0.01) return []
  const grow = easeOutBack(clamp(t / 0.45))
  const r = PROGRESS_R * grow
  const width = PROGRESS_W * grow
  // le remplissage monte sur 85 % du cycle, puis tient
  const fill = clamp(t / (CYCLE_ON_S * 0.85))
  return [
    // le fond : present, mais presque transparent
    { id: 'progBg', r, width, from: 0, sweep: 1, opacity: opacity * 0.16 },
    // l'arc : de midi jusqu'a `fill` du tour
    { id: 'progArc', r, width, from: 0, sweep: Math.max(fill, 0.001), opacity }
  ]
}

/* ------------------------------------------------------------------ dock */

/**
 * `uploading` : deux points qui montent depuis le bas-gauche, font le tour de la
 * bille, puis s'y font absorber.
 *
 * ── Le detail qui fait l'animation ─────────────────────────────────────
 * Ils ne partent pas du corps : ils partent du COIN (`-120 px, +95 px` dans la
 * source, donc hors du cadre du corps) et volent jusqu'a l'orbite. C'est ce
 * trajet qui se lit comme « ca monte », et c'est pour ca que la version qui
 * fait juste tourner des points ne ressemble pas a un envoi.
 *
 * ── La fin : ORBITER puis ETRE ABSORBE (2026-10-30) ───────────────────
 * L'utilisateur : « 他动画里从外面飘来的那个小球，是环绕着他转了好几圈，然后吸收
 * 进去，不是目前的渐变消失 ». La version precedente arrivait sur l'orbite et s'y
 * arretait, puis disparaissait avec l'enveloppe `fade` — une fin molle, qui ne
 * dit rien.
 *
 * Le trajet est donc en TROIS temps, et non deux :
 *   1. le vol depuis le coin jusqu'a l'orbite (0,9 s, ease-out cubique) ;
 *   2. la ronde : une fois arrivee, la particule continue de tourner sur l'orbite
 *      pendant que son rayon se resserre — c'est la partie qu'on ne voyait pas ;
 *   3. l'absorption : sur le dernier tour elle plonge dans la bille et s'eteint.
 *
 * ── Pourquoi deux particules et pas une ───────────────────────────────
 * La source en lance deux, decalees de 1,3 s. On garde ce decalage : la seconde
 * demarre quand la premiere est deja en ronde, ce qui fait lire un FLUX et non
 * un evenement isole.
 *
 * `span` est la duree de l'etat : c'est elle qui date l'absorption. Sans elle,
 * la particule ne saurait pas quand elle doit rentrer.
 */
export function dockDots(t: number, opacity: number, span: number): DotRender[] {
  const out: DotRender[] = []
  if (opacity <= 0.01) return out
  const grow = outCubic(clamp(t / 0.45))
  /** Rayon de l'orbite ou l'on arrive, et rayon ou l'on finit (le bord de la bille). */
  const orbitR = DOCK_R
  /**
   * Instant, pour la particule `i`, ou elle commence a plonger. Il est cale sur
   * la FIN de l'etat : les deux plongent ensemble a la fin, sinon la deuxieme
   * serait encore en vol quand l'animation se coupe — exactement le defaut de
   * `search`, corrige pour la meme raison.
   */
  const diveAt = span - DOCK_DIVE_S
  const dive = clamp((t - diveAt) / DOCK_DIVE_S)
  // depart : un point a GAUCHE, un point a DROITE (voir plus bas)
  const sy = 95 / REF_R
  const baseR = 7 / REF_R
  for (let i = 0; i < 2; i++) {
    /*
     * ── Les deux partent ENSEMBLE, mais de part et d'autre (2026-10-31) ──
     * « 上传目前的两个小球都是从左下角滚入的，能不能做成一左一右飞入？ »
     *
     * Avant : `sx = (-120 + i * 30) / REF_R`, donc les DEUX partaient du coin
     * bas-gauche, a 30 px l'un de l'autre. L'ecart etait trop faible pour se
     * lire : a l'ecran on voyait un point, puis « le meme point » en double —
     * l'utilisateur l'a decrit comme « 都是从左下角滚入的 ».
     *
     * Maintenant le premier part a gauche et le second a droite, symetriquement
     * (`i === 0 ? -120 : +120`). `sy` reste commun : les deux montent, ce qui
     * garde la lecture « ca monte » que le trajet depuis le coin portait deja.
     *
     * L'angle de depart sur l'orbite reste decale d'un demi-tour (`i * PI`) :
     * deux points qui arrivent diametralement opposes ne se superposent jamais,
     * et la ronde se lit comme deux points en poursuite plutot qu'un seul.
     */
    /*
     * ── Point de depart : ±88 px (2026-10-31) ────────────────────────
     * Le passage des deux points du meme coin (bas-gauche) a deux coins
     * opposes (gauche / droite) fait monter le contour exterieur. A ±120 px
     * plus `sy = 95 px`, le point de depart est a `hypot(120, 95) = 153 px` =
     * 1,34 R, et avec son rayon on atteignait **1,39 R** des la premiere image.
     *
     * `smoke-overlay` mesure un RAPPORT (uploading / comet, fourchette
     * 0,9~1,3), pas une valeur absolue — c'est ce qui rend le chiffre
     * surprenant au premier abord : 1,214 R en absolu, mais 1,367 en rapport
     * parce que `comet` culmine a 0,888 R. Pour rentrer dans 1,3 il faut
     * descendre sous 1,155 R absolus.
     *
     * ±88 px : `hypot(88, 95) = 129 px` = 1,13 R, + rayon = **1,15 R**, juste
     * dans la fourchette. L'ecart entre les deux points (176 px) reste large —
     * c'est lui qui fait lire « un a gauche, un a droite », pas la distance au
     * centre.
     */
    const sx = (i === 0 ? -82 : 82) / REF_R
    /*
     * ── Les deux partent ensemble (2026-10-31, tour precedent) ────────
     * « 砍掉最开始只飞入一个球的部分，直接是两个球一起飞入旋转 ».
     *
     * Avant : `0,2 + i * 1,3`, donc le second decollait 1,3 s apres le premier
     * et l'animation passait sa premiere moitie avec un seul point en vol.
     */
    const u = clamp((t - 0.2) / 0.9)
    if (u <= 0) continue
    /*
     * ── Courbe d'approche : `outCubic` -> smoothstep (2026-10-31) ─────
     * « 上传目前的两个小球都是从左下角滚入的，能不能做成一左一右飞入？ »
     *
     * J'ai d'abord juste change les points de depart (-120 / +120). La mesure
     * disait que c'etait bon (x = ±0,99 R a t = 0,21 s) et pourtant la planche
     * montrait toujours un seul point au milieu. Raison :
     *
     *   `outCubic` parcourt 58 % du trajet des `u = 0,25`, et l'opacite
     *   n'atteint 1 qu'a `u = 0,25` (voir `opacity * clamp(u * 4)`). Donc au
     *   moment ou les points deviennent VISIBLES, ils ont deja fait plus de la
     *   moitie du chemin — le « un a gauche, un a droite » n'existe que pendant
     *   l'instant ou ils sont encore transparents.
     *
     * `smoothstep` ne parcourt que 16 % a `u = 0,25` : les deux points restent
     * franchement separes pendant toute la phase ou on les voit, puis foncent
     * se rejoindre a la fin. L'ease-out etait la bonne courbe pour « ca arrive
     * et se pose » ; ici on veut d'abord VOIR le point de depart.
     *
     * Cout assume : l'arrivee sur l'orbite est moins « amortie » qu'avant
     * (vitesse non nulle a l'arrivee). Compense par le fait que la particule
     * enchaine aussitot sur la ronde, qui est deja en mouvement — l'accrochage
     * reste continu.
     */
    const k = u * u * (3 - 2 * u)
    /*
     * ── La plongee ne TOURNE plus, elle GLISSE (2026-10-31) ────────────
     * « 末尾吸收小球的时候太急了，和转圈那个速度比起来比较快，可以少转一点，
     *   但是让吸收小球的动画变得平稳一点 ».
     *
     * ── Deux corrections ratees avant de trouver la vraie cause ────────
     *   ① smoothstep sur le rayon au lieu de `dive²`  → 274 -> 283 px/s
     *   ② + deplier l'ellipse en cercle                → toujours 274 px/s
     *
     * Le rayon refusait de descendre, et la mesure image par image explique
     * pourquoi : il ne DESCENDAIT pas, il OSCILLAIT — 0,45 -> 0,53 -> 0,19 R.
     * Un aller-retour. C'est ca que l'oeil lit comme « il se jette dessus ».
     *
     * Origine : `|r| = rr * sqrt(sin²a + f²cos²a)`. L'orbite est une ellipse
     * vue de biais (`f = 0,5`), donc tant que l'ANGLE avance, `|r|` fait du
     * yo-yo a chaque demi-tour — meme a `rr` constant. Pendant la ronde c'est
     * voulu (c'est la profondeur) ; pendant la plongee, ca se superpose a la
     * chute et le point repart en arriere avant de revenir.
     *
     * ── La correction ─────────────────────────────────────────────────
     * L'angle se FIGE a l'instant ou la plongee commence. Le point cesse de
     * tourner et glisse en ligne droite dans la bille. Alors `sin`/`cos` sont
     * constants et `|r|` devient strictement proportionnel a `rr` : monotone,
     * garanti par construction, pas par reglage.
     *
     * C'est aussi la lecture la plus juste : « il tourne puis il est aspire »
     * (deux gestes distincts) et non « il tourne de plus en plus fort en
     * tombant » (deux gestes melanges). « 可以少转一点 » est satisfait au
     * passage : la ronde s'arrete net au lieu de continuer pendant la chute.
     *
     * Verifie en prototype numerique avant de toucher au moteur
     * (`_work/proto-dive.mjs`) : 2 -> 0 retournements de sens, rayon monotone.
     */
    const aSweep = Math.min(t, span - DOCK_DIVE_S) * DOCK_SPIN
    const a = aSweep + i * Math.PI
    const diveSmooth = dive * dive * (3 - 2 * dive)
    const rr = orbitR + (BODY.small - orbitR) * diveSmooth
    const tx = Math.sin(a) * rr
    const ty = -Math.cos(a) * rr * 0.5 + Math.sin(t * 3 + i) * 0.02 * (1 - diveSmooth)
    out.push({
      x: sx + (tx - sx) * k,
      y: sy + (ty - sy) * k,
      // rayon mesure : (7 + 3 * k) px ; et il gonfle legerement en plongeant,
      // comme une goutte qui se forme avant d'etre aspiree
      r: (baseR + (3 / REF_R) * k) * grow * (1 + dive * 0.35),
      /*
       * ── Pas de fondu pendant la plongee (2026-10-31, 2e passe) ────────
       * « （上传）最后吸收小球的时候做了虚化？去掉虚化？ »
       *
       * Oui, il y en avait un : `clamp((1 - dive) / 0,25)`, soit la particule
       * qui devient transparente sur les 0,11 DERNIERES secondes de sa plongee,
       * c'est-a-dire exactement pendant qu'elle touche la bille. Ce que l'oeil
       * voit alors n'est pas « elle est avalee » mais « elle s'efface ».
       *
       * C'est d'autant plus incoherent que c'est le meme geste que la ceinture
       * de `humming`, ou l'on a justement supprime tout fondu de sortie pour le
       * remplacer par un raccourcissement geometrique. Ici la particule PLONGE
       * jusqu'au rayon de la bille (`rr` tombe a `BODY.small` a `dive = 1`) : la
       * silhouette la recouvre entierement au dernier instant, donc il n'y a
       * rien a masquer. Le fondu etait un reste du temps ou le rayon ne plongeait
       * pas encore.
       *
       * L'enveloppe d'entree reste : elle sert au debut du vol, pas a la fin.
       */
      opacity: opacity * clamp(u * 4)
    })
  }
  return out
}

/* ------------------------------------------------------------------ send */

/**
 * Ralentissement commun a `sending` / `receiving`, en multiplicateur de duree.
 *
 * ── Pourquoi 0,8 (2026-10-30) ─────────────────────────────────────────
 * « 发送、接收的小球、黑圆框都偏小，和别的统一一下，然后动画速度放慢到 0.8 ».
 * Une impulsion qui part en 1,5 s est trop rapide pour un aller simple : le
 * regard n'en voit que le milieu. Allonger la PERIODE (et non la distance) est
 * le seul reglage qui change la vitesse percue sans changer la portee, donc on
 * divise les deux durees par 0,8.
 */
const SEND_SLOW = 0.8
/** Periode effective d'un envoi / d'une reception, en secondes. */
const SEND_P = SEND_S / SEND_SLOW
const RECV_P = RECV_S / SEND_SLOW

/**
 * Rayon de l'anneau de choc, en rayons de boule.
 *
 * ── Pourquoi il ne fait plus 0,18-0,48 R (2026-10-30) ─────────────────
 * A 0,48 R l'anneau de choc est PLUS PETIT que le decor des autres animations
 * (0,89 R) et plus petit que le rayon ou va l'impulsion (0,89 R aussi) : il
 * apparaissait comme un petit cerne colle a la bille, ce que l'utilisateur a
 * decrit comme « 黑圆框……偏小 ». Un anneau de choc doit entourer le corps ET
 * accompagner le trajet de l'impulsion ; il s'ouvre donc jusqu'a la portee du
 * decor.
 */
const SHOCK_FAR = REACH * 0.94 * EXTERIOR_TRACK_SCALE

/**
 * `sending` : une impulsion part du corps en diagonale et sort du cadre, avec
 * un anneau de choc qui s'ouvre en meme temps.
 *
 * Le sens (0.74, -0.62) est mesure : l'impulsion monte vers la droite.
 *
 * ── Retour a la version d'origine (2026-10-31, deuxieme passe) ────────
 * La veille j'avais fait partir l'impulsion du BORD BAS et partir vers le bas,
 * pour qu'elle ne traverse plus le visage (« 会把眼睛挡住 »). L'utilisateur a
 * vu le resultat et a tranche : « 这两个修了之后，变得更奇怪了，改回来吧 ».
 *
 * Pourquoi ca a rate, en une phrase : la diagonale montante donne une DIRECTION
 * au geste (ca part vers le haut-droite, on « envoie »), alors qu'une sortie par
 * le bas se lit comme une chute. Et faire demarrer la matiere au bord de la
 * silhouette la fait apparaitre SUR le contour, collée — la version d'origine
 * la fait naitre au centre, donc sortir DE la matiere.
 *
 * Le point qui recouvre brievement le visage est donc assume : c'est ce que le
 * mouvement raconte, et le remplacer coutait plus que ca ne rapportait.
 */
export function sendDots(t: number, opacity: number): DotRender[] {
  const out: DotRender[] = []
  if (opacity <= 0.01) return out
  const grow = outCubic(clamp(t / 0.45))
  const phase = ((t / SEND_P) % 1 + 1) % 1
  const travel = clamp((phase - 0.18) / 0.55)
  // Start at the center as before, but clear the enlarged silhouette sooner.
  const k = travel * travel * (3 - 2 * travel)
  const dist = SEND_TRAVEL * k
  if (travel > 0 && travel < 1) {
    out.push({
      x: 0.74 * dist,
      y: -0.62 * dist,
      r: SEND_DOT_R * EXTERIOR_DOT_SCALE * (1 - k * 0.55) * grow,
      opacity: opacity * (1 - k * k) * grow
    })
    // la trainee, plus petite et plus pale, demarre en retard
    const trail = clamp((phase - 0.26) / 0.55)
    if (trail > 0 && trail < 1) {
      const kt = trail * trail * (0.4 + 0.6 * trail)
      out.push({
        x: 0.74 * SEND_TRAVEL * kt,
        y: -0.62 * SEND_TRAVEL * kt,
        r: (5 / REF_R) * EXTERIOR_DOT_SCALE * (1 - kt * 0.6) * grow,
        opacity: opacity * 0.3 * (1 - kt) * grow
      })
    }
  }
  return out
}

/** L'anneau de choc de `sending` : un seul cercle qui s'ouvre et s'efface. */
export function sendRings(t: number, opacity: number): RingRender[] {
  if (opacity <= 0.01) return []
  const phase = ((t / SEND_P) % 1 + 1) % 1
  const u = clamp((phase - 0.18) / 0.3)
  if (u <= 0 || u >= 1) return []
  return [
    {
      id: 'shock',
      /*
       * L'anneau part de la taille de la bille et s'ouvre jusqu'a `SHOCK_FAR`,
       * au lieu des 0,48 R d'origine. Il demarre a `BODY.send` et non a 0,18 :
       * un anneau de choc nait SUR le corps qui le produit, il ne le traverse
       * pas.
       */
      r: BODY.send + (SHOCK_FAR - BODY.send) * outCubic(u),
      width: (2.8 / REF_R) * EXTERIOR_DOT_SCALE * (1 - u),
      from: 0,
      sweep: 1,
      opacity: opacity * (1 - u) * 0.8
    }
  ]
}

/* --------------------------------------------------------------- receive */
/**
 * `receiving` : l'inverse de `sending`. Un point arrive de l'exterieur vers le
 * corps, avec un arc qui se referme sur lui.
 *
 * ── Pourquoi la direction change a chaque cycle ────────────────────────
 * Dans la source, l'angle d'arrivee est tire au hasard a chaque cycle
 * (`rand(-1.25pi, 0.25pi)`). Mais ce moteur est une FONCTION PURE du temps :
 * pas d'etat, pas de tirage. On derive donc l'angle du numero de cycle, ce qui
 * garde le cote « vient d'un peu n'importe ou » sans introduire d'etat.
 *
 * ── Retour a la version d'origine (2026-10-31, deuxieme passe) ────────
 * Meme raison que `sendDots` : l'arrivee fixe par le bas a ete essayee puis
 * rejetee (« 这两个修了之后，变得更奇怪了，改回来吧 »). La variete des angles
 * est ce qui fait lire un flux entrant ; un point qui monte toujours du meme
 * endroit se lit comme une animation figee qui se repete.
 */
export function recvDots(t: number, opacity: number): DotRender[] {
  const out: DotRender[] = []
  if (opacity <= 0.01) return out
  const grow = outCubic(clamp(t / 0.45))
  const cycle = Math.floor(t / RECV_P)
  // suite deterministe mais sans motif lisible : trois decalages irrationnels
  const dir = -Math.PI * 0.5 + Math.sin(cycle * 2.399) * Math.PI * 0.75
  const phase = ((t / RECV_P) % 1 + 1) % 1
  const arrive = clamp(phase / 0.6)
  if (arrive >= 1) return out
  // Preserve a readable external approach before the final merge into the core.
  const k = arrive * arrive * (3 - 2 * arrive)
  const dist = RECV_TRAVEL * (1 - k)
  // trajectoire legerement courbe, comme dans la source
  const bow = 0.18 * RECV_TRACK_SCALE * Math.sin(arrive * Math.PI) * (1 - k * 0.7)
  out.push({
    x: Math.cos(dir) * dist - Math.sin(dir) * bow,
    y: Math.sin(dir) * dist + Math.cos(dir) * bow,
    r: (3.5 / REF_R + (6.5 / REF_R) * k) * EXTERIOR_DOT_SCALE * grow,
    opacity: opacity * clamp(arrive * 3.5) * (0.3 + 0.7 * k) * grow
  })
  return out
}

/** L'anneau qui se referme sur le corps quand la reception aboutit. */
export function recvRings(t: number, opacity: number): RingRender[] {
  if (opacity <= 0.01) return []
  const phase = ((t / RECV_P) % 1 + 1) % 1
  const u = clamp((phase - 0.58) / 0.32)
  if (u <= 0 || u >= 1) return []
  return [
    {
      id: 'recv',
      // meme echelle que l'anneau de choc de `sending`, en sens inverse : il
      // arrive de la portee du decor et se referme sur la bille
      r: BODY.receive + (SHOCK_FAR - BODY.receive) * (1 - outCubic(u)),
      width: (2.8 / REF_R) * EXTERIOR_DOT_SCALE * (1 - u),
      from: 0,
      sweep: 1,
      opacity: opacity * (1 - u) * 0.8
    }
  ]
}


/* ------------------------------------------------------------------ ball */

/**
 * `bouncing` : la bille tombe d'une hauteur, touche le sol, puis rebondit.
 *
 * ── La trajectoire, telle que la source la calcule ─────────────────────
 * Deux phases, avec les constantes mesurees :
 *   · chute libre depuis 40 px, duree deduite `sqrt(2*40/T)` = 0.272 s, ou
 *     `T = 8*52/0.62^2` = 1082 px/s^2 est l'acceleration ;
 *   · puis des rebonds de 52 px de haut, un toutes les 0.62 s.
 *
 * L'amplitude des rebonds ne decroit PAS : la source garde 52 px a chaque tour.
 * C'est voulu — une bille qui rebondit sur un sol elastique, pas une balle qui
 * s'arrete.
 *
 * ── Repere ────────────────────────────────────────────────────────────
 * Le decalage rendu est en unites de rayon de boule, POSITIF vers le bas (le
 * repere du moteur), et mesure par rapport a la position de depart : 0 au
 * debut, puis +0.35 quand elle touche le sol, puis -0.10 au sommet du rebond.
 */
export function ballOffset(t: number): number {
  const BOUNCE_S = 0.62
  const BOUNCE_H = 52 / REF_R // hauteur d'un rebond, en rayons de boule
  const START_H = 40 / REF_R // hauteur de depart
  const ACC = (8 * BOUNCE_H) / (BOUNCE_S * BOUNCE_S) // acceleration deduite
  const FALL_S = Math.sqrt((2 * START_H) / ACC)

  // hauteur au-dessus du sol a l'instant t, en rayons de boule
  let height: number
  if (t < FALL_S) {
    height = START_H - 0.5 * ACC * t * t
  } else {
    const c = (((t - FALL_S) / BOUNCE_S) % 1 + 1) % 1
    height = 4 * BOUNCE_H * c * (1 - c)
  }
  // le decalage se mesure depuis la hauteur de depart (celle de l'image 0)
  return START_H - height
}

/* --------------------------------------------------------------- helpers */

/**
 * Part de la duree pendant laquelle la ceinture rentre dans la bille.
 *
 * ── Pourquoi c'est une FRACTION et pas des secondes ────────────────────
 * Une premiere version posait des constantes absolues ; l'etat a change de duree
 * (1,2 / 3,1 / 2,6 s selon les essais) et l'absorption a chaque fois mange tout
 * ou presque. En fraction, le rythme survit a un changement de duree.
 *
 * ── 0,28 : l'absorption FINIT exactement a la fin (2026-10-31) ─────────
 * La valeur etait auparavant relative au retrait de l'anneau : `absorbEnd`
 * valait `span * (1 - WHIRL_OUT_FRAC)`, parce que l'anneau devait se refermer
 * APRES que la ceinture soit rentree (« 彩色小球先吸回去，然后黑框收回 »).
 *
 * L'anneau n'existe plus (voir `STATE.loading`), donc ce couplage n'a plus de
 * raison d'etre et il laissait 20 % de la duree VIDE a la fin : les billes
 * avaient disparu a 2,08 s et l'etat durait jusqu'a 2,6 s. L'absorption occupe
 * desormais la fin de l'etat et s'acheve pile dessus.
 */
export const LOADING_ABSORB_FRAC = 0.28

/** Instant ou la ceinture commence a rentrer, pour une duree d'etat donnee. */
export function loadingAbsorbAt(span: number): number {
  return Math.max(0, span * (1 - LOADING_ABSORB_FRAC))
}

/** Duree du rentre de la ceinture, pour une duree d'etat donnee. */
export function loadingAbsorbFor(span: number): number {
  return span * LOADING_ABSORB_FRAC
}

/* ------------------------------------------------------------ ceintures */

/**
 * Nombre de rubans de la ceinture.
 *
 * La source en pose `rand(3, 5)` quand il n'y a qu'un plan d'orbite (4 en
 * moyenne) et `3 x` plus sur grand ecran. On prend 4 : c'est la moyenne de la
 * source, et au-dela de 5 bandes elles se recouvrent en une tache unique.
 */
const BELT_N = 5

/**
 * Largeur TOTALE d'un ruban a sa tete, en rayons de boule.
 *
 * ── D'ou vient 0,16 (2026-10-31) ───────────────────────────────────────
 * La source calcule `Ne = j.r * fe * 1.7 * sizeScale` avec `j.r` = 6,6 a 8,6 px
 * et `sizeScale = clamp((340/w)^0.7, 1, 2.6)` — donc la largeur FINALE depend de
 * la taille d'affichage, ce qui n'a pas de sens pour un moteur qui doit rendre
 * la meme image a toutes les tailles.
 *
 * La valeur est donc prise a la taille de reference de la source (340 px de
 * large, `sizeScale = 1`) : 7,6 x 0,86 x 1,7 = 11,1 px de large, rapporte a
 * `Re = 114,27`, soit 0,097 R. Ajuste a 0,16 R parce que la planche de l'auteur
 * (celle que l'utilisateur a montree, cadres de ~160 px) sort a 0,175 R : c'est
 * cette taille-la, et pas celle du cadre de 340 px, qui porte le « 肥厚 » qu'il
 * demande.
 */
const BELT_W = 0.16

/**
 * Longueur de chaque trainee, en RADIANS d'orbite.
 *
 * ── Pourquoi 2,8 -> 1,5 (2026-10-31) ──────────────────────────────────
 * La source tire `arc: rand(2.2, 3.4)`, mais chez elle les particules sont
 * GENEREES EN CONTINU (une toutes les 55-105 ms, jusqu'a 110 en vol) : a tout
 * instant il y en a une dizaine sur l'orbite, donc une trainee de 2,8 rad se lit
 * comme un segment parmi d'autres.
 *
 * Ici il n'y a que `BELT_N` rubans, poses a `i/BELT_N` tour d'ecart (72 deg).
 * Avec un arc de 2,8 rad (160 deg), chaque ruban recouvrait largement ses deux
 * voisins et les cinq se fondaient en UN anneau continu — mesure sur la planche :
 * on ne voyait plus cinq bandes, on voyait une bague epaisse. 1,5 rad (86 deg)
 * laisse chaque ruban lisible tout en gardant le recouvrement necessaire pour que
 * ca se lise comme une ceinture et pas comme cinq arcs separes.
 */
const BELT_ARC = 1.5

/**
 * L'ouverture : chaque ruban sort a son tour, en s'etirant du corps vers son
 * orbite.
 *
 * ── Ce que l'utilisateur a demande et pourquoi ces trois nombres ──────
 * « 开头应该是三个旋转出彩线 ». Donc : un mouvement de ROTATION, et les rubans
 * qui en SORTENT. Il faut les trois constantes pour que ca se lise comme un
 * enroulement :
 *   · `BELT_SPAWN_FIRST` : le premier ruban part a 0,10 s — juste apres que la
 *     rotation a demarre (la montee en vitesse prend 0,5 s, donc a 0,10 s elle
 *     tourne deja visiblement) ;
 *   · `BELT_SPAWN_STEP` : 0,13 s d'ecart, donc le cinquieme part a 0,62 s. Le
 *     depassement d'un cinquieme de tour a chaque fois est ce qui fait
 *     l'enroulement ; tous ensemble, ils feraient une ceinture qui apparait.
 *   · `BELT_SPAWN_DUR` : 0,42 s pour parcourir du corps a l'orbite. Assez lent
 *     pour qu'on voie le trajet, assez court pour que la ceinture soit complete
 *     avant la fin de l'etat (2,6 s).
 */
const BELT_SPAWN_FIRST = 0.1
const BELT_SPAWN_STEP = 0.13
const BELT_SPAWN_DUR = 0.42

/**
 * Vitesse angulaire de la ceinture, en radians par seconde, par etat.
 *
 * ── D'ou viennent ces deux chiffres (2026-10-31) ──────────────────────
 * La source fait monter une vitesse unique (`ovSpin`) de 7 rad/s a `dn` en
 * 0,5 s, puis la garde : `dn = 3` pour `loading`, `dn = 1.6` pour `humming`
 * (animation.html l.2933). Ce sont donc des valeurs MESUREES et non esthetiques.
 *
 * `humming` prend un peu plus que 1.6 : a 1,6 rad/s il ne fait que 0,6 tour sur
 * les 2,6 s de l'etat, ce qui se lit comme « ca bouge a peine » et non comme le
 * « 光点环绕 » que l'utilisateur montre en reference.
 */
const BELT_SPIN = { loading: 3, humming: 2.6 } as const
/** Duree de la montee en vitesse au debut, en secondes (mesure de la source). */
const BELT_RAMP_S = 0.5

/**
 * Integrale de `easeInOutCubic` sur `[0, a]`.
 *
 * Pourquoi la forme fermee et pas une somme : `beltRibbons` est appelee a chaque
 * image ; une integration numerique a 60 pas par appel couterait 60 fois plus
 * cher, et surtout elle rendrait l'angle dependant du pas. La forme fermee donne
 * exactement le meme resultat quelle que soit la facon dont on echantillonne.
 */
function easeArea(a: number): number {
  if (a <= 0) return 0
  if (a >= 1) return 0.5
  // ∫ 4u³ = a⁴ ; ∫ (1 - (2-2a)³/2) = a + (2-2a)⁴/16 - 0,5
  return a < 0.5 ? a * a * a * a : a + Math.pow(2 - 2 * a, 4) / 16 - 0.5
}

/**
 * Angle parcouru par la ceinture a l'instant `t`, en radians.
 *
 * La vitesse monte de 0 a `top` en `BELT_RAMP_S` (courbe `easeInOutCubic` de la
 * source), puis reste CONSTANTE. C'est le point cle : elle ne doit pas non plus
 * accelerer a la fin. Une premiere version faisait `spinup = 1 + pull * 2.5`,
 * et c'est exactement ce que l'utilisateur a vu — « 在末尾却突然变大，然后疯狂
 * 旋转吸收进去了 ». Une ceinture qui accelere en fin de vie ne se lit pas comme
 * une aspiration, elle se lit comme un bug.
 */
function beltAngle(t: number, top: number): number {
  const tt = Math.max(0, t)
  const a = Math.min(tt / BELT_RAMP_S, 1)
  return top * BELT_RAMP_S * easeArea(a) + top * Math.max(0, tt - BELT_RAMP_S)
}

/**
 * La ceinture de rubans de `loading` / `humming` — les « 肥厚的彩线 ».
 *
 * ── Ce que l'utilisateur demandait (2026-10-31) ────────────────────────
 * « 你能不能再扒一下原项目的 humming，里面那种肥厚的彩线，才是我想要的 ».
 * Il avait raison de demander la source plutot qu'une retouche : la ceinture de
 * l'auteur n'est PAS faite de points. Chaque particule laisse une trainee, et
 * cette trainee est une BANDE REMPLIE dont l'epaisseur croit vers l'avant
 * (`ribbon()`, animation.html l.1423). Une bande de 11 a 20 px de large, ce que
 * l'oeil lit comme une matiere qui coule ; six disques de 13 px ne peuvent pas
 * imiter ca, quel que soit leur nombre — c'est pour ca que la version a points
 * restait « des billes » et pas « des fils ».
 *
 * ── La geometrie, reprise telle quelle ────────────────────────────────
 * Chaque ruban suit une ellipse vue de biais :
 *
 *     x = rad sin(lam)            y = -rad cos(lam) sin(tilt)
 *     z = cos(lam) cos(tilt)      puis rotation de `roll` dans le plan
 *
 * `z` sert au tri en profondeur : la moitie arriere passe DERRIERE la bille.
 * Sans ca les rubans traverseraient le corps, ce qui casse l'illusion d'orbite —
 * c'est exactement le meme mecanisme que pour les arcs 3D.
 *
 * ── Les rayons ────────────────────────────────────────────────────────
 * La source pose les quatre particules a 116, 128, 141 et 154 px pour un corps
 * de 114,27, soit 1,015 a 1,348 R. Notre plafond de decor est `REACH` (0,888) —
 * c'est le cercle de `comet`, la reference que l'utilisateur a fixee. Les quatre
 * rayons sont donc ramenes dans cet intervalle en gardant leur ECART RELATIF,
 * du plus interieur au plus exterieur : 0,75 a 1,0 fois `REACH`.
 *
 * ── La fin, en douceur (2026-08-31 -> corrige) ───────────────────────
 * `absorbAt` / `absorbFor` datent le rentre. Pendant le rentre le rayon tombe
 * vers `bodyR` et l'opacite s'eteint, mais la VITESSE ANGULAIRE NE CHANGE PAS et
 * la largeur non plus. C'est ce qui distingue « la matiere est aspiree » de
 * « la ceinture explose puis se fait avaler ».
 */
/**
 * Les BILLES COLOREES de `loading` — ce que l'utilisateur appelle「彩球」.
 *
 * ── Pourquoi elles reviennent (2026-10-31) ────────────────────────────
 * `loading` avait des rubans (la 彩线). L'utilisateur : « 能换回我们之前那个圆形
 * 小球吗，turn87版本的，然后定义为（彩球）」. Donc `loading` porte des BILLES,
 * pas des rubans — et c'est desormais la definition du mot 彩球 : de petits
 * disques pleins, chacun d'une couleur FIXE de la palette, qui tournent autour
 * de la bille sur deux anneaux aplatis (vus de biais).
 *
 * Ca laisse trois familles distinctes, et c'est voulu qu'elles le restent :
 *   彩球 (dots)  `loading`            disques pleins, couleur fixe
 *   彩线 (ribbons) `humming` / `search`  bandes remplies, degrade le long du fil
 *   环 (rings)   `radar` / `progress`   cercles traces
 *
 * ── Les deux bugs de la version d'origine, corriges ici ───────────────
 * La version turn87 avait exactement ce defaut que l'utilisateur a decrit plus
 * tard comme « 末尾却突然变大，然后疯狂旋转吸收进去了 » :
 *
 *     const spinup = 1 + pull * 2.5
 *     r: BELT_DOT_R * grow * (1 - ring*0.2) * grow_ * spinup
 *     a: (t * (1.1 + ring*0.35) + ...) * spinup
 *
 * `spinup` multipliait le RAYON (donc les billes grossissaient jusqu'a x3,5) ET
 * la VITESSE ANGULAIRE (donc elles tournaient de plus en plus vite) au moment ou
 * elles sont censees etre aspirees. Une matiere qu'on aspire RENTRE en gardant sa
 * taille et son rythme ; elle ne gonfle pas et ne s'emballe pas. Les deux sont
 * donc retires : ici l'absorption ne fait que rapprocher le rayon du corps et
 * eteindre l'opacite.
 */
export function beltDots(t: number, opacity: number, bodyR: number, absorbAt = Infinity, absorbFor = 0.3): DotRender[] {
  const out: DotRender[] = []
  if (opacity <= 0.01) return out
  const grow = outCubic(clamp(t / 0.45))
  const absorb = absorbAt === Infinity ? 0 : clamp((t - absorbAt) / absorbFor)
  /*
   * L'aspiration finie : a `absorb = 1` il n'y a plus de matiere, et l'etat doit
   * pouvoir enchainer sur une image VIDE. C'est une sortie de tableau, pas un
   * fondu — la matiere a deja disparu avant (voir le rayon qui tombe a zero).
   */
  if (absorbAt !== Infinity && absorb >= 1) return out
  // Let the larger outer orbit fold back into the former absorption track;
  // the disks keep their size and enter the same BODY.small * DIVE_END endpoint.
  const pull = absorb * absorb
  /*
   * ── Le point d'arrivee est DANS la bille, pas sur son bord (2026-10-31) ──
   * `bodyR` est le rayon du corps ; s'y arreter laisse chaque bille a cheval sur
   * la silhouette, donc a moitie visible. On plonge jusqu'a `bodyR * DIVE_END`
   * pour que la matiere soit franchement entree. Meme ordre de grandeur que
   * `dockDots`, pour que les deux animations aient l'air d'avoir la meme bille.
   */
  const DIVE_END = 0.3
  /*
   * ── La taille tombe a zero, mais SEULEMENT une fois a l'interieur ────
   * Le rayon ne peut pas rester constant jusqu'a la fin : l'etat doit rendre une
   * image vide, et une bille de 5,7 px de rayon n'est pas vide. Le retrecissement
   * ne commence qu'apres `absorb > 0,95` : avec la trajectoire ajustee pour
   * la bille agrandie, tous les disques sont alors entiers derriere le corps.
   * Rien ne retrecit visiblement a l'exterieur et l'opacite reste constante.
   */
  const shrink = clamp((absorb - 0.95) / 0.05)
  const shrinkEase = shrink * shrink * (3 - 2 * shrink)
  for (let i = 0; i < 6; i++) {
    const ring = i % 2
    const a = t * (1.1 + ring * 0.35) + (i / 6) * TAU + ring * 0.8
    /*
     * Deux anneaux, le 0 plus large que le 1 (`1 - ring*0,12`), tous deux
     * aplatis par `0,65 + ring*0,20` : c'est ce qui les fait lire comme des
     * ceintures vues de biais et non comme deux cercles concentriques.
     */
    const baseReach = (REACH - BELT_DOT_R) * (1 - ring * 0.12) * grow
    const reach = baseReach * (1 + (EXTERIOR_TRACK_SCALE - 1) * (1 - absorb))
    const dist = absorbAt === Infinity ? reach : reach + (bodyR * DIVE_END - reach) * pull
    out.push({
      x: Math.cos(a) * dist,
      y: Math.sin(a) * dist * (0.65 + ring * 0.20),
      // la taille ne depend NI du temps NI de l'absorption (sauf l'effacement
      // final, qui se joue a l'interieur de la silhouette)
      r: BELT_DOT_R * EXTERIOR_DOT_SCALE * grow * (1 - ring * 0.2) * (1 - shrinkEase),
      /*
       * La teinte indexe la palette par `i` et non par le temps : chaque bille
       * GARDE sa couleur pendant qu'elle tourne. Un `hue + t` ferait un
       * arc-en-ciel mouvant, ce qui n'est pas « des billes colorees » mais
       * « une bille qui change de couleur ».
       */
      color: PALETTE[i % PALETTE.length],
      /*
       * ── Pleine opacite du debut a la fin (2026-10-31) ─────────────────
       * « （加载）的那个彩球，可以做成不要隐没效果的吗？因为他的弹出和消失都是
       *   叠加了一层类似于渐变透明，我不需要 」
       *
       * Il y avait DEUX couches, et il les a toutes les deux vues :
       *
       *   sortie  `clamp((1 - absorb) / 0,2)` — la bille devenait transparente
       *           pendant qu'elle entrait dans le corps ;
       *   entree  `0,55 + 0,45 sin(a * 1,7 + i)` — un scintillement permanent
       *           qui faisait osciller chaque bille entre 0,10 et 1,00.
       *
       * Le scintillement n'etait pas une demande, c'etait un reste de la version
       * ou les billes etaient des particules. Une 彩球 est un disque PLEIN (voir
       * README 3.5) : un disque plein ne clignote pas. Les deux partent.
       *
       * La disparition est desormais purement geometrique : la bille plonge
       * jusqu'a `bodyR * 0,3` et c'est la SILHOUETTE qui la mange (l'etat passe
       * `dotsBehind: true`). Rien ne s'eteint, donc rien ne se « delave ».
       */
      opacity
    })
  }
  return out
}

/**
 * La ceinture de rubans de `loading` / `humming` — les « 肥厚的彩线 ».
 *
 * ── Qui l'utilise encore (2026-10-31) ─────────────────────────────────
 * Plus que `humming`. `loading` est repasse aux 彩球 (`beltDots`) sur demande
 * explicite : « 能换回我们之前那个圆形小球吗 ». Les deux animations ont donc
 * deux materiaux differents, et c'est la definition meme de la distinction
 * 彩球 / 彩线 — voir l'entete de `beltDots`.
 */
export function beltRibbons(
  t: number,
  opacity: number,
  bodyR: number,
  kind: keyof typeof BELT_SPIN = 'humming',
  absorbAt = Infinity,
  absorbFor = 0.2,
  /**
   * Instant ou la ceinture commence a se RESUMER, et duree du resume.
   *
   * ── Pourquoi le resume et pas un fondu (2026-10-31) ────────────────
   * « 结束的时候那个彩线结束，就像是原版那样 ». Dans la source, chaque ruban a un
   * compteur `ret` (animation.html l.1492) qui monte de 0 a 1 en 0,5 s ; pendant
   * ce temps l'arc est multiplie par `1 - ret²(3-2ret)` et la largeur par
   * `1 - 0,72 ret²`. Autrement dit : la trainee RENTRE dans sa particule et
   * s'amincit en meme temps, puis disparait.
   *
   * Un fondu d'opacite donnerait « les rubans deviennent transparents » — une
   * image qui s'efface. Le resume donne « les rubans se rangent » — un geste. La
   * difference se voit immediatement, et c'est celle que l'utilisateur reclame.
   */
  retractAt = Infinity,
  retractFor = 0.5
): RibbonSpec[] {
  const out: RibbonSpec[] = []
  if (opacity <= 0.01) return out

  const absorb = absorbAt === Infinity ? 0 : clamp((t - absorbAt) / absorbFor)
  // carre : l'aspiration prend de la vitesse, mais c'est le RAYON qui accelere,
  // pas la rotation — voir l'entete
  const pull = absorb * absorb
  const ang = beltAngle(t, BELT_SPIN[kind])
  /*
   * Le resume, en `easeInOut` comme la source (`ret²(3-2ret)` est un smoothstep).
   */
  const ret = retractAt === Infinity ? 0 : clamp((t - retractAt) / retractFor)
  const retEase = ret * ret * (3 - 2 * ret)
  /*
   * ── Le resserrement est DECALE par ruban (2026-10-31) ────────────────
   * Mesure : les cinq rubans disparaissaient tous a 2,52 s — la meme image.
   * C'est exactement ce qu'on voulait eviter, et ca venait de `retEase`, qui
   * est le MEME nombre pour les cinq : a l'instant ou il atteint 1, les cinq
   * arcs tombent a zero ensemble.
   *
   * La source n'a pas ce defaut parce que ses particules n'apparaissent pas au
   * meme instant : chacune a son propre age, donc son propre `ret`. Ici les cinq
   * sont contemporains, donc il faut decaler l'instant de depart a la main.
   * `SPREAD` etale les cinq departs sur 0,16 s : le dernier commence quand le
   * premier est deja a 30 % de son resserrement, ce qui suffit a lire un
   * enroulement au lieu d'une disparition.
   *
   * `i` n'est pas disponible ici (on est hors de la boucle), donc le retard est
   * calcule dans la boucle, plus bas.
   */
  const retractDelay = (idx: number) =>
    retractAt === Infinity ? 0 : (0.16 * idx) / Math.max(BELT_N - 1, 1)
  /*
   * ── UN SEUL plan pour les quatre rubans (2026-10-31) ────────────────
   * La source ne cree qu'un plan quand il n'y a qu'un groupe
   * (`makePlanes(wide ? 3 : 1)`), et toutes les particules prennent
   * `planes[i % planes.length]` — donc le MEME plan, avec un jitter de
   * `rand(-0,04, 0,05)` sur l'inclinaison et le roulis.
   *
   * Une version precedente donnait a chaque ruban son propre plan
   * (`tilt = 0,16 + 0,34 * draw(i)` sur toute la plage). La planche l'a montre
   * tout de suite : quatre anneaux orientes differemment se croisent et forment
   * une pelote de ficelle, pas une ceinture. Une ceinture, c'est quatre fils
   * DANS LE MEME plan — c'est ce qui fait lire « un disque vu de biais » plutot
   * que « quatre objets qui se croisent ».
   */
  const planeTilt = 0.16 + 0.24 * draw(0, 3, 17)
  const planeRoll = -0.5 + 0.9 * draw(0, 4, 17)

  for (let i = 0; i < BELT_N; i++) {
    /*
     * ── L'ouverture : trois tours, puis les rubans SORTENT (2026-10-31) ──
     * « 开头应该是三个旋转出彩线 ». Le defaut precedent : `grow` montait sur
     * 0,45 s en changeant le RAYON et la LARGEUR, donc les rubans apparaissaient
     * enflaient — une apparition, pas un mouvement.
     *
     * Ici l'ouverture se fait en deux temps, et le sujet du geste est la VITESSE
     * de rotation, pas la taille :
     *   · le tourillon : la ceinture tourne deja (`beltAngle`), donc elle
     *     tourne des l'instant zero ;
     *   · chaque ruban entre a son tour, decale de `SPAWN_STEP` : le premier
     *     des 0,1 s, le dernier vers 0,55 s. L'oeil voit donc la matiere
     *     S'ENROULER autour de la bille au lieu de la voir grossir.
     * L'epaisseur reste a sa valeur pleine des la naissance (pas de `grow` sur
     * `w`) : un ruban qui s'epaissit se lit comme un zoom, pas comme un fil.
     */
    const spawnAt = BELT_SPAWN_FIRST + i * BELT_SPAWN_STEP
    const born = clamp((t - spawnAt) / BELT_SPAWN_DUR)
    if (born <= 0) continue
    const e = outCubic(born)
    /*
     * Le resserrement propre a CE ruban : meme formule que la source, mais
     * decale dans le temps (voir `retractDelay`). Sans ce decalage les cinq
     * rubans s'effondrent sur la meme image.
     */
    const retI = retractAt === Infinity ? 0 : clamp((t - retractAt - retractDelay(i)) / retractFor)
    const retEaseI = retI * retI * (3 - 2 * retI)
    // jitter du plan : meme famille, mais pas quatre fils exactement confondus
    const tilt = planeTilt + (draw(i, 3, 41) - 0.5) * 0.09
    const roll = planeRoll + (draw(i, 4, 41) - 0.5) * 0.12
    /*
     * `lam` part legerement en avance sur la tete (la source decale de 0 a
     * 0,18 rad) : sans ce decalage les quatre rubans seraient a la meme hauteur
     * et se superposeraient en une seule bande.
     */
    const lam = ang + (i / BELT_N) * TAU + draw(i, 5, 17) * 0.18
    const fullReach = REACH * (0.75 + (0.25 * i) / (BELT_N - 1))
    /*
     * Pendant l'ouverture le ruban part du CORPS et s'etire jusqu'a son orbite :
     * il sort de la matiere. C'est `e` qui porte le trajet, et c'est ce qui fait
     * lire « 旋转出彩线 » plutot que « 彩线出现 ».
     */
    const reach = bodyR + (fullReach - bodyR) * e
    const rad = absorbAt === Infinity ? reach : reach + (bodyR - reach) * pull
    const arc = BELT_ARC * (0.8 + 0.4 * draw(i, 6, 17))
    /*
     * Epaisseur : elle suit le rayon du ruban. Un ruban exterieur plus epais
     * qu'un ruban interieur se lit comme un volume, l'inverse comme une erreur.
     * Elle est aussi reduite par le resume (`1 - 0,72 ret²`, mesure de la
     * source), donc le ruban s'amincit en se rangeant.
     */
    const w = BELT_W * (0.85 + 0.3 * (i / (BELT_N - 1))) * (1 - 0.72 * retEaseI * retEaseI)

    const pts: RibbonPoint[] = []
    const STEPS = 14
    for (let k = 0; k <= STEPS; k++) {
      const a = lam - arc * (1 - k / STEPS)
      const g = rad * Math.sin(a)
      const y = -rad * Math.cos(a) * Math.sin(tilt)
      const c = Math.cos(roll)
      const s = Math.sin(roll)
      pts.push({
        x: g * c - y * s,
        y: g * s + y * c,
        z: Math.cos(a) * Math.cos(tilt)
      })
    }

    /*
     * La trainee s'efface par la QUEUE pendant l'absorption et pendant le
     * resume : on raccourcit l'arc au lieu d'eteindre la bande entiere, sinon
     * les rubans disparaissent ensemble au lieu de se ranger un par un.
     *
     * `ye = arc * (1 - ret²(3-2ret))` : c'est l'expression EXACTE de la source
     * (animation.html l.1538), ou la longueur visible de la trainee est
     * multipliee par ce facteur. A `ret = 1` elle vaut zero — le ruban a
     * entierement rentre dans sa particule.
     */
    const absorbTail = absorbAt === Infinity ? 1 : clamp(1 - absorb)
    const tail = absorbTail * (1 - retEaseI)
    out.push({
      id: `belt${i}`,
      pts: pts.slice(Math.floor(STEPS * (1 - tail))),
      width: w,
      /*
       * ── Teintes reparties, pas tirees au sort (2026-10-31) ──────────
       * La source fait `hue0 + (i * 360) / max(beltN, 1) + rand(-14, 14)` : les
       * quatre rubans couvrent le cercle chromatique entier, l'aleatoire ne
       * faisant que casser la symetrie. Un tirage libre (`draw() * 360`) ne
       * garantit rien : mesure sur la planche, les quatre sortaient bleu-violet-
       * bleu-rose, donc une ceinture froide et monotone au lieu d'un arc-en-ciel.
       * C'est la repartition par `i` qui porte la couleur, pas le tirage.
       */
      hue: (i * 360) / BELT_N + (draw(i, 7, 17) - 0.5) * 28,
      hueSpan: 60 + draw(i, 8, 17) * 60,
      opacity: opacity * (absorbAt === Infinity ? 1 : clamp((1 - absorb) / 0.25))
    })
  }
  return out
}

/* ---------------------------------------------------------- feux d'artifice */

/**
 * Les feux d'artifice : la gerbe de particules de la source (`particles.burst`).
 *
 * ── Ce que fait la source ──────────────────────────────────────────────
 * Un anneau de particules est pose sur le bord du corps (96 a 116 px pour un
 * corps de 114,27) puis projetees vers l'exterieur a 170-360 px/s, avec une
 * poussee vers le haut de 20 a 75 px/s, une gravite de 40 px/s^2 et un
 * frottement de 0,94 par image a 60 Hz. Une sur cinq est une ETOILE doree, les
 * autres prennent une couleur de la palette. C'est ce melange de couleurs qui
 * fait lire « fete » plutot que « etincelles ».
 *
 * ── Pourquoi c'est recalcule et non simule ────────────────────────────
 * La source avance les particules image par image en gardant leur etat. Ce
 * moteur-ci est une FONCTION PURE du temps (voir `engine.ts`), donc rejouer une
 * date doit redonner exactement la meme image — un etat accumule l'interdirait,
 * et le test ne pourrait plus rien verrouiller.
 *
 * La trajectoire est donc resolue a la main. Avec un frottement lineaire
 * `dv/dt = -k v + g`, la position a une solution exacte :
 *
 *     x(t) = x0 + vx0 (1 - e^-kt) / k
 *     y(t) = y0 + vy0 (1 - e^-kt) / k + g (kt - 1 + e^-kt) / k^2
 *
 * ou `k = -60 ln(0,94) = 3,713` : c'est exactement le 0,94 par image de la
 * source, remis en secondes. Meme mouvement, meme duree de vie, et rejouable.
 *
 * ── D'ou viennent les tirages ─────────────────────────────────────────
 * La source tire au hasard. Ici chaque particule tire ses valeurs d'un hachage
 * de son index et d'une graine : meme apparence desordonnee, mais deterministe.
 */

/** Couleur des etoiles dans la source. */
export const STAR_COLOR = '#f4c34e'

/**
 * Les six couleurs du decor colore, relevees dans la source (`PALETTE`, ligne
 * 1161 de `animation.html`).
 *
 * ── Ce n'est pas la palette des feux d'artifice ────────────────────────
 * C'est la palette des PARTICULES de la source au sens large : `burst` s'en
 * sert, mais aussi `spawnBelt` (la ceinture de `loading` / `humming`) et les
 * rubans de la comete. D'ou le nom generique : plusieurs decors la partagent,
 * et c'est voulu — c'est la meme roue de teintes.
 */
export const PALETTE = ['#f9705c', '#5b95f0', '#3fbe86', '#f5b13f', '#9a72ee', '#35c3bd']

/** Frottement de la source : 0,94 par image a 60 Hz, remis en 1/s. */
const BURST_DRAG = -60 * Math.log(0.94)
/** Gravite de la source, en rayons de boule par seconde carree. */
const BURST_G = 40 / REF_R

/**
 * Portee exterieure visee pour une gerbe, en rayons de boule : le point le plus
 * loin que puisse atteindre une particule.
 *
 * ── Pourquoi 1,48 et pas 1,22 (2026-10-30) ────────────────────────────
 * La premiere version visait 1,22 radiation en croyant preserver le cadre. Le
 * resultat a ete juge « 很小一圈 » : pour un corps PLEIN (1,0 rayon, le cas de
 * `waking`), 1,22 ne laisse que **0,22 rayon de course**, soit une couronne
 * collee a la silhouette. Elle se lit comme un liseré, pas comme une explosion.
 *
 * ── Ce que fait la source, et le piege de lecture ─────────────────────
 * La source pousse ses particules jusqu'a 1,83 rayon — mais son CADRE est plus
 * petit que le notre : `viewBox` minX -15, largeur 259, centre a 114,27, donc
 * demi-largeur 129,5 = **1,13 rayon**. Autrement dit chez l'auteur la gerbe sort
 * du cadre et se fait couper : l'explosion est d'autant plus violente qu'on ne
 * la voit pas finir. Notre cadre (demi-viewBox 158) vaut 1,58 rayon, donc on a
 * PLUS de place que la reference, pas moins.
 *
 * On va donc jusqu'a la limite utile du cadre. `BURST_REACH` est la portee de la
 * particule de REFERENCE (vitesse source maximale, `power = 1`) : les gerbes a
 * `power = 1,1` depassent d'environ 10 %, d'ou la valeur 1,40 et non 1,48.
 * Au-dela, les points deborderaient de la boite de l'avatar.
 *
 * ── 1,40 -> 1,52 : pourquoi encore (2026-10-30, deuxieme passe) ───────
 * La planche a montre que `waking` ne gagnait presque rien. La raison est
 * geometrique et n'a rien a voir avec la gerbe : ce corps-la est PLEIN (1,0 R),
 * donc la couronne visible vaut `BURST_REACH - 1` et rien d'autre.
 *
 *     portee 1,22  ->  couronne de 0,22 R =  22 px   (l'etat d'origine)
 *     portee 1,40  ->  couronne de 0,40 R =  40 px   (premiere correction)
 *     portee 1,52  ->  couronne de 0,52 R =  52 px   (ici)
 *
 * Le cadre fait 1,58 R : a 1,52 il reste 0,06 R de marge, ce qui suffit pour
 * que la plus grosse particule (0,07 R avec son etoile) affleure le bord sans
 * etre coupee par le conteneur.
 *
 * ── Pourquoi 1,52 a ete ramene a 1,40 (troisieme passe) ──────────────
 * `BURST_REACH` est le trajet du CENTRE d'une particule. Or ce qu'on mesure a
 * l'ecran (et ce que verifie le test), c'est le bord EXTERIEUR : centre + rayon
 * de la particule. Avec des points qui font maintenant 0,11 R de rayon, viser
 * 1,52 au centre donnait 1,63 au bord — mesure, et ca deborde du cadre.
 *
 * 1,40 + 0,11 = 1,51 au bord, soit juste sous les 1,52 que la deuxieme passe
 * cherchait a obtenir. C'est le meme resultat a l'ecran, mais compte
 * correctement.
 *
 * ── Pourquoi c'est une portee ABSOLUE, pas relative au corps ──────────
 * `from` est le bord du corps d'ou partent les particules, et il varie (1,0
 * pour `waking` qui garde le corps plein, 0,166 pour `celebrate` qui retrecit).
 * La vitesse est recalculee a chaque gerbe pour que le POINT D'ARRIVEE soit
 * toujours `BURST_REACH` : une petite bille tire donc une gerbe plus large
 * qu'un gros corps. Mais attention — la couronne VISIBLE, elle, vaut
 * `BURST_REACH - from`, donc elle est plus faible pour un corps plein. C'est
 * cette dissymetrie qui fait que `waking` (corps plein) a besoin de toute la
 * portee disponible alors que `celebrate` (bille) a de la marge.
 */
const BURST_REACH = 1.4
/** Bord exterieur du corps plein, d'ou partent les particules (`Re`). */
const BURST_START_MAX = 1
/** Trajet maximal d'une particule a la vitesse de la source, sur sa duree de vie. */
const BURST_TRAVEL_FULL = (360 / REF_R) * ((1 - Math.exp(-BURST_DRAG * 0.85)) / BURST_DRAG)
/**
 * Facteur applique aux vitesses de la source pour qu'une gerbe partie du bord
 * d'un corps PLEIN arrive exactement a `BURST_REACH`.
 *
 * ── Pourquoi ce n'est plus une constante suffisante ───────────────────
 * Il ne vaut que pour `from = 1`. Or `from` varie : 1,0 pour `waking` (corps
 * plein), 0,166 pour `celebrate` (corps retreci). La version precedente
 * appliquait ce facteur tel quel, donc une gerbe nee a 0,166 ne parcourait que
 * `BURST_REACH - 1` et s'arretait a 0,57 rayon — une petite couronne autour
 * d'une bille. C'est le « 很小一圈 » constate.
 *
 * `firework` recalcule donc le facteur PAR GERBE a partir de son `from` (voir
 * `burstSpeedFor`), de sorte que la portee finale soit toujours `BURST_REACH`.
 * Ce nom reste pour documenter le cas de reference.
 */
const BURST_SPEED = (BURST_REACH - BURST_START_MAX) / BURST_TRAVEL_FULL

/**
 * Le facteur de vitesse qui amene une gerbe nee a `from` jusqu'a `BURST_REACH`.
 *
 * ── Pourquoi la portee doit etre ABSOLUE et non heritee de la source ──
 * La version precedente appliquait un facteur constant, calibre pour un depart
 * a 1 R. Une gerbe nee a 0,166 R (le corps retreci de `celebrate`) ne
 * parcourait donc que `1,22 - 1 = 0,22` rayon et s'arretait a 0,39 : une petite
 * couronne collee a la bille. C'est le « 很小一圈 » constate. Ici la course est
 * `BURST_REACH - from`, donc la gerbe arrive TOUJOURS au bord du cadre, quelle
 * que soit la taille du corps qui la tire.
 *
 * ── Pourquoi `power` ne proportionne plus la portee ───────────────────
 * `power` vient de la source (0,8 au reveil, 1,1 sur les grosses gerbes de
 * `celebrate`) et multipliait la vitesse. A portee absolue, le garder lineaire
 * ferait deborder les gerbes a 1,1 et retrecirait celles a 0,8 — la taille de
 * l'explosion redeviendrait une loterie. Il n'agit donc plus qu'a +-2 % pres
 * (facteur 0,85..1,0), assez pour que les gerbes ne soient pas clones les unes
 * des autres, trop peu pour casser le cadrage.
 */
function burstSpeedFor(from: number, power: number): number {
  const span = Math.max(BURST_REACH - from, 0.05)
  return (span / BURST_TRAVEL_FULL) * (0.85 + 0.15 * power)
}

/**
 * Le point de depart des particules, en rayons de boule.
 *
 * La source les pose sur le bord du corps (`Re`), ce qui est juste quand le
 * corps est plein. Mais `firework` sert aussi a des etats dont le corps est
 * minuscule ou carrement absent de la scene : poser la gerbe a 1 R la ferait
 * naitre a 100 px du centre, donc jaillir d'un endroit vide. Le depart est donc
 * passe en argument, avec 1 R pour valeur par defaut (le cas `celebrate`).
 */
function burstFrom(from: number, a: number, surf: number, speed: number): { x: number; y: number } {
  return {
    x: Math.cos(a) * from + Math.cos(a) * speed * surf,
    y: Math.sin(a) * from + Math.sin(a) * speed * surf
  }
}

/** L'etoile a cinq branches de la source, rayon `r` en unites de rayon de boule. */
function starPath(r: number): string {
  const n: string[] = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const s = i % 2 === 0 ? 1 : 0.42
    n.push(`${(Math.cos(a) * s * r).toFixed(3)} ${(Math.sin(a) * s * r).toFixed(3)}`)
  }
  return 'M' + n.join('L') + 'Z'
}

/** Tirage deterministe dans [0,1) : remplace le `Math.random` de la source. */
function draw(i: number, salt: number, seed: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7 + seed * 74.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Une gerbe nee a `at` (temps local de l'etat), evaluee a `t`.
 *
 * Renvoie un tableau vide avant la naissance et apres la mort de la derniere
 * particule : l'appelant peut donc l'appeler a chaque image sans condition.
 *
 * `count` et `power` viennent des trois appels de la source : 9 a 13 particules
 * a 0,8 pour le reveil, 16 a 0,95 et 22 a 1,1 pour les autres gerbes.
 */
export function firework(
  t: number,
  at: number,
  count: number,
  power = 1,
  seed = 0,
  from = BURST_START_MAX
): DotRender[] {
  const out: DotRender[] = []
  const age = t - at
  /*
   * ── Pourquoi 0,9 -> 1,4 s (2026-10-30) ──────────────────────────────
   * 0,9 s vient de la source, ou une particule vit 0,45 a 0,85 s. Mais chez
   * l'auteur la gerbe traverse tout le cadre en 1/4 de seconde a 60 img/s : la
   * lire demande de la voir sur beaucoup d'images consecutives.
   *
   * Ici la portee a ete multipliee par 1,25 et l'affichage est plus lent, donc
   * 0,85 s donne une explosion qui s'ouvre et s'eteint presque instantanement —
   * le regard n'a pas le temps de suivre l'expansion, et ca se lit comme un
   * clignotement. Allonger la vie ne change pas la VITESSE (donnee par
   * `BURST_DRAG`) : ca change le moment ou le point s'efface, donc la gerbe
   * reste ouverte plus longtemps.
   */
  if (age < 0 || age > 1.4) return out
  const decay = 1 - Math.exp(-BURST_DRAG * age)
  const surf = decay / BURST_DRAG
  const fall = (BURST_DRAG * age - 1 + Math.exp(-BURST_DRAG * age)) / (BURST_DRAG * BURST_DRAG)
  // facteur calibre sur le `from` de CETTE gerbe : la portee ne depend plus du
  // rayon du corps qui la tire (voir `burstSpeedFor`)
  const speedK = burstSpeedFor(from, power)

  for (let i = 0; i < count; i++) {
    const r1 = draw(i, 0, seed)
    const r2 = draw(i, 1, seed)
    const r3 = draw(i, 2, seed)
    const max = 0.7 + r3 * 0.6 // duree de vie, 0,7-1,3 s (voir le commentaire sur `age`)
    if (age > max) continue
    const le = age / max
    const a = (i / count) * TAU + (r1 - 0.5) * 0.7
    const speed = ((170 + r1 * 190) * speedK) / REF_R
    /*
     * La poussee vers le haut de la source, 20 a 75 px/s.
     *
     * ── Pourquoi elle n'est PAS remise a l'echelle de `speed` ────────────
     * Les deux sont en px/s chez l'auteur, et les deux passent par le meme
     * `1 / REF_R` : leur RAPPORT (environ 0,2) est donc deja celui de la
     * source. Multiplier `kick` par le facteur de vitesse donnerait une gerbe
     * qui part en cone vers le haut au lieu d'exploser en cercle. C'est un
     * piege : la vitesse radiale a change d'echelle, pas l'anisotropie.
     */
    const kick = (20 + r3 * 55) / REF_R

    const p = burstFrom(from, a, surf, speed)
    const x = p.x
    const y = p.y - kick * surf + BURST_G * fall

    /*
     * Le rayon decroit de 40 % sur la vie de la particule (mesure de la source).
     * Il ne depend plus de `REF_R` seul : a 96 px d'affichage une particule de
     * 4 px etait lisible, mais l'explosion est maintenant deux fois plus large,
     * donc les points doivent grandir avec elle ou ils disparaissent dans le
     * vide. 1,35 est mesure pour que le point le plus gros garde la meme part de
     * la scene qu'avant.
     *
     * ── 1,35 -> 1,8 (deuxieme passe) ──────────────────────────────────
     * La planche a montre la gerbe de `waking` comme une « pluie de confettis »
     * et non une explosion. Deux causes, pas une : la couronne etait trop
     * etroite (corrigee par `BURST_REACH`), ET les points trop petits pour la
     * surface qu'ils couvrent. Le diametre d'un point fait ici ~9 px pour un
     * cadre de 3,16 R, soit 3 % de la largeur : chez l'auteur c'est 7 %.
     */
    const rPx = (3.5 + r2 * 4.5) / REF_R
    const r = Math.max(rPx * (1 - le * 0.4) * 1.8, 0.5 / REF_R)
    // fondu : montee sur les 10 premiers pour cent, puis puissance 1,7
    const fade = le < 0.1 ? le / 0.1 : Math.pow(1 - (le - 0.1) / 0.9, 1.7)
    // une sur cinq est une etoile doree, les autres prennent une couleur.
    // `r` reste renseigne meme pour une etoile : le moteur ecarte les points de
    // rayon nul, et `d` ne remplace le trace qu'a l'affichage.
    const star = r3 < 0.2
    out.push({
      x,
      y,
      r,
      d: star ? starPath(r) : undefined,
      rot: star ? age * (r1 - 0.5) * 520 : undefined,
      color: star ? STAR_COLOR : PALETTE[Math.floor(r2 * PALETTE.length) % PALETTE.length],
      opacity: fade
    })
  }
  return out
}

/** Arrondi commun a ce fichier : evite d'importer `r2` partout. */
export const round = r2

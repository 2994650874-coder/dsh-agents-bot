import { TAU, clamp, createRng, r2 } from './math'

/* ------------------------------------------------------------------ couleurs */

/**
 * Les anneaux ne sont pas des couleurs plates : la video montre une roue de
 * teintes complete a luminosite constante, avec un degrade le long de chaque
 * trace. Mesure : S 45-62 %, L 50-67 %.
 */
export function wheel(hue: number, s = 0.55, l = 0.62): string {
  const h = ((hue % 360) + 360) % 360
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x]
  const hex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hex(r)}${hex(g)}${hex(b)}`
}

/* ------------------------------------------------------------- types de rendu */

export interface DotRender {
  x: number
  y: number
  r: number
  opacity: number
  /** couleur explicite ; par defaut le rendu prend celle du corps */
  color?: string
  /**
   * Brume de profondeur : 0 = fondu dans le fond, 1 = couleur du corps pleine.
   * Le melange se fait au rendu, qui seul connait la couleur choisie.
   */
  depth?: number
  /**
   * Forme non circulaire, en unites de rayon de boule et centree sur l'origine
   * (le point du "!" penche est une goutte, pas un disque). Quand elle est
   * fournie, `r` n'est plus utilise pour le trace.
   */
  d?: string
  /** rotation appliquee a `d`, en degres */
  rot?: number
  /**
   * Degrade de teinte le long du trace, quand le point a une forme allongee.
   *
   * ── Pourquoi les rayons de `search` en ont besoin (2026-10-30) ────────
   * L'utilisateur a compare les rayons de `search` a « 写文件那种线条 », qui est
   * un arc a degrade (`ArcRender.grad`, trois arrets de teinte). Un aplat de
   * couleur, lui, se lit comme « 单纯的硬条 » — une barre dure. Le meme trait,
   * mais avec une teinte qui glisse d'un bout a l'autre, se lit comme une
   * filament : c'est la variation de teinte, pas l'epaisseur, qui fait la
   * « matiere ».
   *
   * Les arrets sont donnes dans l'ordre du chemin (`d`), donc de la tete vers la
   * queue pour un rayon. Le rendu les pose en `objectBoundingBox`, ce qui suit
   * automatiquement la forme allongee du point sans avoir a lui dire ou est son
   * axe : la transformation du point (rotation, echelle) s'applique aussi au
   * degrade.
   */
  grad?: string[]
}

/* ------------------------------------------------------------------ rubans */

/**
 * Un point 3D du repere de la source : `z` negatif = derriere le corps.
 *
 * Le tri en profondeur est ce qui fait qu'un ruban PASSE DERRIERE la bille au
 * lieu de la traverser. C'est la meme mecanique que pour les arcs, mais un
 * ruban n'est pas un trait : c'est une BANDE remplie, donc elle a besoin de ses
 * points, pas d'un trace.
 */
export interface RibbonPoint {
  x: number
  y: number
  z: number
}

/**
 * Ce qu'un etat declare pour un ruban : une bande en unites de rayon de boule.
 *
 * ── D'ou vient ce type (2026-10-31) ────────────────────────────────────
 * L'utilisateur : « 你能不能再扒一下原项目的 humming，里面那种肥厚的彩线 ».
 * Les particules de la ceinture de la source ne sont pas des points : chacune
 * laisse une TRAINEE, et cette trainee est une bande remplie dont l'epaisseur
 * croit du vieux vers le recent (`ribbon()`, animation.html l.1423). C'est cette
 * bande qui se lit comme « une matiere qui coule » et qu'un disque ne peut pas
 * imiter, quelle que soit sa taille.
 *
 * `width` est la largeur TOTALE a la TETE ; `taper` regle celle de la queue
 * (0,5 = la reference, 0 = pointe). Voir `bandPath`.
 */
export interface RibbonSpec {
  id: string
  /** points du ruban, du plus ANCIEN au plus RECENT, en unites de rayon de boule */
  pts: RibbonPoint[]
  /** largeur totale a la tete, en unites de rayon de boule */
  width: number
  /** facteur d'epaisseur a la queue (0 = pointe, 0,5 = reference) */
  taper?: number
  /**
   * Teinte de depart explicite, en degres. Ometttre pour un ruban de ceinture
   * (`hue` + `hueSpan`) ; la donner pour un FIAMENT colore ou l'on veut une
   * teinte fixe et un degrade qui s'eteint vers la queue.
   */
  hueFixed?: number
  /**
   * Nombre d'arrets de degrade. 3 (defaut) fait varier la teinte le long du
   * ruban — c'est la ceinture. 2 fait un degrade d'OPACITE a teinte constante,
   * ce qu'il faut pour un filament qui sort de la matiere et s'efface.
   */
  stops?: 2 | 3
  /** teinte au debut du trace, et derivee sur sa longueur */
  hue: number
  hueSpan: number
  opacity: number
}

/** Un ruban pret a peindre : deux bandes (devant / derriere) et un degrade. */
export interface RibbonRender {
  id: string
  front: string
  back: string
  /**
   * Largeur TOTALE a la tete, en unites de viewBox.
   *
   * Portee jusqu'au rendu et pas seulement consommee par lui : c'est la seule
   * mesure de « grosseur » de la bande, et sans elle un test ne peut rien dire
   * de la demande « 肥厚 » (l'epaisseur varie le long du trace, donc elle ne se
   * lit ni dans le path ni dans l'opacite).
   */
  width: number
  opacity: number
  grad: { x1: number; y1: number; x2: number; y2: number; stops: string[] }
}

/**
 * Construit la BANDE d'une trainee, coupee en deux par la profondeur.
 *
 * ── Pourquoi une bande et pas un trait epais ──────────────────────────
 * Un `stroke` a une largeur CONSTANTE : il se lit comme une corde. La reference
 * fait varier l'epaisseur le long de la trainee (`U * (0.5 + 0.5 * i / (n-1))`),
 * donc la queue est deux fois plus fine que la tete. C'est ce profil qui donne
 * l'impression que la matiere s'accumule vers l'avant, et donc qu'elle COULE.
 *
 * `maxW` est la largeur TOTALE a la tete, en unites de viewBox. Elle est
 * plafonnee a `longueur * 0.34` : sur une trainee courte, une bande large se
 * replierait sur elle-meme et ferait une tache.
 *
 * ── `taperFrom` : queue epaisse ou queue en pointe (2026-10-31) ───────
 * `0,5` est le profil de la reference (queue = moitie de la tete) : c'est ce
 * qu'il faut pour une CEINTURE, ou la trainee est un morceau de matiere qui
 * passe. `0` fait une queue EN POINTE, ce qu'il faut pour un JET qui file vers
 * un point : une trainee qui s'effile jusqu'a zero se lit comme une vitesse,
 * une trainee qui s'arrete net a une largeur non nulle se lit comme un baton.
 * C'est la seule difference geometrique entre « la ceinture » de `humming` et
 * « les rayons » de `search` — le reste de la bande est identique, donc les deux
 * animations parlent bien le meme vocabulaire graphique.
 *
 * Les points sont coupes en runs de signe de `z` et chaque run est etendu d'un
 * point de chaque cote, sinon la couture entre devant et derriere laisse un
 * trou d'une demi-largeur.
 */
export function bandPath(
  pts: RibbonPoint[],
  maxW: number,
  taperFrom = 0.5
): { front: string; back: string } {
  const n = pts.length
  if (n < 3) return { front: '', back: '' }
  let total = 0
  for (let i = 1; i < n; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  if (total < 2) return { front: '', back: '' }

  const U = Math.min(maxW, total * 0.34)
  const off: { nx: number; ny: number; hw: number }[] = []
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(i - 1, 0)]
    const b = pts[Math.min(i + 1, n - 1)]
    let dx = b.x - a.x
    let dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    dx /= len
    dy /= len
    // epaisseur lineaire du vieux vers le recent
    const u = taperFrom + (1 - taperFrom) * (i / (n - 1))
    off.push({ nx: -dy, ny: dx, hw: (U * u) / 2 })
  }

  const q = (v: number) => Math.round(v * 10) / 10
  const run = (a: number, b: number): string => {
    let d = ''
    for (let k = a; k <= b; k++) {
      d += `${k === a ? 'M' : 'L'}${q(pts[k].x + off[k].nx * off[k].hw)} ${q(pts[k].y + off[k].ny * off[k].hw)}`
    }
    const rB = q(Math.max(off[b].hw, 0.2))
    if (b === n - 1) {
      d += `A${rB} ${rB} 0 0 0 ${q(pts[b].x - off[b].nx * off[b].hw)} ${q(pts[b].y - off[b].ny * off[b].hw)}`
    } else {
      d += `L${q(pts[b].x - off[b].nx * off[b].hw)} ${q(pts[b].y - off[b].ny * off[b].hw)}`
    }
    for (let k = b - 1; k >= a; k--) {
      d += `L${q(pts[k].x - off[k].nx * off[k].hw)} ${q(pts[k].y - off[k].ny * off[k].hw)}`
    }
    if (a === 0) {
      const rA = q(Math.max(off[a].hw, 0.2))
      d += `A${rA} ${rA} 0 0 0 ${q(pts[a].x + off[a].nx * off[a].hw)} ${q(pts[a].y + off[a].ny * off[a].hw)}`
    }
    return `${d}Z`
  }

  let front = ''
  let back = ''
  let i = 0
  while (i < n) {
    const isFront = pts[i].z >= 0
    let j = i
    while (j + 1 < n && pts[j + 1].z >= 0 === isFront) j++
    const a = Math.max(i - 1, 0)
    const b = Math.min(j + 1, n - 1)
    if (b > a) {
      const d = run(a, b)
      if (isFront) front += d
      else back += d
    }
    i = j + 1
  }
  return { front, back }
}

/**
 * Prepare un ruban pour le rendu : bandes mises a l'echelle et degrade de teinte.
 *
 * ── Pourquoi le degrade est pose en `userSpaceOnUse` et pas en boite ────
 * Contrairement aux rayons de `search` (dont le degrade suit la boite englobante
 * de la forme), un ruban est COURBE : sa boite englobante ne suit pas son axe.
 * Le degrade est donc oriente a la main, de la queue vers la tete — c'est-a-dire
 * le long de la trainee, ce qui est le sens de lecture du mouvement.
 *
 * La teinte tourne de `hue` a `hue + hueSpan` avec la MEME saturation et la meme
 * luminosite que les arcs 3D (`wheel`) : c'est ce qui fait que les rubans et les
 * orbites de la meme famille se lisent comme un seul vocabulaire graphique.
 */
export function ribbonRender(spec: RibbonSpec, scale: number): RibbonRender {
  const pts = spec.pts.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z }))
  const { front, back } = bandPath(pts, spec.width * scale, spec.taper ?? 0.5)
  const head = pts[pts.length - 1]
  const tail = pts[0]
  /*
   * Deux familles d'arrets, et le choix n'est pas cosmetique :
   *   · 3 arrets (defaut) : la TEINTE derive de la queue vers la tete. C'est la
   *     ceinture de `humming` / `loading`, ou le ruban est un morceau de matiere
   *     colore qui passe — il doit porter plusieurs couleurs a lui seul.
   *   · 2 arrets : la teinte est FIXE et seule l'OPACITE tombe vers la queue.
   *     C'est ce qu'il faut pour un filament de `search` : il file vers la bille
   *     et doit s'effacer en queue, pas changer de couleur en chemin. Un filament
   *     bicolore se lirait comme deux morceaux.
   */
  const stops =
    spec.stops === 2
      ? [wheel(spec.hueFixed ?? spec.hue), alphaAt(wheel(spec.hueFixed ?? spec.hue), 0)]
      : spec.hueFixed !== undefined
        ? [
            wheel(spec.hueFixed),
            wheel(spec.hueFixed + spec.hueSpan * 0.5),
            wheel(spec.hueFixed + spec.hueSpan)
          ]
        : [wheel(spec.hue), wheel(spec.hue + spec.hueSpan * 0.5), wheel(spec.hue + spec.hueSpan)]
  return {
    id: spec.id,
    front,
    back,
    width: spec.width * scale,
    opacity: spec.opacity,
    grad: { x1: r2(tail.x), y1: r2(tail.y), x2: r2(head.x), y2: r2(head.y), stops }
  }
}

/** `#rrggbb` + alpha -> `rgba(...)`, pour un arret de degrade transparent. */
function alphaAt(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

/**
 * Ce qu'un etat declare : la geometrie de l'arc reste en unites de rayon de
 * boule, c'est le moteur (seul a connaitre l'echelle du viewBox) qui la
 * rasterise. Sans ca les etats devraient connaitre le viewBox.
 */
export interface ArcSpec {
  id: string
  seed: ArcSeed
  t: number
  opacity: number
}

export interface ArcRender {
  id: string
  /** portion devant le corps */
  front: string
  /** portion derriere le corps (dessinee avant, donc masquee par la silhouette) */
  back: string
  width: number
  opacity: number
  /** degrade de teinte le long du trace */
  grad: { x1: number; y1: number; x2: number; y2: number; stops: string[] }
}

/**
 * Un cercle TRACE (stroke), pas rempli.
 *
 * ── Pourquoi un troisieme type de decor ─────────────────────────────────
 * Les deux systemes existants ne savent pas faire ca :
 *   · `ArcSeed` trace une ellipse 3D (grand axe + aplatissement + inclinaison)
 *     avec un degrade de teinte et un tri en profondeur. C'est fait pour les
 *     orbites, et ca coute 6 elements SVG par arc.
 *   · `DotRender` est un disque PLEIN.
 * Un anneau de radar / une jauge de progression / une onde de choc sont des
 * cercles concentriques au corps, d'epaisseur uniforme, sans 3D. Les forcer
 * dans `ArcSeed` obligerait a mettre `k = 1` et `sweep = 1`, et on paierait un
 * tri en profondeur et un degrade pour rien.
 *
 * ── Ce que ce type porte ────────────────────────────────────────────────
 * Le cercle est decrit en unites de rayon de boule comme le reste du decor :
 *   · `r`      : rayon du trace
 *   · `width`  : epaisseur du trait
 *   · `from`   : fraction du tour ou le trace COMMENCE (0 = 3 h, sens horaire)
 *   · `sweep`  : fraction du tour tracee (1 = cercle entier)
 * Un `sweep` de 1 est un anneau ferme ; en dessous c'est un arc, ce qui suffit
 * a faire la jauge de `progress`. L'angle zero est a midi et le sens est
 * horaire, comme le `rotate(-90)` de la reference.
 */
export interface RingRender {
  id: string
  /** rayon, en unites de rayon de boule */
  r: number
  /** epaisseur du trait, en unites de rayon de boule */
  width: number
  /** debut du trace, en fraction de tour depuis midi, sens horaire */
  from: number
  /** portion tracee, en fraction de tour */
  sweep: number
  opacity: number
  /** couleur explicite ; par defaut celle du corps */
  color?: string
}

/**
 * Trace un arc de cercle en coordonnees de viewBox.
 *
 * `scale` est le rayon de boule en unites de viewBox : c'est le seul a savoir
 * la taille de rendu, donc c'est lui qui convertit. Meme contrat que
 * `arcRender`.
 *
 * Le path est ecrit a la main plutot que via un `<circle>` + `stroke-dasharray`
 * parce qu'un `dasharray` devrait etre recalcule a chaque image de toute facon,
 * et que le path donne le meme resultat avec un seul attribut a mettre a jour.
 */
export function ringRender(ring: RingRender, scale: number): RingRender {
  // Le rayon et l'epaisseur sont deja dans l'unite qu'il faut ; on ne convertit
  // QUE ceux-la. Les fractions de tour sont sans dimension.
  return { ...ring, r: ring.r * scale, width: ring.width * scale }
}

/** Path SVG d'un arc de `RingRender`, centre sur `(cx, cy)` en unites de viewBox. */
export function ringPath(ring: RingRender, cx: number, cy: number): string {
  // Un anneau ferme n'a pas besoin d'un arc : deux cercles concentriques
  // reviendraient au meme et un seul `A` avec 0.999 tour laisse une couture
  // visible. On garde donc le cas plein a part.
  if (ring.sweep >= 0.999) {
    return `M${r2(cx - ring.r)} ${r2(cy)}A${r2(ring.r)} ${r2(ring.r)} 0 1 1 ${r2(cx + ring.r)} ${r2(cy)}A${r2(ring.r)} ${r2(ring.r)} 0 1 1 ${r2(cx - ring.r)} ${r2(cy)}`
  }
  const a0 = ring.from * TAU - Math.PI / 2
  const a1 = (ring.from + ring.sweep) * TAU - Math.PI / 2
  const x0 = cx + Math.cos(a0) * ring.r
  const y0 = cy + Math.sin(a0) * ring.r
  const x1 = cx + Math.cos(a1) * ring.r
  const y1 = cy + Math.sin(a1) * ring.r
  const large = ring.sweep > 0.5 ? 1 : 0
  return `M${r2(x0)} ${r2(y0)}A${r2(ring.r)} ${r2(ring.r)} 0 ${large} 1 ${r2(x1)} ${r2(y1)}`
}

/* --------------------------------------------------------- arc elliptique 3D */

export interface ArcSeed {
  /** demi-grand axe, en unites de rayon de boule */
  a: number
  /** aplatissement b/a : mesure <= 0.45, les plans d'orbite sont vus par la tranche */
  k: number
  /** inclinaison du grand axe a l'ecran, radians */
  tilt: number
  /** tours par seconde */
  speed: number
  phase: number
  /** fraction du tour reellement tracee */
  sweep: number
  hue: number
  hueSpan: number
  width: number
  cx: number
  cy: number
}

/**
 * 每条弧采样多少段。
 *
 * ── 为什么从 64 降到 24（实测，不是估算）──────────────────────────────
 * 弧的屏幕半径约 1.3R ≈ 130px，周长约 800px。64 段 = 每段约 12px，远超人眼
 * 与像素栅格能分辨的精度 —— 是纯浪费。`tools/probe-arc-precision.mjs` 量到：
 *
 *   N    6 弧 d 总长   相对 64   最大几何偏差
 *   64      4379        —        0.00 px
 *   32      2220      -49%       0.47 px
 *   24      1681      -62%       0.84 px   ← 取这个
 *   16      1144      -74%       1.89 px   ← 超过 1px，会露馅
 *
 * 判据是**偏差 < 1px**：那是像素层面画出来一样，砍了没人看得出。
 * 24 段是这条线以内最省的一档；再往下（16）偏差 1.89px 就过线了。
 *
 * ── 为什么这个改动值得做 ────────────────────────────────────────────
 * 弧是面板唯一的重量级元素（每条 = 1 渐变 + 3 stop + 2 path = 6 个元素，
 * 且 `d` 每帧全量重算）。`orbit` 峰值 41 元素/格，是 `sleep` 的 13.7 倍，
 * 而 **`reading` / `searching` 默认就映射到 `orbit`** —— 读文件和检索是
 * 最常见的活动，所以这条路径几乎总在被走到。
 *
 * 改这里只动几何精度，不动美术：弧的位置、粗细、颜色、转速全部不变。
 */
const ARC_SEGMENTS = 24

/**
 * Projette un cercle 3D incline en orthographique.
 *
 * Le cercle vit dans le plan engendre par u (dans l'ecran) et v (qui plonge
 * dans la profondeur). La composante z sert a couper l'arc en deux : la moitie
 * arriere est dessinee avant le corps, donc occultee par lui. C'est ce vrai tri
 * en profondeur qui fait lire les anneaux comme des orbites et pas comme un
 * dessin plat.
 */
export function arcRender(seed: ArcSeed, t: number, scale: number, id: string, opacity = 1): ArcRender {
  const spin = seed.phase + t * seed.speed * TAU
  const cu = Math.cos(seed.tilt)
  const su = Math.sin(seed.tilt)
  const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k))

  const N = ARC_SEGMENTS
  const span = seed.sweep * TAU
  let front = ''
  let back = ''
  let prev: boolean | null = null

  for (let i = 0; i <= N; i++) {
    const th = spin + (i / N) * span
    const ct = Math.cos(th)
    const st = Math.sin(th)
    // u = (cos tilt, sin tilt, 0) ; v = (-sin tilt * k, cos tilt * k, kz)
    const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx
    const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy
    const z = seed.a * st * kz

    const behind = z < 0
    const sx = r2(x * scale)
    const sy = r2(y * scale)
    const cmd = behind !== prev ? 'M' : 'L'
    if (behind) back += `${cmd}${sx} ${sy}`
    else front += `${cmd}${sx} ${sy}`
    prev = behind
  }

  const gx = Math.cos(seed.tilt) * seed.a * scale
  const gy = Math.sin(seed.tilt) * seed.a * scale
  return {
    id,
    front,
    back,
    width: seed.width * scale,
    opacity,
    grad: {
      x1: r2(seed.cx * scale - gx),
      y1: r2(seed.cy * scale - gy),
      x2: r2(seed.cx * scale + gx),
      y2: r2(seed.cy * scale + gy),
      stops: [wheel(seed.hue), wheel(seed.hue + seed.hueSpan * 0.5), wheel(seed.hue + seed.hueSpan)]
    }
  }
}

/* ---------------------------------------------------------------- anneaux */

const RING_RNG = createRng(0xa11ce)

/**
 * 6 anneaux, demi-grand axe 1.30-1.40 (donc nettement plus grands que la
 * boule), aplatissement toujours <= 0.45, epaisseur 0.055, ~3.3 tours/s.
 */
export const RINGS: ArcSeed[] = Array.from({ length: 6 }, (_, i) => ({
  a: 1.3 + RING_RNG() * 0.1,
  k: 0.05 + RING_RNG() * 0.4,
  tilt: (i / 6) * Math.PI + RING_RNG() * 0.5,
  speed: 3 + RING_RNG() * 0.7,
  phase: RING_RNG() * TAU,
  sweep: 0.6 + RING_RNG() * 0.25,
  hue: (i * 360) / 6 + RING_RNG() * 30,
  hueSpan: 60 + RING_RNG() * 60,
  width: 0.05 + RING_RNG() * 0.012,
  cx: 0,
  cy: 0.1
}))

/**
 * Un arc unique qui balaie le triangle juste avant les orbites.
 * Vu quasiment par la tranche (d'ou la forme en epingle a cheveux), rmax 1.37.
 *
 * ── UN seul arc, et non quatre (2026-10-29) ───────────────────────────
 * Le releve donnait quatre arcs emboites (a de 0.78 a 1.38, teintes espacees de
 * 62°). A la taille d'affichage ils se lisent comme « plusieurs traits fins mais
 * assez homogenes » — l'utilisateur les a juges redondants et a demande d'en
 * garder un seul.
 *
 * ── Pourquoi on garde le PLUS EXTERIEUR (a = 1.38) ────────────────────
 * Le premier essai gardait le plus interieur (a = 0.78) et le resultat etait
 * invisible : le corps de `play` est un TRIANGLE de rayon ~1.12, donc un arc a
 * 0.78 passe entierement dessous. A 96 px il ne restait qu'un point vert.
 * Les quatre arcs se soutenaient mutuellement : retirer les trois externes
 * laisse le seul qui ne se voit pas.
 *
 * `a = 1.38` est celui qui depasse le plus du triangle, donc celui qui porte
 * la lecture du mouvement. Planche : `tools/shoot-arc-final.mjs`.
 */
export const SWOOSH: ArcSeed[] = [
  {
    a: 1.38,
    k: 0.11,
    tilt: -0.47,
    speed: 0.3,
    phase: 0.18,
    sweep: 0.4,
    hue: 281,
    hueSpan: 100,
    // 0.07 : plus epais que les 0.05 d'origine — un seul trait de 0.05
    // disparait a 96 px, alors que les quatre se soutenaient mutuellement.
    width: 0.07,
    cx: 0,
    cy: -0.12
  }
]

/* ------------------------------------------------------------- 3 points */

/** x mesures : -0.557 / -0.013 / +0.532, y = 0. */
export const DOT_X = [-0.557, -0.013, 0.532] as const
export const DOT_R = 0.165
export const DOT_PEAK = 1.25

/* ------------------------------------------------------------ particules */

const P_RNG = createRng(0xbeef)

/** 5 particules, une nouvelle toutes les 0.2 s, duree de vie 0.55 s. */
const PARTICLES = Array.from({ length: 5 }, (_, i) => ({
  birth: i * 0.2,
  angle: P_RNG() * TAU,
  rho: 0.58 + P_RNG() * 0.18
}))

/**
 * Les particules ne partent pas en ligne droite : elles spiralent vers le
 * centre (rayon x0.75 par frame, angle +100 deg/s) en grossissant, et passent
 * derriere le noyau ou elles sont avalees.
 */
export function particles(t: number, scale: number, radialOffset = 0, dotScale = scale): DotRender[] {
  const out: DotRender[] = []
  for (const p of PARTICLES) {
    const u = t - p.birth
    if (u < 0 || u > 0.62) continue
    const sourceRho = p.rho * Math.pow(0.75, u * 10)
    // Keep the original birth position and darkness progression, but compensate
    // for a larger body only as the particle approaches its silhouette.
    const mergeOffset = radialOffset * clamp(u / 0.12) * clamp((0.54 - u) / 0.18)
    const rho = sourceRho * scale + mergeOffset
    const a = p.angle + (u * 100 * Math.PI) / 180
    out.push({
      x: Math.cos(a) * rho,
      y: Math.sin(a) * rho,
      r: (0.04 + 0.028 * clamp(u / 0.55)) * dotScale,
      depth: clamp(1 - sourceRho / 0.8),
      opacity: clamp(u / 0.06) * clamp((0.62 - u) / 0.08)
    })
  }
  return out
}

/* ------------------------------------------------------------------ comete */

/**
 * Contrairement a l'intuition, le point ne traverse pas l'ecran : il reste au
 * centre et c'est la trainee qui l'orbite. Ellipse a = 0.85, b = 0.15,
 * grand axe incline de +34deg, 4 rubans, ~210 deg/s.
 *
 * Les quatre rubans sont CONSERVES : c'est le rendu de reference choisi par
 * l'utilisateur (« 跑命令 的轨道最好看 »). Chacun a sa propre teinte, et c'est
 * leur superposition qui donne la bande arc-en-ciel epaisse.
 */
const COMET_RNG = createRng(0xc0e7)
export const COMET_RIBBONS: ArcSeed[] = Array.from({ length: 4 }, (_, i) => {
  const d = i - 1.5
  return {
    a: 0.85 * (1 + d * 0.03),
    // meme aplatissement a +-5 % pres : les rubans forment un faisceau serre
    k: (0.15 / 0.85) * (1 + d * 0.16),
    tilt: (34 * Math.PI) / 180 + d * 0.035,
    speed: 210 / 360,
    // dephasage mesure : 10 a 20 degres entre rubans, pas davantage
    phase: -i * 0.045 + COMET_RNG() * 0.012,
    sweep: 0.34,
    hue: i * 85 + COMET_RNG() * 20,
    hueSpan: 80,
    width: 0.095,
    cx: 0,
    cy: 0
  }
})

/** Rayon du point de la comete, mesure a 0.129. */
export const COMET_DOT = 0.129

/* --------------------------------------------------- pastille notification */

/** Bleu releve au pixel. */
export const NOTIF_BLUE = '#2496e8'
/** La pastille est posee exactement sur la circonference, a -42deg. */
export const NOTIF_ANGLE = -42
export const NOTIF_DIST = 1.003
/** Rayon au repos ; le pop culmine 14 % au-dessus. */
export const NOTIF_R = 0.15
export const NOTIF_POP = 1.14
/**
 * L'encoche est un disque concentrique a la pastille, soustrait du corps.
 * La marge est constante (0.054 R) et suit l'echelle du corps.
 */
export const NOTIF_MARGIN = 0.054

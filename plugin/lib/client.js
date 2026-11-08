window.__ModuleLoader__.load({
  id: "dsh-agents-bot",
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

    // grokbot/plugin/src/client/index.tsx
    var index_exports = {};
    __export(index_exports, {
      apply: () => apply,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);

    // grokbot/plugin/src/client/AvatarPanel.tsx
    var import_react6 = require("react");

    // grokbot/plugin/src/client/Bot.tsx
    var import_react = require("react");

    // grokbot/plugin/src/bot/math.ts
    var TAU = Math.PI * 2;
    var clamp = (v, lo = 0, hi = 1) => v < lo ? lo : v > hi ? hi : v;
    var lerp = (a, b, t) => a + (b - a) * t;
    var easings = {
      easeOutCubic: (t) => 1 - (1 - t) ** 3,
      easeInOutCubic: (t) => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2,
      easeOutQuint: (t) => 1 - (1 - t) ** 5
    };
    function loopNoise(t, period, seed = 0) {
      const p = t / period * TAU;
      return 0.55 * Math.sin(p + seed) + 0.3 * Math.sin(2 * p + seed * 1.7 + 1.1) + 0.15 * Math.sin(3 * p + seed * 2.3 + 2.4);
    }
    function createRng(seed) {
      let a = seed >>> 0;
      return () => {
        a = a + 1831565813 >>> 0;
        let t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    var r2 = (v) => Math.round(v * 100) / 100;

    // grokbot/plugin/src/bot/decor.ts
    function wheel(hue, s = 0.55, l = 0.62) {
      const h = (hue % 360 + 360) % 360;
      const c = (1 - Math.abs(2 * l - 1)) * s;
      const x = c * (1 - Math.abs(h / 60 % 2 - 1));
      const m = l - c / 2;
      const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
      const hex = (v) => Math.round((v + m) * 255).toString(16).padStart(2, "0");
      return `#${hex(r)}${hex(g)}${hex(b)}`;
    }
    function bandPath(pts, maxW, taperFrom = 0.5) {
      const n = pts.length;
      if (n < 3) return { front: "", back: "" };
      let total = 0;
      for (let i2 = 1; i2 < n; i2++) total += Math.hypot(pts[i2].x - pts[i2 - 1].x, pts[i2].y - pts[i2 - 1].y);
      if (total < 2) return { front: "", back: "" };
      const U = Math.min(maxW, total * 0.34);
      const off = [];
      for (let i2 = 0; i2 < n; i2++) {
        const a = pts[Math.max(i2 - 1, 0)];
        const b = pts[Math.min(i2 + 1, n - 1)];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        dx /= len;
        dy /= len;
        const u = taperFrom + (1 - taperFrom) * (i2 / (n - 1));
        off.push({ nx: -dy, ny: dx, hw: U * u / 2 });
      }
      const q = (v) => Math.round(v * 10) / 10;
      const run = (a, b) => {
        let d = "";
        for (let k = a; k <= b; k++) {
          d += `${k === a ? "M" : "L"}${q(pts[k].x + off[k].nx * off[k].hw)} ${q(pts[k].y + off[k].ny * off[k].hw)}`;
        }
        const rB = q(Math.max(off[b].hw, 0.2));
        if (b === n - 1) {
          d += `A${rB} ${rB} 0 0 0 ${q(pts[b].x - off[b].nx * off[b].hw)} ${q(pts[b].y - off[b].ny * off[b].hw)}`;
        } else {
          d += `L${q(pts[b].x - off[b].nx * off[b].hw)} ${q(pts[b].y - off[b].ny * off[b].hw)}`;
        }
        for (let k = b - 1; k >= a; k--) {
          d += `L${q(pts[k].x - off[k].nx * off[k].hw)} ${q(pts[k].y - off[k].ny * off[k].hw)}`;
        }
        if (a === 0) {
          const rA = q(Math.max(off[a].hw, 0.2));
          d += `A${rA} ${rA} 0 0 0 ${q(pts[a].x + off[a].nx * off[a].hw)} ${q(pts[a].y + off[a].ny * off[a].hw)}`;
        }
        return `${d}Z`;
      };
      let front = "";
      let back = "";
      let i = 0;
      while (i < n) {
        const isFront = pts[i].z >= 0;
        let j = i;
        while (j + 1 < n && pts[j + 1].z >= 0 === isFront) j++;
        const a = Math.max(i - 1, 0);
        const b = Math.min(j + 1, n - 1);
        if (b > a) {
          const d = run(a, b);
          if (isFront) front += d;
          else back += d;
        }
        i = j + 1;
      }
      return { front, back };
    }
    function ribbonRender(spec, scale) {
      const pts = spec.pts.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z }));
      const { front, back } = bandPath(pts, spec.width * scale, spec.taper ?? 0.5);
      const head = pts[pts.length - 1];
      const tail = pts[0];
      const stops = spec.stops === 2 ? [wheel(spec.hueFixed ?? spec.hue), alphaAt(wheel(spec.hueFixed ?? spec.hue), 0)] : spec.hueFixed !== void 0 ? [
        wheel(spec.hueFixed),
        wheel(spec.hueFixed + spec.hueSpan * 0.5),
        wheel(spec.hueFixed + spec.hueSpan)
      ] : [wheel(spec.hue), wheel(spec.hue + spec.hueSpan * 0.5), wheel(spec.hue + spec.hueSpan)];
      return {
        id: spec.id,
        front,
        back,
        width: spec.width * scale,
        opacity: spec.opacity,
        grad: { x1: r2(tail.x), y1: r2(tail.y), x2: r2(head.x), y2: r2(head.y), stops }
      };
    }
    function alphaAt(hex, a) {
      const n = parseInt(hex.slice(1), 16);
      return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`;
    }
    function ringPath(ring, cx, cy) {
      if (ring.sweep >= 0.999) {
        return `M${r2(cx - ring.r)} ${r2(cy)}A${r2(ring.r)} ${r2(ring.r)} 0 1 1 ${r2(cx + ring.r)} ${r2(cy)}A${r2(ring.r)} ${r2(ring.r)} 0 1 1 ${r2(cx - ring.r)} ${r2(cy)}`;
      }
      const a0 = ring.from * TAU - Math.PI / 2;
      const a1 = (ring.from + ring.sweep) * TAU - Math.PI / 2;
      const x0 = cx + Math.cos(a0) * ring.r;
      const y0 = cy + Math.sin(a0) * ring.r;
      const x1 = cx + Math.cos(a1) * ring.r;
      const y1 = cy + Math.sin(a1) * ring.r;
      const large = ring.sweep > 0.5 ? 1 : 0;
      return `M${r2(x0)} ${r2(y0)}A${r2(ring.r)} ${r2(ring.r)} 0 ${large} 1 ${r2(x1)} ${r2(y1)}`;
    }
    var ARC_SEGMENTS = 24;
    function arcRender(seed, t, scale, id, opacity = 1) {
      const spin2 = seed.phase + t * seed.speed * TAU;
      const cu = Math.cos(seed.tilt);
      const su = Math.sin(seed.tilt);
      const kz = Math.sqrt(Math.max(0, 1 - seed.k * seed.k));
      const N = ARC_SEGMENTS;
      const span = seed.sweep * TAU;
      let front = "";
      let back = "";
      let prev = null;
      for (let i = 0; i <= N; i++) {
        const th = spin2 + i / N * span;
        const ct = Math.cos(th);
        const st = Math.sin(th);
        const x = seed.a * (ct * cu + st * -su * seed.k) + seed.cx;
        const y = seed.a * (ct * su + st * cu * seed.k) + seed.cy;
        const z = seed.a * st * kz;
        const behind = z < 0;
        const sx = r2(x * scale);
        const sy = r2(y * scale);
        const cmd = behind !== prev ? "M" : "L";
        if (behind) back += `${cmd}${sx} ${sy}`;
        else front += `${cmd}${sx} ${sy}`;
        prev = behind;
      }
      const gx = Math.cos(seed.tilt) * seed.a * scale;
      const gy = Math.sin(seed.tilt) * seed.a * scale;
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
      };
    }
    var RING_RNG = createRng(659918);
    var RINGS = Array.from({ length: 6 }, (_, i) => ({
      a: 1.3 + RING_RNG() * 0.1,
      k: 0.05 + RING_RNG() * 0.4,
      tilt: i / 6 * Math.PI + RING_RNG() * 0.5,
      speed: 3 + RING_RNG() * 0.7,
      phase: RING_RNG() * TAU,
      sweep: 0.6 + RING_RNG() * 0.25,
      hue: i * 360 / 6 + RING_RNG() * 30,
      hueSpan: 60 + RING_RNG() * 60,
      width: 0.05 + RING_RNG() * 0.012,
      cx: 0,
      cy: 0.1
    }));
    var SWOOSH = [
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
    ];
    var DOT_X = [-0.557, -0.013, 0.532];
    var DOT_R = 0.165;
    var DOT_PEAK = 1.25;
    var P_RNG = createRng(48879);
    var PARTICLES = Array.from({ length: 5 }, (_, i) => ({
      birth: i * 0.2,
      angle: P_RNG() * TAU,
      rho: 0.58 + P_RNG() * 0.18
    }));
    function particles(t, scale, radialOffset = 0, dotScale = scale) {
      const out = [];
      for (const p of PARTICLES) {
        const u = t - p.birth;
        if (u < 0 || u > 0.62) continue;
        const sourceRho = p.rho * Math.pow(0.75, u * 10);
        const mergeOffset = radialOffset * clamp(u / 0.12) * clamp((0.54 - u) / 0.18);
        const rho = sourceRho * scale + mergeOffset;
        const a = p.angle + u * 100 * Math.PI / 180;
        out.push({
          x: Math.cos(a) * rho,
          y: Math.sin(a) * rho,
          r: (0.04 + 0.028 * clamp(u / 0.55)) * dotScale,
          depth: clamp(1 - sourceRho / 0.8),
          opacity: clamp(u / 0.06) * clamp((0.62 - u) / 0.08)
        });
      }
      return out;
    }
    var COMET_RNG = createRng(49383);
    var COMET_RIBBONS = Array.from({ length: 4 }, (_, i) => {
      const d = i - 1.5;
      return {
        a: 0.85 * (1 + d * 0.03),
        // meme aplatissement a +-5 % pres : les rubans forment un faisceau serre
        k: 0.15 / 0.85 * (1 + d * 0.16),
        tilt: 34 * Math.PI / 180 + d * 0.035,
        speed: 210 / 360,
        // dephasage mesure : 10 a 20 degres entre rubans, pas davantage
        phase: -i * 0.045 + COMET_RNG() * 0.012,
        sweep: 0.34,
        hue: i * 85 + COMET_RNG() * 20,
        hueSpan: 80,
        width: 0.095,
        cx: 0,
        cy: 0
      };
    });
    var COMET_DOT = 0.129;
    var NOTIF_ANGLE = -42;
    var NOTIF_DIST = 1.003;
    var NOTIF_R = 0.15;
    var NOTIF_POP = 1.14;
    var NOTIF_MARGIN = 0.054;

    // grokbot/plugin/src/bot/face.ts
    var EYE_SPLIT = 15.46;
    var EYE_W = 0.186;
    var EYE_H = 0.412;
    var REST_GAZE = { yaw: 28.49, pitch: 28.62, roll: -13 };
    var deg = (d) => d * Math.PI / 180;
    function spin(u, v, angle) {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      return [
        [u[0] * c + v[0] * s, u[1] * c + v[1] * s, u[2] * c + v[2] * s],
        [v[0] * c - u[0] * s, v[1] * c - u[1] * s, v[2] * c - u[2] * s]
      ];
    }
    function eyePoses(gaze, scale, split = EYE_SPLIT) {
      let f = [0, 0, 1];
      let right = [1, 0, 0];
      let down = [0, 1, 0];
      [f, right] = spin(f, right, deg(gaze.yaw));
      [down, f] = spin(down, f, deg(gaze.pitch));
      [right, down] = spin(right, down, deg(gaze.roll));
      const build = (side) => {
        const [ef, er] = spin(f, right, deg(split * side));
        return {
          x: ef[0] * scale,
          y: ef[1] * scale,
          a: er[0],
          b: er[1],
          c: down[0],
          d: down[1],
          depth: ef[2]
        };
      };
      return [build(-1), build(1)];
    }
    var BLINK_RNG = createRng(24301);
    var BLINKS = (() => {
      const out = [];
      let t = 1.4;
      while (t < 900) {
        out.push(t);
        t += 1.9 + BLINK_RNG() * 2.7;
        if (BLINK_RNG() < 0.18) {
          out.push(t);
          t += 0.24;
        }
      }
      return out;
    })();
    var BLINK_DUR = 0.18;
    var BLINK_PERIOD = 910;
    var BLINK_STILL_LID = 0.45;
    var BLINK_STILL_AT = BLINKS[0] + 0.45 * (1 - BLINK_STILL_LID) * BLINK_DUR;
    var EYES_OPEN_AT = Math.max(0, BLINKS[0] - 0.5);
    function blinkLid(t) {
      const phase = t >= 0 ? t % BLINK_PERIOD : t;
      for (let i = 0; i < BLINKS.length; i++) {
        const start = BLINKS[i];
        if (phase < start) break;
        const k = (phase - start) / BLINK_DUR;
        if (k >= 0 && k <= 1) {
          return k < 0.45 ? 1 - k / 0.45 : (k - 0.45) / 0.55;
        }
      }
      return 1;
    }
    function liveliness(t, opt = {}) {
      const { wander = 1, blink = true, float = true } = opt;
      return {
        dYaw: (loopNoise(t, 11.3, 0.4) * 5.5 + loopNoise(t, 3.7, 2.1) * 1.6) * wander,
        dPitch: (loopNoise(t, 9.1, 1.3) * 4.2 + loopNoise(t, 4.3, 0.7) * 1.3) * wander,
        dRoll: loopNoise(t, 13.7, 3.2) * 2.2 * wander,
        lid: blink ? blinkLid(t) : 1,
        // Au repos la video est quasiment immobile (centre stable a +-0.003, rayon
        // constant) : toute la vie passe par le regard et les clignements. On garde
        // juste de quoi ne pas figer completement l'image.
        driftX: float ? loopNoise(t, 7.9, 1.9) * 6e-3 : 0,
        driftY: float ? loopNoise(t, 5.3, 0.3) * 7e-3 : 0,
        // La largeur est constante, seule la hauteur respire tres legerement.
        breath: float ? 1 + Math.sin(t / 3.4 * Math.PI * 2) * 5e-3 : 1
      };
    }
    function blinkScale(lid) {
      return 0.06 + 0.94 * clamp(lid);
    }

    // grokbot/plugin/src/bot/expressions.ts
    var eye = (w, h, tilt = 0, open = 1) => ({ w, h, tilt, open });
    var pair = (w, h, tilt = 0, open = 1) => [
      eye(w, h, tilt, open),
      eye(w, h, -tilt, open)
    ];
    var EXPRESSIONS = [
      {
        // la pose relevée image par image sur la vidéo de référence
        id: "neutre",
        gaze: { ...REST_GAZE },
        split: EYE_SPLIT,
        eyes: [eye(EYE_W, EYE_H), eye(EYE_W, EYE_H)]
      },
      {
        id: "attentif",
        gaze: { yaw: 4, pitch: 5, roll: -4 },
        split: 16,
        eyes: pair(0.21, 0.44)
      },
      {
        id: "surpris",
        gaze: { yaw: 3, pitch: -3, roll: 0 },
        split: 19,
        eyes: pair(0.45, 0.47)
      },
      {
        id: "excite",
        gaze: { yaw: 6, pitch: -14, roll: 0 },
        split: 19.5,
        eyes: pair(0.4, 0.56, -10)
      },
      {
        // yeux plissés en arc : les hauts convergent légèrement
        id: "heureux",
        gaze: { yaw: 5, pitch: 9, roll: 0 },
        split: 17,
        eyes: pair(0.27, 0.17, 14)
      },
      {
        id: "hilare",
        gaze: { yaw: 4, pitch: 14, roll: 0 },
        split: 18,
        eyes: pair(0.34, 0.13, 20)
      },
      {
        // hauts des yeux qui convergent fort vers le centre + yeux étrécis
        id: "colere",
        gaze: { yaw: 3, pitch: 7, roll: 0 },
        split: 17,
        eyes: pair(0.34, 0.15, 30)
      },
      {
        // l'inverse : les hauts divergent, et le regard tombe
        id: "triste",
        gaze: { yaw: 3, pitch: -13, roll: 0 },
        split: 16,
        eyes: pair(0.22, 0.4, -28)
      },
      {
        id: "effraye",
        gaze: { yaw: 2, pitch: -20, roll: 0 },
        split: 20.5,
        eyes: pair(0.4, 0.6)
      },
      {
        // un œil franchement plus fermé que l'autre
        id: "mefiant",
        gaze: { yaw: 12, pitch: 6, roll: -6 },
        split: 16,
        eyes: [eye(0.21, 0.4), eye(0.22, 0.15)]
      },
      {
        // asymétrique sur les deux axes : tailles ET inclinaisons dépareillées.
        // L'œil plissé est volontairement plat (rapport 1,6) : à un rapport proche
        // de 1 il serait rond, et son inclinaison ne se verrait pas.
        id: "confus",
        gaze: { yaw: -14, pitch: 3, roll: 8 },
        split: 16.5,
        eyes: [eye(0.2, 0.44, -18), eye(0.28, 0.17, 14)]
      },
      {
        // la tête penche : c'est le roulis qui porte la curiosité
        id: "curieux",
        gaze: { yaw: 16, pitch: -9, roll: -15 },
        split: 16.5,
        eyes: [eye(0.24, 0.46, -8), eye(0.2, 0.38, -8)]
      },
      {
        id: "fier",
        gaze: { yaw: 5, pitch: 17, roll: 0 },
        split: 17,
        eyes: pair(0.3, 0.15, 18)
      },
      {
        id: "timide",
        gaze: { yaw: -19, pitch: -14, roll: -7 },
        split: 14,
        eyes: pair(0.17, 0.3)
      },
      {
        // fentes horizontales et regard qui part sur le côté
        id: "blase",
        gaze: { yaw: -22, pitch: 2, roll: 0 },
        split: 16,
        eyes: pair(0.3, 0.12)
      },
      {
        // paupières à moitié tombées : on passe par `open`, donc l'écrasement
        // vertical à l'écran, le même mécanisme que le clignement
        id: "somnolent",
        gaze: { yaw: 6, pitch: -9, roll: -3 },
        split: 16,
        eyes: pair(0.2, 0.42, 0, 0.42)
      }
    ];
    var EXPRESSION_BY_ID = new Map(EXPRESSIONS.map((e) => [e.id, e]));
    var DEFAULT_EXPRESSION = "neutre";
    var lerpEyeCfg = (a, b, t) => ({
      w: lerp(a.w, b.w, t),
      h: lerp(a.h, b.h, t),
      tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t),
      open: lerp(a.open, b.open, t)
    });
    function blendExpression(a, b, t) {
      return {
        id: b.id,
        gaze: {
          yaw: lerp(a.gaze.yaw, b.gaze.yaw, t),
          pitch: lerp(a.gaze.pitch, b.gaze.pitch, t),
          roll: lerp(a.gaze.roll, b.gaze.roll, t)
        },
        split: lerp(a.split, b.split, t),
        eyes: [lerpEyeCfg(a.eyes[0], b.eyes[0], t), lerpEyeCfg(a.eyes[1], b.eyes[1], t)]
      };
    }

    // grokbot/plugin/src/bot/profiles.ts
    var PROFILE_SAMPLES = 64;
    var PROFILES = {
      // oeuf : meme hauteur que la boule, retreci en largeur
      // image 164, empreinte mesuree 1.647 x 2.000
      egg: [0.8369, 0.8424, 0.8497, 0.8585, 0.8674, 0.8775, 0.8878, 0.8983, 0.9089, 0.9185, 0.9288, 0.9374, 0.9445, 0.9504, 0.9543, 0.9559, 0.9555, 0.9519, 0.9466, 0.9389, 0.9302, 0.9193, 0.9085, 0.8969, 0.8852, 0.8734, 0.8625, 0.8513, 0.8411, 0.8325, 0.8243, 0.8179, 0.8137, 0.8112, 0.8102, 0.8128, 0.8178, 0.8262, 0.8374, 0.8518, 0.8702, 0.8922, 0.9169, 0.9446, 0.9741, 1.0023, 1.0267, 1.0433, 1.0481, 1.0393, 1.0216, 0.997, 0.9697, 0.9418, 0.9169, 0.8949, 0.876, 0.8604, 0.849, 0.8394, 0.8337, 0.8314, 0.8305, 0.8326],
      // hexagone pointe en haut, coins tres arrondis
      // image 174, empreinte mesuree 1.826 x 2.011
      hexagon: [0.921, 0.9282, 0.9441, 0.9706, 0.9984, 1.0059, 0.9896, 0.9562, 0.929, 0.9124, 0.9047, 0.9058, 0.9157, 0.9349, 0.9642, 0.9873, 0.9882, 0.9665, 0.9336, 0.9105, 0.8968, 0.8918, 0.8955, 0.908, 0.9293, 0.9611, 0.982, 0.9812, 0.959, 0.9282, 0.9089, 0.8978, 0.8964, 0.9026, 0.9189, 0.9439, 0.9778, 0.999, 0.9964, 0.9713, 0.9439, 0.9274, 0.9196, 0.9206, 0.9308, 0.9502, 0.9799, 1.0121, 1.0226, 1.0071, 0.9752, 0.951, 0.9366, 0.9316, 0.9351, 0.9485, 0.9711, 1.0026, 1.0213, 1.0155, 0.9863, 0.9547, 0.9347, 0.9232],
      // triangle pointe en haut, coins tres arrondis
      // image 190, empreinte mesuree 1.995 x 1.884
      triangle: [0.7819, 0.8211, 0.8747, 0.944, 1.0223, 1.096, 1.1401, 1.134, 1.0808, 1.0047, 0.9265, 0.8603, 0.8104, 0.773, 0.745, 0.7273, 0.7151, 0.7118, 0.7148, 0.7245, 0.7427, 0.768, 0.8037, 0.8518, 0.9148, 0.9876, 1.0583, 1.1073, 1.1109, 1.0667, 0.994, 0.9164, 0.8482, 0.7948, 0.7555, 0.7261, 0.7056, 0.6925, 0.6859, 0.6869, 0.6938, 0.7084, 0.7305, 0.7615, 0.804, 0.8595, 0.9311, 1.0092, 1.0791, 1.1171, 1.1054, 1.0501, 0.9779, 0.905, 0.845, 0.799, 0.7656, 0.7413, 0.7258, 0.716, 0.7146, 0.7204, 0.733, 0.7528]
    };

    // grokbot/plugin/src/bot/shape.ts
    var ANGLES = Array.from({ length: PROFILE_SAMPLES }, (_, i) => i / PROFILE_SAMPLES * TAU);
    var COS = ANGLES.map(Math.cos);
    var SIN = ANGLES.map(Math.sin);
    function silhouette(name, pose = {}) {
      return {
        radii: [...PROFILES[name]],
        rot: 0,
        cx: 0,
        cy: 0,
        sx: 1,
        sy: 1,
        ...pose
      };
    }
    function circle(radius, pose = {}) {
      return {
        radii: new Array(PROFILE_SAMPLES).fill(radius),
        rot: 0,
        cx: 0,
        cy: 0,
        sx: 1,
        sy: 1,
        ...pose
      };
    }
    function blend(a, b, t, out) {
      const dst = out ?? { radii: new Array(PROFILE_SAMPLES), rot: 0, cx: 0, cy: 0, sx: 1, sy: 1 };
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        dst.radii[i] = lerp(a.radii[i] ?? 1, b.radii[i] ?? 1, t);
      }
      let dRot = b.rot - a.rot;
      while (dRot > Math.PI) dRot -= TAU;
      while (dRot < -Math.PI) dRot += TAU;
      dst.rot = a.rot + dRot * t;
      dst.cx = lerp(a.cx, b.cx, t);
      dst.cy = lerp(a.cy, b.cy, t);
      dst.sx = lerp(a.sx, b.sx, t);
      dst.sy = lerp(a.sy, b.sy, t);
      return dst;
    }
    function toPoints(s, scale, out = []) {
      const cr = Math.cos(s.rot);
      const sr = Math.sin(s.rot);
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        const r = s.radii[i] ?? 1;
        const x = r * (COS[i] ?? 0);
        const y = r * (SIN[i] ?? 0);
        const rx = x * cr - y * sr;
        const ry = x * sr + y * cr;
        const p = out[i] ?? { x: 0, y: 0 };
        p.x = (rx * s.sx + s.cx) * scale;
        p.y = (ry * s.sy + s.cy) * scale;
        out[i] = p;
      }
      out.length = PROFILE_SAMPLES;
      return out;
    }
    function closedPath(pts, tension = 1 / 6) {
      const n = pts.length;
      if (n < 3) return "";
      const first = pts[0];
      let d = `M${r2(first.x)} ${r2(first.y)}`;
      for (let i = 0; i < n; i++) {
        const p0 = pts[(i - 1 + n) % n];
        const p1 = pts[i];
        const p2 = pts[(i + 1) % n];
        const p3 = pts[(i + 2) % n];
        const c1x = p1.x + (p2.x - p0.x) * tension;
        const c1y = p1.y + (p2.y - p0.y) * tension;
        const c2x = p2.x - (p3.x - p1.x) * tension;
        const c2y = p2.y - (p3.y - p1.y) * tension;
        d += `C${r2(c1x)} ${r2(c1y)} ${r2(c2x)} ${r2(c2y)} ${r2(p2.x)} ${r2(p2.y)}`;
      }
      return `${d}Z`;
    }
    function profileFromPolygon(poly, cx, cy) {
      const radii = new Array(PROFILE_SAMPLES).fill(0);
      const n = poly.length;
      for (let k = 0; k < PROFILE_SAMPLES; k++) {
        const dx = COS[k] ?? 0;
        const dy = SIN[k] ?? 0;
        let best = 0;
        for (let i = 0; i < n; i++) {
          const a = poly[i];
          const b = poly[(i + 1) % n];
          const ex = b.x - a.x;
          const ey = b.y - a.y;
          const den = dx * ey - dy * ex;
          if (Math.abs(den) < 1e-9) continue;
          const px = a.x - cx;
          const py = a.y - cy;
          const t = (px * ey - py * ex) / den;
          const u = (px * dy - py * dx) / den;
          if (t > best && u >= 0 && u <= 1) best = t;
        }
        radii[k] = best;
      }
      return radii;
    }
    function hullOfCircles(x1, y1, r1, x2, y2, r2v, steps = 96) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.hypot(dx, dy) || 1e-6;
      const base3 = Math.atan2(dy, dx);
      const spread = Math.acos(Math.max(-1, Math.min(1, (r1 - r2v) / dist)));
      const pts = [];
      for (let i = 0; i <= steps / 2; i++) {
        const a = base3 + spread + (TAU - 2 * spread) * i / (steps / 2);
        pts.push({ x: x1 + Math.cos(a) * r1, y: y1 + Math.sin(a) * r1 });
      }
      for (let i = 0; i <= steps / 2; i++) {
        const a = base3 - spread + 2 * spread * i / (steps / 2);
        pts.push({ x: x2 + Math.cos(a) * r2v, y: y2 + Math.sin(a) * r2v });
      }
      return pts;
    }
    function radiusAtAngle(radii, angle) {
      const n = radii.length;
      const t = (angle / TAU % 1 + 1) % 1 * n;
      const i = Math.floor(t);
      return lerp(radii[i % n] ?? 1, radii[(i + 1) % n] ?? 1, t - i);
    }
    function superellipseProfile(n, sx = 1, sy = 1) {
      return ANGLES.map((_, i) => {
        const c = Math.abs((COS[i] ?? 0) / sx) ** n;
        const s = Math.abs((SIN[i] ?? 0) / sy) ** n;
        return (c + s) ** (-1 / n);
      });
    }
    function unionOfCirclesProfile(circles) {
      const out = new Array(PROFILE_SAMPLES).fill(0);
      for (let i = 0; i < PROFILE_SAMPLES; i++) {
        const dx = COS[i] ?? 0;
        const dy = SIN[i] ?? 0;
        let best = 0;
        for (const c of circles) {
          const b = dx * c.x + dy * c.y;
          const disc = b * b - (c.x * c.x + c.y * c.y - c.r * c.r);
          if (disc < 0) continue;
          const t = b + Math.sqrt(disc);
          if (t > best) best = t;
        }
        out[i] = best;
      }
      return out;
    }
    function roundedPolygon(verts, rc, arcSteps = 10) {
      const n = verts.length;
      const out = [];
      const normal = (a, b) => {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        return Math.atan2(-dx / len, dy / len);
      };
      for (let i = 0; i < n; i++) {
        const prev = verts[(i - 1 + n) % n];
        const cur = verts[i];
        const next = verts[(i + 1) % n];
        const a0 = normal(prev, cur);
        const a1 = normal(cur, next);
        let d = a1 - a0;
        while (d > Math.PI) d -= TAU;
        while (d < -Math.PI) d += TAU;
        for (let k = 0; k <= arcSteps; k++) {
          const a = a0 + d * k / arcSteps;
          out.push({ x: cur.x + Math.cos(a) * rc, y: cur.y + Math.sin(a) * rc });
        }
      }
      return out;
    }
    function regularPolygonProfile(sides, radius, rc, rotationDeg = 0) {
      const rot = rotationDeg * Math.PI / 180;
      const verts = Array.from({ length: sides }, (_, i) => {
        const a = rot + i / sides * TAU;
        return { x: Math.cos(a) * (radius - rc), y: Math.sin(a) * (radius - rc) };
      });
      return profileFromPolygon(roundedPolygon(verts, rc), 0, 0);
    }
    function polyPath(pts, scale = 1) {
      if (pts.length < 3) return "";
      let d = "";
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        d += `${i === 0 ? "M" : "L"}${r2(p.x * scale)} ${r2(p.y * scale)}`;
      }
      return `${d}Z`;
    }
    function capsulePath(w, h) {
      const hw = Math.max(w, 0.01) / 2;
      const hh = Math.max(h, 0.01) / 2;
      const r = Math.min(hw, hh);
      return `M${r2(-hw)} ${r2(-hh + r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw + r)} ${r2(-hh)}L${r2(hw - r)} ${r2(-hh)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw)} ${r2(-hh + r)}L${r2(hw)} ${r2(hh - r)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(hw - r)} ${r2(hh)}L${r2(-hw + r)} ${r2(hh)}A${r2(r)} ${r2(r)} 0 0 1 ${r2(-hw)} ${r2(hh - r)}Z`;
    }

    // grokbot/plugin/src/bot/skins.ts
    function normalize(radii, max = 1) {
      const peak = Math.max(...radii);
      if (peak <= 0) return radii;
      const k = max / peak;
      return radii.map((r) => r * k);
    }
    var ANGLES2 = Array.from({ length: PROFILE_SAMPLES }, (_, i) => i / PROFILE_SAMPLES * Math.PI * 2);
    var pebble = normalize(
      ANGLES2.map((a) => 1 + 0.075 * Math.cos(2 * a + 0.5) + 0.035 * Math.cos(3 * a + 2.1)),
      1.02
    );
    var cloud = normalize(
      unionOfCirclesProfile([
        { x: -0.44, y: 0.2, r: 0.54 },
        { x: 0.46, y: 0.2, r: 0.5 },
        { x: 0.02, y: 0.3, r: 0.6 },
        { x: -0.24, y: -0.3, r: 0.48 },
        { x: 0.3, y: -0.24, r: 0.44 }
      ]),
      1.02
    );
    var droplet = normalize(
      profileFromPolygon(hullOfCircles(0, 0.28, 0.66, 0, -0.96, 0.05), 0, 0),
      1.04
    );
    var capsule = profileFromPolygon(hullOfCircles(-0.42, 0, 0.62, 0.42, 0, 0.62), 0, 0);
    var SHAPES = [
      { id: "cercle", radii: new Array(PROFILE_SAMPLES).fill(1) },
      { id: "galet", radii: pebble },
      // 1.15 et pas 1.02 : sur une superellipse le rayon maximal est la diagonale,
      // donc normaliser dessus donne une forme qui parait plus petite que le cercle.
      { id: "squircle", radii: normalize(superellipseProfile(4.2), 1.15) },
      { id: "capsule", radii: capsule },
      // -90deg : un sommet vers le haut de l'ecran (y est oriente vers le bas)
      { id: "triangle", radii: regularPolygonProfile(3, 1.12, 0.34, -90) },
      // 0deg : sommets a gauche et a droite, donc aretes du haut et du bas plates
      { id: "hexagone", radii: regularPolygonProfile(6, 1.04, 0.26, 0) },
      { id: "nuage", radii: cloud },
      { id: "goutte", radii: droplet },
      { id: "bouclier", radii: [0.76811, 0.76084, 0.75865, 0.76124, 0.76949, 0.78157, 0.79819, 0.81936, 0.84429, 0.87188, 0.90064, 0.92884, 0.95461, 0.97577, 0.98909, 0.99692, 1, 0.99692, 0.98909, 0.97577, 0.95461, 0.92884, 0.90064, 0.87188, 0.84429, 0.81936, 0.79819, 0.78157, 0.76949, 0.76124, 0.75865, 0.76084, 0.76811, 0.78193, 0.80077, 0.82766, 0.86222, 0.90641, 0.9606, 0.99446, 0.9967, 0.97565, 0.94769, 0.91951, 0.89461, 0.87383, 0.85854, 0.84954, 0.84691, 0.84954, 0.85854, 0.87383, 0.89461, 0.91951, 0.94769, 0.97565, 0.9967, 0.99446, 0.9606, 0.90641, 0.86222, 0.82766, 0.80077, 0.78193] },
      { id: "dome", radii: [0.83827, 0.86307, 0.89144, 0.92352, 0.96, 1, 0.98119, 0.86904, 0.77967, 0.7132, 0.66306, 0.62512, 0.59673, 0.57612, 0.56211, 0.55398, 0.55131, 0.55398, 0.56211, 0.57612, 0.59673, 0.62512, 0.66306, 0.7132, 0.77967, 0.86904, 0.98119, 1, 0.96, 0.92352, 0.89144, 0.86307, 0.83827, 0.81694, 0.79823, 0.78158, 0.76786, 0.75688, 0.74846, 0.74115, 0.73521, 0.73111, 0.72861, 0.72746, 0.7257, 0.72447, 0.72393, 0.72405, 0.7249, 0.72405, 0.72393, 0.72447, 0.7257, 0.72746, 0.72861, 0.73111, 0.73521, 0.74115, 0.74846, 0.75688, 0.76786, 0.78158, 0.79823, 0.81694] },
      { id: "arche", radii: [0.60275, 0.60566, 0.61456, 0.62987, 0.65241, 0.68345, 0.72492, 0.77974, 0.85241, 0.94916, 1, 0.94939, 0.90631, 0.875, 0.85373, 0.84137, 0.83732, 0.84137, 0.85373, 0.875, 0.90631, 0.94939, 1, 0.94917, 0.85242, 0.77974, 0.72492, 0.68345, 0.65241, 0.62987, 0.61456, 0.60567, 0.60275, 0.60567, 0.61456, 0.62987, 0.65241, 0.68345, 0.72028, 0.75943, 0.79668, 0.83115, 0.86223, 0.88946, 0.91243, 0.93074, 0.94404, 0.95213, 0.95507, 0.95213, 0.94404, 0.93074, 0.91243, 0.88946, 0.86223, 0.83115, 0.79668, 0.75943, 0.72028, 0.68345, 0.65241, 0.62987, 0.61456, 0.60566] },
      { id: "cylindre", radii: [0.75553, 0.75919, 0.77034, 0.78953, 0.81778, 0.85669, 0.90867, 0.97495, 1, 0.98632, 0.96465, 0.94201, 0.92188, 0.90609, 0.89305, 0.88555, 0.8841, 0.88555, 0.89305, 0.90609, 0.92188, 0.942, 0.96465, 0.98631, 1, 0.97495, 0.90868, 0.8567, 0.81779, 0.78954, 0.77034, 0.75919, 0.75554, 0.75919, 0.77034, 0.78954, 0.81779, 0.8567, 0.90868, 0.97495, 1, 0.98631, 0.96465, 0.942, 0.92188, 0.90609, 0.89305, 0.88555, 0.8841, 0.88555, 0.89305, 0.90609, 0.92188, 0.94201, 0.96465, 0.98632, 1, 0.97495, 0.90867, 0.85669, 0.81778, 0.78953, 0.77034, 0.75919] },
      { id: "gemme", radii: [0.99114, 0.97617, 0.9556, 0.93557, 0.91816, 0.90422, 0.89422, 0.88849, 0.88695, 0.8896, 0.89664, 0.90774, 0.92283, 0.94154, 0.9627, 0.98434, 0.99999, 0.98434, 0.96271, 0.94155, 0.92282, 0.90775, 0.89665, 0.88961, 0.88696, 0.8885, 0.89424, 0.90419, 0.91814, 0.93558, 0.95558, 0.97619, 0.99116, 0.97618, 0.95559, 0.93556, 0.91815, 0.9042, 0.89424, 0.8885, 0.88697, 0.88962, 0.89666, 0.90776, 0.92282, 0.94156, 0.96272, 0.98436, 1, 0.98435, 0.96271, 0.94156, 0.92283, 0.90775, 0.89665, 0.88961, 0.88696, 0.88849, 0.89423, 0.90423, 0.91817, 0.93555, 0.9556, 0.97616] },
      { id: "cristal", radii: [0.71233, 0.71577, 0.72628, 0.74438, 0.77102, 0.79921, 0.81963, 0.82976, 0.82937, 0.82635, 0.82946, 0.84072, 0.8607, 0.89044, 0.9306, 0.96686, 0.98329, 0.96688, 0.93063, 0.89048, 0.86074, 0.84076, 0.8295, 0.82638, 0.8294, 0.82977, 0.81962, 0.79919, 0.77098, 0.74435, 0.72625, 0.71574, 0.7123, 0.71574, 0.72625, 0.74435, 0.76733, 0.78944, 0.80688, 0.81852, 0.82437, 0.82553, 0.82878, 0.84003, 0.85999, 0.8897, 0.93081, 0.97924, 1, 0.97922, 0.93077, 0.88966, 0.85995, 0.83999, 0.82874, 0.8255, 0.82434, 0.81851, 0.80689, 0.78946, 0.76735, 0.74438, 0.72628, 0.71577] },
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
      { id: "oeuf", radii: normalize([...PROFILES.egg]) }
    ];
    var SHAPE_BY_ID = new Map(SHAPES.map((s) => [s.id, s]));
    var DEFAULT_SHAPE = "cercle";
    var COLORS = [
      { id: "encre", hex: "#0a0a0c" },
      { id: "brun", hex: "#8b5e3c" },
      { id: "rouge", hex: "#e8483f" },
      { id: "orange", hex: "#f08a24" },
      { id: "ambre", hex: "#f0b429" },
      { id: "vert", hex: "#3ecf8e" },
      { id: "turquoise", hex: "#2fbfa0" },
      { id: "bleu", hex: "#3b93f0" },
      { id: "violet", hex: "#8b5cf6" },
      { id: "rose", hex: "#e152b0" },
      { id: "gris", hex: "#a3a3a3" },
      { id: "creme", hex: "#f1efe9" }
    ];
    var COLOR_BY_ID = new Map(COLORS.map((c) => [c.id, c]));
    var DEFAULT_COLOR = "encre";
    function mixHex(from, to, t) {
      const parse = (h) => {
        const v = parseInt(h.slice(1), 16);
        return [v >> 16 & 255, v >> 8 & 255, v & 255];
      };
      const a = parse(from);
      const b = parse(to);
      const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
      return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
    }

    // grokbot/plugin/src/bot/overlay.ts
    var REF_R = 114.2705;
    var DECOR_R = {
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
    };
    var DOT_R_ORBIT = 12 / REF_R;
    var REACH = 0.888;
    var EXTERIOR_TRACK_SCALE = 1.45;
    var ORBIT_R = (REACH - DOT_R_ORBIT) * EXTERIOR_TRACK_SCALE;
    var BELT_DOT_R = 6.5 / REF_R;
    var PROGRESS_W = 5 / REF_R;
    var PROGRESS_R = REACH - PROGRESS_W / 2;
    var DOCK_R = REACH - 7 / REF_R;
    var DOCK_DIVE_S = 0.9;
    var DOCK_SPIN = 5.6;
    var SEND_DOT_R = 10 / REF_R;
    var SEND_TRACK_SCALE = 1.3;
    var SEND_TRAVEL = REACH / 0.92 * SEND_TRACK_SCALE;
    var RECV_TRACK_SCALE = 1.15;
    var RECV_TRAVEL = REACH / 0.79 * RECV_TRACK_SCALE;
    var SEND_S = 1.5;
    var RECV_S = 1.7;
    var CYCLE_ON_S = 2.5;
    var SMALL_BALL_R = 28 / REF_R * 1.22;
    var BODY = {
      small: SMALL_BALL_R,
      /** Legacy aliases for effects whose origin is the surface of the body. */
      loading: SMALL_BALL_R,
      bounce: 18 / REF_R,
      send: SMALL_BALL_R,
      receive: SMALL_BALL_R,
      hum: 28 / REF_R
    };
    var EXTERIOR_DOT_SCALE = BODY.small / (19 / REF_R);
    var outCubic = easings.easeOutCubic;
    function easeOutBack(n) {
      const m = n - 1;
      return 1 + 2.70158 * m * m * m + 1.70158 * m * m;
    }
    var ORBIT_MERGE_S = 0.9;
    function orbitDots(t, opacity, span) {
      const out = [];
      if (opacity <= 0.01) return out;
      const grow = easeOutBack(clamp(t / 0.45));
      const merge = span > ORBIT_MERGE_S ? clamp((t - (span - ORBIT_MERGE_S)) / ORBIT_MERGE_S) : 0;
      const pull = merge * merge;
      const spin2 = t * 1.7;
      for (let i = 0; i < 5; i++) {
        const a = spin2 + i * TAU / 5;
        const flatten = 0.56;
        const projection = Math.hypot(Math.sin(a), flatten * Math.cos(a));
        const contact = BODY.small / projection;
        const radius = ORBIT_R * grow + (contact - ORBIT_R * grow) * pull;
        const front = Math.cos(a);
        const depth = 0.5 + 0.5 * clamp(front);
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
        });
      }
      return out;
    }
    var RADAR_SPEED = 0.56;
    function radarRings(t, opacity, bodyR) {
      const out = [];
      if (opacity <= 0.01) return out;
      const grow = outCubic(clamp(t / 0.45));
      const far = REACH / 0.88;
      for (let i = 0; i < 3; i++) {
        const e = (t * RADAR_SPEED / 1.3 + i / 3) % 1;
        const r = bodyR + (far - bodyR) * e;
        out.push({
          id: `radar${i}`,
          r: r * grow,
          width: 3.4 / REF_R * (1 - e * 0.55) * grow,
          from: 0,
          sweep: 1,
          opacity: opacity * (1 - e) * 0.9
        });
      }
      return out;
    }
    function progressRings(t, opacity) {
      if (opacity <= 0.01) return [];
      const grow = easeOutBack(clamp(t / 0.45));
      const r = PROGRESS_R * grow;
      const width = PROGRESS_W * grow;
      const fill = clamp(t / (CYCLE_ON_S * 0.85));
      return [
        // le fond : present, mais presque transparent
        { id: "progBg", r, width, from: 0, sweep: 1, opacity: opacity * 0.16 },
        // l'arc : de midi jusqu'a `fill` du tour
        { id: "progArc", r, width, from: 0, sweep: Math.max(fill, 1e-3), opacity }
      ];
    }
    function dockDots(t, opacity, span) {
      const out = [];
      if (opacity <= 0.01) return out;
      const grow = outCubic(clamp(t / 0.45));
      const orbitR = DOCK_R;
      const diveAt = span - DOCK_DIVE_S;
      const dive = clamp((t - diveAt) / DOCK_DIVE_S);
      const sy = 95 / REF_R;
      const baseR = 7 / REF_R;
      for (let i = 0; i < 2; i++) {
        const sx = (i === 0 ? -82 : 82) / REF_R;
        const u = clamp((t - 0.2) / 0.9);
        if (u <= 0) continue;
        const k = u * u * (3 - 2 * u);
        const aSweep = Math.min(t, span - DOCK_DIVE_S) * DOCK_SPIN;
        const a = aSweep + i * Math.PI;
        const diveSmooth = dive * dive * (3 - 2 * dive);
        const rr = orbitR + (BODY.small - orbitR) * diveSmooth;
        const tx = Math.sin(a) * rr;
        const ty = -Math.cos(a) * rr * 0.5 + Math.sin(t * 3 + i) * 0.02 * (1 - diveSmooth);
        out.push({
          x: sx + (tx - sx) * k,
          y: sy + (ty - sy) * k,
          // rayon mesure : (7 + 3 * k) px ; et il gonfle legerement en plongeant,
          // comme une goutte qui se forme avant d'etre aspiree
          r: (baseR + 3 / REF_R * k) * grow * (1 + dive * 0.35),
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
        });
      }
      return out;
    }
    var SEND_SLOW = 0.8;
    var SEND_P = SEND_S / SEND_SLOW;
    var RECV_P = RECV_S / SEND_SLOW;
    var SHOCK_FAR = REACH * 0.94 * EXTERIOR_TRACK_SCALE;
    function sendDots(t, opacity) {
      const out = [];
      if (opacity <= 0.01) return out;
      const grow = outCubic(clamp(t / 0.45));
      const phase = (t / SEND_P % 1 + 1) % 1;
      const travel = clamp((phase - 0.18) / 0.55);
      const k = travel * travel * (3 - 2 * travel);
      const dist = SEND_TRAVEL * k;
      if (travel > 0 && travel < 1) {
        out.push({
          x: 0.74 * dist,
          y: -0.62 * dist,
          r: SEND_DOT_R * EXTERIOR_DOT_SCALE * (1 - k * 0.55) * grow,
          opacity: opacity * (1 - k * k) * grow
        });
        const trail = clamp((phase - 0.26) / 0.55);
        if (trail > 0 && trail < 1) {
          const kt = trail * trail * (0.4 + 0.6 * trail);
          out.push({
            x: 0.74 * SEND_TRAVEL * kt,
            y: -0.62 * SEND_TRAVEL * kt,
            r: 5 / REF_R * EXTERIOR_DOT_SCALE * (1 - kt * 0.6) * grow,
            opacity: opacity * 0.3 * (1 - kt) * grow
          });
        }
      }
      return out;
    }
    function sendRings(t, opacity) {
      if (opacity <= 0.01) return [];
      const phase = (t / SEND_P % 1 + 1) % 1;
      const u = clamp((phase - 0.18) / 0.3);
      if (u <= 0 || u >= 1) return [];
      return [
        {
          id: "shock",
          /*
           * L'anneau part de la taille de la bille et s'ouvre jusqu'a `SHOCK_FAR`,
           * au lieu des 0,48 R d'origine. Il demarre a `BODY.send` et non a 0,18 :
           * un anneau de choc nait SUR le corps qui le produit, il ne le traverse
           * pas.
           */
          r: BODY.send + (SHOCK_FAR - BODY.send) * outCubic(u),
          width: 2.8 / REF_R * EXTERIOR_DOT_SCALE * (1 - u),
          from: 0,
          sweep: 1,
          opacity: opacity * (1 - u) * 0.8
        }
      ];
    }
    function recvDots(t, opacity) {
      const out = [];
      if (opacity <= 0.01) return out;
      const grow = outCubic(clamp(t / 0.45));
      const cycle = Math.floor(t / RECV_P);
      const dir = -Math.PI * 0.5 + Math.sin(cycle * 2.399) * Math.PI * 0.75;
      const phase = (t / RECV_P % 1 + 1) % 1;
      const arrive = clamp(phase / 0.6);
      if (arrive >= 1) return out;
      const k = arrive * arrive * (3 - 2 * arrive);
      const dist = RECV_TRAVEL * (1 - k);
      const bow = 0.18 * RECV_TRACK_SCALE * Math.sin(arrive * Math.PI) * (1 - k * 0.7);
      out.push({
        x: Math.cos(dir) * dist - Math.sin(dir) * bow,
        y: Math.sin(dir) * dist + Math.cos(dir) * bow,
        r: (3.5 / REF_R + 6.5 / REF_R * k) * EXTERIOR_DOT_SCALE * grow,
        opacity: opacity * clamp(arrive * 3.5) * (0.3 + 0.7 * k) * grow
      });
      return out;
    }
    function recvRings(t, opacity) {
      if (opacity <= 0.01) return [];
      const phase = (t / RECV_P % 1 + 1) % 1;
      const u = clamp((phase - 0.58) / 0.32);
      if (u <= 0 || u >= 1) return [];
      return [
        {
          id: "recv",
          // meme echelle que l'anneau de choc de `sending`, en sens inverse : il
          // arrive de la portee du decor et se referme sur la bille
          r: BODY.receive + (SHOCK_FAR - BODY.receive) * (1 - outCubic(u)),
          width: 2.8 / REF_R * EXTERIOR_DOT_SCALE * (1 - u),
          from: 0,
          sweep: 1,
          opacity: opacity * (1 - u) * 0.8
        }
      ];
    }
    function ballOffset(t) {
      const BOUNCE_S = 0.62;
      const BOUNCE_H = 52 / REF_R;
      const START_H = 40 / REF_R;
      const ACC = 8 * BOUNCE_H / (BOUNCE_S * BOUNCE_S);
      const FALL_S = Math.sqrt(2 * START_H / ACC);
      let height;
      if (t < FALL_S) {
        height = START_H - 0.5 * ACC * t * t;
      } else {
        const c = ((t - FALL_S) / BOUNCE_S % 1 + 1) % 1;
        height = 4 * BOUNCE_H * c * (1 - c);
      }
      return START_H - height;
    }
    var LOADING_ABSORB_FRAC = 0.28;
    function loadingAbsorbAt(span) {
      return Math.max(0, span * (1 - LOADING_ABSORB_FRAC));
    }
    function loadingAbsorbFor(span) {
      return span * LOADING_ABSORB_FRAC;
    }
    var BELT_N = 5;
    var BELT_W = 0.16;
    var BELT_ARC = 1.5;
    var BELT_SPAWN_FIRST = 0.1;
    var BELT_SPAWN_STEP = 0.13;
    var BELT_SPAWN_DUR = 0.42;
    var BELT_SPIN = { loading: 3, humming: 2.6 };
    var BELT_RAMP_S = 0.5;
    function easeArea(a) {
      if (a <= 0) return 0;
      if (a >= 1) return 0.5;
      return a < 0.5 ? a * a * a * a : a + Math.pow(2 - 2 * a, 4) / 16 - 0.5;
    }
    function beltAngle(t, top) {
      const tt = Math.max(0, t);
      const a = Math.min(tt / BELT_RAMP_S, 1);
      return top * BELT_RAMP_S * easeArea(a) + top * Math.max(0, tt - BELT_RAMP_S);
    }
    function beltDots(t, opacity, bodyR, absorbAt = Infinity, absorbFor = 0.3) {
      const out = [];
      if (opacity <= 0.01) return out;
      const grow = outCubic(clamp(t / 0.45));
      const absorb = absorbAt === Infinity ? 0 : clamp((t - absorbAt) / absorbFor);
      if (absorbAt !== Infinity && absorb >= 1) return out;
      const pull = absorb * absorb;
      const DIVE_END = 0.3;
      const shrink = clamp((absorb - 0.95) / 0.05);
      const shrinkEase = shrink * shrink * (3 - 2 * shrink);
      for (let i = 0; i < 6; i++) {
        const ring = i % 2;
        const a = t * (1.1 + ring * 0.35) + i / 6 * TAU + ring * 0.8;
        const baseReach = (REACH - BELT_DOT_R) * (1 - ring * 0.12) * grow;
        const reach = baseReach * (1 + (EXTERIOR_TRACK_SCALE - 1) * (1 - absorb));
        const dist = absorbAt === Infinity ? reach : reach + (bodyR * DIVE_END - reach) * pull;
        out.push({
          x: Math.cos(a) * dist,
          y: Math.sin(a) * dist * (0.65 + ring * 0.2),
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
        });
      }
      return out;
    }
    function beltRibbons(t, opacity, bodyR, kind = "humming", absorbAt = Infinity, absorbFor = 0.2, retractAt = Infinity, retractFor = 0.5) {
      const out = [];
      if (opacity <= 0.01) return out;
      const absorb = absorbAt === Infinity ? 0 : clamp((t - absorbAt) / absorbFor);
      const pull = absorb * absorb;
      const ang = beltAngle(t, BELT_SPIN[kind]);
      const ret = retractAt === Infinity ? 0 : clamp((t - retractAt) / retractFor);
      const retEase = ret * ret * (3 - 2 * ret);
      const retractDelay = (idx) => retractAt === Infinity ? 0 : 0.16 * idx / Math.max(BELT_N - 1, 1);
      const planeTilt = 0.16 + 0.24 * draw(0, 3, 17);
      const planeRoll = -0.5 + 0.9 * draw(0, 4, 17);
      for (let i = 0; i < BELT_N; i++) {
        const spawnAt = BELT_SPAWN_FIRST + i * BELT_SPAWN_STEP;
        const born = clamp((t - spawnAt) / BELT_SPAWN_DUR);
        if (born <= 0) continue;
        const e = outCubic(born);
        const retI = retractAt === Infinity ? 0 : clamp((t - retractAt - retractDelay(i)) / retractFor);
        const retEaseI = retI * retI * (3 - 2 * retI);
        const tilt = planeTilt + (draw(i, 3, 41) - 0.5) * 0.09;
        const roll = planeRoll + (draw(i, 4, 41) - 0.5) * 0.12;
        const lam = ang + i / BELT_N * TAU + draw(i, 5, 17) * 0.18;
        const fullReach = REACH * (0.75 + 0.25 * i / (BELT_N - 1));
        const reach = bodyR + (fullReach - bodyR) * e;
        const rad = absorbAt === Infinity ? reach : reach + (bodyR - reach) * pull;
        const arc = BELT_ARC * (0.8 + 0.4 * draw(i, 6, 17));
        const w = BELT_W * (0.85 + 0.3 * (i / (BELT_N - 1))) * (1 - 0.72 * retEaseI * retEaseI);
        const pts = [];
        const STEPS = 14;
        for (let k = 0; k <= STEPS; k++) {
          const a = lam - arc * (1 - k / STEPS);
          const g = rad * Math.sin(a);
          const y = -rad * Math.cos(a) * Math.sin(tilt);
          const c = Math.cos(roll);
          const s = Math.sin(roll);
          pts.push({
            x: g * c - y * s,
            y: g * s + y * c,
            z: Math.cos(a) * Math.cos(tilt)
          });
        }
        const absorbTail = absorbAt === Infinity ? 1 : clamp(1 - absorb);
        const tail = absorbTail * (1 - retEaseI);
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
          hue: i * 360 / BELT_N + (draw(i, 7, 17) - 0.5) * 28,
          hueSpan: 60 + draw(i, 8, 17) * 60,
          opacity: opacity * (absorbAt === Infinity ? 1 : clamp((1 - absorb) / 0.25))
        });
      }
      return out;
    }
    var STAR_COLOR = "#f4c34e";
    var PALETTE = ["#f9705c", "#5b95f0", "#3fbe86", "#f5b13f", "#9a72ee", "#35c3bd"];
    var BURST_DRAG = -60 * Math.log(0.94);
    var BURST_G = 40 / REF_R;
    var BURST_REACH = 1.4;
    var BURST_START_MAX = 1;
    var BURST_TRAVEL_FULL = 360 / REF_R * ((1 - Math.exp(-BURST_DRAG * 0.85)) / BURST_DRAG);
    var BURST_SPEED = (BURST_REACH - BURST_START_MAX) / BURST_TRAVEL_FULL;
    function burstSpeedFor(from, power) {
      const span = Math.max(BURST_REACH - from, 0.05);
      return span / BURST_TRAVEL_FULL * (0.85 + 0.15 * power);
    }
    function burstFrom(from, a, surf, speed) {
      return {
        x: Math.cos(a) * from + Math.cos(a) * speed * surf,
        y: Math.sin(a) * from + Math.sin(a) * speed * surf
      };
    }
    function starPath(r) {
      const n = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const s = i % 2 === 0 ? 1 : 0.42;
        n.push(`${(Math.cos(a) * s * r).toFixed(3)} ${(Math.sin(a) * s * r).toFixed(3)}`);
      }
      return "M" + n.join("L") + "Z";
    }
    function draw(i, salt, seed) {
      const x = Math.sin(i * 127.1 + salt * 311.7 + seed * 74.7) * 43758.5453;
      return x - Math.floor(x);
    }
    function firework(t, at, count, power = 1, seed = 0, from = BURST_START_MAX) {
      const out = [];
      const age = t - at;
      if (age < 0 || age > 1.4) return out;
      const decay = 1 - Math.exp(-BURST_DRAG * age);
      const surf = decay / BURST_DRAG;
      const fall = (BURST_DRAG * age - 1 + Math.exp(-BURST_DRAG * age)) / (BURST_DRAG * BURST_DRAG);
      const speedK = burstSpeedFor(from, power);
      for (let i = 0; i < count; i++) {
        const r1 = draw(i, 0, seed);
        const r22 = draw(i, 1, seed);
        const r3 = draw(i, 2, seed);
        const max = 0.7 + r3 * 0.6;
        if (age > max) continue;
        const le = age / max;
        const a = i / count * TAU + (r1 - 0.5) * 0.7;
        const speed = (170 + r1 * 190) * speedK / REF_R;
        const kick = (20 + r3 * 55) / REF_R;
        const p = burstFrom(from, a, surf, speed);
        const x = p.x;
        const y = p.y - kick * surf + BURST_G * fall;
        const rPx = (3.5 + r22 * 4.5) / REF_R;
        const r = Math.max(rPx * (1 - le * 0.4) * 1.8, 0.5 / REF_R);
        const fade = le < 0.1 ? le / 0.1 : Math.pow(1 - (le - 0.1) / 0.9, 1.7);
        const star = r3 < 0.2;
        out.push({
          x,
          y,
          r,
          d: star ? starPath(r) : void 0,
          rot: star ? age * (r1 - 0.5) * 520 : void 0,
          color: star ? STAR_COLOR : PALETTE[Math.floor(r22 * PALETTE.length) % PALETTE.length],
          opacity: fade
        });
      }
      return out;
    }

    // grokbot/plugin/src/bot/states.ts
    var WAKE_SHAKE_START = 1.05;
    var WAKE_SHAKE_END = 2.55;
    var WAKE_BURST_AT = WAKE_SHAKE_START + 0.3;
    var pair2 = (w, h) => [
      { w, h, open: 1 },
      { w, h, open: 1 }
    ];
    function base(over = {}) {
      return {
        sil: circle(1),
        offX: 0,
        offY: 0,
        gaze: { ...REST_GAZE },
        split: EYE_SPLIT,
        eyes: pair2(EYE_W, EYE_H),
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
      };
    }
    function smallBall(r = BODY.small, facing = "left-up") {
      const gaze = facing === "front" ? { yaw: 0, pitch: 0, roll: 0 } : facing === "left-up" ? { ...REST_GAZE, yaw: -REST_GAZE.yaw, roll: -REST_GAZE.roll } : { ...REST_GAZE };
      return {
        sil: circle(r),
        gaze,
        eyes: pair2(EYE_W * r * 1.35, EYE_H * r * 1.35),
        split: EYE_SPLIT * r * 1.35
      };
    }
    var BAR_UPRIGHT_CY = -0.1875;
    var BAR_UPRIGHT = profileFromPolygon(
      hullOfCircles(0, -0.505, 0.132, 0, 0.13, 0.075),
      0,
      BAR_UPRIGHT_CY
    );
    var BAR_ITALIC = profileFromPolygon(hullOfCircles(0, -0.2535, 0.1345, 0, 0.2535, 0.1345), 0, 0);
    var barUpright = (pose = {}) => ({
      radii: [...BAR_UPRIGHT],
      rot: 0,
      cx: 0,
      cy: BAR_UPRIGHT_CY,
      sx: 1,
      sy: 1,
      ...pose
    });
    var barItalic = (pose = {}) => ({
      radii: [...BAR_ITALIC],
      rot: 0,
      cx: 0,
      cy: 0,
      sx: 1,
      sy: 1,
      ...pose
    });
    var TEAR = polyPath(hullOfCircles(0, 0, 0.118, 0, 0.172, 0.012));
    function dotPulse(t, index) {
      const p = ((t - index * 0.5) / 1.5 % 1 + 1) % 1;
      const k = p < 0.5 ? 0.5 - 0.5 * Math.cos(p * TAU) : 0;
      return clamp(k * 2);
    }
    var CELEBRATE_SLOW = 0.49;
    var STATES = [
      {
        id: "idle",
        mirrorX: true,
        duration: 2.4,
        morph: 0.45,
        blinkIn: false,
        baseFace: true,
        baseBody: true,
        pose: () => base()
      },
      {
        id: "thinking",
        duration: 2.6,
        morph: 0.4,
        baseFace: false,
        baseBody: false,
        blinkIn: true,
        pose: (t) => {
          const mid = dotPulse(t, 1);
          const emerge = 0.3 + 0.7 * easings.easeOutCubic(clamp(t / 0.3));
          return base({
            // la boule DEVIENT le point du milieu : le morph reste continu
            sil: circle(DOT_R * (1 + (DOT_PEAK - 1) * mid), { cx: DOT_X[1] }),
            eyeAlpha: 0,
            dots: [0, 2].map((i) => {
              const k = dotPulse(t, i);
              return {
                x: DOT_X[i] * emerge,
                y: 0,
                r: DOT_R * (1 + (DOT_PEAK - 1) * k),
                opacity: 0.55 + 0.45 * k
              };
            })
          });
        }
      },
      {
        id: "wink",
        duration: 1.6,
        morph: 0.3,
        blinkIn: true,
        baseFace: false,
        baseBody: true,
        pose: () => base({
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
        id: "wide",
        duration: 1.8,
        morph: 0.55,
        blinkIn: true,
        baseFace: false,
        baseBody: true,
        pose: () => base({
          gaze: { yaw: 6.92, pitch: -21.96, roll: 11.6 },
          split: 18.43,
          eyes: pair2(0.356, 0.875)
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
        id: "alert",
        duration: 2.4,
        // le "!" revient en place a 1.6 + 0.4
        minDuration: 2,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const p = clamp(t / 1.5);
          const travel = easings.easeInOutCubic(p) * 0.82 - 0.087;
          const back = t > 1.6 ? clamp((t - 1.6) / 0.4) : 0;
          const x = travel * (1 - back) + 0.1 * back;
          const buzz = Math.sin(t * 2.5 * TAU) * 5e-3;
          const tilt = 17.7 * Math.PI / 180;
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
                rot: tilt * 180 / Math.PI,
                opacity: 1
              }
            ]
          });
        }
      },
      {
        id: "notify",
        duration: 2.2,
        morph: 0.5,
        blinkIn: true,
        baseFace: false,
        baseBody: true,
        pose: (t) => {
          const p = clamp(t / 0.45);
          const pop = 1 + (NOTIF_POP - 1) * Math.sin(p * Math.PI) * (1 - p * 0.35);
          const r = NOTIF_R * (p < 1 ? pop : 1);
          const a = NOTIF_ANGLE * Math.PI / 180;
          return base({
            // le regard part a l'oppose de la pastille
            gaze: { yaw: -21.94, pitch: -5.82, roll: -12.2 },
            split: 18.89,
            eyes: pair2(0.505, 0.498),
            notif: {
              x: Math.cos(a) * NOTIF_DIST,
              y: Math.sin(a) * NOTIF_DIST,
              r,
              notch: r + NOTIF_MARGIN
            }
          });
        }
      },
      {
        /* Voir `alert` : renomme « 错误 » (l'id reste `exclaim`). */
        id: "exclaim",
        duration: 2,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: () => base({
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
        id: "bounce",
        duration: 2.4,
        morph: 0.5,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => base({
          // le point : rayon mesure 0.1585, centre mesure a +0.11
          sil: circle(0.1585, { cy: 0.11 + ballOffset(t) * 0.68 }),
          eyeAlpha: 0
        })
      },
      {
        id: "hexagon",
        duration: 1.6,
        morph: 0.4,
        baseFace: false,
        baseBody: false,
        blinkIn: true,
        pose: () => base({
          sil: silhouette("hexagon"),
          gaze: { yaw: 23.11, pitch: 24.42, roll: -13.3 },
          split: 13.37,
          eyes: pair2(0.177, 0.411)
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
        id: "play",
        duration: 2,
        morph: 0.5,
        baseFace: false,
        baseBody: true,
        blinkIn: true,
        pose: (t) => {
          const fade = clamp(t / 0.35) * clamp((2.2 - t) / 0.5);
          return base({
            // corps au repos : c'est `posed()` qui y met la forme choisie
            sil: circle(1),
            gaze: { yaw: 4, pitch: 5, roll: -4 },
            split: 16,
            eyes: pair2(0.21, 0.44),
            // le trait balaie de la droite vers la gauche par-dessus le corps :
            // c'est l'ancienne trajectoire de `SWOOSH`, conservee telle quelle
            arcs: SWOOSH.map((s, i) => ({
              id: `sw${i}`,
              seed: { ...s, cx: 0.45 - t * 0.42 },
              t,
              opacity: fade
            }))
          });
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
        id: "orbit",
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
          const fadeIn = clamp(t / 0.5);
          return base({
            // le corps devient la petite bille centrale
            ...smallBall(),
            eyeAlpha: 1,
            dots: orbitDots(t, fadeIn, 3).map((d) => ({ ...d, depth: void 0 })),
            rings: []
          });
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
        id: "radar",
        duration: 3,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const fade = clamp(t / 0.4) * clamp((3 - t) / 0.4);
          const r = BODY.small;
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
          });
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
        id: "progress",
        duration: 2.5,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const fade = clamp(t / 0.4) * clamp((2.5 - t) / 0.4);
          const r = BODY.small;
          return base({
            ...smallBall(r),
            rings: progressRings(t, fade)
          });
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
        id: "celebrate",
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
          const r = BODY.small;
          const ft = t * CELEBRATE_SLOW;
          const dots = [
            ...firework(ft, 0.05, 16, 0.95, 11, r),
            ...firework(ft, 0.05, 22, 1.1, 23, r)
          ];
          const breathe = 1 + Math.sin(t * 6.2) * 0.05;
          return base({
            ...smallBall(r),
            sil: circle(r * breathe, { cy: -Math.abs(Math.sin(t * 1.6)) * 0.025 }),
            dots
          });
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
        id: "loading",
        duration: 2.6,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const r = BODY.small;
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
          });
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
        id: "search",
        mirrorX: true,
        duration: 2.6,
        morph: 0.4,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const r = BODY.small;
          const fade = clamp(t / 0.4);
          return base({
            ...smallBall(r, "original"),
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
            ribbons: beltRibbons(t, fade, r, "humming", Infinity, 0.2, 1.85, 0.45)
          });
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
        id: "waking",
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
          let eyeOpen = 1;
          let cy = 0;
          let rot = 0;
          let yaw = REST_GAZE.yaw;
          let pitch = REST_GAZE.pitch;
          let roll = REST_GAZE.roll;
          let split = EYE_SPLIT;
          if (t < 0.55) {
            eyeOpen = 0.07;
            cy = 6 / 100;
          } else if (t < 1.05) {
            const k = easings.easeOutCubic(clamp((t - 0.55) / 0.5));
            eyeOpen = 0.07 + (0.55 - 0.07) * k;
            cy = 6 / 100 - 9 / 100 * k;
          } else if (t < 2.55) {
            const k = (t - WAKE_SHAKE_START) / (WAKE_SHAKE_END - WAKE_SHAKE_START);
            eyeOpen = 0.55 + 0.5 * clamp(k / 0.6);
            cy = -0.03 + 0.03 * easings.easeOutCubic(clamp(k));
          } else if (t < 2.85) {
            eyeOpen = 1.05 + 0.07 * easings.easeOutCubic(clamp((t - WAKE_SHAKE_END) / 0.25));
          } else {
            const et = clamp((t - 2.85) / 0.4);
            eyeOpen = 1.12 - 0.12 * easings.easeOutCubic(et);
          }
          const ok = clamp((t - WAKE_SHAKE_START) / (2.85 - WAKE_SHAKE_START));
          split = EYE_SPLIT * (1 + Math.sin(ok * Math.PI) * 0.18);
          if (t >= 2.85) {
            cy = Math.sin(clamp((t - 2.85) / (3.2 - 2.85)) * Math.PI) * 0.02;
          }
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
          });
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
        id: "sleeping",
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
          const settle = clamp(t / 2);
          const breath = Math.sin(t * 0.55);
          const half = EYE_W * 0.5;
          return base({
            sil: circle(1, {
              cy: 8 / 100 * settle + breath * 0.016,
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
          });
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
        id: "sending",
        duration: 3,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const fade = clamp(t / 0.4) * clamp((3 - t) / 0.4);
          const r = BODY.small;
          return base({
            ...smallBall(r),
            dots: sendDots(t, fade),
            rings: sendRings(t, fade)
          });
        }
      },
      {
        /*
         * La reception : l'inverse exact de `sending`. Un point arrive de
         * l'exterieur et se pose sur le corps, un anneau se referme.
         */
        id: "receiving",
        duration: 3,
        morph: 0.45,
        baseFace: false,
        baseBody: false,
        blinkIn: false,
        pose: (t) => {
          const fade = clamp(t / 0.4) * clamp((3 - t) / 0.4);
          const r = BODY.small;
          return base({
            ...smallBall(r),
            dots: recvDots(t, fade),
            rings: recvRings(t, fade)
          });
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
        id: "uploading",
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
          const r = BODY.small;
          const fadeIn = clamp(t / 0.4);
          return base({
            ...smallBall(r),
            // `3` = la duree de l'etat : `dockDots` y date sa plongee finale
            dots: dockDots(t, fadeIn, 3)
          });
        }
      },
      {
        id: "burst",
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
        bodyRest: (t) => Math.max(easings.easeOutQuint(clamp((t - 1.7) / 0.7)), 1 - clamp(t / 0.12)),
        pose: (t) => {
          const collapse = 1 - (1 - BODY.small) * easings.easeOutQuint(clamp(t / 0.7));
          const regrow = easings.easeOutQuint(clamp((t - 1.7) / 0.7));
          return base({
            ...smallBall(collapse + (1 - collapse) * regrow),
            // Eyes reappear only as the full-size body returns, so retain its normal eye size.
            eyes: pair2(EYE_W, EYE_H),
            split: EYE_SPLIT,
            eyeAlpha: clamp((t - 1.85) / 0.4),
            dots: particles(t, 1.45, BODY.small - 19 / REF_R, EXTERIOR_DOT_SCALE),
            dotsBehind: true
          });
        }
      },
      {
        id: "comet",
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
        bodyRest: (t) => Math.max(easings.easeOutQuint(clamp((t - 1.85) / 0.6)), 1 - clamp(t / 0.12)),
        pose: (t) => {
          const collapse = 1 - (1 - COMET_DOT) * easings.easeOutQuint(clamp(t / 0.55));
          const regrow = easings.easeOutQuint(clamp((t - 1.85) / 0.6));
          const fade = clamp((t - 0.15) / 0.25) * clamp((1.95 - t) / 0.3);
          return base({
            // Le point derive de 0.035 vers le bas puis remonte (wobble mesure).
            sil: circle(collapse + (1 - collapse) * regrow, {
              cy: Math.sin(clamp(t / 1.7) * Math.PI) * 0.035
            }),
            eyeAlpha: clamp((t - 2) / 0.35),
            arcs: COMET_RIBBONS.map((s, i) => ({ id: `cm${i}`, seed: s, t, opacity: fade }))
          });
        }
      }
    ];
    var STATE_BY_ID = new Map(STATES.map((s) => [s.id, s]));

    // grokbot/plugin/src/bot/eyefit.ts
    var R = 100;
    var DERIVE_YAW = 5.5 + 1.6;
    var DERIVE_PITCH = 4.2 + 1.3;
    var DERIVE_X = 6e-3;
    var DERIVE_Y = 7e-3;
    function empreintes(visage, sil, radii) {
      const out = [];
      const poses = eyePoses(visage.gaze, R, visage.split);
      for (let i = 0; i < 2; i++) {
        const e = poses[i];
        if (e.depth <= 0.02) continue;
        const cfg = visage.eyes[i];
        const phi = (cfg.tilt ?? 0) * Math.PI / 180;
        const cp = Math.cos(phi);
        const sp = Math.sin(phi);
        const ax = e.a * cp + e.c * sp;
        const ay = e.b * cp + e.d * sp;
        const cx = -e.a * sp + e.c * cp;
        const cy = -e.b * sp + e.d * cp;
        const hw = Math.max(cfg.w * R, 0.01) / 2;
        const hh = Math.max(cfg.h * R, 0.01) / 2;
        const r = Math.min(hw, hh);
        const long = hh > hw;
        const demi = long ? hh - r : hw - r;
        const fit = radiusAtAngle(radii, Math.atan2(e.y, e.x) - sil.rot);
        out.push({
          x: e.x * fit,
          y: e.y * fit,
          ax: (long ? cx : ax) * demi,
          ay: (long ? cy : ay) * demi,
          r,
          m: [ax, ay, cx, cy]
        });
      }
      return out;
    }
    function approche(pts, x0, y0, x1, y1) {
      const sx = x1 - x0;
      const sy = y1 - y0;
      const len2 = sx * sx + sy * sy;
      let best = Infinity;
      let vx = 0;
      let vy = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        let t = len2 > 0 ? ((p.x - x0) * sx + (p.y - y0) * sy) / len2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = x0 + t * sx - p.x;
        const ey = y0 + t * sy - p.y;
        const d2 = ex * ex + ey * ey;
        if (d2 < best) {
          best = d2;
          vx = ex;
          vy = ey;
        }
      }
      const d = Math.sqrt(best);
      return { d, ux: d > 1e-9 ? vx / d : 0, uy: d > 1e-9 ? vy / d : 0 };
    }
    var FLOTTEMENT = Math.hypot(DERIVE_X, DERIVE_Y) * R;
    function pire(pts, emps, tx, ty) {
      let marge = Infinity;
      let ux = 0;
      let uy = 0;
      for (const e of emps) {
        const x = e.x + tx;
        const y = e.y + ty;
        const a = approche(pts, x - e.ax, y - e.ay, x + e.ax, y + e.ay);
        const [m0, m1, m2, m3] = e.m;
        const rayon = e.r * Math.hypot(m0 * a.ux + m1 * a.uy, m2 * a.ux + m3 * a.uy) + FLOTTEMENT;
        if (a.d - rayon < marge) {
          marge = a.d - rayon;
          ux = a.ux;
          uy = a.uy;
        }
      }
      return { marge, ux, uy };
    }
    var DIRECTIONS = 12;
    var DICHOTOMIE = 8;
    function resous(epreuves) {
      if (!epreuves.length) return { x: 0, y: 0 };
      const marge = (tx, ty) => {
        let m = Infinity;
        for (const ep of epreuves) m = Math.min(m, pire(ep.contour, ep.empreintes, tx, ty).marge);
        return m;
      };
      let requis = Infinity;
      for (const ep of epreuves) {
        requis = Math.min(requis, pire(ep.calContour, ep.reference, 0, 0).marge);
      }
      let mx = 0;
      let my = 0;
      const emps = epreuves[0].empreintes;
      for (const e of emps) {
        mx -= e.x / emps.length;
        my -= e.y / emps.length;
      }
      const course = Math.max(0.35 * R, Math.hypot(mx, my) * 1.25);
      requis = Math.min(requis, marge(mx, my));
      const depart = marge(0, 0);
      if (depart >= requis && depart >= 0) return { x: 0, y: 0 };
      const cible = Math.max(requis, 0);
      let meilleurX = 0;
      let meilleurY = 0;
      let meilleureNorme = Infinity;
      let secoursX = 0;
      let secoursY = 0;
      let secours = depart;
      for (let d = 0; d < DIRECTIONS; d++) {
        const a = d / DIRECTIONS * Math.PI * 2;
        const ux = Math.cos(a);
        const uy = Math.sin(a);
        if (marge(ux * course, uy * course) < cible) {
          for (const k of [0.3, 0.6, 1]) {
            const m = marge(ux * course * k, uy * course * k);
            if (m > secours) {
              secours = m;
              secoursX = ux * course * k;
              secoursY = uy * course * k;
            }
          }
          continue;
        }
        let bas = 0;
        let haut = course;
        for (let i = 0; i < DICHOTOMIE; i++) {
          const mid = (bas + haut) / 2;
          if (marge(ux * mid, uy * mid) >= cible) haut = mid;
          else bas = mid;
        }
        if (haut < meilleureNorme) {
          meilleureNorme = haut;
          meilleurX = ux * haut;
          meilleurY = uy * haut;
        }
      }
      const x = meilleureNorme === Infinity ? secoursX : meilleurX;
      const y = meilleureNorme === Infinity ? secoursY : meilleurY;
      return { x: +(x / R).toFixed(6), y: +(y / R).toFixed(6) };
    }
    function visageDe(def, pose, expr) {
      if (def.baseFace && expr) return { gaze: expr.gaze, split: expr.split, eyes: expr.eyes };
      return { gaze: pose.gaze, split: pose.split, eyes: pose.eyes };
    }
    function dates(def) {
      const signature = (p) => JSON.stringify([p.gaze, p.split, p.eyes, p.sil.rot, p.sil.cx, p.sil.cy, p.sil.sx, p.sil.sy]);
      if (signature(def.pose(0)) === signature(def.pose(def.duration))) return [0];
      const n = 3;
      return Array.from({ length: n }, (_, i) => i / (n - 1) * def.duration);
    }
    function decalagePour(def, radii, expr) {
      const epreuves = [];
      for (const t of dates(def)) {
        const pose = def.pose(t);
        const contour = toPoints({ ...pose.sil, radii }, R);
        const calContour = toPoints(pose.sil, R);
        const v = visageDe(def, pose, expr);
        const coins = [];
        for (const dy of [-DERIVE_YAW, DERIVE_YAW]) {
          for (const dp of [-DERIVE_PITCH, DERIVE_PITCH]) {
            coins.push({
              ...v,
              gaze: { yaw: v.gaze.yaw + dy, pitch: v.gaze.pitch + dp, roll: v.gaze.roll }
            });
          }
        }
        for (const c of coins) {
          epreuves.push({
            empreintes: empreintes(c, pose.sil, radii),
            reference: empreintes(c, pose.sil, pose.sil.radii),
            contour,
            calContour
          });
        }
      }
      return resous(epreuves);
    }
    var NUL = { x: 0, y: 0 };
    var clef = (state2, expr) => `${state2}|${expr ?? ""}`;
    function batir() {
      return new Map(
        SHAPES.map((forme) => {
          const par = /* @__PURE__ */ new Map();
          for (const def of STATES) {
            if (!def.baseBody) continue;
            const expressions = def.baseFace ? [null, ...EXPRESSIONS] : [null];
            for (const expr of expressions) {
              par.set(clef(def.id, expr?.id ?? null), decalagePour(def, forme.radii, expr));
            }
          }
          return [forme.radii, par];
        })
      );
    }
    var DECALAGES = batir();
    function decalageDesYeux(radii, state2, expr) {
      if (!radii) return NUL;
      const par = DECALAGES.get(radii);
      if (!par) return NUL;
      return par.get(clef(state2, expr)) ?? par.get(clef(state2, null)) ?? NUL;
    }

    // grokbot/plugin/src/bot/mirror.ts
    function mirrorPose(pose) {
      const n = pose.sil.radii.length;
      if (n % 2 !== 0) throw new Error("horizontal reflection requires an even radial profile");
      const flipEye = (eye2) => eye2.tilt === void 0 ? { ...eye2 } : { ...eye2, tilt: -eye2.tilt };
      return {
        ...pose,
        sil: {
          ...pose.sil,
          // Screen y points down; reflection x -> -x maps theta to pi - theta.
          radii: pose.sil.radii.map((_, i) => pose.sil.radii[(n / 2 - i + n) % n]),
          rot: -pose.sil.rot,
          cx: -pose.sil.cx
        },
        offX: -pose.offX,
        gaze: { ...pose.gaze, yaw: -pose.gaze.yaw, roll: -pose.gaze.roll },
        spin: -pose.spin,
        eyes: [flipEye(pose.eyes[1]), flipEye(pose.eyes[0])],
        dots: pose.dots.map((dot) => ({ ...dot, x: -dot.x, ...dot.rot === void 0 ? {} : { rot: -dot.rot } })),
        ribbons: pose.ribbons.map((ribbon) => ({
          ...ribbon,
          pts: ribbon.pts.map((point) => ({ ...point, x: -point.x }))
        })),
        notif: pose.notif ? { ...pose.notif, x: -pose.notif.x } : null
      };
    }

    // grokbot/plugin/src/bot/engine.ts
    var NO_LOOK = { yaw: 0, pitch: 0, mix: 0, spin: 0, wander: 1 };
    var lerpLook = (a, b, t) => ({
      yaw: lerp(a.yaw, b.yaw, t),
      pitch: lerp(a.pitch, b.pitch, t),
      mix: lerp(a.mix, b.mix, t),
      spin: lerp(a.spin, b.spin, t),
      wander: lerp(a.wander, b.wander, t)
    });
    var lerpEye = (a, b, t) => ({
      w: lerp(a.w, b.w, t),
      h: lerp(a.h, b.h, t),
      open: lerp(a.open, b.open, t),
      tilt: lerp(a.tilt ?? 0, b.tilt ?? 0, t)
    });
    function blendAngle(a, b, t) {
      let d = b - a;
      while (d > Math.PI) d -= TAU;
      while (d < -Math.PI) d += TAU;
      return a + d * t;
    }
    function blendPose(a, b, t) {
      const out = 1 - t;
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
      };
    }
    var BotEngine = class _BotEngine {
      /** rayon de la boule au repos, en unites de viewBox */
      scale;
      cur;
      prev = null;
      /**
       * Pose de depart FIGEE, posee seulement quand un changement d'etat arrive alors qu'un
       * fondu est deja en cours. Cf. `setState`.
       */
      departFige = null;
      tCur = 0;
      tPrev = 0;
      blinkAt = -10;
      pts = [];
      shape = null;
      shapePrev = null;
      shapeAt = -10;
      /** Position des yeux figée lors du dernier changement d'apparence, par état. */
      decalagePrev = null;
      decalageAt = -10;
      expr = null;
      exprPrev = null;
      exprAt = -10;
      look = NO_LOOK;
      lookPrev = NO_LOOK;
      lookAt = -10;
      /** duree de rattrapage en cours ; voir `LOOK_MORPH`, sa valeur par defaut */
      lookMorph = 0.24;
      /** duree du morph quand on change la forme du corps */
      static SHAPE_MORPH = 0.45;
      /**
       * Duree de rattrapage du regard vers la cible. Plus court que `SHAPE_MORPH` :
       * un regard qui suit doit paraitre attentif, pas visqueux. Comme la cible est
       * reposee a chaque mouvement de souris, c'est cette duree qui donne au suivi
       * son inertie — le regard n'atteint jamais tout a fait un curseur qui bouge.
       */
      static LOOK_MORPH = 0.24;
      constructor(scale = 100, initial = "idle", shape = null, expression = null) {
        this.scale = scale;
        this.cur = initial;
        this.shape = shape;
        this.expr = expression;
      }
      /**
       * Expression de repos choisie dans le personnalisateur. Comme la forme, elle
       * glisse vers la nouvelle valeur au lieu de sauter.
       */
      setExpression(expression, now = 0) {
        if (expression === this.expr) return;
        if (this.decalagePrev && now - this.decalageAt < _BotEngine.SHAPE_MORPH || this.exprPrev && now - this.exprAt < _BotEngine.SHAPE_MORPH) {
          this.freezeDecalage(now);
        } else {
          this.decalagePrev = null;
        }
        this.exprPrev = this.exprAtTime(now);
        this.expr = expression;
        this.exprAt = now;
      }
      /** Expression effective a l'instant `now`, morph en cours compris. */
      exprAtTime(now) {
        const to = this.expr;
        const from = this.exprPrev;
        if (!to || !from) return to;
        const k = (now - this.exprAt) / _BotEngine.SHAPE_MORPH;
        if (k >= 1) return to;
        return blendExpression(from, to, easings.easeOutQuint(clamp(k)));
      }
      /**
       * Forme choisie dans le personnalisateur. Elle ne remplace le corps que sur
       * les etats au repos (`baseBody`) : sur les autres, la silhouette EST
       * l'animation et ne doit pas etre ecrasee.
       *
       * Le changement se fait en morph, pas d'un coup : comme toutes les formes sont
       * echantillonnees aux memes angles, il suffit d'interpoler les rayons.
       */
      setShape(radii, now = 0) {
        if (radii === this.shape) return;
        if (this.decalagePrev && now - this.decalageAt < _BotEngine.SHAPE_MORPH || this.shapePrev && now - this.shapeAt < _BotEngine.SHAPE_MORPH) {
          this.freezeDecalage(now);
        } else {
          this.decalagePrev = null;
        }
        this.shapePrev = this.shapeAtTime(now);
        this.shape = radii;
        this.shapeAt = now;
      }
      /**
       * Forme effective a l'instant `now`, morph en cours compris.
       *
       * Ne remet PAS `shapePrev` a null en fin de morph : `sample` doit rester une
       * fonction pure du temps, donc relire une date passee doit redonner l'image
       * intermediaire. On garde juste une reference de plus.
       */
      shapeAtTime(now) {
        const to = this.shape;
        const from = this.shapePrev;
        if (!to || !from) return to;
        const k = (now - this.shapeAt) / _BotEngine.SHAPE_MORPH;
        if (k >= 1) return to;
        const t = easings.easeOutQuint(clamp(k));
        return to.map((r, i) => lerp(from[i] ?? r, r, t));
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
      setLook(look2, now, morph = _BotEngine.LOOK_MORPH) {
        if (look2 && !Number.isFinite(look2.yaw + look2.pitch + look2.mix + look2.spin + look2.wander)) {
          return;
        }
        this.lookPrev = this.lookAtTime(now);
        this.look = look2 ?? NO_LOOK;
        this.lookAt = now;
        this.lookMorph = morph;
      }
      /** Regard effectif a l'instant `now`, rattrapage en cours compris. */
      lookAtTime(now) {
        const k = (now - this.lookAt) / this.lookMorph;
        if (k >= 1) return this.look;
        return lerpLook(this.lookPrev, this.look, easings.easeOutQuint(clamp(k)));
      }
      posed(def, t, shape, expr) {
        let pose = def.pose(t);
        if (def.baseBody && shape) {
          pose = { ...pose, sil: { ...pose.sil, radii: shape } };
        } else if (def.bodyRest && shape) {
          const w = clamp(def.bodyRest(t));
          if (w > 0) {
            const plat = pose.sil.radii.map((r, i) => r + (shape[i] - r) * w);
            pose = {
              ...pose,
              sil: {
                ...pose.sil,
                radii: plat,
                rot: pose.sil.rot * (1 - w),
                cx: pose.sil.cx * (1 - w),
                cy: pose.sil.cy * (1 - w)
              }
            };
          }
        }
        if (def.baseFace && expr) {
          pose = { ...pose, gaze: expr.gaze, split: expr.split, eyes: expr.eyes };
        }
        return def.mirrorX ? mirrorPose(pose) : pose;
      }
      /**
       * Geler la correction réellement affichée avant de changer une cible. Le rayon
       * interpolé n'a pas d'identité dans la table eyefit : seule sa correction
       * déjà interpolée peut servir d'origine à un morph interrompu.
       */
      freezeDecalage(now) {
        this.decalagePrev = new Map(STATES.map(({ id }) => [id, this.decalageAtTime(now, id)]));
        this.decalageAt = now;
      }
      /** Le chemin normal conserve les axes forme/expression independants. */
      decalageAtTime(now, state2) {
        const surAxe = (debut, duree, a, b) => {
          if (a === b) return b;
          const k = (now - debut) / duree;
          if (k >= 1) return b;
          const t = easings.easeOutQuint(clamp(k));
          return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
        };
        const eyeOffset = (radii, expression) => {
          const offset = decalageDesYeux(radii, state2, expression);
          return STATE_BY_ID.get(state2)?.mirrorX ? { x: -offset.x, y: offset.y } : offset;
        };
        if (this.decalagePrev) {
          const from = this.decalagePrev.get(state2);
          const to = eyeOffset(this.shape, this.expr?.id ?? null);
          return surAxe(this.decalageAt, _BotEngine.SHAPE_MORPH, from, to);
        }
        const parForme = (radii) => surAxe(
          this.exprAt,
          _BotEngine.SHAPE_MORPH,
          eyeOffset(radii, this.exprPrev?.id ?? null),
          eyeOffset(radii, this.expr?.id ?? null)
        );
        return surAxe(
          this.shapeAt,
          _BotEngine.SHAPE_MORPH,
          parForme(this.shapePrev),
          parForme(this.shape)
        );
      }
      get state() {
        return this.cur;
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
      reset(id, now) {
        this.cur = id;
        this.prev = null;
        this.departFige = null;
        this.tCur = now;
        this.tPrev = now;
        this.blinkAt = -10;
      }
      /**
       * Origine du fondu en cours : la pose figee s'il y en a une, sinon l'etat quitte evalue
       * a son propre temps ecoule — donc encore en train de s'animer, ce qui est voulu.
       */
      origine(now, shape, expr) {
        if (this.departFige) return this.departFige;
        if (!this.prev) return null;
        const prevDef = STATE_BY_ID.get(this.prev);
        return this.posed(prevDef, Math.max(0, now - this.tPrev), shape, expr);
      }
      /**
       * Pose composite a l'instant `now`, fondu en cours compris : exactement ce que `sample`
       * melange, avant la couche de vie au repos et de regard. Extraite pour que `setState`
       * puisse la figer.
       */
      poseComposee(now) {
        const def = STATE_BY_ID.get(this.cur);
        const shape = this.shapeAtTime(now);
        const expr = this.exprAtTime(now);
        const pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr);
        const since = now - this.tCur;
        if (since >= def.morph) return pose;
        const origine = this.origine(now, shape, expr);
        if (!origine) return pose;
        return blendPose(origine, pose, easings.easeOutQuint(clamp(since / def.morph)));
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
      setState(id, now) {
        if (id === this.cur) return;
        const morph = STATE_BY_ID.get(this.cur).morph;
        const enPleinFondu = this.prev !== null && now - this.tCur < morph;
        const oldDef = STATE_BY_ID.get(this.cur);
        const leavingLook = oldDef.mirrorX && oldDef.baseFace ? this.lookAtTime(now) : null;
        const pointerDeparture = leavingLook !== null && leavingLook.mix > 0;
        const departure = enPleinFondu || pointerDeparture ? this.poseComposee(now) : null;
        this.departFige = departure && pointerDeparture && leavingLook ? {
          ...departure,
          gaze: {
            ...departure.gaze,
            yaw: lerp(departure.gaze.yaw, leavingLook.yaw, leavingLook.mix) - leavingLook.spin,
            pitch: lerp(departure.gaze.pitch, leavingLook.pitch, leavingLook.mix)
          }
        } : departure;
        this.prev = this.cur;
        this.tPrev = this.tCur;
        this.cur = id;
        this.tCur = now;
        if (STATE_BY_ID.get(id)?.blinkIn) this.blinkAt = now;
      }
      sample(now) {
        const R3 = this.scale;
        const def = STATE_BY_ID.get(this.cur);
        const shape = this.shapeAtTime(now);
        const expr = this.exprAtTime(now);
        let pose = this.posed(def, Math.max(0, now - this.tCur), shape, expr);
        let decalage = this.decalageAtTime(now, this.cur);
        const since = now - this.tCur;
        const origine = since < def.morph ? this.origine(now, shape, expr) : null;
        if (origine) {
          const ratio = easings.easeOutQuint(clamp(since / def.morph));
          pose = blendPose(origine, pose, ratio);
          const quitte = this.prev;
          if (quitte) {
            const avant = this.decalageAtTime(now, quitte);
            decalage = {
              x: lerp(avant.x, decalage.x, ratio),
              y: lerp(avant.y, decalage.y, ratio)
            };
          }
        }
        const alive = pose.eyeAlpha > 0.01;
        const look2 = def.baseFace ? this.lookAtTime(now) : NO_LOOK;
        const pointerBlend = origine && def.mirrorX && def.baseFace ? easings.easeOutQuint(clamp(since / def.morph)) : 1;
        const lookMix = look2.mix * pointerBlend;
        const life = liveliness(now, { wander: alive ? look2.wander : 0, blink: alive });
        const horizontal = def.mirrorX ? -1 : 1;
        const gaze = {
          // Les deux visees REMPLACENT celles de la pose au lieu de s'y ajouter (voir
          // `Look`), et le tour se retranche en chemin. La derive s'ajoute APRES le
          // melange, sinon la cible l'annulerait en meme temps que la pose — or elle
          // doit survivre a une tete tournee sans pointeur.
          yaw: lerp(pose.gaze.yaw, look2.yaw, lookMix) + life.dYaw * horizontal - look2.spin * pointerBlend,
          pitch: lerp(pose.gaze.pitch, look2.pitch, lookMix) + life.dPitch,
          // le roulis, lui, ne suit rien : la tete du bot est penchee de -13deg dans
          // la video, et la faire rouler avec le curseur casse cette signature
          roll: pose.gaze.roll + life.dRoll * horizontal
        };
        const forced = clamp((now - this.blinkAt) / 0.2);
        const forcedLid = forced < 1 ? Math.abs(forced * 2 - 1) : 1;
        const lid = Math.min(life.lid, forcedLid);
        const offX = pose.offX + life.driftX * horizontal;
        const offY = pose.offY + life.driftY;
        const sil = {
          ...pose.sil,
          cx: pose.sil.cx + offX,
          cy: pose.sil.cy + offY,
          sy: pose.sil.sy * life.breath
        };
        const bodyPath = closedPath(toPoints(sil, R3, this.pts));
        const bodyRadius = (x, y) => radiusAtAngle(pose.sil.radii, Math.atan2(y, x) - pose.sil.rot);
        const eyes = [];
        if (pose.eyeAlpha > 0.01) {
          const poses = eyePoses(gaze, R3, pose.split);
          const cs = Math.cos(pose.spin);
          const sn = Math.sin(pose.spin);
          const rotX = (x, y) => x * cs - y * sn;
          const rotY = (x, y) => x * sn + y * cs;
          for (let i = 0; i < 2; i++) {
            const e = poses[i];
            if (e.depth <= 0.02) continue;
            const cfg = pose.eyes[i];
            const ex = rotX(e.x, e.y);
            const ey = rotY(e.x, e.y);
            const fit = bodyRadius(ex, ey);
            const phi = (cfg.tilt ?? 0) * Math.PI / 180;
            const cp = Math.cos(phi);
            const sp = Math.sin(phi);
            const ax = rotX(e.a * cp + e.c * sp, e.b * cp + e.d * sp);
            const ay = rotY(e.a * cp + e.c * sp, e.b * cp + e.d * sp);
            const cx2 = rotX(-e.a * sp + e.c * cp, -e.b * sp + e.d * cp);
            const cy2 = rotY(-e.a * sp + e.c * cp, -e.b * sp + e.d * cp);
            const k = blinkScale(Math.min(lid, cfg.open));
            eyes.push({
              d: capsulePath(cfg.w * R3, cfg.h * R3),
              matrix: `matrix(${r2(ax)},${r2(ay * k)},${r2(cx2)},${r2(cy2 * k)},${r2(ex * fit + (offX + decalage.x) * R3)},${r2(ey * fit + (offY + decalage.y) * R3)})`,
              alpha: pose.eyeAlpha * clamp(e.depth / 0.12)
            });
          }
        }
        const dots = pose.dots.filter((p) => p.opacity > 0.01 && p.r > 5e-4).map((p) => ({ ...p, x: (p.x + offX) * R3, y: (p.y + offY) * R3, r: p.r * R3 }));
        const nFit = pose.notif ? bodyRadius(pose.notif.x, pose.notif.y) : 1;
        const nx = pose.notif ? (pose.notif.x * nFit + offX) * R3 : 0;
        const ny = pose.notif ? (pose.notif.y * nFit + offY) * R3 : 0;
        const notif = pose.notif ? { x: nx, y: ny, r: pose.notif.r * R3 } : null;
        const notch = pose.notif ? { x: nx, y: ny, r: pose.notif.notch * R3 } : null;
        return {
          bodyPath,
          bodyAlpha: pose.bodyAlpha,
          eyes,
          dots,
          dotsBehind: pose.dotsBehind,
          // Les etats declarent des arcs en unites de rayon de boule ; le moteur
          // est le seul a connaitre l'echelle du viewBox, donc c'est lui qui trace.
          arcs: pose.arcs.filter((a) => a.opacity > 0.01).map((a) => arcRender(a.seed, a.t, R3, a.id, a.opacity)),
          // Les bandes : le moteur est le seul a connaitre l'echelle du viewBox, donc
          // c'est lui qui les rasterise en coordonnees de viewBox, comme les arcs.
          ribbons: pose.ribbons.filter((r) => r.opacity > 0.01 && r.pts.length >= 3).map((r) => ribbonRender(r, R3)),
          /*
           * Les anneaux sont des cercles TRACES centres sur le corps. Contrairement
           * aux arcs, ils n'ont pas de repere 3D : le rayon et l'epaisseur sont deja
           * dans l'unite de rayon de boule, donc seule la conversion d'echelle reste
           * a faire — et c'est le moteur qui la fait, comme pour les arcs.
           *
           * Le centre suit `offX`/`offY` : un anneau de radar doit rester centre sur
           * le corps meme quand l'etat le decale.
           */
          rings: pose.rings.filter((r) => r.opacity > 0.01 && r.sweep > 5e-4).map((r) => ({
            ...r,
            r: r.r * R3,
            width: r.width * R3,
            // les bornes du centre sont ajoutees ici pour que le rendu n'ait
            // qu'a tracer : le composant ne connait pas `offX`/`offY`
            cx: offX * R3,
            cy: offY * R3
          })),
          notif,
          notch
        };
      }
    };

    // grokbot/plugin/src/bot/repere.ts
    var RAYON = 100;
    var DEMI_VIEWBOX = 158;

    // grokbot/plugin/src/client/look.ts
    var DEFAULT_LOOK = {
      shape: DEFAULT_SHAPE,
      color: DEFAULT_COLOR,
      expression: DEFAULT_EXPRESSION,
      size: 96
    };
    var SHAPE_LABEL = {
      cercle: "圆",
      galet: "卵石",
      squircle: "圆角方",
      capsule: "胶囊",
      triangle: "三角",
      hexagone: "六边形",
      nuage: "云",
      goutte: "水滴",
      // 以下 6 个来自 grok-icon-study 的 animation.html，半径由
      // `tools/gen-shapes.mjs` 从它的 SVG path 转换而来（见 README
      // 《能不能把它的「编辑页面」搬进设置页》）。
      bouclier: "盾牌",
      dome: "穹顶",
      arche: "拱门",
      cylindre: "圆柱",
      gemme: "宝石",
      cristal: "晶体",
      oeuf: "蛋"
    };
    var COLOR_LABEL = {
      encre: "墨黑",
      brun: "棕",
      rouge: "红",
      orange: "橙",
      ambre: "琥珀",
      vert: "绿",
      turquoise: "青绿",
      bleu: "蓝",
      violet: "紫",
      rose: "粉",
      gris: "灰",
      creme: "奶油"
    };
    var EXPR_LABEL = {
      neutre: "中性",
      attentif: "专注",
      surpris: "惊讶",
      excite: "兴奋",
      heureux: "开心",
      hilare: "大笑",
      colere: "生气",
      triste: "难过",
      effraye: "害怕",
      mefiant: "戒备",
      confus: "困惑",
      curieux: "好奇",
      fier: "自豪",
      timide: "害羞",
      blase: "厌了",
      somnolent: "困倦"
    };
    var SHAPE_ORDER = [
      "cercle",
      "squircle",
      "hexagone",
      "nuage",
      "capsule",
      "triangle",
      "galet",
      "bouclier",
      "dome",
      "arche",
      "cylindre",
      "gemme",
      "cristal",
      // L'oeuf vient de l'ETAT `egg`, promu au rang de forme (2026-10-30) : il
      // arrive en fin de liste, a cote des autres formes « pleines » — sa place
      // naturelle, puisque rien ne le distingue d'une silhouette ordinaire.
      "oeuf",
      "goutte"
    ];
    var PRESET_SIZE = 8;
    var PRESET_MIN = 2;
    var PRESET_MAX = PRESET_SIZE;
    var COLOR_ORDER = [
      "encre",
      "brun",
      "rouge",
      "orange",
      "ambre",
      "vert",
      "turquoise",
      "bleu",
      "violet",
      "rose",
      "gris",
      "creme"
    ];
    var EXPRESSION_ORDER = [
      "neutre",
      "curieux",
      "confus",
      "attentif",
      "timide",
      "somnolent",
      "triste",
      "effraye",
      "surpris",
      "excite",
      "heureux",
      "hilare",
      "colere",
      "mefiant",
      "fier",
      "blase"
    ];
    var EXPRESSION_PRESET_ORDER = EXPRESSION_ORDER;
    var PRESET_DEFAULT = [
      { shape: "squircle", color: "brun", expression: "confus" },
      { shape: "hexagone", color: "rouge", expression: "curieux" },
      { shape: "nuage", color: "orange", expression: "attentif" },
      { shape: "cylindre", color: "ambre", expression: "timide" },
      { shape: "arche", color: "vert", expression: "somnolent" },
      { shape: "dome", color: "turquoise", expression: "blase" },
      { shape: "goutte", color: "bleu", expression: "effraye" },
      { shape: "oeuf", color: "violet", expression: "surpris" }
    ];
    function ordered(labels, order) {
      const out = {};
      for (const id of order) {
        const label = labels[id];
        if (label !== void 0) out[id] = label;
      }
      for (const [id, label] of Object.entries(labels)) {
        if (!(id in out)) out[id] = label;
      }
      return out;
    }
    var SHAPE_OPTIONS = ordered(SHAPE_LABEL, SHAPE_ORDER);
    var COLOR_OPTIONS = ordered(COLOR_LABEL, COLOR_ORDER);
    var EXPRESSION_OPTIONS = ordered(EXPR_LABEL, EXPRESSION_ORDER);
    var SHAPE_IDS = Object.keys(SHAPE_OPTIONS);
    function presetLookAt(index, base3, slots = PRESET_DEFAULT) {
      if (index <= 0) return base3;
      const table = slots.length ? slots : PRESET_DEFAULT;
      const slot = table[(index - 1) % table.length];
      return {
        ...base3,
        shape: slot.shape,
        color: slot.color ?? base3.color,
        expression: slot.expression
      };
    }
    function sanitizePreset(raw) {
      if (!Array.isArray(raw)) return PRESET_DEFAULT.map((r) => ({ ...r }));
      const out = [];
      for (const row2 of raw) {
        if (!row2 || typeof row2 !== "object") continue;
        const { shape, color, expression } = row2;
        if (typeof shape !== "string" || !(shape in SHAPE_LABEL)) continue;
        if (typeof expression !== "string" || !(expression in EXPR_LABEL)) continue;
        const fallbackColor = PRESET_DEFAULT[out.length]?.color ?? DEFAULT_LOOK.color;
        const safeColor = typeof color === "string" && color in COLOR_LABEL ? color : fallbackColor;
        out.push({ shape, color: safeColor, expression });
        if (out.length >= PRESET_MAX) break;
      }
      return out.length ? out : PRESET_DEFAULT.map((r) => ({ ...r }));
    }
    function inShapePreset(id, slots = PRESET_DEFAULT) {
      return slots.some((s) => s.shape === id);
    }
    function shapeRadiiOf(shape) {
      return SHAPE_BY_ID.get(shape)?.radii ?? null;
    }
    function inkOf(color) {
      return COLOR_BY_ID.get(color)?.hex ?? "#0a0a0c";
    }
    function expressionOf(id) {
      return EXPRESSIONS.find((e) => e.id === id) ?? null;
    }

    // grokbot/plugin/src/client/activities.ts
    var ACTIVITY_PRESENTATION = {
      idle: { label: "空闲", color: "#8db6a0" },
      thinking: { label: "思考中", color: "#5aa9e6" },
      reading: { label: "读文件", color: "#5aa9e6" },
      searching: { label: "检索中", color: "#5aa9e6" },
      running: { label: "跑命令", color: "#5aa9e6" },
      writing: { label: "写文件", color: "#5aa9e6" },
      compacting: { label: "压缩上下文", short: "压缩", color: "#5aa9e6" },
      background: { label: "后台任务", short: "后台", color: "#5aa9e6" },
      waiting: { label: "等待确认", short: "等待", color: "#f0b429" },
      done: { label: "刚完成", short: "完成", color: "#5aa9e6" },
      error: { label: "出错", color: "#e0563f" },
      spawning: { label: "启动中", short: "启动", color: "#5aa9e6" },
      sleep: { label: "休眠", color: "#8db6a0" }
    };
    var ACTIVITY_LABEL = Object.fromEntries(
      Object.entries(ACTIVITY_PRESENTATION).map(([activity, presentation]) => [activity, presentation.label])
    );
    var ACTIVITY_ORDER = [
      "idle",
      "thinking",
      "reading",
      "searching",
      "running",
      "writing",
      "compacting",
      "background",
      "waiting",
      "done",
      "error",
      "spawning",
      "sleep"
    ];
    var MAX_ROTATION_ITEMS = 2;
    var MIN_PLAYS = 1;
    var MAX_PLAYS = 20;
    var DEFAULT_ROTATION = {
      idle: [
        { state: "idle", plays: 1 },
        { state: "wink", plays: 1 }
      ],
      thinking: [
        { state: "burst", plays: 1 },
        { state: "wink", plays: 1 }
      ],
      reading: [
        { state: "receiving", plays: 1 },
        { state: "loading", plays: 1 }
      ],
      searching: [
        { state: "search", plays: 1 },
        { state: "wide", plays: 1 }
      ],
      running: [
        { state: "orbit", plays: 1 },
        { state: "radar", plays: 1 }
      ],
      /*
       * `writing` → `alert`（2026-10-31）。三个状态换了名字：`alert` 现在叫
       * 「写文件」，`exclaim` 叫「错误」，`play` 叫「环流」。活动映射跟着走，
       * 否则面板上会出现「写文件 · 环流」——名字对了，动画是另一回事。
       */
      writing: [
        { state: "alert", plays: 1 },
        { state: "sending", plays: 1 }
      ],
      compacting: [
        { state: "thinking", plays: 1 },
        { state: "celebrate", plays: 1 }
      ],
      background: [
        { state: "uploading", plays: 1 },
        { state: "idle", plays: 1 }
      ],
      waiting: [
        { state: "notify", plays: 1 },
        { state: "exclaim", plays: 1 }
      ],
      done: [
        { state: "play", plays: 1 },
        { state: "wink", plays: 1 }
      ],
      error: [
        { state: "exclaim", plays: 1 },
        { state: "progress", plays: 1 }
      ],
      /*
       * 启动中仍用「弹跳」(2026-10-30)：`egg` 被提升成了 FORME（见
       * `bot/skins.ts`，`oeuf`），形状不能放进轮播。用户选 `bounce` 的理由
       * 仍然成立 —— 一个点弹几下就说明「在起、还没站稳」。
       */
      spawning: [
        { state: "bounce", plays: 1 },
        { state: "idle", plays: 1 }
      ],
      sleep: [
        { state: "sleeping", plays: 1 },
        { state: "idle", plays: 1 }
      ]
    };
    var ACTIVITY_STATE = Object.fromEntries(
      ACTIVITY_ORDER.map((a) => [a, DEFAULT_ROTATION[a][0].state])
    );
    var SLEEP_OPTIONS = [
      { id: 5, label: "5 分钟" },
      { id: 10, label: "10 分钟" },
      { id: 15, label: "15 分钟" },
      { id: 30, label: "30 分钟" },
      { id: 60, label: "1 小时" },
      { id: 120, label: "2 小时" }
    ];
    var DEFAULT_SLEEP_MINUTES = 30;
    function activityOfTool(tool) {
      switch (tool) {
        case "read":
        case "read_image":
        case "knowledge_get_document":
          return "reading";
        case "grep":
        case "glob":
        case "web_search":
        case "web_fetch":
        case "anysearch_search":
        case "anysearch_batch_search":
        case "anysearch_capabilities":
        case "knowledge_search":
          return "searching";
        case "bash":
        case "pwsh":
        case "terminal_send":
        case "run_code":
          return "running";
        case "write":
        case "edit":
          return "writing";
        case "spawn_teammate":
        case "subagent":
        case "subagent_fork":
        case "workflow":
        case "ralph":
          return "spawning";
        case "ask_user_question":
          return "waiting";
        default:
          return "thinking";
      }
    }
    var ANIMATION_OPTIONS = [
      { id: "idle", label: "空闲" },
      { id: "thinking", label: "思考" },
      { id: "wink", label: "眨眼" },
      { id: "search", label: "检索" },
      { id: "wide", label: "等待" },
      /*
       * ── 2026-10-31：三个名字换了，画没动 ────────────────────────────────
       * 用户原话：「（写文件）的名字改成环流，（出错）的名字改成（写文件），
       * （惊叹）的名字改成（错误）」。
       *
       * 换的是**标签**，不是 id、不是美术。id 被量法表、老存盘、历史看板
       * （`turn*.html` 内联的是当时的引擎）引用着，动 id 等于断掉那些档案。
       *
       *   play    → 环流    （一条线扫过身体，本来就不像「写文件」）
       *   alert   → 写文件  （倾斜的「!」来回移动 + 抖动，像在落笔）
       *   exclaim → 错误    （竖着的「!」，一动不动，是报错的样子）
       *
       * 配套改了 `DEFAULT_ROTATION`：`writing` 活动指向 alert，`error` 活动指向
       * exclaim —— 否则面板上会出现「写文件 · 环流」这种字面冲突。
       */
      { id: "alert", label: "写文件" },
      { id: "notify", label: "完成" },
      { id: "exclaim", label: "错误" },
      { id: "bounce", label: "弹跳" },
      { id: "play", label: "环流" },
      { id: "orbit", label: "环绕" },
      { id: "radar", label: "雷达" },
      { id: "progress", label: "进度" },
      { id: "celebrate", label: "庆祝" },
      { id: "loading", label: "加载" },
      { id: "waking", label: "苏醒" },
      { id: "sleeping", label: "睡眠" },
      { id: "sending", label: "发送" },
      { id: "receiving", label: "接收" },
      { id: "uploading", label: "上传" },
      { id: "burst", label: "爆发" },
      { id: "comet", label: "跑命令" }
    ];

    // grokbot/plugin/src/client/rotation.ts
    var LABEL = new Map(ANIMATION_OPTIONS.map((o) => [o.id, o.label]));
    function playLengthOf(state2) {
      const def = STATE_BY_ID.get(state2);
      if (!def) return 2;
      return Math.max(def.duration, def.minDuration ?? 0);
    }
    function cycleLength(rotation2) {
      let sum = 0;
      for (const item of rotation2) sum += playLengthOf(item.state) * item.plays;
      return sum;
    }
    function slotAt(rotation2, startedAt, now) {
      if (rotation2.length === 0) return { state: "idle", elapsed: 0, pass: 0 };
      const total = cycleLength(rotation2);
      if (!(total > 0)) return { state: rotation2[0].state, elapsed: 0, pass: 0 };
      const raw = (now - startedAt) / 1e3;
      const t = (raw % total + total) % total;
      let acc = 0;
      for (const item of rotation2) {
        const span = playLengthOf(item.state) * item.plays;
        if (t < acc + span) {
          const into = t - acc;
          const one = playLengthOf(item.state);
          const pass = one > 0 ? Math.floor(into / one) : 0;
          return { state: item.state, elapsed: one > 0 ? into % one : 0, pass };
        }
        acc += span;
      }
      return { state: rotation2[0].state, elapsed: 0, pass: 0 };
    }
    function describeRotation(rotation2) {
      if (rotation2.length === 0) return "未配置";
      return `${describeShort(rotation2)}（一轮约 ${cycleLength(rotation2).toFixed(1)} 秒）`;
    }
    function describeShort(rotation2) {
      if (rotation2.length === 0) return "未配置";
      return rotation2.map((r) => `${LABEL.get(r.state) ?? STATE_BY_ID.get(r.state)?.id ?? r.state} ×${r.plays}`).join(" → ");
    }

    // grokbot/plugin/src/client/sharedFrameClock.ts
    var groups = /* @__PURE__ */ new Map();
    function groupFor(key) {
      let group = groups.get(key);
      if (!group) {
        group = { draws: /* @__PURE__ */ new Map(), pointers: /* @__PURE__ */ new Map(), pointer: { x: 0, y: 0, seen: false }, nextDraw: 0, raf: 0, timer: 0 };
        groups.set(key, group);
      }
      return group;
    }
    function forgetIfUnused(key, group) {
      if (group.draws.size === 0 && group.pointers.size === 0 && groups.get(key) === group) groups.delete(key);
    }
    function intervalOf(group) {
      const draws = [...group.draws.values()];
      if (draws.some((item) => !item.fps || item.fps <= 0)) return 0;
      return 1e3 / Math.max(...draws.map((item) => item.fps));
    }
    function cancelWake(group) {
      if (group.raf) cancelAnimationFrame(group.raf);
      if (group.timer) window.clearTimeout(group.timer);
      group.raf = 0;
      group.timer = 0;
    }
    function schedule(key, group, now) {
      if (groups.get(key) !== group || group.draws.size === 0 || group.raf || group.timer) return;
      const interval = intervalOf(group);
      const frame = (at) => {
        group.raf = 0;
        if (groups.get(key) !== group || group.draws.size === 0) return;
        const rate = intervalOf(group);
        if (rate > 0) {
          group.nextDraw += rate;
          if (group.nextDraw < at - rate) group.nextDraw = at + rate;
        }
        for (const [id, item] of [...group.draws]) if (group.draws.has(id)) item.step(at);
        schedule(key, group, at);
      };
      if (interval === 0 || group.nextDraw - now <= 1) {
        group.raf = requestAnimationFrame(frame);
      } else {
        group.timer = window.setTimeout(() => {
          group.timer = 0;
          if (groups.get(key) === group && group.draws.size > 0) group.raf = requestAnimationFrame(frame);
        }, group.nextDraw - now - 1);
      }
    }
    function subscribeSharedFrames(key, fps, step) {
      const group = groupFor(key);
      const id = Symbol(key);
      const previousRate = group.draws.size ? intervalOf(group) : null;
      group.draws.set(id, { fps, step });
      if (previousRate === null) group.nextDraw = performance.now();
      if (previousRate === null || previousRate !== intervalOf(group)) {
        cancelWake(group);
        schedule(key, group, performance.now());
      }
      return () => {
        if (!group.draws.has(id)) return;
        const priorRate = intervalOf(group);
        group.draws.delete(id);
        const nextRate = group.draws.size ? intervalOf(group) : null;
        if (nextRate === null || nextRate !== priorRate) {
          cancelWake(group);
          if (nextRate !== null) schedule(key, group, performance.now());
        }
        forgetIfUnused(key, group);
      };
    }
    function subscribeSharedPointer(key, update) {
      const group = groupFor(key);
      const id = Symbol(key);
      group.pointers.set(id, update);
      update(group.pointer);
      if (group.pointers.size === 1) {
        group.onMove = (event) => {
          if (event.pointerType === "touch") return;
          group.pointer = { x: event.clientX, y: event.clientY, seen: true };
          for (const listener of group.pointers.values()) listener(group.pointer);
        };
        group.onLeave = () => {
          group.pointer = { ...group.pointer, seen: false };
          for (const listener of group.pointers.values()) listener(group.pointer);
        };
        window.addEventListener("pointermove", group.onMove);
        document.addEventListener("pointerleave", group.onLeave);
      }
      return () => {
        if (!group.pointers.delete(id)) return;
        if (group.pointers.size === 0) {
          if (group.onMove) window.removeEventListener("pointermove", group.onMove);
          if (group.onLeave) document.removeEventListener("pointerleave", group.onLeave);
          group.onMove = void 0;
          group.onLeave = void 0;
          group.pointer = { ...group.pointer, seen: false };
        }
        forgetIfUnused(key, group);
      };
    }

    // grokbot/plugin/src/client/Bot.tsx
    var import_jsx_runtime = require("react/jsx-runtime");
    var VB = DEMI_VIEWBOX;
    var R2 = RAYON;
    var uidSeed = 0;
    function Frame({ frame, look: look2, paper, maskId, uid, inkOverride }) {
      const ink = inkOverride ?? inkOf(look2.color);
      const gradId = (i, behind) => `${uid}-d${behind ? "b" : "f"}${i}`;
      const dotAttrs = (dot, i, behind) => {
        const fill = dot.color ?? (dot.depth === void 0 ? ink : mixHex(paper, ink, dot.depth));
        const painted = dot.grad ? `url(#${gradId(i, behind)})` : fill;
        return dot.d ? {
          fill: painted,
          opacity: dot.opacity,
          d: dot.d,
          transform: `translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${R2})`
        } : { fill: painted, opacity: dot.opacity, cx: dot.x, cy: dot.y, r: dot.r };
      };
      const dotGrads = (behind) => frame.dots.map(
        (dot, i) => dot.grad ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "linearGradient",
          {
            id: gradId(i, behind),
            x1: "0",
            y1: "0",
            x2: "1",
            y2: "0",
            children: dot.grad.map((c, k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", { offset: k / Math.max(1, dot.grad.length - 1), stopColor: c }, k))
          },
          gradId(i, behind)
        ) : null
      );
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "mask",
            {
              id: maskId,
              maskUnits: "userSpaceOnUse",
              x: -VB,
              y: -VB,
              width: VB * 2,
              height: VB * 2,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: frame.bodyPath, fill: "#fff" }),
                frame.eyes.map((eye2, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "path",
                  {
                    d: eye2.d,
                    transform: eye2.matrix,
                    opacity: eye2.alpha,
                    fill: "#000"
                  },
                  i
                )),
                frame.notch ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "circle",
                  {
                    cx: frame.notch.x,
                    cy: frame.notch.y,
                    r: frame.notch.r,
                    fill: "#000"
                  }
                ) : null
              ]
            }
          ),
          dotGrads(true),
          dotGrads(false),
          frame.arcs.map((arc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "linearGradient",
            {
              id: `${uid}-${arc.id}`,
              gradientUnits: "userSpaceOnUse",
              x1: arc.grad.x1,
              y1: arc.grad.y1,
              x2: arc.grad.x2,
              y2: arc.grad.y2,
              children: arc.grad.stops.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "stop",
                {
                  offset: i / (arc.grad.stops.length - 1),
                  stopColor: c
                },
                i
              ))
            },
            arc.id
          )),
          frame.ribbons.map((rb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "linearGradient",
            {
              id: `${uid}-${rb.id}`,
              gradientUnits: "userSpaceOnUse",
              x1: rb.grad.x1,
              y1: rb.grad.y1,
              x2: rb.grad.x2,
              y2: rb.grad.y2,
              children: rb.grad.stops.map((c, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "stop",
                {
                  offset: i / (rb.grad.stops.length - 1),
                  stopColor: c
                },
                i
              ))
            },
            `rb${rb.id}`
          ))
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { fill: "none", strokeLinecap: "round", children: frame.arcs.map((arc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: arc.back,
            stroke: `url(#${uid}-${arc.id})`,
            strokeWidth: arc.width,
            opacity: arc.opacity
          },
          `b${arc.id}`
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { children: frame.ribbons.map((rb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: rb.back,
            fill: `url(#${uid}-${rb.id})`,
            opacity: rb.opacity
          },
          `rbB${rb.id}`
        )) }),
        frame.dotsBehind ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { children: frame.dots.map(
          (dot, i) => dot.d ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { ...dotAttrs(dot, i, true) }, `pb${i}`) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { ...dotAttrs(dot, i, true) }, `pb${i}`)
        ) }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { opacity: frame.bodyAlpha, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: frame.bodyPath, fill: paper }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { mask: `url(#${maskId})`, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", { x: -VB, y: -VB, width: VB * 2, height: VB * 2, fill: ink }) })
        ] }),
        !frame.dotsBehind ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { children: frame.dots.map(
          (dot, i) => dot.d ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { ...dotAttrs(dot, i, false) }, `pf${i}`) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { ...dotAttrs(dot, i, false) }, `pf${i}`)
        ) }) : null,
        frame.notif ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "circle",
          {
            cx: frame.notif.x,
            cy: frame.notif.y,
            r: frame.notif.r,
            fill: "#2496e8"
          }
        ) : null,
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { fill: "none", strokeLinecap: "round", children: frame.rings.map((ring) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: ringPath(ring, ring.cx, ring.cy),
            stroke: ring.color ?? ink,
            strokeWidth: ring.width,
            opacity: ring.opacity
          },
          `r${ring.id}`
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { fill: "none", strokeLinecap: "round", children: frame.arcs.map((arc) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: arc.front,
            stroke: `url(#${uid}-${arc.id})`,
            strokeWidth: arc.width,
            opacity: arc.opacity
          },
          `f${arc.id}`
        )) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("g", { children: frame.ribbons.map((rb) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "path",
          {
            d: rb.front,
            fill: `url(#${uid}-${rb.id})`,
            opacity: rb.opacity
          },
          `rbF${rb.id}`
        )) })
      ] });
    }
    function Bot({
      state: state2,
      rotation: rotation2,
      look: look2,
      frozenAt,
      paper = "#ffffff",
      ink,
      follow = false,
      frameGroup,
      fps
    }) {
      const uidRef = (0, import_react.useRef)("");
      if (uidRef.current === "") uidRef.current = `av${(uidSeed++).toString(36)}`;
      const uid = uidRef.current;
      const maskId = `bot-mask-${uid}`;
      const engineRef = (0, import_react.useRef)(null);
      if (engineRef.current === null) {
        const first = rotation2?.[0]?.state ?? state2;
        engineRef.current = new BotEngine(R2, first, shapeRadiiOf(look2.shape), expressionOf(look2.expression));
      }
      const engine = engineRef.current;
      const svgRef = (0, import_react.useRef)(null);
      const clockRef = (0, import_react.useRef)(0);
      const [frame, setFrame] = (0, import_react.useState)(() => engine.sample(frozenAt ?? 0));
      const rotRef = (0, import_react.useRef)({
        sig: "",
        start: 0,
        rotation: void 0,
        pass: 0,
        cycle: 0,
        pendingReset: false
      });
      const effectiveRotation = rotation2 ?? [{ state: state2, plays: 1 }];
      const rotSig = effectiveRotation === void 0 ? "" : effectiveRotation.map((r) => `${r.state}:${r.plays}`).join(",");
      if (rotRef.current.sig !== rotSig) {
        rotRef.current.pendingReset = rotRef.current.sig !== "";
        rotRef.current.sig = rotSig;
        rotRef.current.start = clockRef.current * 1e3;
        rotRef.current.pass = 0;
        rotRef.current.cycle = 0;
      }
      rotRef.current.rotation = effectiveRotation;
      (0, import_react.useEffect)(() => {
        engine.setShape(shapeRadiiOf(look2.shape), clockRef.current);
      }, [engine, look2.shape]);
      (0, import_react.useEffect)(() => {
        engine.setExpression(expressionOf(look2.expression), clockRef.current);
      }, [engine, look2.expression]);
      (0, import_react.useEffect)(() => {
        if (frozenAt === void 0) return;
        engine.reset(state2, 0);
        engine.setShape(shapeRadiiOf(look2.shape), 0);
        engine.setExpression(expressionOf(look2.expression), 0);
        setFrame(engine.sample(frozenAt));
      }, [engine, state2, frozenAt, look2.shape, look2.expression]);
      (0, import_react.useEffect)(() => {
        if (frozenAt !== void 0) return;
        const start = performance.now() - clockRef.current * 1e3;
        const advance = (now) => {
          const t = (now - start) / 1e3;
          clockRef.current = t;
          const rot = rotRef.current;
          if (rot.rotation !== void 0) {
            const slot = slotAt(rot.rotation, rot.start, t * 1e3);
            const cycleLen = cycleLength(rot.rotation);
            const cycle = cycleLen > 0 ? Math.floor((t * 1e3 - rot.start) / 1e3 / cycleLen) : 0;
            if (rot.pendingReset) {
              engine.reset(slot.state, t - slot.elapsed);
              rot.pendingReset = false;
              rot.pass = slot.pass;
              rot.cycle = cycle;
            } else if (slot.state !== engine.state) {
              engine.setState(slot.state, t);
              rot.pass = slot.pass;
              rot.cycle = cycle;
            } else if (slot.pass !== rot.pass || cycle !== rot.cycle) {
              engine.reset(slot.state, t);
              rot.pass = slot.pass;
              rot.cycle = cycle;
            }
          }
          if (follow) aim(t);
          setFrame(engine.sample(t));
        };
        if (frameGroup) return subscribeSharedFrames(frameGroup, fps, advance);
        const interval = fps && fps > 0 ? 1e3 / fps : 0;
        let nextDraw = 0;
        let raf = 0;
        let timer = 0;
        let stopped = false;
        const schedule2 = (now) => {
          if (stopped) return;
          if (interval === 0 || nextDraw - now <= 1) {
            raf = requestAnimationFrame(draw2);
            return;
          }
          timer = window.setTimeout(() => {
            if (!stopped) raf = requestAnimationFrame(draw2);
          }, nextDraw - now - 1);
        };
        const draw2 = (now) => {
          if (interval > 0) {
            nextDraw += interval;
            if (nextDraw < now - interval) nextDraw = now + interval;
          }
          advance(now);
          schedule2(now);
        };
        schedule2(performance.now());
        return () => {
          stopped = true;
          cancelAnimationFrame(raf);
          window.clearTimeout(timer);
        };
      }, [engine, frozenAt, follow, fps, frameGroup]);
      function aim(t) {
        if (!STATE_BY_ID.get(engine.state)?.baseFace) return;
        const box = svgRef.current?.getBoundingClientRect();
        if (!box || box.width === 0 || box.height === 0) return;
        const cx = box.left + box.width / 2;
        const cy = box.top + box.height / 2;
        const nx = (lastPointer.current.x - cx) / Math.max(1, window.innerWidth / 2);
        const ny = (lastPointer.current.y - cy) / Math.max(1, window.innerHeight / 2);
        const clamp1 = (v) => v < -1 ? -1 : v > 1 ? 1 : v;
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
        );
      }
      const lastPointer = (0, import_react.useRef)({ x: 0, y: 0, seen: false });
      (0, import_react.useEffect)(() => {
        if (!follow) return;
        if (frameGroup) return subscribeSharedPointer(frameGroup, (point) => {
          lastPointer.current = point;
        });
        const onMove = (e) => {
          if (e.pointerType === "touch") return;
          lastPointer.current = { x: e.clientX, y: e.clientY, seen: true };
        };
        const onLeave = () => {
          lastPointer.current.seen = false;
        };
        window.addEventListener("pointermove", onMove);
        document.addEventListener("pointerleave", onLeave);
        return () => {
          window.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerleave", onLeave);
        };
      }, [follow, frameGroup]);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "svg",
        {
          ref: svgRef,
          width: look2.size,
          height: look2.size,
          viewBox: `${-VB} ${-VB} ${VB * 2} ${VB * 2}`,
          role: "img",
          "aria-label": "agent 头像",
          "data-state": engine.state,
          style: { display: "block", overflow: "visible" },
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Frame, { frame, look: look2, paper, maskId, uid, inkOverride: ink })
        }
      );
    }

    // grokbot/plugin/src/client/mainOverlayMode.ts
    var import_react2 = require("react");
    var current = { place: "sidebar", origin: null };
    var navigate;
    function setSidebarNavigator(fn) {
      navigate = fn;
    }
    var listeners = /* @__PURE__ */ new Set();
    var subscribe = (notify) => {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    };
    var emit = (next) => {
      current = next;
      for (const listener of listeners) listener();
    };
    var useMainOverlayMode = () => (0, import_react2.useSyncExternalStore)(subscribe, () => current, () => current);
    function switchToMain(origin2, paneId, openTab) {
      if (current.place === "main") return;
      emit({ place: "main", origin: origin2, paneId, openTab });
    }
    function switchToSidebar() {
      if (current.place !== "main") return false;
      const previous = current;
      const { paneId, openTab } = previous;
      const open = navigate ?? openTab;
      if (!open) {
        emit({ ...previous, returnError: "侧栏导航暂不可用，请稍后重试" });
        return false;
      }
      emit({ place: "sidebar", origin: null });
      try {
        if (paneId) open("agentsBot", { paneId });
        else open("agentsBot");
      } catch {
        try {
          open("agentsBot");
        } catch {
          emit({ ...previous, returnError: "当前没有可用的侧栏会话，请打开对话后重试" });
          return false;
        }
      }
      return true;
    }

    // grokbot/plugin/src/client/IsolatedGrid.tsx
    var import_react3 = require("react");

    // grokbot/plugin/src/isolation/protocol.mjs
    var ACTIVITY = Object.freeze(["idle", "thinking", "reading", "searching", "running", "writing", "compacting", "background", "waiting", "done", "error", "spawning", "sleep"]);
    var ANIMATION = Object.freeze(["idle", "thinking", "wink", "search", "wide", "alert", "notify", "exclaim", "bounce", "hexagon", "play", "orbit", "radar", "progress", "celebrate", "loading", "waking", "sleeping", "sending", "receiving", "uploading", "burst", "comet"]);
    var SHAPE = /* @__PURE__ */ new Set(["cercle", "galet", "squircle", "capsule", "triangle", "hexagone", "nuage", "goutte", "bouclier", "dome", "arche", "cylindre", "gemme", "cristal", "oeuf"]);
    var COLOR = /* @__PURE__ */ new Set(["encre", "brun", "rouge", "orange", "ambre", "vert", "turquoise", "bleu", "violet", "rose", "gris", "creme"]);
    var EXPRESSION = /* @__PURE__ */ new Set(["neutre", "attentif", "surpris", "excite", "heureux", "hilare", "colere", "triste", "effraye", "mefiant", "confus", "curieux", "fier", "timide", "blase", "somnolent"]);
    var MAX_BYTES = 16384;
    var MAX_AGE_MS = 12e3;
    var MAX_FUTURE_MS = 1e3;
    var owns = (x, k) => Object.prototype.hasOwnProperty.call(x, k);
    var obj = (x) => x !== null && typeof x === "object" && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
    var exact = (x, keys) => obj(x) && Object.keys(x).length === keys.length && keys.every((k) => owns(x, k));
    var integer = (x, lo, hi) => Number.isSafeInteger(x) && x >= lo && x <= hi;
    var token = (x) => typeof x === "string" && /^[a-f0-9]{32}$/.test(x);
    var origin = (x) => typeof x === "string" && x !== "null" && x !== "*" && /^[a-z][a-z0-9+.-]*:\/\/[^\/?#@\s]+$/i.test(x) && (!/^https?:/i.test(x) || new URL(x).origin === x);
    var look = (x) => exact(x, ["shape", "color", "expression", "size"]) && SHAPE.has(x.shape) && COLOR.has(x.color) && EXPRESSION.has(x.expression) && integer(x.size, 16, 512);
    var rotation = (x) => Array.isArray(x) && x.length >= 1 && x.length <= 2 && x.every((i) => exact(i, ["state", "plays"]) && ANIMATION.includes(i.state) && integer(i.plays, 1, 20));
    var canvas = (x) => typeof x === "string" && /^#[a-f0-9]{6}$/i.test(x);
    var ui = (x) => (exact(x, ["fps", "dwellMs", "rotation", "cols", "rows"]) || exact(x, ["fps", "dwellMs", "rotation", "cols", "rows", "canvas"]) && canvas(x.canvas)) && [45, 60, 90, 120].includes(x.fps) && [0, 1200, 1600, 3e3].includes(x.dwellMs) && integer(x.cols, 1, 3) && integer(x.rows, 1, 3) && exact(x.rotation, ACTIVITY) && ACTIVITY.every((a) => rotation(x.rotation[a]));
    var row = (x) => exact(x, ["id", "name", "activity", "changedAt", "isChild", "childCount", "look", "pose"]) && token(x.id) && (x.name === "当前会话" || /^监控 [2-9]$/.test(x.name)) && ACTIVITY.includes(x.activity) && integer(x.changedAt, 0, 864e13) && typeof x.isChild === "boolean" && integer(x.childCount, 0, 999) && typeof x.pose === "boolean" && look(x.look);
    var snapshot = (x) => exact(x, ["v", "kind", "nonce", "epoch", "seq", "sentAt", "rows", "ui"]) && x.v === 1 && x.kind === "SNAPSHOT" && token(x.nonce) && token(x.epoch) && integer(x.seq, 1, Number.MAX_SAFE_INTEGER) && integer(x.sentAt, 0, 864e13) && Array.isArray(x.rows) && x.rows.length >= 1 && x.rows.length <= 9 && x.rows.every(row) && new Set(x.rows.map((r) => r.id)).size === x.rows.length && ui(x.ui) && x.ui.cols * x.ui.rows >= x.rows.length;
    function bounded(value) {
      try {
        const clone = structuredClone(value), json = JSON.stringify(clone);
        return typeof json === "string" && new TextEncoder().encode(json).length <= MAX_BYTES ? clone : null;
      } catch {
        return null;
      }
    }
    function validateSnapshot(value, now) {
      const x = bounded(value);
      return x && snapshot(x) && integer(now, 0, 864e13) && x.sentAt <= now + MAX_FUTURE_MS && now - x.sentAt <= MAX_AGE_MS ? x : null;
    }
    var hello = (x) => exact(x, ["v", "kind"]) && x.v === 1 && x.kind === "HELLO";
    var handshake = (x, kind) => exact(x, ["v", "kind", "nonce", "epoch"]) && x.v === 1 && x.kind === kind && token(x.nonce) && token(x.epoch);
    var ack = (x) => exact(x, ["v", "kind", "nonce", "epoch", "seq"]) && x.v === 1 && x.kind === "ACK" && token(x.nonce) && token(x.epoch) && integer(x.seq, 1, Number.MAX_SAFE_INTEGER);
    var randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
    function endpoint(source, targetOrigin) {
      if (!source || typeof source !== "object" && typeof source !== "function" || !origin(targetOrigin)) throw Error("exact origin and window source required");
    }
    var ParentBridge = class {
      constructor({ childSource, childOrigin, send, now = Date.now }) {
        endpoint(childSource, childOrigin);
        if (typeof send !== "function" || typeof now !== "function") throw Error("send and clock required");
        Object.assign(this, { send, now });
        this.rotate(childSource, childOrigin);
      }
      rotate(childSource, childOrigin) {
        endpoint(childSource, childOrigin);
        this.childSource = childSource;
        this.childOrigin = childOrigin;
        this.nonce = randomToken();
        this.epoch = randomToken();
        this.seq = 0;
        this.lastAckSeq = 0;
        this.lastAckAt = 0;
        this.phase = "hello";
        this.latest = null;
      }
      publish(rows, settings) {
        const data = { v: 1, kind: "SNAPSHOT", nonce: this.nonce, epoch: this.epoch, seq: 1, sentAt: this.now(), rows, ui: settings };
        const clean = validateSnapshot(data, this.now());
        if (!clean) return false;
        this.latest = { rows: clean.rows, ui: clean.ui };
        if (this.phase === "ready") this.flush();
        return true;
      }
      flush() {
        if (!this.latest || this.seq === Number.MAX_SAFE_INTEGER) return false;
        const clean = validateSnapshot({ v: 1, kind: "SNAPSHOT", nonce: this.nonce, epoch: this.epoch, seq: this.seq + 1, sentAt: this.now(), ...this.latest }, this.now());
        if (!clean) return false;
        this.send(this.childSource, clean, this.childOrigin);
        this.seq++;
        return true;
      }
      receive(event) {
        if (!event || event.source !== this.childSource || event.origin !== this.childOrigin) return false;
        const x = bounded(event.data);
        if (!x) return false;
        if (this.phase === "hello" && hello(x)) {
          this.phase = "init";
          this.send(this.childSource, { v: 1, kind: "INIT", nonce: this.nonce, epoch: this.epoch }, this.childOrigin);
          return true;
        }
        if (this.phase === "init" && handshake(x, "READY") && x.nonce === this.nonce && x.epoch === this.epoch) {
          this.phase = "ready";
          this.flush();
          return true;
        }
        if (this.phase === "ready" && ack(x) && x.nonce === this.nonce && x.epoch === this.epoch && x.seq > this.lastAckSeq && x.seq <= this.seq) {
          this.lastAckSeq = x.seq;
          this.lastAckAt = this.now();
          return true;
        }
        if (this.phase === "ready" && handshake(x, "RESYNC") && x.nonce === this.nonce && x.epoch === this.epoch) {
          this.nonce = randomToken();
          this.epoch = randomToken();
          this.seq = 0;
          this.lastAckSeq = 0;
          this.lastAckAt = 0;
          this.phase = "init";
          this.send(this.childSource, { v: 1, kind: "INIT", nonce: this.nonce, epoch: this.epoch }, this.childOrigin);
          return true;
        }
        return false;
      }
    };
    function createOpaqueIds() {
      const ids = /* @__PURE__ */ new Map();
      return { get(realId) {
        if (typeof realId !== "string" || !realId) throw Error("parent-only identity required");
        if (!ids.has(realId)) ids.set(realId, randomToken());
        return ids.get(realId);
      }, clear() {
        ids.clear();
      } };
    }

    // grokbot/plugin/src/client/canvasColor.ts
    function labelColorForCanvas(hex) {
      const linear = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722 > 0.18 ? "#171717" : "#ffffff";
    }
    function canvasColorBehind(element) {
      const chain = [];
      for (let node = element; node && chain.length < 32; node = node.parentElement) chain.push(node);
      const out = [246, 248, 251];
      for (const node of chain.reverse()) {
        const css = getComputedStyle(node).backgroundColor;
        const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.exec(css);
        if (!match) continue;
        const red = Number(match[1]), green = Number(match[2]), blue = Number(match[3]), alpha = match[4] === void 0 ? 1 : Number(match[4]);
        if ([red, green, blue].some((value) => value > 255) || !Number.isFinite(alpha) || alpha < 0 || alpha > 1) continue;
        for (const [index, channel] of [red, green, blue].entries()) out[index] = Math.round(channel * alpha + out[index] * (1 - alpha));
      }
      return "#" + out.map((value) => value.toString(16).padStart(2, "0")).join("");
    }

    // grokbot/plugin/src/client/IsolatedGrid.tsx
    var import_jsx_runtime2 = require("react/jsx-runtime");
    var CHILD_ORIGIN = "http://127.0.0.1:49383";
    var PARENT_ORIGIN = true ? "dsh-app://app" : "dsh-app://app";
    var HEARTBEAT_MS = 3e3;
    var ACK_MAX_AGE_MS = 1e4;
    function StartupPlaceholder({ look: look2 }) {
      const [animating, setAnimating] = (0, import_react3.useState)(true);
      (0, import_react3.useEffect)(() => {
        const timer = setTimeout(() => setAnimating(false), 2400);
        return () => clearTimeout(timer);
      }, []);
      const size = Math.min(110, look2.size);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "davf-isolation-startup", role: "status", children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "davf-isolation-startup-portrait", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
          Bot,
          {
            state: animating ? "bounce" : "idle",
            frozenAt: animating ? void 0 : 1.1,
            look: { ...look2, size },
            fps: 15,
            paper: "transparent"
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "davf-isolation-startup-note", children: "正在验证独立画面…" }),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "davf-isolation-startup-pill", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "davf-isolation-startup-dot", "aria-hidden": "true" }),
          "启动中"
        ] })
      ] });
    }
    function IsolatedGrid({ snapshot: snapshot2, containerRef, controls, onUnavailable, onConnected }) {
      const frame = (0, import_react3.useRef)(null);
      const latest = (0, import_react3.useRef)(snapshot2);
      const bridgeRef = (0, import_react3.useRef)(null);
      const [ready, setReady] = (0, import_react3.useState)(false);
      latest.current = snapshot2;
      const sampleCanvas = () => {
        const root = frame.current?.parentElement;
        const canvas2 = canvasColorBehind(root ?? null);
        root?.style.setProperty("--davf-isolated-canvas", canvas2);
        root?.style.setProperty("--davf-isolated-label", labelColorForCanvas(canvas2));
        return canvas2;
      };
      (0, import_react3.useLayoutEffect)(() => {
        sampleCanvas();
      }, [snapshot2]);
      const currentUi = (ui2) => ({ ...ui2, canvas: sampleCanvas() });
      (0, import_react3.useEffect)(() => {
        const bridge = bridgeRef.current;
        if (bridge?.phase === "ready" && bridge.publish(snapshot2.rows, currentUi(snapshot2.ui)) === false) {
          onUnavailable("活动快照未通过白名单验证");
        }
      }, [snapshot2, onUnavailable]);
      (0, import_react3.useEffect)(() => {
        const target = frame.current;
        const capability = true ? "c1625532a4f71e1cfc34a97d425fd8b2915a4314fcd6df8be9c2eb9de53a7e05" : "";
        if (!target || window.location.origin !== PARENT_ORIGIN || !/^[a-f0-9]{64}$/.test(capability)) {
          onUnavailable("独立画面入口未通过验证");
          return;
        }
        let live = true, owned = false, unavailable = false, acknowledged = false;
        let loadedAt = 0;
        let handshakeTimeout;
        let staleAckTimeout;
        const awake = () => document.visibilityState === "visible" && document.hasFocus();
        const fail = (reason, recoverable = false) => {
          if (!live || unavailable) return;
          unavailable = true;
          clearTimeout(handshakeTimeout);
          clearTimeout(staleAckTimeout);
          bridgeRef.current = null;
          setReady(false);
          onUnavailable(reason, recoverable);
        };
        const sendFresh = () => {
          const bridge = bridgeRef.current;
          if (!live || unavailable || !owned || !bridge || bridge.phase !== "ready") return;
          try {
            if (!bridge.publish(latest.current.rows, currentUi(latest.current.ui))) {
              fail("隔离快照校验失败");
              return;
            }
          } catch {
            fail("隔离数据发送失败", true);
            return;
          }
          if (bridge.lastAckSeq < 1 || Date.now() - bridge.lastAckAt <= ACK_MAX_AGE_MS || staleAckTimeout || !awake()) return;
          const lastAckAt = bridge.lastAckAt;
          staleAckTimeout = setTimeout(() => {
            staleAckTimeout = void 0;
            if (bridgeRef.current === bridge && bridge.lastAckAt <= lastAckAt && awake()) fail("隔离画面失联", true);
          }, 8e3);
        };
        const onLoad = () => {
          if (!live || unavailable) return;
          const source = target.contentWindow;
          if (!source) {
            fail("隔离子页没有可用窗口");
            return;
          }
          owned = false;
          acknowledged = false;
          loadedAt = Date.now();
          clearTimeout(staleAckTimeout);
          staleAckTimeout = void 0;
          setReady(false);
          try {
            const bridge = new ParentBridge({ childSource: source, childOrigin: CHILD_ORIGIN, send: (to, data, origin2) => to.postMessage(data, origin2) });
            bridgeRef.current = bridge;
            if (!bridge.publish(latest.current.rows, currentUi(latest.current.ui))) {
              fail("隔离快照校验失败");
              return;
            }
          } catch {
            fail("隔离通道初始化失败");
            return;
          }
          clearTimeout(handshakeTimeout);
          handshakeTimeout = setTimeout(() => {
            if ((bridgeRef.current?.lastAckSeq ?? 0) < 1 && awake()) fail("隔离握手超时", true);
          }, 8e3);
        };
        const onMessage = (event) => {
          if (!live || unavailable || event.source !== target.contentWindow || event.origin !== CHILD_ORIGIN) return;
          const data = event.data;
          if (data && typeof data === "object" && !Array.isArray(data) && data.kind === "G2_OWNER") {
            if (Object.keys(data).length !== 3 || data.v !== 1 || data.capability !== capability) {
              fail("隔离资源归属标记不匹配");
              return;
            }
            owned = true;
            return;
          }
          if (!owned || !bridgeRef.current) return;
          try {
            const bridge = bridgeRef.current;
            if (!bridge.receive(event)) return;
            if (bridge.lastAckSeq >= 1) {
              clearTimeout(handshakeTimeout);
              clearTimeout(staleAckTimeout);
              staleAckTimeout = void 0;
              if (!acknowledged) {
                acknowledged = true;
                onConnected?.();
              }
              setReady(true);
            } else {
              setReady(false);
              if (bridge.phase === "init") {
                loadedAt = Date.now();
                clearTimeout(handshakeTimeout);
                handshakeTimeout = setTimeout(() => {
                  if ((bridgeRef.current?.lastAckSeq ?? 0) < 1 && awake()) fail("隔离重同步超时", true);
                }, 8e3);
              }
            }
          } catch {
            fail("隔离通信失败");
          }
        };
        const onError = () => fail("隔离资源加载失败", true);
        const onResume = () => {
          if (!live || unavailable || !awake()) return;
          const bridge = bridgeRef.current;
          if (bridge?.phase === "ready") sendFresh();
          else if (loadedAt > 0 && Date.now() - loadedAt >= 8e3) fail("隔离握手超时", true);
        };
        window.addEventListener("message", onMessage);
        window.addEventListener("focus", onResume);
        window.addEventListener("pageshow", onResume);
        document.addEventListener("visibilitychange", onResume);
        target.addEventListener("load", onLoad);
        target.addEventListener("error", onError);
        target.src = CHILD_ORIGIN + "/";
        const heartbeat = setInterval(sendFresh, HEARTBEAT_MS);
        return () => {
          live = false;
          clearInterval(heartbeat);
          clearTimeout(handshakeTimeout);
          clearTimeout(staleAckTimeout);
          window.removeEventListener("message", onMessage);
          window.removeEventListener("focus", onResume);
          window.removeEventListener("pageshow", onResume);
          document.removeEventListener("visibilitychange", onResume);
          target.removeEventListener("load", onLoad);
          target.removeEventListener("error", onError);
          bridgeRef.current = null;
        };
      }, [onUnavailable, onConnected]);
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { ref: containerRef, style: { position: "relative", flex: 1, minHeight: 0, width: "100%" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("iframe", { ref: frame, title: "隔离活动 AI", sandbox: "allow-scripts allow-same-origin", style: { display: ready ? "block" : "none", width: "100%", height: "100%", border: 0 } }),
        ready ? controls : null,
        !ready && snapshot2.rows[0] ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(StartupPlaceholder, { look: snapshot2.rows[0].look }) : null
      ] });
    }

    // grokbot/plugin/src/client/IsolationControls.tsx
    var import_jsx_runtime3 = require("react/jsx-runtime");
    function IsolationControls({ shownIds, displayNames, portraitSizes, cols, rows, customizer, editTarget, onEdit, onRemove }) {
      return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { "aria-label": "隔离画面操作", style: {
        position: "absolute",
        inset: 8,
        zIndex: 1,
        display: "grid",
        gap: 6,
        gridTemplateColumns: "repeat(" + cols + ",minmax(0,1fr))",
        gridTemplateRows: "repeat(" + rows + ",minmax(0,1fr))",
        pointerEvents: "none"
      }, children: shownIds.map((id, index) => {
        const editing = customizer && editTarget === id;
        const target = customizer && (editing || editTarget === void 0 && index === 0);
        return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "davf-isolated-cell" + (shownIds.length === 1 ? " is-single" : shownIds.length === 2 && (portraitSizes[index] ?? 0) >= 80 ? " is-pair" : shownIds.length >= 3 && shownIds.length <= 8 && (portraitSizes[index] ?? 0) >= 120 ? " is-spacious" : shownIds.length === 9 ? " is-dense" : ""), style: { pointerEvents: "none" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "davf-isolated-portrait-space", style: { height: portraitSizes[index] ?? 48, marginBottom: shownIds.length === 1 ? -Math.min(36, Math.round((portraitSizes[index] ?? 48) * 0.2)) : void 0 }, "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "davf-isolated-name", title: displayNames[index]?.name ?? "已关闭的对话", children: [
            displayNames[index]?.isChild ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "davf-caret", children: "└ " }) : null,
            displayNames[index]?.name ?? "已关闭的对话"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "davf-isolated-meta-space", "aria-hidden": "true" }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "davf-isolated-meta-space", "aria-hidden": "true" }),
          customizer ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "davf-cell-tag" + (target ? " is-on" : ""),
              style: { pointerEvents: "auto" },
              title: editing ? "正在修改这个 agent 的外观（只改这一个）" : target ? "没选具体 agent 时，改的是全局外观" : "点它只修改这个 agent 的外观",
              "aria-label": "修改第" + (index + 1) + "格外观",
              onClick: () => onEdit(editing ? void 0 : id),
              children: editing ? "修改中" : target ? "默认" : "改它"
            }
          ) : index > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "davf-cell-remove",
              style: { pointerEvents: "auto", opacity: 0.85 },
              title: "取消监视",
              "aria-label": "取消第" + (index + 1) + "格监视",
              onClick: () => onRemove(id),
              children: "✕"
            }
          ) : null
        ] }, id);
      }) });
    }

    // grokbot/plugin/src/client/bridgeSnapshot.ts
    var OPAQUE = /^[a-f0-9]{32}$/;
    function snapshotForChild(input) {
      const { shownIds, agentById, kidsCount, tokenFor, lookFor, botSize, customizer, editTarget, fps, dwellMs, rotation: rotation2, cols, rows } = input;
      if (!Array.isArray(shownIds) || shownIds.length > 9 || new Set(shownIds).size !== shownIds.length) return null;
      if (!Number.isInteger(cols) || cols < 1 || cols > 3 || !Number.isInteger(rows) || rows < 1 || rows > 3 || cols * rows < shownIds.length) return null;
      if (!Number.isInteger(botSize) || botSize < 16 || botSize > 512) return null;
      const projected = shownIds.map((sessionId, index) => {
        const opaque = tokenFor(sessionId);
        if (typeof opaque !== "string" || !OPAQUE.test(opaque) || opaque === sessionId) return null;
        const agent = agentById.get(sessionId);
        const look2 = lookFor(sessionId);
        return {
          id: opaque,
          name: index === 0 ? "当前会话" : `监控 ${index + 1}`,
          activity: agent?.activity ?? "idle",
          changedAt: agent?.changedAt ?? 0,
          isChild: agent?.isChild ?? false,
          childCount: kidsCount.get(sessionId) ?? 0,
          pose: customizer && (editTarget === sessionId || editTarget === void 0 && index === 0),
          look: { shape: look2.shape, color: look2.color, expression: look2.expression, size: botSize }
        };
      });
      const safeRows = projected.filter((row2) => row2 !== null);
      if (safeRows.length !== projected.length) return null;
      const tokenList = safeRows.map((row2) => row2.id);
      if (new Set(tokenList).size !== tokenList.length) return null;
      const safeRotation = Object.fromEntries(ACTIVITY.map((activity) => [
        activity,
        rotation2[activity]?.map((item) => ({ state: item.state, plays: item.plays }))
      ]));
      return { rows: safeRows, ui: { fps, dwellMs, rotation: safeRotation, cols, rows } };
    }

    // grokbot/plugin/src/client/derive.ts
    var ERROR_WINDOW_MS = 15e3;
    var SPAWN_WINDOW_MS = 6e3;
    function isChildRow(row2) {
      return row2?.origin === "subagent" || row2?.parentId !== void 0;
    }
    function deriveActivity({ row: row2, status, proj, now, sleepMinutes, teamPhase }) {
      if (proj !== void 0 && proj.errorAt > 0 && now - proj.errorAt < ERROR_WINDOW_MS) {
        return "error";
      }
      if (status?.pendingInteraction) return "waiting";
      if (teamPhase === "provisioning") return "spawning";
      if (isChildRow(row2) && row2?.blank === false) {
        if (status?.running !== true) {
          if ((row2.updatedAt ?? 0) === 0) return "spawning";
          if (now - (row2.updatedAt ?? 0) < SPAWN_WINDOW_MS) return "spawning";
        }
      }
      if (proj?.compacting) return "compacting";
      if (proj !== void 0 && proj.tools > 0 && proj.tool !== null) {
        return activityOfTool(proj.tool);
      }
      if (proj !== void 0 && proj.bg > 0) return "background";
      if (status?.completionUnread) return "done";
      const running = status?.running ?? row2?.running ?? false;
      if (running) return "thinking";
      const lastActive = row2?.updatedAt ?? 0;
      if (lastActive > 0 && now - lastActive > sleepMinutes * 6e4) return "sleep";
      return "idle";
    }

    // grokbot/plugin/src/client/agents.ts
    function activeSessionOf(list) {
      const snapshot2 = list;
      if (!snapshot2?.byId || !Array.isArray(snapshot2.ids)) return void 0;
      const inIds = new Set(snapshot2.ids);
      for (const id of snapshot2.ids) {
        const row2 = snapshot2.byId[id];
        if (!row2 || isRealChild(row2, id, inIds)) continue;
        if ((row2.retainedBy?.mainView ?? 0) > 0) return id;
      }
      return void 0;
    }
    function unavailableSessionIds(list, activeId, selected, archivedIds) {
      const unavailable = new Set(archivedIds ?? []);
      if (list?.phase === "ready" && activeId && list.ids.includes(activeId)) {
        for (const id of selected) {
          if (!list.ids.includes(id) && !list.byId[id]) unavailable.add(id);
        }
      }
      return unavailable;
    }
    function teamNames(list) {
      const out = /* @__PURE__ */ new Map();
      const bySession = list?.projectionsBySession;
      if (!bySession) return out;
      for (const projection of Object.values(bySession)) {
        const team = projection?.values?.agentTeam;
        for (const m of team?.members ?? []) {
          if (m && typeof m.id === "string") out.set(m.id, m);
        }
      }
      return out;
    }
    function avatarProjectionOf(list, id) {
      const raw = list?.projectionsBySession?.[id]?.values?.agentsBot;
      if (!raw || typeof raw !== "object") return void 0;
      const v = raw;
      const tool = v.tool;
      const tools = v.tools;
      const bg = v.bg;
      const compacting = v.compacting;
      const errorAt = v.errorAt;
      if (tool !== null && typeof tool !== "string") return void 0;
      if (typeof tools !== "number" || !Number.isFinite(tools)) return void 0;
      if (typeof bg !== "number" || !Number.isFinite(bg)) return void 0;
      if (typeof compacting !== "boolean") return void 0;
      if (typeof errorAt !== "number" || !Number.isFinite(errorAt)) return void 0;
      return { tool, tools, bg, compacting, errorAt };
    }
    function displayNameOf(row2, member, id) {
      if (member !== void 0 && member.role === "teammate") {
        const n = member.name?.trim();
        if (n !== void 0 && n !== "") return n;
      }
      const title = row2.displayTitle?.trim();
      if (title !== void 0 && title !== "") return title;
      return id.slice(0, 8);
    }
    function deriveAgents(list, status, now, sleepMinutes) {
      if (!list) return [];
      const names = teamNames(list);
      const inIds = new Set(list.ids ?? []);
      const rows = [];
      for (const id of list.ids) {
        const row2 = list.byId[id];
        if (!row2) continue;
        const member = names.get(id);
        const st = status?.get(id);
        const projection = avatarProjectionOf(list, id);
        rows.push({
          id,
          name: displayNameOf(row2, member, id),
          /**
           * 用 `isRealChild` 而不是「有 parentId」：分叉出来的会话也有 parentId，
           * 但它是普通会话，不该画「└」这个表示子代理的前缀。
           * 同一处误判也出现在子代理计数上（见 `countDescendants`）。
           */
          isChild: isRealChild(row2, id, inIds) || member?.role === "teammate",
          parentId: row2.parentId,
          activity: deriveActivity({
            row: row2,
            status: st,
            proj: projection,
            now,
            sleepMinutes,
            teamPhase: member?.phase
          }),
          changedAt: row2.updatedAt ?? 0,
          projection
        });
      }
      const byParent = /* @__PURE__ */ new Map();
      const roots = [];
      for (const r of rows) {
        if (r.parentId && rows.some((p) => p.id === r.parentId)) {
          const arr = byParent.get(r.parentId) ?? [];
          arr.push(r);
          byParent.set(r.parentId, arr);
        } else roots.push(r);
      }
      const out = [];
      for (const root of roots) {
        out.push(root);
        for (const kid of byParent.get(root.id) ?? []) out.push(kid);
      }
      return out;
    }
    function isRealChild(row2, id, inIds) {
      if (row2?.parentId === void 0) return false;
      if (row2.origin === "subagent") return true;
      if (row2.origin === void 0) return !inIds.has(id);
      return false;
    }
    function countDescendants(list, rootId) {
      if (!list || !rootId) return 0;
      const byId = list.byId ?? {};
      const inIds = new Set(list.ids ?? []);
      const byParent = /* @__PURE__ */ new Map();
      const add = (childId, parentId) => {
        if (!parentId) return;
        const arr = byParent.get(parentId) ?? [];
        if (!arr.includes(childId)) arr.push(childId);
        byParent.set(parentId, arr);
      };
      for (const id of list.ids ?? []) {
        if (isRealChild(byId[id], id, inIds)) add(id, byId[id]?.parentId);
      }
      for (const [id, row2] of Object.entries(byId)) {
        if (isRealChild(row2, id, inIds)) add(id, row2?.parentId);
      }
      let n = 0;
      const seen = /* @__PURE__ */ new Set();
      const walk = (id) => {
        for (const kid of byParent.get(id) ?? []) {
          if (seen.has(kid)) continue;
          seen.add(kid);
          n++;
          walk(kid);
        }
      };
      walk(rootId);
      return n;
    }

    // grokbot/plugin/src/client/Picker.tsx
    var import_react5 = require("react");

    // grokbot/plugin/src/client/store.ts
    var import_react4 = require("react");

    // grokbot/plugin/src/client/monitorQueue.ts
    var bounded2 = (n) => Math.max(1, Math.min(9, Number.isFinite(n) ? Math.trunc(n) : 9));
    var distinct = (ids) => [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
    function seedMonitorQueue(picked, activeId, max = 9) {
      const limit = bounded2(max);
      const active = activeId || void 0;
      const extra = distinct(picked).filter((id) => id !== active).slice(0, active ? limit - 1 : limit);
      return { order: active ? [active, ...extra] : extra, capacity: Math.min(limit, 1 + extra.length) };
    }
    function visitMonitorQueue(state2, id, unavailable) {
      if (typeof id !== "string" || !id) return { order: [...state2.order], capacity: state2.capacity };
      const capacity = bounded2(state2.capacity);
      const order = distinct(state2.order);
      if (order.includes(id)) return { order: [id, ...order.filter((entry) => entry !== id)].slice(0, capacity), capacity };
      if (order.length >= capacity) {
        const victim = [...order].reverse().find((entry) => unavailable.has(entry)) ?? order[order.length - 1];
        order.splice(order.indexOf(victim), 1);
      }
      return { order: [id, ...order].slice(0, capacity), capacity };
    }
    function addMonitorQueue(state2, id, max = 9) {
      const limit = bounded2(max);
      const capacity = Math.min(limit, bounded2(state2.capacity) + 1);
      const order = distinct(state2.order);
      if (typeof id !== "string" || !id || bounded2(state2.capacity) >= limit && !order.includes(id)) {
        return { order: order.slice(0, bounded2(state2.capacity)), capacity: bounded2(state2.capacity) };
      }
      return { order: (order.includes(id) ? order : [...order, id]).slice(0, capacity), capacity };
    }
    function removeMonitorQueue(state2, id, activeId) {
      const capacity = Math.max(1, bounded2(state2.capacity) - 1);
      const active = activeId || void 0;
      const remaining = distinct(state2.order).filter((entry) => entry !== id && entry !== active);
      return { order: (active ? [active, ...remaining] : remaining).slice(0, capacity), capacity };
    }
    function clearMonitorQueue(_state, activeId) {
      return { order: activeId ? [activeId] : [], capacity: 1 };
    }

    // grokbot/plugin/src/client/store.ts
    var ANIMATION_IDS = new Set(ANIMATION_OPTIONS.map((o) => o.id));
    var MAX_MONITORED = 9;
    function gridOf(n, orientation = "landscape") {
      if (n <= 1) return { rows: 1, cols: 1 };
      if (orientation === "portrait") {
        if (n <= 2) return { rows: 2, cols: 1 };
        if (n <= 3) return { rows: 3, cols: 1 };
        if (n <= 4) return { rows: 2, cols: 2 };
        if (n <= 6) return { rows: 3, cols: 2 };
        return { rows: 3, cols: 3 };
      }
      if (n <= 2) return { rows: 1, cols: 2 };
      if (n <= 4) return { rows: 2, cols: 2 };
      if (n <= 6) return { rows: 2, cols: 3 };
      return { rows: 3, cols: 3 };
    }
    function orientationOf(w, h, prev) {
      if (!(w > 0) || !(h > 0)) return prev;
      const a = w / h;
      if (a < 0.9) return "portrait";
      if (a > 1.1) return "landscape";
      return prev;
    }
    var FPS_OPTIONS = [
      { id: 45, label: "45", hint: "省一些 CPU，动画仍算顺" },
      { id: 60, label: "60", hint: "标准流畅（默认）" },
      { id: 90, label: "90", hint: "高刷可选；隔离子页绘制量增加" },
      { id: 120, label: "120", hint: "高刷可选；隔离子页绘制量更高" }
    ];
    var DEFAULT_FPS = 60;
    var DEFAULT_MAIN_BOT_SIZE = 96;
    var MIN_MAIN_BOT_SIZE = 64;
    var MAX_MAIN_BOT_SIZE = 192;
    function readMainBotSize(raw) {
      const size = typeof raw === "number" ? raw : Number(raw);
      return Number.isFinite(size) && size >= MIN_MAIN_BOT_SIZE && size <= MAX_MAIN_BOT_SIZE ? Math.round(size) : DEFAULT_MAIN_BOT_SIZE;
    }
    var DWELL_OPTIONS = [
      { id: 0, label: "关闭", hint: "真实反映每一刻，但短动画会一闪而过" },
      { id: 1200, label: "1.2 秒", hint: "轻微平滑，短活动仍常出现" },
      { id: 1600, label: "1.6 秒", hint: "推荐：动画基本能播完，读文件仍看得见" },
      { id: 3e3, label: "3.0 秒", hint: "最平滑，能装下环绕 / 上传的整遍；短活动会合并很多" }
    ];
    var DEFAULT_DWELL_MS = 0;
    var KEY = "dsh-agents-bot:ui";
    var LEGACY_KEY = "dsh-agent-avatar:ui";
    function readStored() {
      try {
        const fresh = localStorage.getItem(KEY);
        if (fresh !== null) return fresh;
        const legacy = localStorage.getItem(LEGACY_KEY);
        if (legacy === null) return null;
        localStorage.setItem(KEY, legacy);
        localStorage.removeItem(LEGACY_KEY);
        return legacy;
      } catch {
        return null;
      }
    }
    function num(v, fallback) {
      return typeof v === "number" && Number.isFinite(v) ? v : fallback;
    }
    function load() {
      try {
        const raw = readStored();
        if (!raw) return {};
        const v = JSON.parse(raw);
        const look2 = readLook(v.look);
        const picked = Array.isArray(v.picked) ? v.picked.filter((x) => typeof x === "string") : [];
        return {
          picked: picked.slice(0, MAX_MONITORED - 1),
          look: look2,
          // Older installs rendered the second Bot with global look. Snapshot that look once
          // when this key is absent; never share its object reference or overwrite an existing choice.
          messageLook: Object.prototype.hasOwnProperty.call(v, "messageLook") ? readLook(v.messageLook) : { ...look2 },
          looks: readLooks(v.looks),
          customizer: v.customizer === true,
          fps: readFps(v.fps),
          mainBotSize: readMainBotSize(v.mainBotSize),
          dwellMs: readDwell(v.dwellMs),
          rotation: readRotation(v.rotation),
          preset: readPreset(v.preset, v.shapeOrder),
          sleepMinutes: readSleep(v.sleepMinutes)
        };
      } catch {
        return {};
      }
    }
    function readFps(raw) {
      const n = typeof raw === "number" ? raw : Number(raw);
      for (const o of FPS_OPTIONS) if (o.id === n) return o.id;
      return DEFAULT_FPS;
    }
    function readSleep(raw) {
      const n = typeof raw === "number" ? raw : Number(raw);
      for (const o of SLEEP_OPTIONS) if (o.id === n) return o.id;
      return DEFAULT_SLEEP_MINUTES;
    }
    function readDwell(raw) {
      const n = typeof raw === "number" ? raw : Number(raw);
      if (n === 2400) return 3e3;
      for (const o of DWELL_OPTIONS) if (o.id === n) return o.id;
      return DEFAULT_DWELL_MS;
    }
    function readPreset(raw, legacy) {
      if (raw !== void 0) return sanitizePreset(raw);
      if (!Array.isArray(legacy)) return [...PRESET_DEFAULT];
      const exprBase = DEFAULT_LOOK.expression;
      const at = EXPRESSION_PRESET_ORDER.indexOf(exprBase);
      const out = legacy.filter((x) => typeof x === "string").slice(0, PRESET_MAX).map((shape, i) => ({
        shape,
        expression: EXPRESSION_PRESET_ORDER[(Math.max(0, at) + i + 1) % EXPRESSION_PRESET_ORDER.length] ?? DEFAULT_LOOK.expression
      }));
      return out.length ? sanitizePreset(out) : [...PRESET_DEFAULT];
    }
    function readLook(raw) {
      const v = raw ?? {};
      return {
        shape: typeof v.shape === "string" ? v.shape : DEFAULT_LOOK.shape,
        color: typeof v.color === "string" ? v.color : DEFAULT_LOOK.color,
        expression: typeof v.expression === "string" ? v.expression : DEFAULT_LOOK.expression,
        size: num(v.size, DEFAULT_LOOK.size)
      };
    }
    function readLooks(raw) {
      const out = {};
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
      for (const [id, value] of Object.entries(raw)) {
        if (typeof id === "string" && value && typeof value === "object") out[id] = readLook(value);
      }
      return out;
    }
    function readRotation(raw) {
      const out = {};
      const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
      for (const activity of ACTIVITY_ORDER) {
        const fallback = DEFAULT_ROTATION[activity];
        const value = src[activity];
        if (!Array.isArray(value)) {
          out[activity] = fallback;
          continue;
        }
        const items = value.slice(0, MAX_ROTATION_ITEMS).map((item) => {
          if (!item || typeof item !== "object") return null;
          const { state: state2, plays } = item;
          if (typeof state2 !== "string") return null;
          if (!ANIMATION_IDS.has(state2)) return null;
          const n = typeof plays === "number" ? plays : Number(plays);
          if (!Number.isFinite(n)) return null;
          return { state: state2, plays: Math.min(MAX_PLAYS, Math.max(MIN_PLAYS, Math.round(n))) };
        }).filter((x) => x !== null);
        out[activity] = items.length > 0 ? items : fallback;
      }
      return out;
    }
    var persisted = load();
    var DEFAULTS = {
      picked: persisted.picked ?? [],
      look: persisted.look ?? DEFAULT_LOOK,
      messageLook: persisted.messageLook ?? { ...DEFAULT_LOOK },
      looks: persisted.looks ?? {},
      // Placement is window memory. A previous main-mode expansion must not reopen on a fresh sidebar window.
      // This runs once at module initialization, not on every AvatarPanel remount.
      customizer: false,
      picker: false,
      editTarget: void 0,
      preview: null,
      previewExpression: null,
      previewShape: null,
      previewColor: null,
      previewRotation: null,
      fps: persisted.fps ?? DEFAULT_FPS,
      mainBotSize: persisted.mainBotSize ?? DEFAULT_MAIN_BOT_SIZE,
      dwellMs: persisted.dwellMs ?? DEFAULT_DWELL_MS,
      rotation: persisted.rotation ?? DEFAULT_ROTATION,
      preset: persisted.preset ?? [...PRESET_DEFAULT],
      sleepMinutes: persisted.sleepMinutes ?? DEFAULT_SLEEP_MINUTES
    };
    var state = { ...DEFAULTS, picker: false, editTarget: void 0, preview: null };
    var subs = /* @__PURE__ */ new Set();
    function emit2() {
      for (const fn of subs) fn();
    }
    function persist() {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({
            picked: state.picked,
            look: state.look,
            messageLook: state.messageLook,
            looks: state.looks,
            customizer: state.customizer,
            fps: state.fps,
            mainBotSize: state.mainBotSize,
            dwellMs: state.dwellMs,
            rotation: state.rotation,
            preset: state.preset,
            sleepMinutes: state.sleepMinutes
          })
        );
      } catch {
      }
    }
    function patchUi(patch) {
      state = { ...state, ...patch };
      persist();
      emit2();
    }
    function togglePanel(which) {
      if (which === "picker") {
        patchUi({ picker: !state.picker, customizer: false });
      } else {
        patchUi({ customizer: !state.customizer, picker: false });
      }
    }
    function setLook(target, next) {
      if (target === void 0) {
        patchUi({ look: next });
        return;
      }
      patchUi({ looks: { ...state.looks, [target]: next } });
    }
    function setMessageLook(next) {
      patchUi({ messageLook: next });
    }
    function resetLook(target) {
      if (!(target in state.looks)) return;
      const next = { ...state.looks };
      delete next[target];
      patchUi({ looks: next });
    }
    function setMainBotSize(size) {
      if (!Number.isFinite(size)) return;
      const next = Math.min(MAX_MAIN_BOT_SIZE, Math.max(MIN_MAIN_BOT_SIZE, Math.round(size)));
      if (state.mainBotSize !== next) patchUi({ mainBotSize: next });
    }
    function setFps(fps) {
      if (state.fps === fps) return;
      patchUi({ fps });
    }
    function setDwellMs(dwellMs) {
      const n = DWELL_OPTIONS.some((o) => o.id === dwellMs) ? dwellMs : DEFAULT_DWELL_MS;
      if (state.dwellMs === n) return;
      patchUi({ dwellMs: n });
    }
    function setRotation(activity, rotation2) {
      const items = rotation2.slice(0, MAX_ROTATION_ITEMS).map((r) => ({
        state: r.state,
        plays: Math.min(MAX_PLAYS, Math.max(MIN_PLAYS, Math.round(r.plays)))
      }));
      if (items.length === 0) return;
      patchUi({ rotation: { ...state.rotation, [activity]: items } });
    }
    function resetRotation(activity) {
      patchUi({ rotation: { ...state.rotation, [activity]: DEFAULT_ROTATION[activity] } });
    }
    function resetAllRotation() {
      patchUi({ rotation: DEFAULT_ROTATION });
    }
    function rotationChanged(activity, state0 = state) {
      return JSON.stringify(state0.rotation[activity]) !== JSON.stringify(DEFAULT_ROTATION[activity]);
    }
    function setSleepMinutes(minutes) {
      const ok = SLEEP_OPTIONS.some((o) => o.id === minutes);
      if (!ok || state.sleepMinutes === minutes) return;
      patchUi({ sleepMinutes: minutes });
    }
    function setPreset(next) {
      const clean = sanitizePreset(next);
      if (JSON.stringify(clean) === JSON.stringify(state.preset)) return;
      patchUi({ preset: clean });
    }
    function setPresetAt(index, patch) {
      const cur = state.preset[index];
      if (!cur) return;
      const next = state.preset.map((row2, i) => i === index ? { ...row2, ...patch } : row2);
      setPreset(next);
    }
    function removePresetAt(index) {
      if (state.preset.length <= PRESET_MIN) return false;
      if (index < 0 || index >= state.preset.length) return false;
      setPreset(state.preset.filter((_, i) => i !== index));
      return true;
    }
    function addPresetRow() {
      if (state.preset.length >= PRESET_MAX) return false;
      const usedShape = new Set(state.preset.map((r) => r.shape));
      const shape = SHAPE_IDS.find((id) => !usedShape.has(id)) ?? SHAPE_IDS[0] ?? DEFAULT_LOOK.shape;
      const usedColor = new Set(state.preset.map((r) => r.color));
      const color = Object.keys(COLOR_OPTIONS).find((id) => !usedColor.has(id)) ?? Object.keys(COLOR_OPTIONS)[0] ?? DEFAULT_LOOK.color;
      const usedExpr = new Set(state.preset.map((r) => r.expression));
      const expression = EXPRESSION_PRESET_ORDER.find((id) => !usedExpr.has(id)) ?? DEFAULT_LOOK.expression;
      setPreset([...state.preset, { shape, color, expression }]);
      return true;
    }
    function presetChanged(state0 = state) {
      return JSON.stringify(state0.preset) !== JSON.stringify(PRESET_DEFAULT);
    }
    function resetPreset() {
      patchUi({ preset: PRESET_DEFAULT.map((r) => ({ ...r })) });
    }
    function setPreview(state2) {
      patchUi({ preview: state2, previewRotation: null });
    }
    function playRotationInPreview(rotation2) {
      if (rotation2.length === 0) return;
      patchUi({
        preview: rotation2[0].state,
        previewRotation: rotation2.map((r) => ({ ...r }))
      });
    }
    function setPreviewExpression(expression) {
      patchUi({ previewExpression: expression });
    }
    function setPreviewShape(shape) {
      patchUi({ previewShape: shape });
    }
    function setPreviewColor(color) {
      patchUi({ previewColor: color });
    }
    function previewSlotOf(slot) {
      patchUi({
        previewShape: slot.shape,
        previewColor: slot.color,
        previewExpression: slot.expression
      });
    }
    var monitorQueue = null;
    var activeMonitorId;
    var automaticPresetSlots = /* @__PURE__ */ new Map();
    function presetPositionFor(sessionId, firstPosition) {
      const known = automaticPresetSlots.get(sessionId);
      if (known !== void 0) return known;
      const position = Math.max(0, firstPosition);
      automaticPresetSlots.set(sessionId, position);
      return position;
    }
    function syncPresetSlots(shownIds) {
      if (shownIds.length === 0) return new Map(automaticPresetSlots);
      const kept = /* @__PURE__ */ new Map();
      for (const [id, position] of automaticPresetSlots) {
        if (shownIds.includes(id)) kept.set(id, position);
      }
      automaticPresetSlots.clear();
      const taken = /* @__PURE__ */ new Set();
      for (const id of shownIds) {
        const known = kept.get(id);
        if (known !== void 0 && !taken.has(known)) {
          automaticPresetSlots.set(id, known);
          taken.add(known);
        }
      }
      for (const id of shownIds) {
        if (automaticPresetSlots.has(id)) continue;
        let position = Math.max(0, shownIds.indexOf(id));
        while (taken.has(position)) position += 1;
        automaticPresetSlots.set(id, position);
        taken.add(position);
      }
      return new Map(automaticPresetSlots);
    }
    function currentMonitorQueue() {
      return monitorQueue ?? seedMonitorQueue(state.picked, activeMonitorId, MAX_MONITORED);
    }
    function publishMonitorQueue(next, activeId, save) {
      monitorQueue = next;
      if (activeId !== void 0) activeMonitorId = activeId;
      const nextPicked = next.order.filter((id) => id !== activeMonitorId);
      if (nextPicked.length === state.picked.length && nextPicked.every((id, i) => id === state.picked[i])) {
        if (save) persist();
        return;
      }
      state = { ...state, picked: nextPicked };
      if (save) persist();
      emit2();
    }
    function togglePicked(sessionId) {
      if (!sessionId || sessionId === activeMonitorId) return false;
      if (state.picked.includes(sessionId)) {
        removePicked(sessionId);
        return true;
      }
      const before = currentMonitorQueue();
      const next = addMonitorQueue(before, sessionId, MAX_MONITORED);
      if (next.capacity === before.capacity && !next.order.includes(sessionId)) return false;
      publishMonitorQueue(activeMonitorId ? visitMonitorQueue(next, activeMonitorId, /* @__PURE__ */ new Set()) : next, activeMonitorId, true);
      return true;
    }
    function removePicked(sessionId) {
      if (!state.picked.includes(sessionId)) return;
      publishMonitorQueue(removeMonitorQueue(currentMonitorQueue(), sessionId, activeMonitorId), activeMonitorId, true);
    }
    function clearPicked() {
      if (state.picked.length === 0) return;
      publishMonitorQueue(clearMonitorQueue(currentMonitorQueue(), activeMonitorId), activeMonitorId, true);
    }
    function monitoredList(activeId, picked, unavailable = /* @__PURE__ */ new Set()) {
      const queue = monitorQueue ?? seedMonitorQueue(picked, activeId, MAX_MONITORED);
      return activeId ? visitMonitorQueue(queue, activeId, unavailable).order : [...queue.order];
    }
    function visitMonitored(activeId, unavailable) {
      if (!activeId) return;
      const initial = monitorQueue ?? seedMonitorQueue(state.picked, activeId, MAX_MONITORED);
      const next = visitMonitorQueue(initial, activeId, unavailable);
      publishMonitorQueue(next, activeId, false);
    }
    function subscribe2(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    }
    function useUi(key) {
      return (0, import_react4.useSyncExternalStore)(subscribe2, () => state[key]);
    }

    // grokbot/plugin/src/client/Picker.tsx
    var import_jsx_runtime4 = require("react/jsx-runtime");
    function workspaceLabel(w) {
      const t = w.title?.trim();
      if (t) return t;
      const p = w.path ?? "";
      const base3 = p.split(/[\\/]/).filter(Boolean).pop();
      return base3 || p || "未分组";
    }
    function MonitorPicker({ useSessions, useSessionStatus, useWorkspaces, activeId }) {
      const list = useSessions((s) => s);
      const status = useSessionStatus((m) => m);
      const wsSnap = useWorkspaces((s) => s);
      const picked = useUi("picked");
      const sleepMinutes = useUi("sleepMinutes");
      const [openWs, setOpenWs] = (0, import_react5.useState)(null);
      const [now, setNow] = (0, import_react5.useState)(() => Date.now());
      (0, import_react5.useEffect)(() => {
        const id = window.setInterval(() => setNow(Date.now()), 5e3);
        return () => window.clearInterval(id);
      }, []);
      const agents = (0, import_react5.useMemo)(
        () => deriveAgents(list, status, now, sleepMinutes),
        [list, status, now, sleepMinutes]
      );
      const agentById = (0, import_react5.useMemo)(() => new Map(agents.map((a) => [a.id, a])), [agents]);
      const groups2 = (0, import_react5.useMemo)(() => {
        const items = wsSnap?.items ?? [];
        const byId = list?.byId ?? {};
        const out = [];
        const claimed = /* @__PURE__ */ new Set();
        for (const w of items) {
          const ids = (w.sessionIds ?? []).filter((id) => {
            const row2 = byId[id];
            return row2 !== void 0 && !row2.blank;
          });
          if (ids.length === 0) continue;
          for (const id of ids) claimed.add(id);
          out.push({
            key: w.workspaceId ?? w.path ?? "ws-" + out.length,
            label: workspaceLabel(w),
            ids
          });
        }
        const stray = (list?.ids ?? []).filter((id) => {
          const row2 = byId[id];
          return row2 !== void 0 && !row2.blank && !claimed.has(id);
        });
        if (stray.length > 0) out.push({ key: "", label: "未分组", ids: stray });
        return out;
      }, [wsSnap, list]);
      const activeGroup = (0, import_react5.useMemo)(() => {
        if (activeId === void 0) return null;
        return groups2.find((g) => g.ids.includes(activeId))?.key ?? null;
      }, [groups2, activeId]);
      const expanded = (0, import_react5.useMemo)(() => {
        if (openWs) return openWs;
        const init = /* @__PURE__ */ new Set();
        if (activeGroup !== null) init.add(activeGroup);
        return init;
      }, [openWs, activeGroup]);
      const toggleWs = (key) => {
        const next = new Set(expanded);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setOpenWs(next);
      };
      const total = (activeId === void 0 ? 0 : 1) + picked.length;
      const full = picked.length >= MAX_MONITORED - 1;
      return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "davf-picker", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "davf-picker-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: "选择要显示的对话" }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "davf-picker-hint", children: [
            "已选 ",
            total,
            "/",
            MAX_MONITORED,
            "（当前窗口自动在内，不用勾）"
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "davf-picker-body", children: groups2.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "davf-picker-empty", children: "还没有可显示的对话。" }) : groups2.map((g) => {
          const isOpen = expanded.has(g.key);
          const chosenCount = g.ids.filter((id) => picked.includes(id)).length;
          return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "davf-ws", children: [
            /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
              "button",
              {
                className: `davf-ws-head${isOpen ? " is-open" : ""}`,
                onClick: () => toggleWs(g.key),
                children: [
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "davf-ws-caret", children: isOpen ? "▾" : "▸" }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "davf-ws-name", title: g.label, children: g.label }),
                  /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "davf-ws-count", children: [
                    chosenCount > 0 ? `${chosenCount}/` : "",
                    g.ids.length
                  ] })
                ]
              }
            ),
            isOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "davf-ws-body", children: g.ids.map((id) => {
              const a = agentById.get(id);
              const isActive = id === activeId;
              const isPicked = picked.includes(id);
              const disabled = !isActive && !isPicked && full;
              return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
                "button",
                {
                  className: `davf-pick-row${isPicked ? " is-on" : ""}${isActive ? " is-active" : ""}`,
                  disabled,
                  title: disabled ? `最多显示 ${MAX_MONITORED} 个` : a?.name ?? id,
                  onClick: () => {
                    if (isActive) return;
                    togglePicked(id);
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: `davf-pick-box${isPicked ? " is-on" : ""}${isActive ? " is-active" : ""}`, children: isActive ? "·" : isPicked ? "✓" : "" }),
                    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "davf-pick-name", children: a?.name ?? id.slice(0, 10) }),
                    isActive ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "davf-pick-tag", children: "当前" }) : null,
                    a ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "davf-pick-act", children: ACTIVITY_LABEL[a.activity] }) : null
                  ]
                },
                id
              );
            }) }) : null
          ] }, g.key || "stray");
        }) })
      ] });
    }

    // grokbot/plugin/src/client/AvatarPanel.tsx
    var import_jsx_runtime5 = require("react/jsx-runtime");
    function AvatarPanel(props) {
      const tabInfo = props.useTabInfo?.();
      const mode = useMainOverlayMode();
      const [generation, setGeneration] = (0, import_react6.useState)(0);
      const retryDelay = (0, import_react6.useRef)(1e3);
      const retryTimer = (0, import_react6.useRef)(void 0);
      const pending = (0, import_react6.useRef)(false);
      const retry = (0, import_react6.useCallback)(() => {
        if (!pending.current) return;
        pending.current = false;
        clearTimeout(retryTimer.current);
        retryTimer.current = void 0;
        setGeneration((old) => old + 1);
      }, []);
      const onTransientDisconnect = (0, import_react6.useCallback)(() => {
        if (pending.current) return;
        pending.current = true;
        if (document.visibilityState === "visible" && document.hasFocus()) {
          retryTimer.current = setTimeout(retry, retryDelay.current);
        }
        retryDelay.current = Math.min(3e4, retryDelay.current * 2);
      }, [retry]);
      const onBridgeReady = (0, import_react6.useCallback)(() => {
        retryDelay.current = 1e3;
        pending.current = false;
        clearTimeout(retryTimer.current);
        retryTimer.current = void 0;
      }, []);
      (0, import_react6.useEffect)(() => {
        const onResume = () => {
          if (pending.current && document.visibilityState === "visible" && document.hasFocus()) retry();
        };
        window.addEventListener("focus", onResume);
        window.addEventListener("pageshow", onResume);
        document.addEventListener("visibilitychange", onResume);
        return () => {
          clearTimeout(retryTimer.current);
          window.removeEventListener("focus", onResume);
          window.removeEventListener("pageshow", onResume);
          document.removeEventListener("visibilitychange", onResume);
        };
      }, [retry]);
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(AvatarPanelBody, { ...props, mode: mode.place, paneId: tabInfo?.panel.id, openTab: tabInfo?.tab.actions.openTab, onTransientDisconnect, onBridgeReady }, generation);
    }
    function AvatarPanelBody({ useSessions, useSessionStatus, useWorkspaces, mode, paneId, openTab, onTransientDisconnect, onBridgeReady }) {
      const overlayMode = useMainOverlayMode();
      const mainBotSize = useUi("mainBotSize");
      const picked = useUi("picked");
      const look2 = useUi("look");
      const messageLook = useUi("messageLook");
      const [mainLookTarget, setMainLookTarget] = (0, import_react6.useState)("main");
      const looks = useUi("looks");
      const customizer = useUi("customizer");
      const picker = useUi("picker");
      const editTarget = useUi("editTarget");
      const fps = useUi("fps");
      const dwellMs = useUi("dwellMs");
      const rotation2 = useUi("rotation");
      const preset = useUi("preset");
      const sleepMinutes = useUi("sleepMinutes");
      const [isolationError, setIsolationError] = (0, import_react6.useState)(null);
      const [retryKey, setRetryKey] = (0, import_react6.useState)(0);
      const opaqueIds = (0, import_react6.useRef)(null);
      if (opaqueIds.current === null) opaqueIds.current = createOpaqueIds();
      const onIsolationUnavailable = (0, import_react6.useCallback)((reason, recoverable = false) => {
        if (recoverable) {
          onTransientDisconnect();
          return;
        }
        setIsolationError(reason);
      }, [onTransientDisconnect]);
      const list = useSessions((s) => s);
      const status = useSessionStatus((m) => m);
      const archivedIds = useWorkspaces((s) => s?.archivedSessionIds);
      const gridRef = (0, import_react6.useRef)(null);
      const bodyRef = (0, import_react6.useRef)(null);
      const [box, setBox] = (0, import_react6.useState)({ w: 0, h: 0 });
      const activeId = (0, import_react6.useMemo)(() => activeSessionOf(list), [list]);
      const unavailable = (0, import_react6.useMemo)(
        () => unavailableSessionIds(list, activeId, monitoredList(void 0, picked), archivedIds),
        [activeId, archivedIds, list, picked]
      );
      const shownIds = (0, import_react6.useMemo)(() => activeId ? monitoredList(activeId, picked, unavailable) : [], [activeId, picked, unavailable]);
      (0, import_react6.useLayoutEffect)(() => visitMonitored(activeId, unavailable), [activeId, unavailable]);
      const presetSlots = (0, import_react6.useMemo)(() => syncPresetSlots(shownIds), [shownIds]);
      const [now, setNow] = (0, import_react6.useState)(() => Date.now());
      (0, import_react6.useEffect)(() => {
        const id = window.setInterval(() => setNow(Date.now()), 5e3);
        return () => window.clearInterval(id);
      }, []);
      const agents = (0, import_react6.useMemo)(
        () => deriveAgents(list, status, now, sleepMinutes),
        [list, status, now, sleepMinutes]
      );
      const agentById = (0, import_react6.useMemo)(() => new Map(agents.map((a) => [a.id, a])), [agents]);
      const count = shownIds.length;
      const lookFor = (0, import_react6.useCallback)(
        (id) => looks[id] ?? presetLookAt(presetSlots.get(id) ?? presetPositionFor(id, shownIds.indexOf(id)), look2, preset),
        [looks, look2, shownIds, presetSlots, preset]
      );
      const [orientation, setOrientation] = (0, import_react6.useState)("landscape");
      const grid = (0, import_react6.useMemo)(() => gridOf(count, orientation), [count, orientation]);
      (0, import_react6.useEffect)(() => {
        const el = bodyRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver((entries) => {
          const r = entries[0]?.contentRect;
          if (!r) return;
          setOrientation((prev) => orientationOf(r.width, r.height, prev));
        });
        ro.observe(el);
        return () => ro.disconnect();
      }, []);
      (0, import_react6.useEffect)(() => {
        const el = gridRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver((entries) => {
          const r = entries[0]?.contentRect;
          if (r) setBox({ w: r.width, h: r.height });
        });
        ro.observe(el);
        return () => ro.disconnect();
      }, [customizer, picker, count, isolationError, retryKey]);
      const kidsCount = (0, import_react6.useMemo)(() => {
        const out = /* @__PURE__ */ new Map();
        for (const id of shownIds) {
          const n = countDescendants(list, id);
          if (n > 0) out.set(id, n);
        }
        return out;
      }, [list, shownIds]);
      const gap = 8;
      const cellW = Math.max(40, (box.w || 320) / grid.cols - gap);
      const cellH = Math.max(40, (box.h || 480) / grid.rows - gap);
      const botSize = Math.round(Math.max(40, Math.min(260, Math.min(cellW, cellH - 34) * 0.92)));
      const isolatedSnapshot = (0, import_react6.useMemo)(() => {
        if (count === 0 || !opaqueIds.current) return null;
        return snapshotForChild({
          shownIds,
          agentById,
          kidsCount,
          tokenFor: (id) => opaqueIds.current.get(id),
          lookFor,
          botSize,
          customizer,
          editTarget,
          fps,
          dwellMs,
          rotation: rotation2,
          cols: grid.cols,
          rows: grid.rows
        });
      }, [retryKey, count, shownIds, agentById, kidsCount, lookFor, botSize, customizer, editTarget, fps, dwellMs, rotation2, grid]);
      (0, import_react6.useEffect)(() => {
        if (count > 0 && isolatedSnapshot === null) onIsolationUnavailable("隔离显示数据不可用");
      }, [count, isolatedSnapshot, onIsolationUnavailable]);
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-panel", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-bar", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-title", children: "活动 AI" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "davf-count", children: [
            count,
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "davf-count-total", children: [
              "/",
              MAX_MONITORED
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
            "button",
            {
              type: "button",
              role: "switch",
              "aria-label": "Bot 展示位置",
              "aria-checked": mode === "main",
              title: mode === "main" ? "切回侧栏 Bot" : "切到 DSH 主窗口",
              className: "davf-g2-switch",
              "data-testid": "g2-placement-switch",
              onClick: () => {
                if (mode === "main") {
                  if (switchToSidebar()) {
                    setMainLookTarget("main");
                    patchUi({ customizer: false });
                  }
                  return;
                }
                const rect = gridRef.current?.getBoundingClientRect();
                const size = mainBotSize;
                const x = rect ? rect.left + rect.width / (2 * grid.cols) - size / 2 : window.innerWidth - 152;
                const y = rect ? rect.top + rect.height / (2 * grid.rows) - size / 2 : 96;
                switchToMain({ x, y }, paneId, openTab);
                setMainLookTarget("main");
                patchUi({ customizer: false, picker: false, editTarget: void 0 });
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-g2-switch-track", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-g2-switch-thumb" }) }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-g2-switch-text", children: mode === "main" ? "回侧栏" : "主窗口" })
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-capsule", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                className: `davf-cap${picker ? " is-on" : ""}`,
                title: "选择要显示在格子里的对话",
                onClick: () => togglePanel("picker"),
                children: "对话…"
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
              "button",
              {
                className: `davf-cap${customizer ? " is-on" : ""}`,
                title: "自定义外观",
                onClick: () => togglePanel("customizer"),
                children: "外观"
              }
            ),
            picked.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { className: "davf-cap davf-cap-quiet", title: "取消全部额外对话", onClick: clearPicked, children: "清空" }) : null
          ] })
        ] }),
        mode === "main" && overlayMode.returnError ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { role: "status", className: "davf-g2-switch-error", children: overlayMode.returnError }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-body", ref: bodyRef, children: [
          picker ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            MonitorPicker,
            {
              useSessions,
              useSessionStatus,
              useWorkspaces,
              activeId
            }
          ) : null,
          customizer ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            Customizer,
            {
              look: mode === "main" && mainLookTarget === "message" ? messageLook : editTarget === void 0 ? look2 : lookFor(editTarget),
              target: editTarget,
              targetName: editTarget === void 0 ? void 0 : agentById.get(editTarget)?.name,
              targetIndex: editTarget === void 0 ? 0 : shownIds.indexOf(editTarget),
              overridden: Object.keys(looks).length > 0,
              mainBotSize,
              showMainSize: mode === "main",
              mainLookTarget,
              onMainLookTarget: setMainLookTarget,
              onLook: (next) => mode === "main" && mainLookTarget === "message" ? setMessageLook(next) : setLook(editTarget, next),
              onReset: editTarget !== void 0 && looks[editTarget] ? () => resetLook(editTarget) : void 0
            }
          ) : null,
          mode === "main" ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-g2-placeholder" + (customizer || picker ? " is-compact" : ""), role: "status", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("svg", { className: "davf-g2-still", width: "96", height: "96", viewBox: "0 0 96 96", "aria-hidden": "true", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("rect", { x: "23", y: "30", width: "50", height: "38", rx: "5", fill: "none", stroke: "currentColor", strokeWidth: "2" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("circle", { cx: "60", cy: "40", r: "3", fill: "currentColor" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("path", { d: "M29 61 41 49l8 8 8-7 10 11", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-g2-placeholder-copy", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { className: "davf-g2-placeholder-title", children: "我在 DSH 桌面活动" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-g2-placeholder-subtitle", children: "侧边栏可以关闭" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-g2-placeholder-hint", children: "调整大小或外观，请点击上方「外观」" })
            ] })
          ] }) : isolationError ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-isolation-error", role: "status", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { children: [
              "独立画面暂不可用：",
              isolationError
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", onClick: () => {
              opaqueIds.current?.clear();
              setIsolationError(null);
              setRetryKey((n) => n + 1);
            }, children: "重试" })
          ] }) : isolatedSnapshot ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            IsolatedGrid,
            {
              snapshot: isolatedSnapshot,
              containerRef: gridRef,
              onUnavailable: onIsolationUnavailable,
              onConnected: onBridgeReady,
              controls: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                IsolationControls,
                {
                  shownIds,
                  displayNames: shownIds.map((id) => ({ name: agentById.get(id)?.name ?? "已关闭的对话", isChild: agentById.get(id)?.isChild ?? false })),
                  portraitSizes: isolatedSnapshot.rows.map((row2) => row2.look.size),
                  cols: grid.cols,
                  rows: grid.rows,
                  customizer,
                  editTarget,
                  onEdit: (target) => patchUi({ editTarget: target }),
                  onRemove: removePicked
                }
              )
            },
            retryKey
          ) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "davf-isolation-empty", role: "status", children: activeId === void 0 ? "当前窗口未识别到对话，正在等待…" : count === 0 ? "暂无可显示的会话" : "正在准备独立画面…" })
        ] })
      ] });
    }
    function Customizer({
      look: look2,
      target,
      targetName,
      targetIndex,
      overridden,
      mainBotSize,
      showMainSize,
      mainLookTarget,
      onMainLookTarget,
      onLook,
      onReset
    }) {
      const editingGlobal = target === void 0;
      const editingMessage = showMainSize && mainLookTarget === "message";
      const preset = useUi("preset");
      return (
        /* 和监视选择器用同一个大矩形框：视觉上两个面板是一对，
           而不是「一个框里一个裸列表」。 */
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-picker davf-custbox", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-picker-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: editingMessage ? "外观 · 消息 Bot" : editingGlobal ? "外观 · 全局" : `外观 · ${targetName ?? "这个 agent"}` }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-picker-hint", children: editingMessage ? "仅编辑消息 Bot 外观" : editingGlobal ? overridden ? "已单独设置的 agent 不受影响" : "整排按顺位自动分配" : targetIndex > 0 ? `第 ${targetIndex + 1} 格顺位 · 只改这一个` : "只改这一个" }),
            !editingMessage && onReset ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { className: "davf-cap davf-cap-quiet", title: "恢复成顺位预设", onClick: onReset, children: "恢复顺位" }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-picker-body davf-custbody", children: [
            showMainSize ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("section", { className: "davf-main-size", "data-block": "main-bot-size", "aria-label": "主窗口 Bot 尺寸设置", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("label", { className: "davf-main-size-label", htmlFor: "davf-main-bot-size", children: "尺寸 · 仅主窗口 Bot" }),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-main-size-control", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                    "input",
                    {
                      id: "davf-main-bot-size",
                      type: "range",
                      min: MIN_MAIN_BOT_SIZE,
                      max: MAX_MAIN_BOT_SIZE,
                      step: "1",
                      value: mainBotSize,
                      "aria-valuetext": `${mainBotSize} 像素`,
                      onChange: (e) => setMainBotSize(Number(e.currentTarget.value))
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "davf-cust-note", children: [
                    MIN_MAIN_BOT_SIZE,
                    "–",
                    MAX_MAIN_BOT_SIZE,
                    " px · 默认 96；侧栏自动适配"
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-look-target", role: "group", "aria-label": "外观编辑目标", "data-testid": "g3-look-target", children: [
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "davf-look-target-choice",
                    "aria-pressed": mainLookTarget === "main",
                    onClick: () => onMainLookTarget("main"),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "主 Bot" }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: "当前监控窗口" })
                    ]
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                  "button",
                  {
                    type: "button",
                    className: "davf-look-target-choice",
                    "aria-pressed": mainLookTarget === "message",
                    onClick: () => onMainLookTarget("message"),
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("strong", { children: "消息 Bot" }),
                      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("small", { children: "监控其他窗口" })
                    ]
                  }
                )
              ] })
            ] }) : null,
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-cust-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-cust-label", children: "形状" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "davf-shapes", children: Object.entries(SHAPE_OPTIONS).map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
                "button",
                {
                  className: `davf-shape${look2.shape === id ? " is-on" : ""}`,
                  title: inShapePreset(id, preset) ? label : `${label}（不参与顺位，只能手动选）`,
                  onClick: () => onLook({ ...look2, shape: id }),
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Bot, { state: "idle", look: { ...look2, shape: id, size: 30 }, frozenAt: 1.1, paper: "transparent" }),
                    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: label })
                  ]
                },
                id
              )) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-cust-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-cust-label", children: "配色" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "davf-colors", children: Object.entries(COLOR_OPTIONS).map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                "button",
                {
                  className: `davf-color${look2.color === id ? " is-on" : ""}`,
                  title: label,
                  style: { background: COLORS.find((c) => c.id === id)?.hex ?? "#000" },
                  onClick: () => onLook({ ...look2, color: id })
                },
                id
              )) })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-cust-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-cust-label", children: "表情" }),
              /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-chips davf-expressions", children: [
                Object.entries(EXPRESSION_OPTIONS).map(([id, label]) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                  "button",
                  {
                    className: `davf-chip${look2.expression === id ? " is-on" : ""}`,
                    title: label,
                    onClick: () => onLook({ ...look2, expression: id }),
                    children: label
                  },
                  id
                )),
                /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "davf-cust-note", title: "其余状态的表情是逐帧量出来的动画，不能被覆盖", children: "平时仅空闲时可见" })
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "davf-cust-note davf-cust-foot", children: [
              "调外观时作用对象会切到静止姿态，否则看不出变化；其余格子照常反映真实状态。",
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("br", {}),
              "帧率和动画轮播在「设置 → 插件 → 活动 AI」。"
            ] })
          ] })
        ] })
      );
    }

    // grokbot/plugin/src/client/GuideIcon.tsx
    var import_jsx_runtime6 = require("react/jsx-runtime");
    var FILL = 1.58;
    var ICON_LOOK = { ...DEFAULT_LOOK, expression: "attentif" };
    function GuideIcon({ size = 22, className }) {
      return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        "span",
        {
          className,
          style: {
            display: "grid",
            placeItems: "center",
            width: size,
            height: size,
            overflow: "hidden"
          },
          children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
            "span",
            {
              style: {
                width: size,
                height: size,
                display: "grid",
                placeItems: "center",
                // 图标一律用宿主的文字色，不读外观配色
                color: "currentColor"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { style: { display: "block", transform: `scale(${FILL})`, transformOrigin: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
                Bot,
                {
                  state: "idle",
                  look: { ...ICON_LOOK, size },
                  paper: "transparent",
                  ink: "currentColor",
                  frozenAt: EYES_OPEN_AT
                }
              ) })
            }
          )
        }
      );
    }

    // grokbot/plugin/src/client/MainOverlayG2.tsx
    var import_react9 = require("react");

    // grokbot/plugin/src/client/overlaySessionData.ts
    var EMPTY = { ready: false, otherCount: 0, otherChildCount: 0, pending: [] };
    function deriveOverlaySessionData(list, statuses, picked, archivedIds, now, sleepMinutes) {
      if (!list || list.phase !== "ready" || !Array.isArray(list.ids) || !list.byId || !statuses || typeof statuses.get !== "function") return EMPTY;
      const activeId = activeSessionOf(list);
      if (!activeId || !list.ids.includes(activeId)) return { ...EMPTY, ready: true };
      const unavailable = unavailableSessionIds(list, activeId, monitoredList(void 0, [...picked]), archivedIds);
      const shown = monitoredList(activeId, [...picked], unavailable);
      const others = shown.filter((id) => id !== activeId && !!list.byId[id] && !unavailable.has(id));
      const agents = deriveAgents(list, statuses, now, sleepMinutes);
      const byId = new Map(agents.map((a) => [a.id, a]));
      const row2 = byId.get(activeId);
      const pending = others.filter((id) => !!statuses?.get(id)?.pendingInteraction).map((id) => ({ id, name: byId.get(id)?.name ?? list.byId[id]?.displayTitle?.trim() ?? id.slice(0, 8) }));
      return {
        ready: true,
        activeId,
        main: row2 ? { name: row2.name, activity: row2.activity, childCount: countDescendants(list, activeId) } : void 0,
        otherCount: others.length,
        otherChildCount: others.reduce((sum, id) => sum + countDescendants(list, id), 0),
        pending
      };
    }

    // grokbot/plugin/src/client/OverlayBotMeta.tsx
    var import_react7 = require("react");
    var import_jsx_runtime7 = require("react/jsx-runtime");
    var base2 = {
      color: "var(--dsw-alias-label-primary,#242424)",
      fontFamily: "inherit",
      textShadow: "0 1px 1px var(--dsw-alias-bg-layer-1,#fff)",
      pointerEvents: "none",
      textAlign: "center",
      paddingBottom: 3
    };
    var pill = {
      boxSizing: "border-box",
      width: "min(82px, calc(100% - 8px))",
      minWidth: 0,
      height: 16,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      borderRadius: 999,
      border: "1px solid var(--dsw-alias-border-subtle,#d6d8dd)",
      background: "var(--dsw-alias-bg-layer-1,rgba(255,255,255,.92))",
      padding: "0 3px",
      fontSize: 9,
      lineHeight: "14px",
      textAlign: "center"
    };
    function Title({ text, fullTitle = text }) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("strong", { title: fullTitle, style: {
        display: "block",
        width: "calc(100% - 8px)",
        margin: "0 auto",
        fontSize: 12.5,
        fontWeight: 600,
        lineHeight: "18px",
        height: 18,
        textAlign: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }, children: text });
    }
    function Status({ label, activity }) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { ...pill, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 2 }, title: label, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { "aria-hidden": "true", style: {
          width: 6,
          height: 6,
          flexShrink: 0,
          borderRadius: "50%",
          background: ACTIVITY_PRESENTATION[activity].color
        } }),
        label
      ] });
    }
    function MetaRow({ label, activity, children }) {
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 4 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Status, { label, activity }),
        children > 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { style: { ...pill, display: "inline-flex", alignItems: "center", justifyContent: "center" }, title: "子代理：" + children, children: [
          "×",
          children,
          " 子代理"
        ] }) : null
      ] });
    }
    function PendingRow({ items, reduceMotion }) {
      const nodes = (0, import_react7.useRef)(/* @__PURE__ */ new Map());
      const previous = (0, import_react7.useRef)(null);
      const visible = items.slice(0, 2);
      const ids = visible.map((item) => item.id).join("|");
      (0, import_react7.useLayoutEffect)(() => {
        const next = visible.map((item) => ({ id: item.id, top: nodes.current.get(item.id)?.getBoundingClientRect().top ?? 0 }));
        const prior = previous.current;
        if (prior && !reduceMotion && prior.some((item) => !next.some((row2) => row2.id === item.id))) {
          for (const row2 of next) {
            const el = nodes.current.get(row2.id);
            if (!el || typeof el.animate !== "function") continue;
            const before = prior.find((item) => item.id === row2.id);
            const from = before ? before.top - row2.top : 20;
            if (Math.abs(from) > 0.5) el.animate([
              { transform: "translateY(" + from + "px)", opacity: before ? 1 : 0.25 },
              { transform: "translateY(0)", opacity: 1 }
            ], { duration: 250, easing: "ease-out" });
          }
        }
        previous.current = next;
      }, [ids, reduceMotion]);
      if (visible.length === 0) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { "data-testid": "overlay-message-pending", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginTop: 4 }, children: visible.map((item) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "span",
        {
          ref: (node) => {
            if (node) nodes.current.set(item.id, node);
            else nodes.current.delete(item.id);
          },
          "data-session": item.id,
          style: { ...pill, display: "block" },
          title: item.name + " · 等待你处理",
          "aria-label": item.name + " 等待你处理",
          children: item.name.slice(0, 6)
        },
        item.id
      )) });
    }
    function MainBotMeta({ data }) {
      if (!data.main) return null;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { "data-testid": "overlay-main-meta", style: base2, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Title, { text: data.main.name }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MetaRow, { label: ACTIVITY_PRESENTATION[data.main.activity].label, activity: data.main.activity, children: data.main.childCount })
      ] });
    }
    function MessageBotMeta({ data, reduceMotion, compact = false }) {
      if (!data.ready || !data.activeId) return null;
      const fullTitle = "监控其他窗口 " + data.otherCount;
      return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { "data-testid": "overlay-message-meta", style: base2, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(Title, { text: compact ? "监控 " + data.otherCount : fullTitle, fullTitle }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(PendingRow, { items: data.pending, reduceMotion })
      ] });
    }

    // grokbot/plugin/src/client/MainOverlayG1.tsx
    var import_react8 = require("react");
    var import_jsx_runtime8 = require("react/jsx-runtime");
    var SIZE = 96;
    function safeOverlayTop() {
      const css = getComputedStyle(document.documentElement);
      const value = (name) => Number.parseFloat(css.getPropertyValue(name)) || 0;
      return Math.max(40, value("--dsh-frame-top-clearance"), value("--dsh-frame-overlay-top"), value("--dsh-frame-chrome-top")) + 8;
    }
    function clampOverlay(point, size = SIZE) {
      return {
        x: Math.max(0, Math.min(point.x, Math.max(0, window.innerWidth - size))),
        y: Math.max(safeOverlayTop(), Math.min(point.y, Math.max(safeOverlayTop(), window.innerHeight - size)))
      };
    }

    // grokbot/plugin/src/client/MainOverlayG2.tsx
    var import_jsx_runtime9 = require("react/jsx-runtime");
    var POSITION_KEY = "dsh-agents-bot:main-position-v1";
    var SECONDARY_RATIO = 0.6;
    var SECONDARY_GAP = 8 * 0.7;
    var VISIBLE_BOTTOM = 0.85;
    var overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
    var MAIN_META_FOOTER = 64;
    var messageMetaFooter = (pending) => pending > 1 ? 64 : pending > 0 ? 44 : 24;
    var mainMetaWidthOf = (size) => Math.max(112, size - 8);
    var messageMetaWidthOf = (small) => Math.max(86, Math.min(96, small));
    var isLateral = (main, p, size, small) => p.x >= main.x + size || p.x + small <= main.x;
    var smallVisualShiftOf = (main, p, size, small) => {
      const inward = size * 0.095;
      return p.x >= main.x + size ? { x: -inward, y: 0 } : p.x + small <= main.x ? { x: inward, y: 0 } : p.y >= main.y + size ? { x: 0, y: -inward } : { x: 0, y: inward };
    };
    var messageMetaLeftOf = (main, p, size, small, width) => p.x + small / 2 + smallVisualShiftOf(main, p, size, small).x - width / 2;
    function secondaryPosition(main, size, viewport, top, inputs = [], withMeta = false, pendingCount = 0) {
      const small = size * SECONDARY_RATIO;
      const gap = SECONDARY_GAP;
      const mainInfoWidth = mainMetaWidthOf(size), smallInfoWidth = messageMetaWidthOf(small);
      const smallFooter = messageMetaFooter(pendingCount);
      const mainInfo = { x: main.x + (size - mainInfoWidth) / 2, y: main.y + size + 3, width: mainInfoWidth, height: MAIN_META_FOOTER - 3 };
      const smallInfo = (p) => ({
        x: messageMetaLeftOf(main, p, size, small, smallInfoWidth),
        y: (isLateral(main, p, size, small) ? main.y + size : p.y + small) + 3,
        width: smallInfoWidth,
        height: smallFooter - 3
      });
      const verticalX = Math.max(
        (smallInfoWidth - small) / 2,
        Math.min(main.x + (size - small) / 2, viewport.width - (smallInfoWidth + small) / 2)
      );
      const choices = [
        { x: main.x + size + gap, y: main.y + (size - small) * VISIBLE_BOTTOM },
        { x: main.x - small - gap, y: main.y + (size - small) * VISIBLE_BOTTOM },
        { x: verticalX, y: main.y - small - (withMeta ? smallFooter : 0) - gap },
        { x: verticalX, y: main.y + size + (withMeta ? MAIN_META_FOOTER + size * 0.095 : 0) + gap }
      ];
      const within = (p) => {
        const info = smallInfo(p);
        return p.x >= 0 && p.y >= top && p.x + small <= viewport.width && (!withMeta || info.x >= 0 && info.x + info.width <= viewport.width && info.y >= top && info.y + info.height <= viewport.height) && (!withMeta || p.y + small <= viewport.height);
      };
      const separated = (p) => {
        const mainBot = { ...main, width: size, height: size }, smallBot = { ...p, width: small, height: small };
        const shift = smallVisualShiftOf(main, p, size, small);
        const drawnSmall = { x: p.x + shift.x, y: p.y + shift.y, width: small, height: small };
        return !overlaps(mainBot, smallBot) && (!withMeta || !overlaps(mainInfo, drawnSmall) && !overlaps(mainBot, smallInfo(p)) && !overlaps(mainInfo, smallInfo(p)));
      };
      const clear = (p) => inputs.every((input) => !overlaps({ ...p, width: small, height: small }, input));
      const viable = choices.filter((p) => within(p) && separated(p));
      const chosen = viable.find(clear) ?? viable[0];
      if (chosen) return chosen;
      const fallback = choices.map((p) => ({
        x: Math.max(0, Math.min(p.x, viewport.width - small)),
        y: Math.max(top, Math.min(p.y, viewport.height - small - (withMeta ? smallFooter : 0)))
      }));
      return fallback.find((p) => within(p) && separated(p) && clear(p)) ?? fallback.find((p) => within(p) && separated(p)) ?? fallback.find((p) => !overlaps({ ...p, width: small, height: small }, { ...main, width: size, height: size })) ?? fallback[0];
    }
    function readPosition(raw) {
      if (!raw) return null;
      try {
        const v = JSON.parse(raw);
        return v && typeof v === "object" && !Array.isArray(v) && typeof v.x === "number" && Number.isFinite(v.x) && typeof v.y === "number" && Number.isFinite(v.y) ? { x: v.x, y: v.y } : null;
      } catch {
        return null;
      }
    }
    function storedPosition() {
      try {
        return readPosition(localStorage.getItem(POSITION_KEY));
      } catch {
        return null;
      }
    }
    function savePosition(p) {
      try {
        localStorage.setItem(POSITION_KEY, JSON.stringify(p));
      } catch {
      }
    }
    function MainOverlayG2({ useSessions, useSessionStatus, useWorkspaces } = {}) {
      const mode = useMainOverlayMode();
      if (mode.place !== "main") return null;
      if (useSessions && useSessionStatus && useWorkspaces) return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
        LiveOverlayBot,
        {
          origin: mode.origin,
          returnError: mode.returnError,
          useSessions,
          useSessionStatus,
          useWorkspaces
        }
      );
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ActiveBot, { origin: mode.origin, returnError: mode.returnError, data: null });
    }
    function LiveOverlayBot({ origin: origin2, returnError, useSessions, useSessionStatus, useWorkspaces }) {
      const list = useSessions((s) => s);
      const status = useSessionStatus((s) => s);
      const archived = useWorkspaces((s) => s?.archivedSessionIds);
      const picked = useUi("picked");
      const sleepMinutes = useUi("sleepMinutes");
      const [now, setNow] = (0, import_react9.useState)(() => Date.now());
      (0, import_react9.useEffect)(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 5e3);
        return () => window.clearInterval(timer);
      }, []);
      const data = (0, import_react9.useMemo)(
        () => deriveOverlaySessionData(list, status, picked, archived, now, sleepMinutes),
        [list, status, picked, archived, now, sleepMinutes]
      );
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(ActiveBot, { origin: origin2, returnError, data });
    }
    function ActiveBot({ origin: origin2, returnError, data }) {
      const look2 = useUi("look");
      const messageLook = useUi("messageLook");
      const rotation2 = useUi("rotation");
      const fps = useUi("fps");
      const size = useUi("mainBotSize");
      const [position, setPosition] = (0, import_react9.useState)(() => clampOverlay(storedPosition() ?? origin2 ?? { x: window.innerWidth - 152, y: 96 }, size));
      const [reduceMotion, setReduceMotion] = (0, import_react9.useState)(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      const drag = (0, import_react9.useRef)(null);
      const dragInputs = (0, import_react9.useRef)(null);
      const clampMain = (0, import_react9.useCallback)((p) => {
        const next = clampOverlay(p, size);
        if (!data?.ready) return next;
        const inset = Math.max(0, (mainMetaWidthOf(size) - size) / 2);
        return {
          x: Math.max(inset, Math.min(next.x, Math.max(inset, window.innerWidth - size - inset))),
          y: Math.min(next.y, Math.max(safeOverlayTop(), window.innerHeight - size - MAIN_META_FOOTER))
        };
      }, [size, data?.ready]);
      const clamp2 = (0, import_react9.useCallback)(() => setPosition((p) => ({ ...clampMain(p) })), [clampMain]);
      (0, import_react9.useEffect)(() => {
        const query = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduceMotion(query.matches);
        query.addEventListener("change", update);
        return () => query.removeEventListener("change", update);
      }, []);
      (0, import_react9.useEffect)(() => {
        clamp2();
        const frame = requestAnimationFrame(clamp2);
        const short = window.setTimeout(clamp2, 120);
        const long = window.setTimeout(clamp2, 600);
        window.addEventListener("resize", clamp2);
        document.addEventListener("DOMContentLoaded", clamp2);
        window.addEventListener("load", clamp2);
        return () => {
          cancelAnimationFrame(frame);
          clearTimeout(short);
          clearTimeout(long);
          window.removeEventListener("resize", clamp2);
          document.removeEventListener("DOMContentLoaded", clamp2);
          window.removeEventListener("load", clamp2);
        };
      }, [clamp2]);
      const commit = (p) => {
        const next = clampMain(p);
        setPosition(next);
        savePosition(next);
      };
      const inputBounds = dragInputs.current ?? Array.from(document.querySelectorAll('textarea, input, [contenteditable="true"], [role="textbox"]')).filter((el) => el.getClientRects().length > 0 && !el.closest(".davf-g1-shell")).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      });
      const smallSize = size * SECONDARY_RATIO;
      const small = secondaryPosition(position, size, { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight }, safeOverlayTop(), inputBounds, !!data?.ready, data?.pending.length ?? 0);
      const smallVisualShift = smallVisualShiftOf(position, small, size, smallSize);
      const activity = data?.main?.activity ?? "idle";
      const mainRotation = rotation2[activity];
      const messageRotation = rotation2.idle;
      const mainState = mainRotation?.[0]?.state ?? ACTIVITY_STATE[activity];
      const mainMetaWidth = mainMetaWidthOf(size);
      const smallMetaWidth = messageMetaWidthOf(smallSize);
      const smallMetaLeft = messageMetaLeftOf(position, small, size, smallSize, smallMetaWidth);
      const smallMetaTop = (isLateral(position, small, size, smallSize) ? position.y + size : small.y + smallSize) + 3;
      return /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "davf-g1-shell", "data-testid": "main-overlay-g2", children: [
        /* @__PURE__ */ (0, import_jsx_runtime9.jsxs)("div", { className: "davf-g1-entity", style: { left: position.x, top: position.y, width: size, height: size, ["--davf-main-size"]: `${size}px` }, "data-x": position.x, "data-y": position.y, children: [
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            Bot,
            {
              state: mainState,
              rotation: mainRotation,
              look: { ...look2, size },
              fps,
              frameGroup: "main-overlay",
              frozenAt: reduceMotion ? 1.1 : void 0,
              follow: !reduceMotion
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
            "button",
            {
              type: "button",
              className: "davf-g1-hit",
              "aria-label": "主 Bot，拖动或用方向键移动，Esc 退出焦点",
              "data-testid": "main-overlay-g2-hit",
              onKeyDown: (e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.currentTarget.blur();
                  return;
                }
                const step = e.shiftKey ? 24 : 8;
                const move = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
                const delta = move[e.key];
                if (delta) {
                  e.preventDefault();
                  commit({ x: position.x + delta.x, y: position.y + delta.y });
                }
              },
              onPointerDown: (e) => {
                if (e.button !== 0) return;
                drag.current = { id: e.pointerId, start: { x: e.clientX, y: e.clientY }, origin: position, moved: false };
                dragInputs.current = inputBounds;
                e.currentTarget.setPointerCapture(e.pointerId);
                e.preventDefault();
              },
              onPointerMove: (e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                const dx = e.clientX - d.start.x, dy = e.clientY - d.start.y;
                if (Math.hypot(dx, dy) > 4) d.moved = true;
                setPosition(clampMain({ x: d.origin.x + dx, y: d.origin.y + dy }));
              },
              onPointerUp: (e) => {
                const d = drag.current;
                if (!d || d.id !== e.pointerId) return;
                drag.current = null;
                dragInputs.current = null;
                setPosition((p) => ({ ...p }));
                if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
                if (d.moved) savePosition(clampMain({ x: d.origin.x + e.clientX - d.start.x, y: d.origin.y + e.clientY - d.start.y }));
              },
              onPointerCancel: () => {
                drag.current = null;
                dragInputs.current = null;
                setPosition((p) => ({ ...p }));
              }
            }
          ),
          returnError ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("span", { className: "davf-g2-error", role: "status", children: returnError }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { "data-testid": "main-overlay-g2-small", "aria-hidden": "true", style: { position: "absolute", left: small.x, top: small.y, width: smallSize, height: smallSize, pointerEvents: "none" }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: { transform: `translate(${smallVisualShift.x}px, ${smallVisualShift.y}px)` }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(
          Bot,
          {
            state: messageRotation?.[0]?.state ?? ACTIVITY_STATE.idle,
            rotation: messageRotation,
            look: { ...messageLook, size: smallSize },
            fps,
            frameGroup: "main-overlay",
            frozenAt: reduceMotion ? 1.1 : void 0,
            follow: !reduceMotion
          }
        ) }) }),
        data?.ready ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
          position: "absolute",
          left: Math.max(0, Math.min(position.x + (size - mainMetaWidth) / 2, window.innerWidth - mainMetaWidth)),
          top: position.y + size + 3,
          width: mainMetaWidth,
          pointerEvents: "none"
        }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MainBotMeta, { data }) }) : null,
        data?.ready ? /* @__PURE__ */ (0, import_jsx_runtime9.jsx)("div", { style: {
          position: "absolute",
          left: Math.max(0, Math.min(smallMetaLeft, window.innerWidth - smallMetaWidth)),
          top: smallMetaTop,
          width: smallMetaWidth,
          pointerEvents: "none"
        }, children: /* @__PURE__ */ (0, import_jsx_runtime9.jsx)(MessageBotMeta, { data, reduceMotion, compact: smallMetaWidth < 96 }) }) : null
      ] });
    }

    // grokbot/plugin/src/client/Settings.tsx
    var import_react10 = require("react");
    var import_jsx_runtime10 = require("react/jsx-runtime");
    var ANIMATION_LABEL = new Map(ANIMATION_OPTIONS.map((o) => [o.id, o.label]));
    function ConfirmButton({
      className,
      label,
      confirmLabel,
      title,
      onConfirm
    }) {
      const [armed, setArmed] = (0, import_react10.useState)(false);
      (0, import_react10.useEffect)(() => {
        if (!armed) return;
        const id = setTimeout(() => setArmed(false), 3e3);
        return () => clearTimeout(id);
      }, [armed]);
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
        "button",
        {
          className: `${className ?? ""}${armed ? " is-armed" : ""}`,
          title: armed ? "再点一次才会执行" : title,
          onClick: () => {
            if (!armed) {
              setArmed(true);
              return;
            }
            setArmed(false);
            onConfirm();
          },
          children: armed ? confirmLabel : label
        }
      );
    }
    function SettingsPage() {
      const rotation2 = useUi("rotation");
      const fps = useUi("fps");
      const dwellMs = useUi("dwellMs");
      const sleepMinutes = useUi("sleepMinutes");
      const preview = useUi("preview");
      const previewShape = useUi("previewShape");
      const previewColor = useUi("previewColor");
      const previewExpression = useUi("previewExpression");
      const previewRotation = useUi("previewRotation");
      const look2 = useUi("look");
      const changedCount = ACTIVITY_ORDER.filter((a) => rotationChanged(a)).length;
      const [mapOpen, setMapOpen] = (0, import_react10.useState)(false);
      const previewLook = (0, import_react10.useMemo)(
        () => ({
          ...look2,
          shape: previewShape ?? look2.shape,
          color: previewColor ?? look2.color,
          expression: previewExpression ?? look2.expression
        }),
        [look2, previewShape, previewColor, previewExpression]
      );
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(Preview, { preview, rotation: previewRotation, look: previewLook }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "davs-card", "data-block": "map", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-card-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("h4", { className: "davs-title", children: "动画映射" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "davs-desc", children: "每个活动播哪几个动画、各播几遍。最多两项轮播 —— 配一项就是固定播，配两项就交替。 按「遍」而不是「秒」，是因为每个动画长度不同（眨眼 1.6 秒、检索 3.4 秒）， 按遍数配所见即所得，而且不会被截断。" })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-card-tools", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                ConfirmButton,
                {
                  className: "davs-btn",
                  label: "恢复默认",
                  confirmLabel: `确认恢复 ${ACTIVITY_ORDER.length} 个活动？`,
                  title: changedCount > 0 ? `把所有活动恢复成默认（当前 ${changedCount} 项已改）` : "把所有活动恢复成默认（当前没有改动）",
                  onConfirm: resetAllRotation
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "button",
                {
                  className: `davs-chip davs-chip-toggle${mapOpen ? " is-on" : ""}`,
                  onClick: () => setMapOpen((v) => !v),
                  title: mapOpen ? "收起这一块" : "展开这一块",
                  children: mapOpen ? "收起" : "展开调整"
                }
              )
            ] })
          ] }),
          mapOpen ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(import_jsx_runtime10.Fragment, { children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "davs-rows", children: ACTIVITY_ORDER.map((activity) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            RotationRow,
            {
              activity,
              rotation: rotation2[activity],
              changed: rotationChanged(activity)
            },
            activity
          )) }) }) : /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "davs-fold-note", children: [
            "已收起 · ",
            ACTIVITY_ORDER.length,
            " 个活动",
            changedCount > 0 ? ` · ${changedCount} 项已改` : ""
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(PresetSection, {}),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("h4", { className: "davs-title", children: "休眠" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "davs-desc", children: "一个 agent 多久没有活动之后，就画成休眠状态。" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-chips", children: [
            SLEEP_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "button",
              {
                className: `davs-chip${sleepMinutes === o.id ? " is-on" : ""}`,
                onClick: () => setSleepMinutes(o.id),
                children: o.label
              },
              o.id
            )),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-note", children: "无活动超过这个时长即进入休眠" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("h4", { className: "davs-title", children: "帧率" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "davs-desc", children: "整个面板共用一档，不按 agent 区分。这是上限不是实际帧率 —— 屏幕刷新率是天花板， 这里只负责往下压。" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-chips", children: [
            FPS_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "button",
              {
                className: `davs-chip${fps === o.id ? " is-on" : ""}`,
                title: o.hint,
                onClick: () => setFps(o.id),
                children: o.label
              },
              o.id
            )),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-note", children: FPS_OPTIONS.find((o) => o.id === fps)?.hint ?? "" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-section", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("h4", { className: "davs-title", children: "动画停留" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "davs-desc", children: "每个动画至少显示这么久，才允许换成下一个。工具调用本身很短（读文件约 8 毫秒、 改文件约 26 毫秒），而对应动画要 2~3.4 秒 —— 不节流时一半以上的动画播不完， 看起来像一闪而过。开启后画面会平滑一些，代价是极短的活动可能被合并掉。" }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-chips", children: [
            DWELL_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "button",
              {
                className: `davs-chip${dwellMs === o.id ? " is-on" : ""}`,
                title: o.hint,
                onClick: () => setDwellMs(o.id),
                children: o.label
              },
              o.id
            )),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-note", children: DWELL_OPTIONS.find((o) => o.id === dwellMs)?.hint ?? "" })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("p", { className: "davs-foot", children: "形状、配色、表情属于单个 bot 的外观，在右栏「活动 AI → 外观」里调。" })
      ] });
    }
    function PresetSection() {
      const preset = useUi("preset");
      const look2 = useUi("look");
      const changed = presetChanged();
      const [expanded, setExpanded] = (0, import_react10.useState)(false);
      const shapeOpts = Object.entries(SHAPE_OPTIONS);
      const colorOpts = Object.entries(COLOR_OPTIONS);
      const exprOpts = Object.entries(EXPRESSION_OPTIONS);
      const tooFew = preset.length < PRESET_MAX;
      return (
        /* 和「动画映射」同一种外壳：圆角边框 + 标题行右侧工具区。
           v0.3.11 起两块真正长得一样 —— 之前只有动画映射有壳、收起胶囊
           还沉在标题下面，用户要求「收起挪到和动画映射一样的位置」。 */
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("section", { className: "davs-card", "data-block": "preset", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-card-head", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("h4", { className: "davs-title", children: "自动分配顺位" }),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "davs-desc", children: [
                "加第 N 个格子时，它长什么样 —— 每行一个「形状 + 配色 + 表情」。 第 1 格永远是当前窗口，由右栏的「外观 · 全局」决定，不在这里。 所以 ",
                PRESET_MAX,
                " 行正好覆盖第 2~",
                PRESET_MAX + 1,
                " 格。 行数少于格子数会「从头重复」。"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-card-tools", children: [
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                ConfirmButton,
                {
                  className: "davs-btn",
                  label: "恢复默认",
                  confirmLabel: "确认恢复顺位？",
                  title: changed ? "恢复成默认顺位（当前已改）" : "恢复成默认顺位（当前没有改动）",
                  onConfirm: resetPreset
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                "button",
                {
                  className: `davs-chip davs-chip-toggle${expanded ? " is-on" : ""}`,
                  onClick: () => setExpanded((v) => !v),
                  title: expanded ? "收起这一块" : "展开这一块",
                  children: expanded ? "收起" : "展开调整"
                }
              )
            ] })
          ] }),
          expanded ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(import_jsx_runtime10.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-rows davs-rows-preset", children: [
              preset.map((slot, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-row", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "davs-row-name", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "davs-row-label", children: [
                  "第 ",
                  i + 2,
                  " 格"
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-row-slots", children: [
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-preset-thumb", title: "这一格的实际样子", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    Bot,
                    {
                      state: "idle",
                      look: {
                        ...look2,
                        shape: slot.shape,
                        color: slot.color ?? look2.color,
                        expression: slot.expression,
                        size: 24
                      },
                      frozenAt: EYES_OPEN_AT,
                      paper: "transparent"
                    }
                  ) }),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "select",
                    {
                      className: "davs-select",
                      value: slot.shape,
                      onChange: (e) => setPresetAt(i, { shape: e.target.value }),
                      title: `第 ${i + 2} 格用哪个形状`,
                      children: shapeOpts.map(([optId, label]) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: optId, children: label }, optId))
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "select",
                    {
                      className: "davs-select davs-select-color",
                      value: slot.color ?? look2.color,
                      onChange: (e) => setPresetAt(i, { color: e.target.value }),
                      title: `第 ${i + 2} 格用哪个配色`,
                      children: colorOpts.map(([optId, label]) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: optId, children: label }, optId))
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "select",
                    {
                      className: "davs-select",
                      value: slot.expression,
                      onChange: (e) => setPresetAt(i, { expression: e.target.value }),
                      title: `第 ${i + 2} 格用哪个表情`,
                      children: exprOpts.map(([optId, label]) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: optId, children: label }, optId))
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "button",
                    {
                      className: "davs-btn davs-btn-try",
                      onClick: () => previewSlotOf({ ...slot, color: slot.color ?? look2.color }),
                      title: "把这一行的样子放到上面的试片里看",
                      children: "试播"
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
                    "button",
                    {
                      className: "davs-icon",
                      onClick: () => removePresetAt(i),
                      disabled: preset.length <= PRESET_MIN,
                      title: preset.length <= PRESET_MIN ? `至少保留 ${PRESET_MIN} 行` : "去掉这一行",
                      children: "−"
                    }
                  )
                ] })
              ] }, i)),
              preset.length < PRESET_MAX ? /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-row davs-row-add", children: [
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "davs-row-name", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "davs-row-label davs-row-label-dim", children: [
                  "第 ",
                  preset.length + 2,
                  " 格"
                ] }) }),
                /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "davs-row-slots", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "davs-icon davs-order-add", onClick: addPresetRow, title: "加一行", children: "＋" }) })
              ] }) : null
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "davs-fold-note", children: [
              "当前 ",
              preset.length,
              " 行",
              tooFew ? ` · 少于 ${PRESET_MAX} 行，第 ${preset.length + 2} 格起会从头重复` : " · 覆盖满 9 格"
            ] })
          ] }) : (
            /* 和动画映射一样给一句摘要，避免「一片空白、不知道是收起来了还是坏了」 */
            /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("p", { className: "davs-fold-note", children: [
              "已收起 · ",
              preset.length,
              " 行（第 2~",
              preset.length + 1,
              " 格）",
              changed ? " · 已改" : ""
            ] })
          )
        ] })
      );
    }
    var PREVIEW_SIZE = 288;
    function Preview({
      preview,
      rotation: rotation2,
      look: look2
    }) {
      const current2 = preview ?? "idle";
      const length = playLengthOf(current2);
      const curShape = look2.shape;
      const curColor = look2.color;
      const curExpr = look2.expression;
      const animCur = rotation2 ? describeShort(rotation2) : ANIMATION_LABEL.get(current2) ?? current2;
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-preview", children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("div", { className: "davs-preview-bot", children: /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          Bot,
          {
            state: current2,
            rotation: rotation2 ?? void 0,
            look: { ...look2, size: PREVIEW_SIZE },
            paper: "transparent"
          }
        ) }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-groups", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            ChipGroup,
            {
              title: "动画",
              cur: animCur,
              hint: rotation2 ? "试播这条轮播" : `一遍约 ${length.toFixed(1)} 秒`,
              items: ANIMATION_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
              value: current2,
              onPick: (id) => setPreview(id)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            ChipGroup,
            {
              title: "形状",
              cur: SHAPE_OPTIONS[curShape] ?? curShape,
              items: Object.entries(SHAPE_OPTIONS).map(([id, label]) => ({ id, label })),
              value: curShape,
              onPick: setPreviewShape
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            ChipGroup,
            {
              title: "配色",
              cur: COLOR_OPTIONS[curColor] ?? curColor,
              items: Object.entries(COLOR_OPTIONS).map(([id, label]) => ({ id, label })),
              value: curColor,
              onPick: setPreviewColor,
              swatch: true
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            ChipGroup,
            {
              title: "表情",
              cur: EXPRESSION_OPTIONS[curExpr] ?? curExpr,
              items: Object.entries(EXPRESSION_OPTIONS).map(([id, label]) => ({ id, label })),
              value: curExpr,
              onPick: setPreviewExpression
            }
          )
        ] })
      ] });
    }
    function ChipGroup({
      title,
      cur,
      hint,
      items,
      value,
      onPick,
      swatch = false
    }) {
      const cols = Math.ceil(items.length / (swatch ? 1 : 3));
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-group", "data-group": title, children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-group-head", children: [
          title,
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-group-cur", children: cur }),
          hint ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-group-cur", children: hint }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
          "div",
          {
            className: `davs-group-chips${swatch ? " davs-group-chips-swatch" : ""}`,
            style: { "--cols": cols },
            children: items.map((it) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)(
              "button",
              {
                className: `davs-chip davs-chip-sm${value === it.id ? " is-on" : ""}${swatch ? " davs-chip-swatch" : ""}`,
                onClick: () => onPick(it.id),
                title: `${title}：${it.label}`,
                children: [
                  swatch ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-swatch", style: { background: inkOf(it.id) } }) : null,
                  it.label
                ]
              },
              it.id
            ))
          }
        )
      ] });
    }
    function RotationRow({
      activity,
      rotation: rotation2,
      changed
    }) {
      const [expanded, setExpanded] = (0, import_react10.useState)(rotation2.length > 1);
      (0, import_react10.useEffect)(() => {
        if (rotation2.length <= 1) setExpanded(false);
      }, [rotation2.length]);
      const items = expanded ? rotation2 : rotation2.slice(0, 1);
      const total = cycleLength(items);
      function patch(index, next) {
        const base3 = items.map((r) => ({ ...r }));
        const target = base3[index];
        if (!target) return;
        if (next.state !== void 0) target.state = next.state;
        if (next.plays !== void 0) target.plays = next.plays;
        setRotation(activity, base3);
      }
      function addSecond() {
        const used = new Set(items.map((r) => r.state));
        const pick = activity === "idle" && !used.has("wink") ? "wink" : activity === "thinking" && !used.has("burst") ? "burst" : "idle";
        setExpanded(true);
        setRotation(activity, [...items, { state: pick, plays: 1 }]);
      }
      function removeSecond() {
        setExpanded(false);
        setRotation(activity, items.slice(0, 1));
      }
      return /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-row", "data-changed": changed ? "" : void 0, children: [
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-row-name", children: [
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-row-label", children: ACTIVITY_LABEL[activity] }),
          changed ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              className: "davs-link",
              onClick: () => resetRotation(activity),
              title: `恢复默认：${describeRotation(DEFAULT_ROTATION[activity])}`,
              children: "已改 · 恢复"
            }
          ) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-row-slots", children: [
          items.map((item, i) => /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("div", { className: "davs-slot", children: [
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "select",
              {
                className: "davs-select",
                value: item.state,
                onChange: (e) => patch(i, { state: e.target.value }),
                title: "这个位置播哪个动画",
                children: ANIMATION_OPTIONS.map((o) => /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("option", { value: o.id, children: o.label }, o.id))
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("span", { className: "davs-times", children: "×" }),
            /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
              "input",
              {
                className: "davs-num",
                type: "number",
                min: MIN_PLAYS,
                max: MAX_PLAYS,
                value: item.plays,
                onChange: (e) => {
                  const n = Number(e.target.value);
                  if (!Number.isFinite(n)) return;
                  patch(i, { plays: Math.min(MAX_PLAYS, Math.max(MIN_PLAYS, Math.round(n))) });
                },
                title: "播几遍"
              }
            ),
            i === 1 ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "davs-icon", onClick: removeSecond, title: "去掉第二项", children: "−" }) : null
          ] }, i)),
          items.length < MAX_ROTATION_ITEMS ? /* @__PURE__ */ (0, import_jsx_runtime10.jsx)("button", { className: "davs-icon", onClick: addSecond, title: "加第二项轮播", children: "＋" }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime10.jsxs)("span", { className: "davs-total", title: "这一轮播完的总时长", children: [
            "一轮约 ",
            total.toFixed(1),
            " 秒"
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime10.jsx)(
            "button",
            {
              className: "davs-btn davs-btn-try",
              onClick: () => playRotationInPreview(rotation2),
              title: `在试片里播这一行：${describeRotation(rotation2)}`,
              children: "试播"
            }
          )
        ] })
      ] });
    }

    // grokbot/plugin/src/client/style.ts
    var STYLE = `
    /* ══ 右栏面板 ══════════════════════════════════════════════════════
       宿主给正文的容器（.tabBody）是 height:100%;display:flex;flex-direction:column。
       所以根节点只要 flex:1 就能填满 —— 不写绝对定位、不写 100vh、不写边框圆角
       （那是浮窗为了「像一张卡片」才需要的；嵌在栏里时它本身就是栏的一部分）。 */
    /* G1: frame-wide transparent shell never grabs input; only the clipped Bot disc does.
       Explicit no-drag overrides chrome row drag rules. No rectangular iframe hit box. */
    .davf-g1-shell{position:fixed;inset:0;z-index:20;pointer-events:none;background:transparent}
    .davf-g1-entity{position:absolute;width:var(--davf-main-size,96px);height:var(--davf-main-size,96px);pointer-events:none}
    .davf-g1-entity>svg{pointer-events:none}
    .davf-g1-hit{position:absolute;inset:0;width:100%;height:100%;padding:0;border:0;background:transparent;
      border-radius:50%;clip-path:circle(39.58% at 50% 50%);pointer-events:auto;cursor:grab;touch-action:none;
      -webkit-app-region:no-drag}
    .davf-g1-hit:active{cursor:grabbing}
    .davf-g1-hit:focus-visible{outline:3px solid var(--dsw-alias-state-business-primary,#3964fe);outline-offset:-5px}
    .davf-g1-feedback{position:absolute;left:50%;top:calc(var(--davf-main-size,96px) - 6px);transform:translateX(-50%);white-space:nowrap;
      font:11px/1.5 sans-serif;color:var(--dsw-alias-label-primary);pointer-events:none}
    @media (prefers-reduced-motion: reduce){.davf-g1-entity,.davf-g1-hit{transition:none!important;animation:none!important}}
    .davf-g2-error{position:fixed;bottom:8px;left:8px;right:8px;margin:auto;max-width:260px;text-align:center;pointer-events:none;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);border-radius:6px;font-size:11px;line-height:1.5}
    .davf-g2-placeholder{flex:1;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);font-size:12px}.davf-g2-placeholder:not(.is-compact){gap:96px}.davf-g2-placeholder svg{max-width:96px;max-height:96px}.davf-g2-placeholder.is-compact .davf-g2-still{display:none}.davf-g2-placeholder-copy{width:100%;max-width:260px;padding:0 8px;box-sizing:border-box;text-align:center}.davf-g2-placeholder-title{display:block;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.5}.davf-g2-placeholder-subtitle{display:block;margin-top:3px;color:var(--dsw-alias-label-primary);font-size:15px;font-weight:600;line-height:1.5}.davf-g2-placeholder-hint{display:block;margin-top:16px;font-size:12px;line-height:1.6}.davf-g2-still{color:var(--dsw-alias-label-tertiary,#8b94a5);opacity:.48;pointer-events:none}
    .davf-g2-switch{flex-shrink:0;display:inline-flex;align-items:center;gap:5px;padding:1px 4px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:11px;cursor:pointer;-webkit-app-region:no-drag}
    .davf-g2-switch:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3964fe);outline-offset:2px}
    .davf-g2-switch-track{width:31px;height:15px;border-radius:999px;display:flex;align-items:center;padding:2px;box-sizing:border-box;background:var(--dsw-alias-border-l1,#a0a6b0);transition:background .16s}
    .davf-g2-switch-thumb{width:11px;height:11px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .16s}
    .davf-g2-switch[aria-checked=true] .davf-g2-switch-track{background:var(--dsw-alias-state-business-primary,#3964fe)}
    .davf-g2-switch[aria-checked=true] .davf-g2-switch-thumb{transform:translateX(16px)}
    .davf-g2-switch-error{padding:2px 10px;font-size:10px;color:var(--dsw-alias-state-error-primary,#e0563f)}
    @media(prefers-reduced-motion:reduce){.davf-g2-switch,.davf-g2-switch-thumb,.davf-g2-switch-track,.davf-g2-placeholder{animation:none!important;transition:none!important}}
    .davf-panel{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;
      overflow:hidden;color:var(--dsw-alias-label-primary);font-size:13px}

    /* 顶部一行：标题 + 计数 + 胶囊。不再是拖动条，所以没有 cursor:grab。 */
    .davf-bar{display:flex;align-items:center;gap:9px;height:38px;padding:0 10px 0 12px;
      flex-shrink:0;user-select:none;-webkit-user-select:none;
      border-bottom:1px solid var(--dsw-alias-border-l2)}
    .davf-title{font-size:12.5px;font-weight:600;letter-spacing:.01em;white-space:nowrap}
    .davf-count{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary);display:flex;align-items:baseline;gap:1px}
    .davf-count-total{opacity:.55}
    .davf-overflow{margin-left:4px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.06));font-size:10px;color:var(--dsw-alias-label-secondary)}

    /* 胶囊长条：监视 + 外观 */
    .davf-capsule{margin-left:auto;display:flex;align-items:center;gap:1px;padding:2px;
      border-radius:999px;border:1px solid var(--dsw-alias-border-l2);
      background:var(--dsw-alias-bg-layer-1);cursor:default}
    /* 规格（1×1 / 1×2）已从标题栏移除 —— 那只是当初验证格子逻辑用的显示，
       对用户没有信息量。gridOf() 仍然决定布局，只是不再把它写出来。 */
    .davf-cap{border:0;background:transparent;color:var(--dsw-alias-label-secondary);
      font:inherit;font-size:10.5px;line-height:1;padding:4px 8px;border-radius:999px;
      cursor:pointer;white-space:nowrap;transition:background .13s,color .13s}
    .davf-cap:hover{background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.06));color:var(--dsw-alias-label-primary)}
    .davf-cap.is-on{background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
    .davf-cap-quiet{color:var(--dsw-alias-label-tertiary);font-size:10px}

    .davf-body{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;padding:8px 10px 10px;overflow:hidden}
    .davf-isolation-empty,.davf-isolation-error{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;padding:12px;text-align:center;font-size:11px;color:var(--dsw-alias-label-secondary)}
    .davf-isolation-error button{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:5px 9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer}
    /* Before owner + first ACK, this is a single parent-side preview, never the real monitor grid. */
    .davf-isolation-startup{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:4px;min-height:0;overflow:hidden;pointer-events:none;background:var(--davf-isolated-canvas,#f6f8fb);
      color:var(--davf-isolated-label,#171717);font-size:11px}
    .davf-isolation-startup-portrait{flex:0 1 auto;min-height:0;display:flex;align-items:center;justify-content:center;max-width:100%;max-height:55%}
    .davf-isolation-startup-portrait svg{max-width:100%;max-height:100%}
    .davf-isolation-startup-note{line-height:18px;text-align:center;white-space:nowrap;opacity:.72}
    .davf-isolation-startup-pill{box-sizing:border-box;width:82px;height:16px;margin-top:5px;display:flex;align-items:center;
      justify-content:center;gap:3px;border:1px solid color-mix(in srgb,var(--davf-isolated-label,#171717) 35%,var(--davf-isolated-canvas,#f6f8fb));border-radius:999px;
      background:var(--davf-isolated-canvas,#f6f8fb);color:var(--davf-isolated-label,#171717);font-size:9px;line-height:14px}
    .davf-isolation-startup-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-business-primary,#3964fe)}

    /* 移除按钮：默认隐形，悬停格子才出现 —— 否则多格时满屏都是 ✕ */
    .davf-cell-remove{position:absolute;right:5px;top:5px;width:17px;height:17px;display:grid;place-items:center;
      border:0;border-radius:5px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);
      font-size:9px;line-height:1;cursor:pointer;opacity:0;transition:opacity .15s,color .15s,background .15s}
    .davf-cell-remove:hover{background:var(--dsw-alias-state-error-primary,#e0563f);color:#fff}

    /* 外观面板开着时，每格顶部那枚「改它」小胶囊。
       只在外观面板开着时出现，所以平时不占视觉。 */
    .davf-cell-tag{position:absolute;left:50%;top:2px;transform:translateX(-50%);
      border:1px solid var(--dsw-alias-border-l2);border-radius:999px;
      background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);
      font:inherit;font-size:9.5px;line-height:1;padding:3px 7px;cursor:pointer;white-space:nowrap;
      transition:.14s;z-index:1}
    .davf-cell-tag:hover{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      color:var(--dsw-alias-state-business-primary,#3964fe)}
    .davf-cell-tag.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
    /* Real titles stay parent-only; mirror the child portrait and pill rows to share one centered baseline. */
    .davf-isolated-cell{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;
      gap:3px;box-sizing:border-box;min-width:0;min-height:0;padding:6px 4px;border:1px solid transparent}
    .davf-isolated-portrait-space{flex:0 1 auto;min-height:0;width:100%;margin-bottom:12px}
    .davf-isolated-cell.is-dense .davf-isolated-portrait-space{margin-bottom:3px}
    .davf-isolated-name{font-weight:600;flex:0 0 18px;width:calc(100% - 8px);height:18px;z-index:2;max-width:100%;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box;text-align:center;pointer-events:none;
      background:var(--davf-isolated-canvas,var(--dsw-alias-bg-layer-1));color:var(--dsw-alias-label-primary);
      font-size:12.5px;line-height:18px;letter-spacing:.01em}
    .davf-isolated-cell.is-pair .davf-isolated-name{transform:translateY(-32px)}
    .davf-isolated-cell.is-spacious .davf-isolated-name{transform:translateY(-40px)}
    .davf-isolated-name + .davf-isolated-meta-space{margin-top:5px}
    .davf-isolated-meta-space{flex:0 0 16px;width:82px;height:16px}
    .davf-caret{color:var(--dsw-alias-label-tertiary);margin-right:3px}

    /* ══ 监视选择器 / 外观面板（共用同一套矩形框）═════════════════════════
       两者都用 .davf-picker 的外框，视觉上是一对。
       之前外观是裸列表、从下往上长，和选择器对不上，是用户报的问题。 */
    .davf-picker{flex:0 0 auto;max-height:58%;min-height:0;display:flex;flex-direction:column;
      border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
      background:var(--dsw-alias-bg-layer-2);overflow:hidden;
      animation:davf-picker-in .2s ease-out both}
    /* 都是从「上方」滑下来 —— 两个面板方向必须一致 */
    @keyframes davf-picker-in{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}

    /* 外观面板比选择器高一点：它有四行，58% 会挤 */
    .davf-custbox{max-height:64%;container-type:inline-size;min-width:0}
    .davf-custbody{padding:8px 10px 10px;display:flex;flex-direction:column;gap:9px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}

    .davf-picker-head{display:flex;align-items:baseline;gap:8px;padding:8px 10px 7px;flex-shrink:0;
      border-bottom:1px solid var(--dsw-alias-border-l2)}
    .davf-picker-head>span:first-child{font-size:11.5px;font-weight:600}
    .davf-picker-hint{margin-left:auto;font-size:10px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
    .davf-picker-body{flex:1;min-height:0;overflow:auto;padding:4px 4px 6px}
    .davf-picker-empty{padding:18px 12px;text-align:center;font-size:11.5px;color:var(--dsw-alias-label-tertiary)}

    /* 工作区一行：可折叠，右边显示「已选/总数」 */
    .davf-ws-head{display:flex;align-items:center;gap:6px;width:100%;border:0;background:transparent;
      padding:6px 7px;border-radius:7px;font:inherit;font-size:11.5px;cursor:pointer;
      color:var(--dsw-alias-label-primary);text-align:left;transition:background .13s}
    .davf-ws-head:hover{background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.05))}
    .davf-ws-caret{width:10px;flex-shrink:0;font-size:9px;color:var(--dsw-alias-label-tertiary)}
    .davf-ws-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:550}
    .davf-ws-count{flex-shrink:0;font-family:ui-monospace,Consolas,monospace;font-size:10px;
      color:var(--dsw-alias-label-tertiary)}
    .davf-ws-body{display:flex;flex-direction:column;gap:1px;padding:1px 0 4px 14px}

    /* 一条会话：勾选框 + 名字 + 状态 */
    .davf-pick-row{display:flex;align-items:center;gap:7px;width:100%;border:0;background:transparent;
      padding:5px 8px;border-radius:7px;font:inherit;font-size:11.5px;cursor:pointer;
      color:var(--dsw-alias-label-secondary);text-align:left;transition:background .13s,color .13s}
    .davf-pick-row:hover:not(:disabled){background:var(--dsw-alias-bg-layer-3,rgba(0,0,0,.05));
      color:var(--dsw-alias-label-primary)}
    .davf-pick-row:disabled{opacity:.42;cursor:not-allowed}
    .davf-pick-row.is-on{color:var(--dsw-alias-label-primary)}
    .davf-pick-row.is-active{cursor:default}
    .davf-pick-box{flex-shrink:0;width:13px;height:13px;display:grid;place-items:center;
      border:1px solid var(--dsw-alias-border-l1);border-radius:4px;
      font-size:9px;line-height:1;color:#fff;transition:.13s}
    .davf-pick-box.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      background:var(--dsw-alias-state-business-primary,#3964fe)}
    /* 当前窗口那个格子：用淡蓝底 + 点，表示「已在内、不可取消」 */
    .davf-pick-box.is-active{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      background:transparent;color:var(--dsw-alias-state-business-primary,#3964fe);font-size:13px}
    .davf-pick-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .davf-pick-tag{flex-shrink:0;padding:0 4px;border-radius:999px;font-size:9px;line-height:1.5;
      background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
    .davf-pick-act{flex-shrink:0;font-size:10px;color:var(--dsw-alias-label-tertiary)}

    /* 外观面板内部的行。外框由 .davf-picker/.davf-custbox 提供，
       这里只管行内排版 —— 不再自己当容器（之前那样会从下往上长）。 */
    .davf-cust-row{display:flex;gap:9px;align-items:flex-start;min-width:0}
    .davf-cust-label{flex:0 0 34px;padding-top:4px;font-size:10px;font-weight:600;letter-spacing:.08em;
      text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
    .davf-chips{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
    .davf-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
      color:var(--dsw-alias-label-secondary);border-radius:6px;padding:3px 8px;
      font:inherit;font-size:11px;cursor:pointer;transition:.13s;white-space:nowrap}
    .davf-chip:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
    .davf-chip.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
    /* 表情 16 项排 6+5+5：后两行居中，比 6+6+4 更均衡。
       12 列中每项占两列，首项从第 2 列起可让五项两边各留一列。 */
    .davf-expressions{display:grid;flex:1;grid-template-columns:repeat(12,minmax(0,1fr));gap:5px;min-width:0}
    .davf-expressions .davf-chip{grid-column:span 2;min-width:0;padding:3px 1px;font-size:9px;overflow:hidden;text-overflow:ellipsis;text-align:center}
    .davf-expressions .davf-chip:nth-child(7),.davf-expressions .davf-chip:nth-child(12){grid-column:2 / span 2}
    .davf-expressions .davf-cust-note{grid-column:1/-1}
    /* 行尾的小字说明：试片只影响哪一格、帧率是全局的、表情只在空闲可见。
       不换行、不抢焦点，只是让「为什么只有一个格子变了」有答案。 */
    .davf-cust-note{font-size:10px;color:var(--dsw-alias-label-tertiary);
      line-height:1.5;padding-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    /* 面板底部整行说明：允许换行（它是完整句子，不是行尾标签） */
    .davf-cust-foot{white-space:normal;padding-top:8px;
      border-top:1px solid var(--dsw-alias-border-l2)}
    /* 形状 15 项与设置页一致，按行填充三排（5+5+5）。
       minmax(0,1fr) 和按钮内部省略避免极窄右栏横向溢出。 */
    .davf-shapes{display:grid;flex:1;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;min-width:0}
    .davf-shape{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 2px 3px;
      border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-1);
      color:var(--dsw-alias-label-tertiary);font:inherit;font-size:9px;line-height:1.2;
      cursor:pointer;transition:.13s;white-space:nowrap;min-width:0;overflow:hidden}
    .davf-shape span{max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .davf-shape svg{max-width:100%}
    .davf-shape:hover{border-color:var(--dsw-alias-border-l1)}
    .davf-shape.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);color:var(--dsw-alias-label-primary)}
    /* 主窗口的尺寸与编辑目标在同一外观卡片内，按尺寸→目标→形状依次展开。 */
    .davf-main-size{min-width:0;padding:2px 0 6px;border-bottom:1px solid var(--dsw-alias-border-l2)}
    .davf-main-size-label{display:block;margin-bottom:5px;font-size:10.5px;font-weight:600;
      color:var(--dsw-alias-label-secondary)}
    .davf-main-size-control{min-width:0;display:flex;flex-direction:column;gap:4px;font-size:11px}
    .davf-main-size-control input[type=range]{width:100%;margin:0;accent-color:var(--dsw-alias-state-business-primary,#3964fe)}
    .davf-main-size-control .davf-cust-note{padding-top:0;white-space:normal}
    .davf-look-target{display:flex;min-width:0;gap:3px;padding:3px;border:1px solid var(--dsw-alias-border-l2);
      border-radius:9px;background:var(--dsw-alias-bg-layer-1)}
    .davf-look-target-choice{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;gap:2px;
      padding:5px 2px;border:1px solid transparent;border-radius:6px;background:transparent;
      color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer}
    .davf-look-target-choice[aria-pressed=true]{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2)}
    .davf-look-target-choice strong{font-size:13px;font-weight:700;line-height:1.3}
    .davf-look-target-choice small{font-size:10px;line-height:1.3;color:var(--dsw-alias-label-tertiary)}
    .davf-look-target-choice:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#3964fe);outline-offset:1px}
    .davf-colors{display:flex;flex-wrap:wrap;gap:5px;min-width:0}
    .davf-color{width:17px;height:17px;border-radius:50%;border:2px solid transparent;padding:0;cursor:pointer;
      transition:.13s;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
    .davf-color:hover{transform:scale(1.12)}
    .davf-color.is-on{border-color:var(--dsw-alias-label-primary);transform:scale(1.08)}

    /* 116px 级窄栏无法同时容纳五个完整图标/文字：此时以可读和可点为先，
       两列纵向滚动；正常宽度仍保持形状 5+5+5、表情 6+5+5 三排。 */
    @container (max-width:256px){
      .davf-picker-head{flex-wrap:wrap;gap:2px;padding:6px 4px}
      .davf-picker-hint{margin-left:0;white-space:normal;overflow-wrap:anywhere;min-width:0}
      .davf-custbody{padding:5px 4px;gap:5px}
      .davf-cust-row{display:block}
      .davf-cust-label{display:block;padding:0 0 3px}
      .davf-shapes,.davf-expressions{width:100%;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
      .davf-expressions .davf-chip,.davf-expressions .davf-chip:nth-child(7),
      .davf-expressions .davf-chip:nth-child(12){grid-column:span 1}
      .davf-shape{padding:3px 0}
      .davf-shape svg{width:24px;height:24px}
      .davf-cust-note{white-space:normal;overflow-wrap:anywhere}
    }

    /* ══ 栏内面板（预览工具仍在用） ═════════════════════════════════════ */
    .dav-host{height:100%;min-height:0;display:flex;flex-direction:column;color:var(--dsw-alias-label-primary);font-size:13px;overflow:hidden}
    .dav-root{flex:1;min-height:0;display:flex;align-items:stretch}

    .dav-stage{min-width:0;min-height:0;display:flex;flex-direction:column;padding:20px 22px 22px;overflow:hidden}
    .dav-stage-head{display:flex;align-items:baseline;gap:8px;margin-bottom:16px;flex-shrink:0}
    .dav-stage-title{font-size:13px;font-weight:600;letter-spacing:.02em}
    .dav-stage-count{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary)}
    .dav-grid{flex:1;min-height:0;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:10px;align-content:start;padding-right:4px}

    .dav-card{position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:10px 8px 11px;border:1px solid var(--dsw-alias-border-l2);border-radius:12px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;transition:border-color .16s,background .16s}
    .dav-card:hover{border-color:var(--dsw-alias-border-l1)}
    .dav-card-bar{position:absolute;left:0;top:0;bottom:0;width:3px;opacity:.9}
    .dav-card-bot{width:92px;height:92px;display:grid;place-items:center;flex-shrink:0}
    .dav-card-meta{min-width:0;width:100%;text-align:center}
    .dav-card-name{font-size:12px;font-weight:550;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
    .dav-caret{color:var(--dsw-alias-label-tertiary);margin-right:3px}
    .dav-card-act{display:flex;align-items:center;justify-content:center;gap:4px;margin-top:3px;font-size:10.5px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
    .dav-dot{width:5px;height:5px;border-radius:50%;flex-shrink:0}

    .dav-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;color:var(--dsw-alias-label-tertiary);text-align:center;padding:0 30px}
    .dav-empty p{max-width:300px;font-size:12px;line-height:1.75;margin:0}
    .dav-empty-bot{opacity:.8}

    .dav-split{flex:0 0 5px;cursor:col-resize;background:transparent;position:relative;flex-shrink:0}
    .dav-split:after{content:"";position:absolute;left:2px;top:0;bottom:0;width:1px;background:var(--dsw-alias-border-l2)}
    .dav-split:hover:after{background:var(--dsw-alias-state-business-primary,#3964fe)}

    .dav-side{flex:1 1 0;min-width:240px;max-width:420px;min-height:0;overflow:auto;border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
    .dav-cust{padding:20px 18px 28px;display:flex;flex-direction:column;gap:20px}
    .dav-cust-head{font-size:13px;font-weight:600}
    .dav-sec{display:flex;flex-direction:column;gap:9px}
    .dav-sec-title{font-size:10.5px;font-weight:600;letter-spacing:.09em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}

    .dav-chips{display:flex;flex-wrap:wrap;gap:6px}
    .dav-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);border-radius:7px;padding:4px 9px;font:inherit;font-size:11.5px;cursor:pointer;transition:.14s}
    .dav-chip:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
    .dav-chip.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}

    .dav-shapes{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
    .dav-shape{display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 2px 5px;border:1px solid var(--dsw-alias-border-l2);border-radius:9px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10px;cursor:pointer;transition:.14s}
    .dav-shape:hover{border-color:var(--dsw-alias-border-l1)}
    .dav-shape.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);color:var(--dsw-alias-label-primary)}

    .dav-colors{display:grid;grid-template-columns:repeat(6,1fr);gap:6px}
    .dav-color{aspect-ratio:1;border-radius:50%;border:2px solid transparent;cursor:pointer;padding:0;transition:.14s;box-shadow:inset 0 0 0 1px rgba(0,0,0,.08)}
    .dav-color:hover{transform:scale(1.08)}
    .dav-color.is-on{border-color:var(--dsw-alias-label-primary);transform:scale(1.06)}

    .dav-range{width:100%;accent-color:var(--dsw-alias-state-business-primary,#3964fe)}

    /* ══ 设置页 ════════════════════════════════════════════════════════
       挂在「设置 → 插件 → dsh-agents-bot」的组合包详情页里。
       容器是插件页自己的表单区，所以这里不写边框/圆角/背景 —— 它本身
       就该像页面里的一段内容，而不是又一张卡片。
       宽度按容器自适应（插件页可能是窄栏也可能是宽面板）。 */
    .davs{display:flex;flex-direction:column;gap:18px;padding:4px 0 8px;min-width:0;
      container-type:inline-size;color:var(--dsw-alias-label-primary);font-size:12.5px}
    .davs-title{margin:0;font-size:12.5px;font-weight:600}
    .davs-desc{margin:5px 0 0;font-size:11.5px;line-height:1.65;color:var(--dsw-alias-label-tertiary);max-width:62em}
    .davs-section{display:flex;flex-direction:column;gap:2px;padding-top:14px;
      border-top:1px solid var(--dsw-alias-border-l2)}
    .davs-section .davs-desc{margin-bottom:8px}

    .davs-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
      color:var(--dsw-alias-label-secondary);border-radius:7px;padding:5px 10px;
      font:inherit;font-size:11.5px;cursor:pointer;transition:.13s;white-space:nowrap;flex-shrink:0}
    .davs-btn:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}

    /* 二级确认态（「恢复默认」被点过一次）。
       为什么要变红边框：这两枚按钮干的是一键抹掉全部手工配置，没有撤销。
       进入确认态后必须**一眼看出它已经变了**，否则用户以为第一次没点中、
       再点一次 —— 那正好就是执行。红色是唯一不靠读字就能分辨的信号。 */
    .davs-btn.is-armed{border-color:#d0553f;color:#d0553f;font-weight:600}
    .davs-btn.is-armed:hover{border-color:#d0553f;color:#d0553f}

    /* ── 试片 ────────────────────────────────────────────────────────────
       版式 = 左预览 / 右三组按钮，三组各压成三行（用户 2026-10-30 选定 B）。

       ── 为什么预览是 288px ───────────────────────────────────────────────
       量过：旧版预览框 96px，右侧按钮区 297px —— 右侧正好是左侧三倍，
       这就是用户说的「上下差太多」。三倍正好补齐，所以 288px 不是凑的。

       ── 为什么三组要压成固定三行 ─────────────────────────────────────────
       自然换行时三组的行数各不相同（动画 3 行、图案 2 行、表情 2 行），
       三块高度参差；固定三行后三块等高，视线扫下来是整齐的格子。
       实测上下差从 74px 降到 22px。

       ── 为什么列数要算，不能写死 ─────────────────────────────────────────
       行数固定时列数必须是 ceil(芯片数 / 行数)，否则标签会被挤扁。
       用 grid-auto-flow:column 先竖后横更是错的：阅读顺序会从
       「空闲 思考 眨眼」变成「空 思 眨」。列数由组件算好，经 --cols 传入。 */
    .davs-preview{display:flex;gap:16px;align-items:stretch;padding:12px 14px;
      border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
      background:var(--dsw-alias-bg-layer-1)}
    /* 左边那个**框**跟着右边长高，里面那个 bot 仍是 288px。
       为什么要分成两件事（2026-10-31）：加了「配色」以后右侧成了四组，
       总高 368px，而框还是写死的 288px —— 右边探出一截，正是用户第 100 轮
       报的「上下差太多」的形状。把框改成 stretch + min-height，两边永远齐平；
       而 bot 的绘制尺寸不变，288 那条「旧值 96 的三倍」的判据仍然成立。 */
    .davs-preview-bot{flex-shrink:0;width:288px;min-height:288px;align-self:stretch;
      display:flex;align-items:center;justify-content:center;border-radius:10px;
      background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);
      padding:8px;box-sizing:border-box}

    /* 三组按钮：每组成一块卡片，块内芯片排成固定三行的网格。 */
    .davs-groups{display:flex;flex-direction:column;gap:8px;min-width:0;flex:1}
    .davs-group{display:flex;flex-direction:column;gap:4px;min-width:0;
      border:1px solid var(--dsw-alias-border-l2);border-radius:8px;
      padding:5px 8px;background:var(--dsw-alias-bg-layer-1)}
    .davs-group-head{display:flex;align-items:baseline;gap:6px;font-size:10.5px;
      font-weight:600;color:var(--dsw-alias-label-secondary)}
    .davs-group-cur{font-weight:400;color:var(--dsw-alias-label-tertiary)}
    /* 列数由 --cols 给（= ceil(芯片数 / 3)），按行填充 —— 保证正好三行
       且保持从左到右的阅读顺序。 */
    .davs-group-chips{display:grid;gap:4px;
      grid-template-columns:repeat(var(--cols,8),minmax(0,1fr))}
    .davs-group-chips .davs-chip{padding:2px 4px;text-align:center;min-width:0}

    /* ── 配色那一组：一行 12 枚「色点 + 名字」─────────────────────────────
       为什么单独一套：配色是 12 个，压三行会把右边撑得比左边高 128px
       （用户第 100 轮报的「上下差太多」又回来了）。压一行只要 368px 上下，
       和 288px 的预览基本齐平。

       ── 列数用 auto-fit 而不是写死 12 ─────────────────────────────────
       写死 repeat(12, 1fr) 在容器 773px 时会把每列压到 33px，「写文件」
       这种三字标签就被省略了（实测 4 枚被截）。改成 auto-fit + 最小 44px：
       宽的时候自然排成一行（960 容器下正好 12 枚一行），窄的时候自动折成
       两行 —— 折行只是长高一点，不会被截断。 */
    .davs-group-chips-swatch{grid-template-columns:repeat(auto-fit,minmax(44px,1fr));gap:3px}
    .davs-chip-swatch{display:flex;align-items:center;justify-content:center;gap:3px;
      padding:2px 3px;min-width:0}
    .davs-chip-swatch .davs-swatch{width:8px;height:8px;border-radius:50%;flex-shrink:0;
      box-shadow:inset 0 0 0 1px rgba(0,0,0,.14)}
    /* 选中态是实心蓝，色点会被蓝色盖住 —— 加一圈白描边把它顶出来。 */
    .davs-chip-swatch.is-on .davs-swatch{box-shadow:0 0 0 1.5px #fff}

    /* ── 轮播行 ── */
    .davs-rows{display:flex;flex-direction:column;gap:1px;
      border:1px solid var(--dsw-alias-border-l2);border-radius:10px;overflow:hidden}
    .davs-row{display:flex;align-items:center;gap:12px;padding:7px 12px;
      background:var(--dsw-alias-bg-layer-1);min-width:0}
    .davs-row:nth-child(even){background:var(--dsw-alias-bg-layer-2)}
    .davs-row[data-changed]{box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary,#3964fe)}
    .davs-row-name{display:flex;align-items:center;gap:7px;flex-shrink:0;width:7.5em}
    .davs-row-label{font-size:12px;font-weight:500;white-space:nowrap}
    .davs-link{border:0;background:transparent;padding:0;font:inherit;font-size:10px;
      color:var(--dsw-alias-state-business-primary,#3964fe);cursor:pointer;white-space:nowrap}
    .davs-link:hover{text-decoration:underline}

    .davs-row-slots{display:flex;align-items:center;gap:6px;flex-wrap:wrap;min-width:0}
    .davs-slot{display:flex;align-items:center;gap:4px}
    .davs-select{font:inherit;font-size:11.5px;padding:3px 5px;border-radius:6px;
      border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
      color:var(--dsw-alias-label-primary);cursor:pointer;max-width:8em}
    .davs-select:hover{border-color:var(--dsw-alias-border-l1)}
    .davs-times{font-size:10.5px;color:var(--dsw-alias-label-tertiary)}
    .davs-num{font:inherit;font-size:11.5px;width:3.1em;padding:3px 4px;border-radius:6px;
      border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
      color:var(--dsw-alias-label-primary);text-align:center}
    .davs-num:hover{border-color:var(--dsw-alias-border-l1)}
    .davs-icon{width:19px;height:19px;display:flex;align-items:center;justify-content:center;
      border:1px dashed var(--dsw-alias-border-l1);background:transparent;border-radius:6px;
      color:var(--dsw-alias-label-tertiary);font:inherit;font-size:12px;line-height:1;cursor:pointer;transition:.13s}
    .davs-icon:hover{border-style:solid;color:var(--dsw-alias-label-primary);
      border-color:var(--dsw-alias-state-business-primary,#3964fe)}
    .davs-total{margin-left:auto;font-size:10.5px;color:var(--dsw-alias-label-tertiary);
      white-space:nowrap;font-variant-numeric:tabular-nums}

    /* 自动分配顺位：每格一个「序号 + 下拉 + 减号」。
       用 grid 三列而不是 flex：序号要右对齐成一条竖线，下拉要等宽 ——
       flex 下每个下拉按自己内容定宽，看起来参差不齐。 */
    .davs-order{display:grid;grid-template-columns:auto minmax(0,1fr) auto;
      gap:5px 7px;align-items:center;margin-top:8px;max-width:260px}
    .davs-order-row{display:contents}
    .davs-order-no{font-size:10.5px;color:var(--dsw-alias-label-tertiary);
      text-align:right;font-variant-numeric:tabular-nums;min-width:1.2em}
    .davs-order .davs-select{max-width:none;width:100%}
    .davs-icon:disabled{opacity:.35;cursor:not-allowed}
    .davs-icon:disabled:hover{border-style:dashed;color:var(--dsw-alias-label-tertiary);
      border-color:var(--dsw-alias-border-l1)}
    .davs-order-add{grid-column:2;justify-self:start}

    /* ── 可折叠卡片（动画映射）──────────────────────────────────────────
       用户要求「做成和自动分配顺位一样的可折叠形态，用一个胶囊包裹」。
       所以整块包在一条圆角边框里，标题行右侧放展开/收起胶囊。
       胶囊本身复用 .davs-chip（is-on 表示已展开），和顺位那块完全一致。 */
    .davs-card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;
      padding:12px 14px 14px;display:flex;flex-direction:column;gap:2px}
    .davs-card-head{display:flex;align-items:flex-start;gap:12px;justify-content:space-between}
    .davs-card-tools{display:flex;align-items:center;gap:8px;flex-shrink:0}
    /* 折叠时给一句摘要，避免「一片空白、不知道是收起来了还是坏了」 */
    .davs-fold-note{margin:8px 0 0;font-size:11px;color:var(--dsw-alias-label-tertiary)}

    /* ── 顺位行（模仿动画映射的行结构）──────────────────────────────────
       左边一列「第 N 格」= 那边的一列活动名；右边是「图案 + 表情」= 那边的
       「动画 + 遍数」。用同一套 .davs-row / .davs-row-slots，所以两块的
       行高、间距、悬停底色完全一致 —— 这正是用户要的「结构一样」。 */
    .davs-rows-preset{margin-top:8px}
    .davs-rows-preset .davs-row-name{width:5.5em}
    .davs-row-label-dim{color:var(--dsw-alias-label-tertiary);font-weight:400}
    /* 缩略图：24px 只够分辨轮廓，够用且不把行撑高 */
    .davs-preset-thumb{flex-shrink:0;width:24px;height:24px;display:flex;
      align-items:center;justify-content:center}
    .davs-rows-preset .davs-select{max-width:7.5em}
    /* 配色下拉比图案/表情窄一点：色名都是两三个字，不需要 7.5em。
       行里现在有四个控件（图案 / 配色 / 表情 / 试播 / 减号），窄下来才排得开。 */
    .davs-rows-preset .davs-select-color{max-width:5em}
    .davs-row-add{background:transparent !important}
    .davs-row-add .davs-row-slots{align-items:center}

    /* ── 行尾「试播」小按钮 ──────────────────────────────────────────────
       为什么不是 .davs-icon（那个是 ＋ / − 的虚线方框）：试播是**动词**，
       要带字。虚线框里放两个字会挤成一团，所以复用 .davs-btn 的描边样式，
       只把它压到和下拉等高、字更小 —— 它在行尾属于「附属动作」，
       不该比左边的下拉更抢眼。 */
    .davs-btn-try{padding:2px 7px;font-size:10.5px;line-height:1.5;
      border-radius:6px;white-space:nowrap;flex-shrink:0}

    /* ── 芯片组（休眠阈值 / 帧率 / 试片选择）── */
    .davs-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
    .davs-chip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
      color:var(--dsw-alias-label-secondary);border-radius:7px;padding:4px 9px;
      font:inherit;font-size:11.5px;cursor:pointer;transition:.13s;white-space:nowrap}
    .davs-chip:hover{border-color:var(--dsw-alias-border-l1);color:var(--dsw-alias-label-primary)}
    .davs-chip.is-on{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}
    .davs-chip-sm{font-size:10.5px;padding:2px 7px}

    /* ── 折叠胶囊 ────────────────────────────────────────────────────────
       和「选中某项」的芯片**必须长得不一样**：is-on 的实心蓝在这里会读成
       「当前选中了展开」，而它其实只是个开合开关。所以这里不用实心，
       改用描边 + 一个朝下/朝上的小箭头表达状态。 */
    .davs-chip-toggle{display:inline-flex;align-items:center;gap:4px;
      border-radius:999px;padding:3px 10px}
    .davs-chip-toggle::after{content:'▾';font-size:9px;line-height:1;opacity:.65;
      transform:translateY(-1px);transition:transform .13s}
    .davs-chip-toggle.is-on{background:var(--dsw-alias-bg-layer-1);
      color:var(--dsw-alias-label-secondary);border-color:var(--dsw-alias-border-l1)}
    .davs-chip-toggle.is-on:hover{border-color:var(--dsw-alias-state-business-primary,#3964fe);
      color:var(--dsw-alias-label-primary)}
    .davs-chip-toggle.is-on::after{content:'▴'}
    .davs-note{font-size:10.5px;color:var(--dsw-alias-label-tertiary);line-height:1.5}

    .davs-foot{margin:0;padding-top:12px;border-top:1px solid var(--dsw-alias-border-l2);
      font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.6}

    /* 以实际插件表单宽度而非桌面窗口宽度判定窄栏；设置页可嵌在宽窗口的小侧面板。 */
    @container (max-width:560px){
      .davs-row{flex-direction:column;align-items:flex-start;gap:6px}
      .davs-row-name{width:auto}
      .davs-total{margin-left:0}
    }

    /* ── 窄容器：三行网格会挤坏标签，退回「上下排 + 自然换行」────────────
       ── 断点 780px 是量出来的，不是挑的 ──────────────────────────────────
       三行网格每列要放得下最宽的标签（「跑命令」「圆角方」约 45px）。
       按钮区宽 = 容器宽 - 288(方块) - 16(gap) - 28(padding)，8 列时
       每列 ≈ (按钮区 - 7*4 - 16)/8。实测：
           容器 775 → 按钮区 443 → 每列 50px  ✅ 零省略
           容器 701 → 按钮区 369 → 每列 41px  ✂「写文件」「跑命令」被省
           容器 628 → 按钮区 296 → 每列 32px  ✂ 同上
           容器 554 → 按钮区 222 → 每列 22px  ✂ 41 个芯片全挤坏
       所以这条路只在容器 ≥ 780px 成立。
       DSH 设置页最宽 960px（PluginManagerPage.module.css 的 max-width），
       窗口足够宽时正好落在这个区间里 —— 960 下按钮区 598px，每列 69px，宽裕。

       780 以下改成方块在上、三组在下铺满整宽：那时按钮区有整个容器宽
       （例如容器 474 时约 442px），比挤在右侧的 142px 好得多。 */
    @container (max-width:779px){
      .davs-preview{flex-direction:column;align-items:stretch}
      .davs-preview-bot{width:100%;max-width:288px;margin:0 auto}
      /* 行数不再固定：固定三行在窄容器里必然挤坏标签，自然换行至少可读 */
      .davs-group-chips{grid-template-columns:repeat(auto-fill,minmax(54px,1fr))}
    }

    @media (max-width:720px){
      .dav-root{flex-direction:column}
      .dav-side{max-width:none;border-left:0;border-top:1px solid var(--dsw-alias-border-l2)}
    }
    `;

    // grokbot/plugin/src/client/index.tsx
    var import_jsx_runtime11 = require("react/jsx-runtime");
    var TAB_ID = "dsh-agents-bot";
    var TAB_KIND = "agentsBot";
    var TITLE = "活动 AI";
    var DESC = "把每个 agent 正在做什么画成会呼吸的形象，并排看。";
    var SETTINGS_KEYS = ["dsh-agents-bot", "include:dsh-agents-bot"];
    var inject = ["slots"];
    function installStyle() {
      if (typeof document === "undefined") return;
      if (document.querySelector('style[data-plugin-css="dsh-agents-bot"]')) return;
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-agents-bot";
      tag.dataset.pluginCss = "dsh-agents-bot";
      tag.textContent = STYLE;
      document.head.appendChild(tag);
    }
    function apply(ctx) {
      installStyle();
      const disposeOverlay = ctx.slots.inject(
        "shell.overlay",
        () => ctx.slots.register(
          { name: "shell.overlay", id: "dsh-agents-bot.main-overlay-g0" },
          MainOverlayG2
        )
      );
      ctx.effect(() => () => {
        if (typeof disposeOverlay === "function") disposeOverlay();
      }, "agent-avatar: G2 explicit main overlay registration");
      ctx.inject(["sidebarRight"], (scope) => {
        const service = scope.sidebarRight;
        if (!service) return;
        setSidebarNavigator((kind, options) => service.openTab(kind, options));
        return () => setSidebarNavigator(void 0);
      });
      const disposeRight = ctx.inject(["sidebarRightTabs"], (scope) => {
        const registered = [];
        const track = (d) => {
          if (typeof d === "function") registered.push(d);
        };
        try {
          const tabs = scope.sidebarRightTabs;
          if (tabs === void 0 || typeof tabs.register !== "function") return;
          track(
            tabs.register({
              id: TAB_ID,
              kind: TAB_KIND,
              title: () => TITLE,
              guide: [
                {
                  order: 30,
                  title: () => TITLE,
                  description: () => DESC,
                  /*
                   * 入口卡片的图标。不给的话宿主用内置立方体占位符，
                   * 跟「活动 AI」毫无关系。`GuideIcon` 是一个只收
                   * `{ size, className }` 的 React 组件，契约见那个文件。
                   */
                  icon: GuideIcon
                }
              ]
            })
          );
          track(
            scope.slots.inject(
              "sidebar.right.pane.tab",
              () => scope.slots.register(
                { name: "sidebar.right.pane.tab", key: TAB_ID },
                AvatarPanel
              )
            )
          );
          track(
            scope.slots.inject(
              "sidebar.right.pane.tab.title",
              () => scope.slots.register(
                { name: "sidebar.right.pane.tab.title", key: TAB_ID },
                function AvatarTitle() {
                  return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)("span", { children: TITLE });
                }
              )
            )
          );
        } catch {
          for (const d of registered) d();
          return;
        }
        return () => {
          for (const d of registered) d();
        };
      });
      const settingsRegistered = [];
      try {
        for (const key of SETTINGS_KEYS) {
          const d = ctx.slots.inject(
            "plugins.bundle.config",
            () => ctx.slots.register(
              { name: "plugins.bundle.config", key },
              function AgentAvatarSettings({ view }) {
                if (view === "summary") return null;
                return /* @__PURE__ */ (0, import_jsx_runtime11.jsx)(SettingsPage, {});
              }
            )
          );
          if (typeof d === "function") settingsRegistered.push(d);
        }
      } catch {
        for (const d of settingsRegistered) d();
      }
      ctx.effect(() => () => {
        const d1 = disposeRight;
        if (typeof d1?.dispose === "function") d1.dispose();
      }, "agent-avatar: right sidebar registration");
      ctx.effect(() => () => {
        for (const d of settingsRegistered) d();
      }, "agent-avatar: settings page registration");
    }

    return module.exports
  }
})

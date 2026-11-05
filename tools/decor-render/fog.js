// The Widow's fog effect: a whole-header layer. Dark fog and a fir forest roll in over the card, a
// big dark widow crosses it, vanishes in a puff of white smoke, and the fog thins out again. Most of
// the loop is clean, so only the middle of it costs bytes. Same spider rig as the photo frame.
//
// The page draws this art over the whole header (banner, photo, name and bio) with `object-cover`
// anchored at the bottom, so the creature's path stays in the middle and the fog covers every edge.
import { PALETTES, Spider } from "./spider.js";

const { PI, sin, cos, atan2, min, max, floor } = Math;

export const W = 480;
export const H = 576;
export const T = 14;

const clamp01 = (v) => max(0, min(1, v));
const smooth = (t) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};
const ease = (t) => {
  const x = clamp01(t);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
const lerp = (a, b, t) => a + (b - a) * t;
const span = (t, a, b) => ease((t - a) / (b - a));

// ---- the timeline (seconds) ----
const FOG_IN = [3.2, 5.6];
const FOG_OUT = [9.9, 12.6];
const FOREST_IN = [3.4, 5.9];
const FOREST_OUT = [10.3, 12.9];
const WALK = [4.6, 9.0]; // the creature crosses
const PUFF = 9.15; // and vanishes in smoke
const SMOKE_LEN = 2.1;

// Where nothing at all is drawn: one frame each is enough, held for the whole stretch.
export const IDLE = [
  [0, 3.1],
  [13.0, T],
];
// Where the picture changes fast, so it is recorded at the higher frame rate.
export const BUSY = [[WALK[0] - 0.2, PUFF + 1.1]];
// The still shown until the device may play motion: the forest and a thin fog, no creature.
export const POSTER_AT = 5.9;

const fogEnv = (t) => span(t, FOG_IN[0], FOG_IN[1]) * (1 - span(t, FOG_OUT[0], FOG_OUT[1]));
const forestEnv = (t) => span(t, FOREST_IN[0], FOREST_IN[1]) * (1 - span(t, FOREST_OUT[0], FOREST_OUT[1]));

// ---- noise ----
const hash = (x, y, s) => {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, y, s) {
  const xi = floor(x);
  const yi = floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  return lerp(lerp(hash(xi, yi, s), hash(xi + 1, yi, s), u), lerp(hash(xi, yi + 1, s), hash(xi + 1, yi + 1, s), u), v);
}
const fbm = (x, y, s) => 0.52 * vnoise(x, y, s) + 0.28 * vnoise(x * 2.03 + 11, y * 2.03 + 5, s + 1) + 0.2 * vnoise(x * 4.1 + 3, y * 4.1 + 17, s + 2);

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The creature is the photo frame's widow, darker and dimmer: a shape in the fog, not a portrait.
const SHADE = {
  ...PALETTES.widow,
  leg: "#04070b",
  band: [20, 32, 46],
  rim: [78, 120, 148],
  back: [34, 78, 104],
  abd: ["#33485b", "#131e2a", "#05090e", "#020406"],
  ceph: ["#2f4356", "#111a25", "#05090d", "#020305"],
  red: ["#f0502f", "#b0141a", "#560a0e"],
};

// ---- the path of the creature: a gentle curve in from the lower left, slowing to a stop ----
const P0 = { x: -200, y: 500 };
const PC = { x: 70, y: 340 };
const P1 = { x: 330, y: 262 };
function crossing(t) {
  const u = ease((t - WALK[0]) / (WALK[1] - WALK[0]));
  const x = (1 - u) * (1 - u) * P0.x + 2 * u * (1 - u) * PC.x + u * u * P1.x;
  const y = (1 - u) * (1 - u) * P0.y + 2 * u * (1 - u) * PC.y + u * u * P1.y;
  const dx = 2 * (1 - u) * (PC.x - P0.x) + 2 * u * (P1.x - PC.x);
  const dy = 2 * (1 - u) * (PC.y - P0.y) + 2 * u * (P1.y - PC.y);
  // It fades only in the puff: before that it simply walks in from outside the picture.
  const show = t < PUFF + 0.05 ? 1 : 1 - smooth((t - PUFF - 0.05) / 0.3);
  return { x, y, ang: atan2(dy, dx), show };
}

// ---- the fir forest, drawn once ----
function fir(ctx, x, base, h, w, wob) {
  const tiers = 7;
  for (let k = 0; k < tiers; k++) {
    const top = base - h + (k * h * 0.82) / tiers;
    const bot = base - h + ((k + 1.6) * h * 0.82) / tiers + h * 0.09;
    const half = (w * (k + 1.1)) / tiers;
    ctx.beginPath();
    ctx.moveTo(x + wob * (k / tiers) * 3, top);
    ctx.lineTo(x - half, bot);
    ctx.lineTo(x - half * 0.5, bot - h * 0.025);
    ctx.lineTo(x, bot + h * 0.012);
    ctx.lineTo(x + half * 0.5, bot - h * 0.025);
    ctx.lineTo(x + half, bot);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillRect(x - w * 0.045, base - h * 0.1, w * 0.09, h * 0.14);
}

function makeForest(SS) {
  const c = document.createElement("canvas");
  c.width = W * SS;
  c.height = H * SS;
  const x = c.getContext("2d");
  x.scale(SS, SS);
  const rnd = mulberry(7);
  // Three rows, far to near; the near row is darkest and only fills the corners and the bottom.
  const rows = [
    { n: 22, base: H * 0.95, h: [170, 260], w: [34, 52], fill: "rgba(44,60,82,0.8)", near: 0.0 },
    { n: 15, base: H * 1.02, h: [230, 350], w: [46, 66], fill: "rgba(15,22,32,0.92)", near: 0.2 },
    { n: 8, base: H * 1.07, h: [300, 420], w: [64, 90], fill: "rgba(7,11,17,0.97)", near: 0.55 },
  ];
  for (const row of rows) {
    x.fillStyle = row.fill;
    for (let i = 0; i < row.n; i++) {
      // More trees at the left and right edges than in the middle, so the face stays clear.
      const u = (i + 0.5 + (rnd() - 0.5) * 0.7) / row.n;
      const edge = Math.abs(u - 0.5) * 2;
      if (rnd() > 0.78 + 0.22 * edge) continue;
      const hh = lerp(row.h[0], row.h[1], rnd()) * (0.8 + 0.5 * edge);
      fir(x, u * W, row.base, hh, lerp(row.w[0], row.w[1], rnd()), rnd() - 0.5);
    }
  }
  // Keep it to the lower part of the card and the corners: nothing above the middle but the side trees.
  x.globalCompositeOperation = "destination-in";
  const g = x.createLinearGradient(0, H * 0.34, 0, H * 0.84);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,1)");
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  return c;
}

// ---- fog, computed small and drawn big ----
const FW = 96;
const FH = 115;
function makeFogLayer() {
  const c = document.createElement("canvas");
  c.width = FW;
  c.height = FH;
  const x = c.getContext("2d");
  return { c, x, img: x.createImageData(FW, FH) };
}
// One layer of drifting fog at time t. `dir` is the way it drifts; `dense` is how thick it gets.
function paintFog(layer, t, { seed, dir, speed, sx, sy, dense, tint, floor: lo }) {
  const d = layer.img.data;
  const env = fogEnv(t);
  for (let j = 0; j < FH; j++) {
    const py = j / FH;
    // Thicker toward the bottom and the sides, thinner over the middle of the card.
    const bottom = 0.18 + 0.82 * py ** 2.2;
    for (let i = 0; i < FW; i++) {
      const px = i / FW;
      const side = 0.7 + 0.3 * Math.abs(px - 0.5) * 2;
      const n = fbm(px * sx + t * speed * dir, py * sy + 0.35 * sin(t * 0.33 + seed), seed);
      const m = fbm(px * sx * 0.7 - t * speed * 0.5 * dir + 9, py * sy * 0.7 + 4, seed + 7);
      const a = smooth((n - lo) / 0.4) * bottom * side * dense * env;
      const k = (i + j * FW) * 4;
      d[k] = lerp(tint[0][0], tint[1][0], m);
      d[k + 1] = lerp(tint[0][1], tint[1][1], m);
      d[k + 2] = lerp(tint[0][2], tint[1][2], m);
      d[k + 3] = clamp01(a) * 255;
    }
  }
  layer.x.putImageData(layer.img, 0, 0);
}

// A static wisp texture (alpha only) that the smoke is cut through. A smooth gradient of alpha shows
// rings once the picture is saved with few transparency levels; a textured one does not.
function makeWisps() {
  const tw = 120;
  const th = 144;
  const c = document.createElement("canvas");
  c.width = tw;
  c.height = th;
  const x = c.getContext("2d");
  const img = x.createImageData(tw, th);
  for (let j = 0; j < th; j++) {
    for (let i = 0; i < tw; i++) {
      const n = fbm((i / tw) * 7, (j / th) * 8.4, 41);
      const k = (i + j * tw) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = (0.32 + 0.68 * smooth((n - 0.3) / 0.45)) * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

// ---- the smoke puff: soft puffs that swell, drift and thin out ----
const PUFFS = (() => {
  const rnd = mulberry(99);
  return Array.from({ length: 30 }, (_, i) => {
    const a = rnd() * PI * 2;
    const big = i < 8;
    return {
      a,
      speed: lerp(30, 110, rnd()) * (big ? 0.5 : 1),
      r0: lerp(10, 20, rnd()) * (big ? 1.5 : 1),
      r1: lerp(34, 66, rnd()) * (big ? 1.5 : 1),
      delay: rnd() * 0.32,
      rise: lerp(10, 36, rnd()),
      peak: lerp(0.16, 0.34, rnd()),
    };
  });
})();

function drawSmoke(ctx, t, sx) {
  const u0 = t - PUFF;
  if (u0 < 0 || u0 > SMOKE_LEN + 0.4) return;
  for (const p of PUFFS) {
    const u = (u0 - p.delay) / SMOKE_LEN;
    if (u <= 0 || u >= 1) continue;
    const grow = 1 - (1 - u) ** 3;
    const dist = p.speed * grow;
    const x = P1.x + cos(p.a) * dist;
    const y = P1.y + sin(p.a) * dist * 0.8 - p.rise * grow;
    const r = lerp(p.r0, p.r1, grow);
    const alpha = p.peak * smooth(u / 0.12) * (1 - smooth((u - 0.18) / 0.82));
    const g = ctx.createRadialGradient(x * sx, y * sx, 0, x * sx, y * sx, r * sx);
    g.addColorStop(0, `rgba(238,243,250,${alpha})`);
    g.addColorStop(0.55, `rgba(208,218,232,${alpha * 0.55})`);
    g.addColorStop(1, "rgba(190,204,222,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x * sx, y * sx, r * sx, 0, PI * 2);
    ctx.fill();
  }
}

// ---- the scene, with the same small interface the frame uses (info, advance, render) ----
export function createScene() {
  const params = new URLSearchParams(location.search);
  const OUT = Number(params.get("out")) || W;
  const OUTH = Math.round((OUT * H) / W);
  const sx = OUT / W; // art pixels to saved pixels
  const SS = 2;

  const canvas = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return [c, c.getContext("2d")];
  };
  const [fin, finCtx] = canvas(OUT, OUTH);
  // The creature is drawn at twice size and shrunk once, like the frame's widow.
  const [bodyC, bodyCtx] = canvas(W * SS, H * SS);
  const [shadowC, shadowCtx] = canvas(W * SS, H * SS);
  bodyCtx.scale(SS, SS);
  shadowCtx.scale(SS, SS);
  const [creatureC, creatureCtx] = canvas(W * SS, H * SS);
  const forest = makeForest(SS);
  const wisps = makeWisps();
  const [smokeC, smokeCtx] = canvas(OUT, OUTH);
  const back = makeFogLayer();
  const front = makeFogLayer();

  const creature = new Spider({ path: (t) => crossing(((t % T) + T) % T), scale: 0.86, palette: SHADE, period: T });
  creature.reset(0);

  const clear = (c, x) => {
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.restore();
  };

  // Fine fixed grain on the transparency, so that when the saved file keeps only a few levels of it
  // the steps between levels break up into grain instead of showing as rings. The same pattern in
  // every frame; clear areas and solid areas are left alone.
  const DITHER = Number(params.get("dither") ?? 0);
  const dither = () => {
    if (!DITHER) return;
    const img = finCtx.getImageData(0, 0, OUT, OUTH);
    const d = img.data;
    for (let k = 3, p = 0; k < d.length; k += 4, p++) {
      const a = d[k];
      if (a < 3 || a > 252) continue;
      const g = hash(p % OUT, (p / OUT) | 0, 5) - 0.5;
      d[k] = Math.max(1, Math.min(254, a + g * DITHER));
    }
    finCtx.putImageData(img, 0, 0);
  };

  let now = 0;
  const STEP = 1 / 120;
  const blur = (px) => (finCtx.filter = px ? `blur(${px}px)` : "none");

  return {
    info: () => ({
      name: "widow-fog",
      kind: "header",
      T,
      W,
      H,
      OUT,
      OUTH,
      busy: BUSY,
      idle: IDLE,
      posterAt: POSTER_AT,
      R: 0,
      scalePercent: 100,
      now,
    }),
    advance(to) {
      while (now < to - 1e-9) {
        const dt = min(STEP, to - now);
        now += dt;
        creature.update(now, dt);
      }
      return now;
    },
    render() {
      const t = ((now % T) + T) % T;
      clear(fin, finCtx);
      finCtx.imageSmoothingEnabled = true;
      finCtx.imageSmoothingQuality = "high";
      const fe = forestEnv(t);
      if (fe > 0.001) {
        finCtx.globalAlpha = fe;
        // The forest rises a little as it fades in.
        finCtx.drawImage(forest, 0, (1 - fe) * 26 * sx, OUT, OUTH);
        finCtx.globalAlpha = 1;
      }
      if (fogEnv(t) > 0.001) {
        paintFog(back, t, { seed: 3, dir: 1, speed: 0.1, sx: 3.2, sy: 3.8, dense: 0.5, floor: 0.34, tint: [[22, 31, 46], [96, 116, 146]] });
        blur(5 * sx);
        finCtx.drawImage(back.c, -8 * sx, -8 * sx, OUT + 16 * sx, OUTH + 16 * sx);
        blur(0);
      }
      // The creature, in its own layer so it can be softened a little (it is far off in the fog).
      clear(bodyC, bodyCtx);
      clear(shadowC, shadowCtx);
      creature.draw(bodyCtx, shadowCtx, t);
      clear(creatureC, creatureCtx);
      creatureCtx.filter = `blur(${5 * SS}px)`;
      creatureCtx.globalAlpha = 0.9;
      creatureCtx.drawImage(shadowC, 0, 0);
      creatureCtx.filter = `blur(${0.7 * SS}px)`;
      creatureCtx.globalAlpha = 1;
      creatureCtx.drawImage(bodyC, 0, 0);
      creatureCtx.filter = "none";
      finCtx.drawImage(creatureC, 0, 0, OUT, OUTH);
      if (fogEnv(t) > 0.001) {
        paintFog(front, t, { seed: 21, dir: -1, speed: 0.14, sx: 2.6, sy: 3.1, dense: 0.2, floor: 0.4, tint: [[70, 86, 110], [150, 168, 192]] });
        blur(5 * sx);
        finCtx.drawImage(front.c, -8 * sx, -8 * sx, OUT + 16 * sx, OUTH + 16 * sx);
        blur(0);
      }
      if (t > PUFF && t < PUFF + SMOKE_LEN + 0.5) {
        clear(smokeC, smokeCtx);
        drawSmoke(smokeCtx, t, sx);
        // Cut the puffs through the wisps, which drift a little, then soften the result.
        smokeCtx.globalCompositeOperation = "destination-in";
        smokeCtx.filter = `blur(${2 * sx}px)`;
        const dx = (t - PUFF) * 9 * sx;
        smokeCtx.drawImage(wisps, -40 * sx - dx, -40 * sx + dx * 0.5, OUT + 80 * sx, OUTH + 80 * sx);
        smokeCtx.filter = "none";
        smokeCtx.globalCompositeOperation = "source-over";
        blur(1.4 * sx);
        finCtx.drawImage(smokeC, 0, 0);
        blur(0);
      }
      dither();
      return fin.toDataURL("image/png");
    },
  };
}

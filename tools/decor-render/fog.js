// The Dragon's fog effect (id widowfog): a whole-header layer. Dark fog and a fir forest roll in over the card, a
// dragon rises into the picture from the right, roars, breathes a long stream of fire that lights the
// fog, then closes its mouth and sinks back out of sight; the fog thins out again. Most of the loop
// is clean, so only the middle of it costs bytes.
//
// The page draws this art over the whole header (banner, photo, name and bio) with `object-cover`
// anchored at the bottom, behind the photo and the words, so the dragon's path stays in the middle
// and the fog covers every edge.

const { PI, sin, cos, atan2, min, max, floor, exp, hypot } = Math;

export const W = 480;
export const H = 576;
export const T = 14.5;

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
const FOG_OUT = [10.8, 13.0];
const FOREST_IN = [3.4, 5.9];
const FOREST_OUT = [11.2, 13.2];
const RISE = [5.6, 7.3]; // the dragon comes into the picture
const JAW_OPEN = [7.0, 7.6]; // and opens its mouth to roar
const ROAR_END = [8.2, 8.7]; // the head comes back down
const FIRE = [8.1, 9.9]; // fire breath
const JAW_SHUT = [9.9, 10.4];
const SINK = [10.4, 12.0]; // and it goes back

// Where nothing at all is drawn: one frame each is enough, held for the whole stretch.
export const IDLE = [
  [0, 3.1],
  [13.4, T],
];
// Where the picture changes fast, so it is recorded at the higher frame rate.
export const BUSY = [[RISE[0] - 0.1, SINK[1] + 0.1]];
// The still shown until the device may play motion: the forest in thin fog, no dragon.
export const POSTER_AT = 5.0;

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

// ---- the dragon: a dark shape in the fog, lit cold from above and orange by its own fire ----
const BASE = { x: 730, y: 650 }; // where the neck comes from, far off the lower right
const HOLD = { x: 340, y: 316 }; // where the head stops
const OFF = { x: 660, y: 440 }; // the head's place while it is out of sight
const HEAD_S = 1.0;
const JAW_MAX = 0.66; // radians

const rot = (p, a) => ({ x: p.x * cos(a) - p.y * sin(a), y: p.x * sin(a) + p.y * cos(a) });

// 0 hidden, 1 fully risen.
const presence = (t) => span(t, RISE[0], RISE[1]) * (1 - span(t, SINK[0], SINK[1]));
const jawAt = (t) => span(t, JAW_OPEN[0], JAW_OPEN[1]) * (1 - span(t, JAW_SHUT[0], JAW_SHUT[1]));
// The roar: the head tips back. Fire: the head comes down and aims across the card.
const roarAt = (t) => span(t, JAW_OPEN[0], JAW_OPEN[1]) * (1 - span(t, ROAR_END[0], ROAR_END[1]));
const fireAt = (t) => span(t, FIRE[0], FIRE[0] + 0.35) * (1 - span(t, FIRE[1] - 0.35, FIRE[1] + 0.15));

function headPose(t) {
  const p = presence(t);
  const sinkOnly = span(t, SINK[0], SINK[1]);
  const q = ease(p);
  const roar = roarAt(t);
  const fire = fireAt(t);
  const shake = roar * 1.8 * sin(t * 41);
  const bob = 4 * sin(t * 1.9) * q;
  const x = lerp(OFF.x, HOLD.x, q) + shake;
  const y = lerp(OFF.y, HOLD.y, q) + bob + 46 * sinkOnly + 2 * shake;
  // Pitch up (positive) for the roar, a little down for the fire.
  const ang = (5 + 21 * roar - 11 * fire - 6 * sinkOnly) * (PI / 180);
  return { x, y, ang, p };
}

// Local head coordinates face left; the origin is the back of the skull.
const UPPER = [[14, -26], [-6, -40], [-34, -48], [-58, -40], [-84, -32], [-118, -26], [-146, -17], [-154, -8], [-150, -1], [-120, 2], [-90, 5], [-60, 4], [-30, 8], [-6, 10], [16, 6]];
const HORN_A = [[10, -34], [40, -58], [86, -84], [120, -88], [80, -62], [52, -42], [24, -26]];
const HORN_B = [[14, -14], [52, -26], [98, -34], [72, -16], [34, -6]];
const BROW = [[-34, -47], [-30, -64], [-12, -45]];
const CHEEK = [[16, 4], [42, 26], [62, 46], [28, 24], [4, 14]];
const JAW = [[-8, 6], [-30, 16], [-70, 21], [-112, 13], [-140, 4], [-136, -3], [-100, 1], [-60, 3], [-26, 4]];
const HINGE = { x: -8, y: 8 };

function poly(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

// Where the fire leaves the mouth, and which way it points, at time t (in the art's pixels).
function mouthAt(t) {
  const h = headPose(t);
  const jaw = jawAt(t) * JAW_MAX;
  const l = rot({ x: -146, y: 6 + 8 * jaw }, h.ang);
  const d = rot({ x: -1, y: 0.1 + 0.18 * jaw }, h.ang);
  const n = hypot(d.x, d.y);
  return { x: h.x + l.x * HEAD_S, y: h.y + l.y * HEAD_S, dx: d.x / n, dy: d.y / n };
}

function neckPoints(h) {
  const N = { x: h.x + rot({ x: 14, y: -2 }, h.ang).x * HEAD_S, y: h.y + rot({ x: 14, y: -2 }, h.ang).y * HEAD_S };
  const C1 = { x: BASE.x - 240, y: BASE.y - 90 };
  const C2 = { x: N.x + 200, y: N.y + 170 };
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const m = 1 - u;
    const x = m * m * m * BASE.x + 3 * m * m * u * C1.x + 3 * m * u * u * C2.x + u * u * u * N.x;
    const y = m * m * m * BASE.y + 3 * m * m * u * C1.y + 3 * m * u * u * C2.y + u * u * u * N.y;
    pts.push({ x, y });
  }
  return pts;
}

function drawDragon(ctx, t) {
  const h = headPose(t);
  if (h.p < 0.002) return;
  const fire = fireAt(t);
  const roar = roarAt(t);
  const jaw = jawAt(t) * JAW_MAX;
  const warm = clamp01(fire + 0.3 * jawAt(t));
  const rim = `rgba(${Math.round(lerp(120, 255, warm))},${Math.round(lerp(165, 150, warm))},${Math.round(lerp(196, 70, warm))},${lerp(0.3, 0.7, warm)})`;

  // ---- the neck: a tapering tube with a ridge of spines along its top and pale belly plates ----
  const pts = neckPoints(h);
  const L = [];
  const R = [];
  pts.forEach((p, i) => {
    const a = pts[max(0, i - 1)];
    const b = pts[min(pts.length - 1, i + 1)];
    let tx = b.x - a.x;
    let ty = b.y - a.y;
    const tl = hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const u = i / (pts.length - 1);
    const w = lerp(88, 30, u ** 0.75) * HEAD_S;
    p.w = w;
    p.n = { x: -ty, y: tx };
    L.push({ x: p.x + p.n.x * w, y: p.y + p.n.y * w });
    R.push({ x: p.x - p.n.x * w, y: p.y - p.n.y * w });
  });
  // The upper side is the one whose normal points up the picture at the middle of the neck.
  const mid = pts[floor(pts.length / 2)];
  const topIsL = mid.n.y < 0;
  const top = topIsL ? L : R;
  const g = ctx.createLinearGradient(0, h.y - 120, 0, h.y + 260);
  g.addColorStop(0, "#0d1620");
  g.addColorStop(1, "#04070b");
  ctx.fillStyle = g;
  ctx.beginPath();
  L.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i].x, R[i].y);
  ctx.closePath();
  ctx.fill();
  // Spines along the top edge, leaning back toward the base.
  ctx.fillStyle = "#070d14";
  for (let i = 8; i < pts.length - 1; i += 2) {
    const p = top[i];
    const nrm = pts[i].n;
    const sgn = topIsL ? 1 : -1;
    const back = { x: pts[i - 1].x - pts[i].x, y: pts[i - 1].y - pts[i].y };
    const bl = hypot(back.x, back.y) || 1;
    const sz = lerp(24, 13, i / pts.length) * HEAD_S;
    ctx.beginPath();
    ctx.moveTo(p.x - (back.x / bl) * 7, p.y - (back.y / bl) * 7);
    ctx.lineTo(p.x + nrm.x * sgn * sz + (back.x / bl) * sz * 0.9, p.y + nrm.y * sgn * sz + (back.y / bl) * sz * 0.9);
    ctx.lineTo(p.x + (back.x / bl) * 9, p.y + (back.y / bl) * 9);
    ctx.closePath();
    ctx.fill();
  }
  // A cold (or fire-warm) light along the top of the neck.
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  top.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.stroke();

  // ---- the head ----
  ctx.save();
  ctx.translate(h.x, h.y);
  ctx.rotate(h.ang);
  ctx.scale(HEAD_S, HEAD_S);
  const hg = ctx.createLinearGradient(-80, -60, 20, 30);
  hg.addColorStop(0, "#14202c");
  hg.addColorStop(0.5, "#0a121b");
  hg.addColorStop(1, "#04070b");

  // Horns and the cheek spike sit behind the skull.
  ctx.fillStyle = "#0a111a";
  poly(ctx, HORN_A);
  ctx.fill();
  poly(ctx, HORN_B);
  ctx.fill();
  poly(ctx, CHEEK);
  ctx.fill();

  // The inside of the mouth glows as the fire builds: only the wedge between the lips and the lower jaw.
  if (jaw > 0.04) {
    const lower = [8, 7, 6, 5].map((i) => {
      const r = rot({ x: JAW[i][0] - HINGE.x, y: JAW[i][1] - HINGE.y }, -jaw);
      return [r.x + HINGE.x, r.y + HINGE.y];
    });
    const mg = ctx.createRadialGradient(-30, 8, 2, -60, 14, 100);
    mg.addColorStop(0, `rgba(255,${Math.round(lerp(110, 215, fire))},${Math.round(lerp(40, 120, fire))},${0.35 + 0.6 * warm})`);
    mg.addColorStop(0.6, `rgba(${Math.round(lerp(120, 200, warm))},${Math.round(lerp(20, 50, warm))},12,0.9)`);
    mg.addColorStop(1, "rgba(30,6,6,0.95)");
    ctx.fillStyle = mg;
    poly(ctx, [[-150, -1], [-120, 2], [-90, 5], [-60, 4], [-30, 8], [-6, 10], ...lower]);
    ctx.fill();
  }

  // The lower jaw swings down on its hinge.
  ctx.save();
  ctx.translate(HINGE.x, HINGE.y);
  ctx.rotate(-jaw);
  ctx.translate(-HINGE.x, -HINGE.y);
  ctx.fillStyle = hg;
  poly(ctx, JAW);
  ctx.fill();
  // Lower teeth point up.
  ctx.fillStyle = `rgba(${Math.round(lerp(176, 255, warm))},${Math.round(lerp(184, 214, warm))},${Math.round(lerp(196, 170, warm))},0.78)`;
  for (const x of [-126, -108, -90, -72]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 3);
    ctx.lineTo(x, -8);
    ctx.lineTo(x + 4, 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // The skull, the brow spike and the upper teeth.
  ctx.fillStyle = hg;
  poly(ctx, UPPER);
  ctx.fill();
  poly(ctx, BROW);
  ctx.fill();
  ctx.fillStyle = `rgba(${Math.round(lerp(176, 255, warm))},${Math.round(lerp(184, 214, warm))},${Math.round(lerp(196, 170, warm))},0.82)`;
  for (const x of [-140, -122, -104, -86, -68]) {
    ctx.beginPath();
    ctx.moveTo(x - 4, 0);
    ctx.lineTo(x + 1, 12 + (x < -100 ? 2 : 0));
    ctx.lineTo(x + 5, 3);
    ctx.closePath();
    ctx.fill();
  }
  // Nostril and the eye, which burns brighter as it roars.
  ctx.fillStyle = "#020305";
  ctx.beginPath();
  ctx.ellipse(-143, -13, 4, 2.2, -0.4, 0, PI * 2);
  ctx.fill();
  ctx.save();
  ctx.shadowColor = "rgba(255,110,30,1)";
  ctx.shadowBlur = 10 + 14 * warm;
  ctx.fillStyle = `rgb(255,${Math.round(lerp(120, 220, warm))},${Math.round(lerp(40, 90, warm))})`;
  ctx.beginPath();
  ctx.ellipse(-52, -30, 10, 3.6, 0.35, 0, PI * 2);
  ctx.fill();
  ctx.restore();
  // The light along the brow and snout.
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  UPPER.slice(0, 9).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.beginPath();
  HORN_A.slice(0, 5).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.stroke();
  ctx.restore();
  void roar;
}

// ---- the fire: each particle's whole life is worked out from when it was born, so any frame can be drawn alone ----
const FLAMES = (() => {
  const rnd = mulberry(5150);
  return Array.from({ length: 190 }, (_, i) => ({
    b: lerp(FIRE[0] + 0.1, FIRE[1] - 0.1, i / 190) + (rnd() - 0.5) * 0.02,
    life: lerp(0.7, 1.25, rnd()),
    speed: lerp(420, 800, rnd()),
    spread: (rnd() - 0.5) * 0.4,
    lift: lerp(20, 80, rnd()),
    size: lerp(0.7, 1.25, rnd()),
  }));
})();
const SPARKS = (() => {
  const rnd = mulberry(77);
  return Array.from({ length: 26 }, () => ({
    b: lerp(FIRE[0] + 0.2, FIRE[1] - 0.2, rnd()),
    life: lerp(0.8, 1.5, rnd()),
    speed: lerp(240, 520, rnd()),
    spread: (rnd() - 0.5) * 0.9,
    fall: lerp(60, 160, rnd()),
    r: lerp(1.2, 2.8, rnd()),
  }));
})();

function flameColor(u) {
  if (u < 0.22) return [255, 244, 200];
  if (u < 0.5) return [255, lerp(210, 140, (u - 0.22) / 0.28), lerp(120, 40, (u - 0.22) / 0.28)];
  if (u < 0.8) return [lerp(255, 170, (u - 0.5) / 0.3), lerp(140, 44, (u - 0.5) / 0.3), lerp(40, 22, (u - 0.5) / 0.3)];
  return [lerp(170, 60, (u - 0.8) / 0.2), lerp(44, 30, (u - 0.8) / 0.2), 22];
}

function drawFire(ctx, t, sx) {
  if (t < FIRE[0] || t > FIRE[1] + 1.6) return;
  ctx.globalCompositeOperation = "lighter";
  for (const f of FLAMES) {
    const age = t - f.b;
    if (age <= 0 || age >= f.life) continue;
    const u = age / f.life;
    const m = mouthAt(f.b);
    const run = (f.speed * (1 - exp(-2.3 * age))) / 2.3;
    const ang = f.spread * (0.35 + u);
    const dx = m.dx * cos(ang) - m.dy * sin(ang);
    const dy = m.dx * sin(ang) + m.dy * cos(ang);
    const x = m.x + dx * run;
    const y = m.y + dy * run - f.lift * age * age;
    const r = lerp(10, 54, u ** 0.8) * f.size;
    const [cr, cg, cb] = flameColor(u);
    const a = (1 - u) ** 1.15 * 0.55;
    const g = ctx.createRadialGradient(x * sx, y * sx, 0, x * sx, y * sx, r * sx);
    g.addColorStop(0, `rgba(${cr | 0},${cg | 0},${cb | 0},${a})`);
    g.addColorStop(0.5, `rgba(${cr | 0},${(cg * 0.8) | 0},${(cb * 0.6) | 0},${a * 0.5})`);
    g.addColorStop(1, "rgba(120,30,10,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x * sx, y * sx, r * sx, 0, PI * 2);
    ctx.fill();
  }
  // Sparks that fly further and fall.
  for (const s of SPARKS) {
    const age = t - s.b;
    if (age <= 0 || age >= s.life) continue;
    const u = age / s.life;
    const m = mouthAt(s.b);
    const run = (s.speed * (1 - exp(-1.6 * age))) / 1.6;
    const ang = s.spread;
    const dx = m.dx * cos(ang) - m.dy * sin(ang);
    const dy = m.dx * sin(ang) + m.dy * cos(ang);
    const x = m.x + dx * run;
    const y = m.y + dy * run + s.fall * age * age;
    ctx.fillStyle = `rgba(255,${(lerp(230, 110, u)) | 0},${(lerp(150, 40, u)) | 0},${(1 - u) * 0.95})`;
    ctx.beginPath();
    ctx.arc(x * sx, y * sx, s.r * sx * (1 - u * 0.5), 0, PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

// A soft orange light on the fog around the head and along the fire. Cut through the wisp texture by
// the caller, so it does not show rings once the picture is saved with few transparency levels.
function drawFireLight(ctx, t, sx) {
  const fire = fireAt(t);
  const warm = clamp01(fire + 0.35 * jawAt(t));
  if (warm < 0.01) return;
  const m = mouthAt(t);
  const reach = 150 + 150 * fire;
  const cx = (m.x + m.dx * reach * 0.6) * sx;
  const cy = (m.y + m.dy * reach * 0.6) * sx;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, (230 + 120 * fire) * sx);
  g.addColorStop(0, `rgba(255,140,60,${0.5 * warm})`);
  g.addColorStop(0.5, `rgba(230,90,30,${0.24 * warm})`);
  g.addColorStop(1, "rgba(120,40,10,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W * sx, H * sx);
}

// The roar: two pale rings that spread from the mouth.
function drawRoar(ctx, t, sx) {
  const m = mouthAt(t);
  for (const start of [JAW_OPEN[1] - 0.05, JAW_OPEN[1] + 0.35]) {
    const u = (t - start) / 1.0;
    if (u <= 0 || u >= 1) continue;
    const r = lerp(24, 190, 1 - (1 - u) ** 2.2);
    ctx.strokeStyle = `rgba(205,215,232,${0.3 * (1 - u) ** 1.4})`;
    ctx.lineWidth = lerp(5, 1.6, u) * sx;
    ctx.beginPath();
    ctx.ellipse((m.x - m.dx * 20) * sx, (m.y - m.dy * 20) * sx, r * sx * 0.78, r * sx, atan2(m.dy, m.dx), 0, PI * 2);
    ctx.stroke();
  }
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
  // The dragon is drawn at twice size and shrunk once, so its edges are clean.
  const [bodyC, bodyCtx] = canvas(W * SS, H * SS);
  bodyCtx.scale(SS, SS);
  const [creatureC, creatureCtx] = canvas(W * SS, H * SS);
  const forest = makeForest(SS);
  const wisps = makeWisps();
  const [lightC, lightCtx] = canvas(OUT, OUTH);
  const [fireC, fireCtx] = canvas(OUT, OUTH);
  const back = makeFogLayer();
  const front = makeFogLayer();

  const clear = (c, x) => {
    x.save();
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.restore();
  };

  let now = 0;
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
      now = to;
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
      // The dragon, in its own layer so it can be softened a little (it is far off in the fog).
      clear(bodyC, bodyCtx);
      bodyCtx.save();
      drawDragon(bodyCtx, t);
      bodyCtx.restore();
      clear(creatureC, creatureCtx);
      // Lit by its own fire: warm light near the mouth, only where the dragon is.
      creatureCtx.filter = `blur(${0.7 * SS}px)`;
      creatureCtx.drawImage(bodyC, 0, 0);
      creatureCtx.filter = "none";
      const warm = clamp01(fireAt(t) + 0.3 * jawAt(t));
      if (warm > 0.01) {
        const m = mouthAt(t);
        creatureCtx.globalCompositeOperation = "source-atop";
        const g = creatureCtx.createRadialGradient(m.x * SS, m.y * SS, 0, m.x * SS, m.y * SS, 190 * SS);
        g.addColorStop(0, `rgba(255,150,70,${0.3 * warm})`);
        g.addColorStop(1, "rgba(255,110,40,0)");
        creatureCtx.fillStyle = g;
        creatureCtx.fillRect(0, 0, W * SS, H * SS);
        creatureCtx.globalCompositeOperation = "source-over";
      }
      finCtx.drawImage(creatureC, 0, 0, OUT, OUTH);
      if (fogEnv(t) > 0.001) {
        paintFog(front, t, { seed: 21, dir: -1, speed: 0.14, sx: 2.6, sy: 3.1, dense: 0.2, floor: 0.4, tint: [[70, 86, 110], [150, 168, 192]] });
        blur(5 * sx);
        finCtx.drawImage(front.c, -8 * sx, -8 * sx, OUT + 16 * sx, OUTH + 16 * sx);
        blur(0);
      }
      // Fire light on the fog: a soft glow, cut through the wisps (drifting a little) so it has texture.
      if (fireAt(t) + jawAt(t) > 0.01) {
        clear(lightC, lightCtx);
        drawFireLight(lightCtx, t, sx);
        lightCtx.globalCompositeOperation = "destination-in";
        lightCtx.filter = `blur(${2 * sx}px)`;
        const dx = t * 7 * sx;
        lightCtx.drawImage(wisps, -40 * sx - dx, -40 * sx + dx * 0.5, OUT + 80 * sx, OUTH + 80 * sx);
        lightCtx.filter = "none";
        lightCtx.globalCompositeOperation = "source-over";
        finCtx.globalCompositeOperation = "lighter";
        finCtx.drawImage(lightC, 0, 0);
        finCtx.globalCompositeOperation = "source-over";
      }
      // The roar rings and the fire itself, on top.
      clear(fireC, fireCtx);
      drawRoar(fireCtx, t, sx);
      drawFire(fireCtx, t, sx);
      blur(0.9 * sx);
      finCtx.drawImage(fireC, 0, 0);
      blur(0);
      return fin.toDataURL("image/png");
    },
  };
}

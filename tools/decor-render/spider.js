// A top-down spider that walks, drawn with shaded canvas shapes. Used by the decoration renderer
// (tools/decor-render): the same code is stepped frame by frame in a headless browser and the frames
// are saved as an animated WebP. Nothing here touches the page or the network.
//
// Units are pixels of the art at scale 1; `scale` shrinks the whole animal (the little spiders).
// Screen coordinates: x to the right, y down. A heading of 0 points right, 90 degrees points down.
//
// The feet are solved on the flat ground (the photo). Height is then added on the screen: the body
// and the knees are lifted straight up the picture, and the cast shadows stay on the ground, so the
// animal reads as standing on the photo rather than lying on it.

const { PI, cos, sin, sqrt, atan2, min, max, abs, hypot } = Math;
export const TAU = PI * 2;

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
const len = (a) => hypot(a.x, a.y);
const dot = (a, b) => a.x * b.x + a.y * b.y;
const norm = (a) => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rot = (p, a) => ({ x: p.x * cos(a) - p.y * sin(a), y: p.x * sin(a) + p.y * cos(a) });
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => min(hi, max(lo, v));
const smooth = (t) => t * t * (3 - 2 * t);

// The light comes from the upper left, as it does in the reference. A unit vector pointing TO the light.
export const LIGHT = norm({ x: -0.55, y: -0.84 });

// One leg pair each: where the hip sits along the head plate, the angle of the resting stance away
// from straight ahead, how far out the foot rests (as a share of the leg), the length of the leg, and
// which way the knee bows (+1 forward, -1 back).
const PAIRS = [
  { hx: 38, ang: 38, reach: 0.86, len: 170, bow: +1 },
  { hx: 27, ang: 78, reach: 0.84, len: 154, bow: +1 },
  { hx: 16, ang: 114, reach: 0.84, len: 150, bow: -1 },
  { hx: 5, ang: 150, reach: 0.86, len: 170, bow: -1 },
];
const HIP_Y = 15;
const SEG = [0.38, 0.4, 0.22]; // femur, tibia, foot piece, as shares of the leg

// Heights above the ground (pixels at scale 1): the middle of the body, and the hip, knee, ankle and
// foot of a leg standing still. A foot in the air adds `lift` times these extra amounts.
const BODY_H = 13;
const LEG_H = [11, 33, 10, 0];
const LIFT_H = [0, 14, 12, 14];

// Body parts (at scale 1): centre x, half length, half width, how much wider the back end is.
const ABD = { x: -27, a: 47, b: 41, tail: 0.12 };
const CEPH = { x: 25, a: 29, b: 25, tail: 0.05 };

// A critically damped spring: it follows a target with a little lag and no overshoot.
function spring(s, target, dt, w) {
  const acc = -w * w * (s.x - target) - 2 * w * s.v;
  s.v += acc * dt;
  s.x += s.v * dt;
}

export const PALETTES = {
  widow: {
    leg: "#0c141d",
    band: [44, 74, 98],
    rim: [128, 218, 244],
    back: [58, 140, 185],
    abd: ["#5a7b98", "#22364a", "#0b141d", "#04070b"],
    ceph: ["#52728f", "#1d2e40", "#0a121b", "#03060a"],
    red: ["#ff5a3c", "#cc1519", "#650a10"],
    eye: "#ff4a3a",
  },
  small: {
    leg: "#2a1013",
    band: [96, 44, 44],
    rim: [255, 196, 168],
    back: [150, 60, 60],
    abd: ["#94504b", "#401a1c", "#1c0a0b", "#0a0304"],
    ceph: ["#84443f", "#371618", "#190809", "#090203"],
    red: ["#ff7a5a", "#e0241f", "#7a0c10"],
    eye: "#ff6a4a",
  },
};

export class Spider {
  // path(t) gives { x, y, ang, show } for the body origin (the middle of the head plate's hips).
  constructor({ path, scale = 1, palette = PALETTES.widow, stepScale = 1, nudges = [], period = 0 }) {
    this.period = period; // the loop length, so gestures repeat each time round
    // Slow rhythms (breathing, a raised leg's sway) take a whole number of turns per loop, so the
    // picture at the end of the loop is the picture at its start.
    const cyc = (hz) => (period ? (TAU * Math.max(1, Math.round(period * hz))) / period : TAU * hz);
    this.wBreath = cyc(0.37);
    this.wKnee = cyc(0.3);
    this.wSwayA = cyc(1.35);
    this.wSwayB = cyc(1.07);
    this.path = path;
    // Little gestures while resting: { leg, t0, t1, x, y, air } moves one foot to a new place from t0
    // to t1 (x and y in body pixels) and, when `air` is 1, holds it raised and waving.
    this.nudges = nudges;
    this.scale = scale;
    this.pal = palette;
    this.stepScale = stepScale; // little spiders move their feet faster
    this.legs = [];
    this.sway = { x: 0, v: 0 };
    this.abd = { x: 0, v: 0 };
    this.breath = 0;
    this.nextGroup = 0;
    this.lastStep = -9;
    this.pulse = 0;
    this.turnRate = 0;
    this.t = 0;
  }

  poseAt(t) {
    return this.path(t);
  }

  // Where the foot of a leg rests, in the world, for a given body pose.
  home(leg, pose, tm = this.t) {
    const k = this.scale;
    const p = PAIRS[leg.pair];
    const hip = { x: p.hx, y: leg.side * HIP_Y };
    const dir = { x: cos((p.ang * PI) / 180), y: leg.side * sin((p.ang * PI) / 180) };
    let local = add(hip, mul(dir, p.reach * p.len));
    const n = this.nudgeOf(leg, tm);
    if (n) local = add(local, { x: n.x, y: n.y });
    return add({ x: pose.x, y: pose.y }, rot(mul(local, k), pose.ang));
  }

  // The gesture a leg is making at time tm, if any (times wrap with the loop).
  nudgeOf(leg, tm0) {
    const tm = this.period ? ((tm0 % this.period) + this.period) % this.period : tm0;
    const idx = leg.pair * 2 + (leg.side > 0 ? 1 : 0);
    for (const n of this.nudges) {
      if (n.leg === idx && tm >= n.t0 && tm < n.t1) return n;
    }
    return null;
  }

  // How far a leg is raised for a gesture (0 on the ground, 1 held up), eased in and out.
  airOf(leg, tm0) {
    const tm = this.period ? ((tm0 % this.period) + this.period) % this.period : tm0;
    const idx = leg.pair * 2 + (leg.side > 0 ? 1 : 0);
    let a = 0;
    for (const n of this.nudges) {
      if (n.leg !== idx || !n.air) continue;
      const up = clamp((tm - n.t0 - 0.2) / 0.3, 0, 1);
      const down = clamp((n.t1 - tm) / 0.3, 0, 1);
      a = max(a, smooth(min(up, down)));
    }
    return a;
  }

  hipWorld(leg, pose) {
    const k = this.scale;
    const p = PAIRS[leg.pair];
    return add({ x: pose.x, y: pose.y }, rot(mul({ x: p.hx, y: leg.side * HIP_Y }, k), pose.ang));
  }

  // Plant every foot at its resting place for the pose at time t.
  reset(t) {
    const pose = this.poseAt(t);
    this.legs = [];
    for (let pair = 0; pair < 4; pair++) {
      for (const side of [-1, 1]) {
        const leg = { pair, side, group: (pair + (side > 0 ? 1 : 0)) % 2, t: 1, dur: 0.2, lift: 0, bowSide: 1, air: 0 };
        this.t = t;
        leg.foot = this.home(leg, pose, t);
        leg.from = leg.foot;
        leg.to = leg.foot;
        this.legs.push(leg);
      }
    }
  }

  // Advance the walk by dt seconds to time t.
  update(t, dt) {
    this.t = t;
    const pose = this.poseAt(t);
    const before = this.poseAt(t - 0.03);
    const after = this.poseAt(t + 0.03);
    const speed = hypot(after.x - before.x, after.y - before.y) / 0.06;
    let dAng = after.ang - before.ang;
    dAng = atan2(sin(dAng), cos(dAng));
    const turn = abs(dAng) / 0.06; // radians per second
    this.turnRate = (dAng / 0.06) * (pose.show === 0 ? 0 : 1);
    const busy = speed > 4 * this.scale || turn > 0.05;
    this.speed = speed;

    // Feet in the air keep moving.
    for (const leg of this.legs) {
      if (leg.t < 1) {
        leg.t = min(1, leg.t + dt / leg.dur);
        const e = smooth(leg.t);
        leg.foot = { x: lerp(leg.from.x, leg.to.x, e), y: lerp(leg.from.y, leg.to.y, e) };
        leg.lift = sin(PI * leg.t);
        if (leg.t >= 1) {
          leg.foot = leg.to;
          leg.lift = 0;
        }
      }
    }

    // Start new steps. A foot goes when it has fallen far enough behind its resting place; only one
    // group of four moves at a time, so the other four always carry the body (an alternating
    // tetrapod, the way real spiders walk).
    const thr = (busy ? 14 : 1.6) * this.scale;
    const stepping = this.legs.filter((l) => l.t < 1);
    const err = (l) => len(sub(l.foot, this.home(l, pose)));
    let group = null;
    if (stepping.length) {
      const early = stepping.every((l) => l.t < 0.28);
      if (early) group = stepping[0].group;
    } else {
      const wanting = this.legs.filter((l) => err(l) > thr);
      if (wanting.length) {
        const score = [0, 0];
        for (const l of wanting) score[l.group] += err(l);
        group = score[0] === score[1] ? this.nextGroup : score[0] > score[1] ? 0 : 1;
      }
    }
    if (group !== null) {
      const dur = (busy ? lerp(0.27, 0.17, clamp(max(speed / (95 * this.scale ** 0.5), turn / 2), 0, 1)) : 0.36) * this.stepScale;
      const lead = dur + 0.1;
      const future = this.poseAt(t + lead);
      for (const l of this.legs) {
        if (l.t < 1 || l.group !== group) continue;
        if (err(l) <= thr * 0.55) continue;
        l.from = l.foot;
        l.to = this.home(l, future, t + lead);
        l.t = 0;
        l.dur = dur;
        if (this.lastStep < t - 0.05) this.pulse = this.pulse > 0 ? -1 : 1;
        this.lastStep = t;
        this.nextGroup = 1 - group;
      }
    }

    // Weight: the body leans a little toward the legs that are planted, and the round back lags
    // behind a turn.
    const leanTarget = busy ? this.pulse * 2.4 * this.scale : 0;
    spring(this.sway, leanTarget, dt, 9);
    spring(this.abd, clamp(-this.turnRate * 0.09, -0.26, 0.26) + this.sway.x * 0.01, dt, 8);
    this.breath = sin(t * this.wBreath) * 0.5 + 0.5;
  }

  // The body's pose on the ground: the path plus the little sway.
  bodyPose(t) {
    const p = this.poseAt(t);
    const side = rot({ x: 0, y: 1 }, p.ang);
    return { x: p.x + side.x * this.sway.x, y: p.y + side.y * this.sway.x, ang: p.ang + this.sway.x * 0.012, show: p.show };
  }

  // The four points of each leg on the ground: hip, knee, ankle, foot.
  legPoints(leg, pose) {
    const k = this.scale;
    const P = PAIRS[leg.pair];
    const H = this.hipWorld(leg, pose);
    const total = P.len * k;
    const L1 = SEG[0] * total;
    const L2 = SEG[1] * total;
    const L3 = SEG[2] * total;
    let F = leg.foot;
    if (leg.air > 0.01) {
      // A raised foot feels the air: it sways a little.
      const w = rot({ x: 4 * sin(this.t * this.wSwayA), y: 5 * sin(this.t * this.wSwayB + 1) }, pose.ang);
      F = add(F, mul(w, leg.air * k));
    }
    const d = sub(F, H);
    const dl = len(d) || 1;
    const dh = { x: d.x / dl, y: d.y / dl };
    const fwd = { x: cos(pose.ang), y: sin(pose.ang) };
    const p = { x: -dh.y, y: dh.x };
    const c = dot(p, fwd);
    if (abs(c) > 0.3) leg.bowSide = c * P.bow > 0 ? 1 : -1;
    const bs = leg.bowSide;
    const b = { x: -dh.y * bs, y: dh.x * bs };
    const tip = norm({ x: dh.x - 0.5 * b.x, y: dh.y - 0.5 * b.y });
    let A = sub(F, mul(tip, L3));
    let v = sub(A, H);
    let D = len(v);
    const maxD = L1 + L2 - 0.6;
    if (D > maxD) {
      A = add(H, mul(v, maxD / D));
      v = sub(A, H);
      D = maxD;
    }
    D = max(D, abs(L1 - L2) + 1);
    const vh = { x: v.x / (len(v) || 1), y: v.y / (len(v) || 1) };
    const a = (L1 * L1 - L2 * L2 + D * D) / (2 * D);
    const h = sqrt(max(0, L1 * L1 - a * a)) * 0.8 + leg.lift * 9 * k;
    const pb = { x: -vh.y * bs, y: vh.x * bs };
    const K = add(H, add(mul(vh, a), mul(pb, h)));
    const Fo = add(A, mul(tip, L3));
    return [H, K, A, Fo];
  }

  // ---- drawing ----

  // The legs and the body, drawn into ctx. `sctx` is a second context that gets the cast shadows.
  draw(ctx, sctx, t) {
    const pose = this.bodyPose(t);
    if (pose.show !== undefined && pose.show <= 0.002) return;
    const alpha = pose.show === undefined ? 1 : clamp(pose.show, 0, 1);
    ctx.save();
    ctx.globalAlpha *= alpha;
    sctx.save();
    sctx.globalAlpha *= alpha;

    const k = this.scale;
    const breath = sin(t * this.wKnee) * 1.1 * k;
    for (const l of this.legs) l.air = this.airOf(l, t);
    const AIR_H = [0, 18, 26, 30];
    const ground = this.legs.map((l) => this.legPoints(l, pose));
    const heights = this.legs.map((l, i) =>
      LEG_H.map((h, j) => (h + l.lift * LIFT_H[j] + l.air * AIR_H[j] + (j === 1 ? breath * (i % 2 ? 1 : -1) * 0.7 : 0)) * k),
    );
    // Where the legs are drawn: the ground points lifted up the picture.
    const shown = ground.map((g, i) => g.map((p, j) => ({ x: p.x, y: p.y - heights[i][j] })));

    // Shadows first: the higher a part is, the further its shadow lands from it.
    this.legs.forEach((l, i) => this.legShadow(sctx, ground[i], heights[i]));
    this.bodyShadow(sctx, pose);
    // Legs that are higher up the picture (further away) first, so nearer ones overlap them.
    const order = this.legs.map((_, i) => i).sort((a, b) => shown[a][1].y - shown[b][1].y);
    for (const i of order) this.drawLeg(ctx, shown[i], this.legs[i]);
    this.drawBody(ctx, { ...pose, y: pose.y - BODY_H * k }, k);
    ctx.restore();
    sctx.restore();
  }

  legShadow(sctx, pts, hts) {
    const k = this.scale;
    const q = pts.map((p, i) => ({ x: p.x - LIGHT.x * hts[i] * 0.4, y: p.y - LIGHT.y * hts[i] * 0.4 }));
    const sm = sample(q, 7);
    sctx.save();
    sctx.strokeStyle = "rgba(0,0,0,0.4)";
    sctx.lineCap = "round";
    sctx.lineJoin = "round";
    for (let i = 0; i < sm.length - 1; i++) {
      const u = i / (sm.length - 1);
      sctx.lineWidth = max(0.8, widthAt(u) * k * 0.85);
      sctx.beginPath();
      sctx.moveTo(sm[i].x, sm[i].y);
      sctx.lineTo(sm[i + 1].x, sm[i + 1].y);
      sctx.stroke();
    }
    sctx.restore();
  }

  bodyShadow(sctx, pose) {
    const k = this.scale;
    sctx.save();
    sctx.translate(pose.x - LIGHT.x * BODY_H * 0.75 * k, pose.y - LIGHT.y * BODY_H * 0.75 * k);
    sctx.rotate(pose.ang);
    sctx.scale(k, k);
    sctx.fillStyle = "rgba(0,0,0,0.66)";
    eggPath(sctx, ABD.x, 0, ABD.a * 0.96, ABD.b * 0.96, ABD.tail);
    sctx.fill();
    eggPath(sctx, CEPH.x, 0, CEPH.a * 0.96, CEPH.b * 0.96, CEPH.tail);
    sctx.fill();
    sctx.restore();
  }

  drawLeg(ctx, pts, leg) {
    const k = this.scale;
    const sm = sample(pts, 9);
    const n = sm.length;
    const widen = 1 + leg.lift * 0.12;
    const left = [];
    const right = [];
    for (let i = 0; i < n; i++) {
      const a = sm[max(0, i - 1)];
      const b = sm[min(n - 1, i + 1)];
      const tng = norm(sub(b, a));
      const nrm = { x: -tng.y, y: tng.x };
      const w = max(0.65, widthAt(i / (n - 1)) * k * widen) / 2;
      left.push(add(sm[i], mul(nrm, w)));
      right.push(sub(sm[i], mul(nrm, w)));
      sm[i].nrm = nrm;
      sm[i].w = w;
    }
    ctx.save();
    ctx.fillStyle = this.pal.leg;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(left[i].x, left[i].y);
    const tipEnd = sm[n - 1];
    const ta = atan2(tipEnd.nrm.y, tipEnd.nrm.x);
    ctx.arc(tipEnd.x, tipEnd.y, tipEnd.w, ta, ta + PI, false);
    for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.clip();

    // A glossy tube: a lighter band toward the lamp, a bright line at the lit edge and a cool glow
    // along the far edge.
    ctx.lineCap = "round";
    const [bandR, bandG, bandB] = this.pal.band;
    const [r, g, b] = this.pal.rim;
    const [br, bg, bb] = this.pal.back;
    for (let i = 0; i < n - 1; i++) {
      const nrm = sm[i].nrm;
      const nrm2 = sm[i + 1].nrm;
      const facing = dot(nrm, LIGHT);
      const side = facing >= 0 ? 1 : -1;
      const s = abs(facing);
      const w = sm[i].w;
      const w2 = sm[i + 1].w;
      const seg = (off, width, color) => {
        const p0 = add(sm[i], mul(nrm, side * w * off));
        const p1 = add(sm[i + 1], mul(nrm2, side * w2 * off));
        ctx.strokeStyle = color;
        ctx.lineWidth = max(0.5, width);
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      };
      seg(0.3, w * 1.15, `rgba(${bandR},${bandG},${bandB},${0.25 + 0.65 * s})`);
      seg(0.8, w * 0.55, `rgba(${r},${g},${b},${0.08 + 0.62 * s * s})`);
      seg(-0.85, w * 0.45, `rgba(${br},${bg},${bb},${0.3 + 0.3 * (1 - s)})`);
    }
    ctx.restore();

    // Joints: a small glossy bead at the knee and the ankle.
    ctx.save();
    for (const j of [1, 2]) {
      const idx = j === 1 ? Math.round((n - 1) * 0.36) : Math.round((n - 1) * 0.74);
      const c = sm[idx];
      const rad = max(0.8, c.w * 1.25);
      const gr = ctx.createRadialGradient(c.x + LIGHT.x * rad * 0.4, c.y + LIGHT.y * rad * 0.4, 0, c.x, c.y, rad);
      gr.addColorStop(0, "rgba(205,240,255,0.85)");
      gr.addColorStop(0.4, "rgba(70,120,150,0.55)");
      gr.addColorStop(1, "rgba(10,16,22,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.arc(c.x, c.y, rad, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  drawBody(ctx, pose, k) {
    ctx.save();
    ctx.translate(pose.x, pose.y);
    ctx.rotate(pose.ang);
    ctx.scale(k, k);
    // The light as seen from the body's own side.
    const ll = rot(LIGHT, -pose.ang);
    const breathe = 1 + this.breath * 0.012;
    // The round back, a little behind the head plate in a turn; it hinges at the front.
    ctx.save();
    const hinge = ABD.x + ABD.a * 0.8;
    ctx.translate(hinge, 0);
    ctx.rotate(this.abd.x);
    ctx.translate(-hinge + ABD.x, 0);
    ctx.scale(breathe, breathe);
    this.drawAbdomen(ctx, ll);
    ctx.restore();
    this.drawHead(ctx, ll);
    ctx.restore();
  }

  drawAbdomen(ctx, ll) {
    const { a, b, tail } = ABD;
    const pal = this.pal;
    ctx.save();
    eggPath(ctx, 0, 0, a, b, tail);
    ctx.clip();
    const g = ctx.createRadialGradient(ll.x * a * 0.42, ll.y * b * 0.42, 1, ll.x * a * 0.1, ll.y * b * 0.1, a * 1.25);
    g.addColorStop(0, pal.abd[0]);
    g.addColorStop(0.2, pal.abd[1]);
    g.addColorStop(0.58, pal.abd[2]);
    g.addColorStop(1, pal.abd[3]);
    ctx.fillStyle = g;
    ctx.fillRect(-a * 1.3, -b * 1.3, a * 2.6, b * 2.6);

    // The red mark: an hourglass with curved sides and a glossy finish, set a little toward the back.
    ctx.save();
    ctx.translate(-a * 0.08, 0);
    const u = a * 0.3;
    const v = b * 0.33;
    const wst = b * 0.075;
    const rg = ctx.createRadialGradient(ll.x * u * 0.6, ll.y * v * 0.6, 0, 0, 0, u * 1.25);
    rg.addColorStop(0, pal.red[0]);
    rg.addColorStop(0.5, pal.red[1]);
    rg.addColorStop(1, pal.red[2]);
    ctx.fillStyle = rg;
    ctx.strokeStyle = pal.red[2];
    ctx.lineJoin = "round";
    ctx.lineWidth = b * 0.05;
    ctx.beginPath();
    ctx.moveTo(-u, -v);
    ctx.quadraticCurveTo(-u * 0.25, -wst * 0.2, 0, -wst);
    ctx.quadraticCurveTo(u * 0.25, -wst * 0.2, u, -v);
    ctx.lineTo(u, v);
    ctx.quadraticCurveTo(u * 0.25, wst * 0.2, 0, wst);
    ctx.quadraticCurveTo(-u * 0.25, wst * 0.2, -u, v);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // A glint on the red.
    ctx.fillStyle = "rgba(255,210,190,0.45)";
    ctx.beginPath();
    ctx.ellipse(-u * 0.55, -v * 0.45, u * 0.2, v * 0.16, -0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    // A pair of small red spots near the spinnerets, like the reference.
    ctx.fillStyle = pal.red[1];
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(-a * 0.66, sy * b * 0.3, b * 0.07, b * 0.055, 0, 0, TAU);
      ctx.fill();
    }

    // A shine on the side facing the light.
    ctx.save();
    ctx.translate(ll.x * a * 0.4, ll.y * b * 0.4);
    ctx.rotate(atan2(-ll.x, ll.y));
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, a * 0.44);
    sh.addColorStop(0, "rgba(235,250,255,0.9)");
    sh.addColorStop(0.35, "rgba(150,205,235,0.38)");
    sh.addColorStop(1, "rgba(120,180,220,0)");
    ctx.fillStyle = sh;
    ctx.scale(1, 0.42);
    ctx.beginPath();
    ctx.arc(0, 0, a * 0.44, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();

    // Edge light along the contour on the side away from the light.
    ctx.save();
    eggPath(ctx, 0, 0, a, b, tail);
    const [rr, gg, bb] = pal.rim;
    const eg = ctx.createLinearGradient(-ll.x * a, -ll.y * b, ll.x * a * 0.2, ll.y * b * 0.2);
    eg.addColorStop(0, `rgba(${rr},${gg},${bb},0.75)`);
    eg.addColorStop(0.45, `rgba(${rr},${gg},${bb},0)`);
    ctx.strokeStyle = eg;
    ctx.lineWidth = 2.6;
    ctx.stroke();
    ctx.restore();
  }

  drawHead(ctx, ll) {
    const pal = this.pal;
    const { x, a, b, tail } = CEPH;
    // Fangs and feelers first, under the head plate.
    ctx.save();
    ctx.fillStyle = pal.leg;
    ctx.strokeStyle = pal.leg;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const fk = this.breath * 1.4;
    for (const s of [-1, 1]) {
      ctx.strokeStyle = pal.leg;
      ctx.lineWidth = 4.6;
      ctx.beginPath();
      ctx.moveTo(x + a * 0.7, s * 8);
      ctx.lineTo(x + a + 7, s * 12);
      ctx.lineTo(x + a + 16 + fk, s * (8.5 - fk * 0.3));
      ctx.stroke();
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = `rgba(${pal.rim[0]},${pal.rim[1]},${pal.rim[2]},0.7)`;
      ctx.beginPath();
      ctx.moveTo(x + a + 7, s * 10.5);
      ctx.lineTo(x + a + 15 + fk, s * 7.5);
      ctx.stroke();
      ctx.strokeStyle = pal.leg;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + a * 0.9, s * 3.6);
      ctx.lineTo(x + a + 8, s * 2.8);
      ctx.stroke();
    }
    ctx.restore();

    // A soft shadow the head plate throws on the back where they overlap.
    ctx.save();
    ctx.translate(x, 0);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.filter = "blur(2.5px)";
    eggPath(ctx, -3, 0, a * 1.02, b * 1.04, tail);
    ctx.fill();
    ctx.filter = "none";
    ctx.restore();

    ctx.save();
    ctx.translate(x, 0);
    eggPath(ctx, 0, 0, a, b, tail);
    ctx.clip();
    const g = ctx.createRadialGradient(ll.x * a * 0.45, ll.y * b * 0.45, 1, ll.x * a * 0.1, ll.y * b * 0.1, a * 1.3);
    g.addColorStop(0, pal.ceph[0]);
    g.addColorStop(0.25, pal.ceph[1]);
    g.addColorStop(0.65, pal.ceph[2]);
    g.addColorStop(1, pal.ceph[3]);
    ctx.fillStyle = g;
    ctx.fillRect(-a * 1.3, -b * 1.3, a * 2.6, b * 2.6);
    // The groove across the middle of the head plate.
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-a * 0.4, 0);
    ctx.lineTo(a * 0.1, 0);
    ctx.stroke();
    // Shine.
    ctx.save();
    ctx.translate(ll.x * a * 0.42, ll.y * b * 0.4);
    ctx.rotate(atan2(-ll.x, ll.y));
    const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, a * 0.5);
    sh.addColorStop(0, "rgba(225,246,255,0.8)");
    sh.addColorStop(0.4, "rgba(140,200,230,0.3)");
    sh.addColorStop(1, "rgba(120,180,220,0)");
    ctx.fillStyle = sh;
    ctx.scale(1, 0.45);
    ctx.beginPath();
    ctx.arc(0, 0, a * 0.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Eyes: four small glints across the front.
    ctx.save();
    ctx.fillStyle = pal.eye;
    for (const [ex, ey, er] of [
      [x + a * 0.6, -5, 1.6],
      [x + a * 0.6, 5, 1.6],
      [x + a * 0.78, -2.3, 1.2],
      [x + a * 0.78, 2.3, 1.2],
    ]) {
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(ex, ey, er, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    // Edge light.
    ctx.save();
    ctx.translate(x, 0);
    eggPath(ctx, 0, 0, a, b, tail);
    const [rr, gg, bb] = pal.rim;
    const eg = ctx.createLinearGradient(-ll.x * a, -ll.y * b, ll.x * a * 0.2, ll.y * b * 0.2);
    eg.addColorStop(0, `rgba(${rr},${gg},${bb},0.7)`);
    eg.addColorStop(0.45, `rgba(${rr},${gg},${bb},0)`);
    ctx.strokeStyle = eg;
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }
}

// Leg width from hip (0) to foot (1), at scale 1.
function widthAt(u) {
  const key = [
    [0, 10.5],
    [0.2, 10],
    [0.38, 8],
    [0.6, 5],
    [0.8, 3.2],
    [1, 1.3],
  ];
  for (let i = 0; i < key.length - 1; i++) {
    if (u <= key[i + 1][0]) {
      const t = (u - key[i][0]) / (key[i + 1][0] - key[i][0]);
      return lerp(key[i][1], key[i + 1][1], smooth(t));
    }
  }
  return key[key.length - 1][1];
}

// A smooth curve through the points (Catmull-Rom), `per` samples between each pair.
function sample(pts, per) {
  const out = [];
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < p.length - 2; i++) {
    for (let s = 0; s < per; s++) {
      const t = s / per;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ x: f(p[i - 1].x, p[i].x, p[i + 1].x, p[i + 2].x), y: f(p[i - 1].y, p[i].y, p[i + 1].y, p[i + 2].y) });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

// A rounded egg, wider toward the back (the left, -x) than the front.
function eggPath(ctx, cx, cy, a, b, tail) {
  ctx.beginPath();
  const N = 56;
  for (let i = 0; i <= N; i++) {
    const u = (i / N) * TAU;
    const wide = 1 + tail * -cos(u);
    const x = cx + a * cos(u);
    const y = cy + b * sin(u) * wide;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

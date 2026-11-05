// The Black Widow decoration: a big widow that perches on the top edge of the photo, turns, walks
// along the rim to the other side and perches again, while three small spiders crawl over the face.
// One timeline drives everything; the loop starts and ends with the widow settled and still.
import { PALETTES, Spider } from "./spider.js";

const { PI, sin, cos, atan2, min, max } = Math;
const D2R = PI / 180;

// The art is a square. The photo's frame (the ring that the page draws) is a circle of radius R in the
// middle; the page draws this art at SCALE percent of that ring so the circle lines up with the photo.
export const W = 528;
export const R = 120;
export const SCALE_PERCENT = Math.round((100 * W) / (2 * R) / 2) * 2; // 180
const CX = W / 2;
const CY = W / 2;
const RB = R - 16; // the widow's body origin rides a little inside the rim

// ---- the timeline (seconds) ----
const REST_R = 2.8;
const TURN = 0.75;
const WALK = 2.4;
const REST_L = 3.1;
const TAIL = 1.3; // settled and still at the end, so the loop closes cleanly

const t_turn1 = REST_R;
const t_walk1 = t_turn1 + TURN * 0.7;
const t_walk1_end = t_walk1 + WALK;
const t_turn2 = t_walk1_end - TURN * 0.25;
const t_turn2_end = t_turn2 + TURN;
const t_turn3 = t_turn2_end + REST_L;
const t_walk2 = t_turn3 + TURN * 0.7;
const t_walk2_end = t_walk2 + WALK;
const t_turn4 = t_walk2_end - TURN * 0.25;
const t_turn4_end = t_turn4 + TURN;
export const T = t_turn4_end + TAIL;

const PHI_R = 36 * D2R; // perched at the upper right
const PHI_L = -36 * D2R; // perched at the upper left

const ease = (t) => {
  const x = max(0, min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10); // smootherstep
};
const span = (t, a, b) => ease((t - a) / (b - a));

function phiAt(t) {
  if (t < t_walk1) return PHI_R;
  if (t < t_walk1_end) return PHI_R + (PHI_L - PHI_R) * span(t, t_walk1, t_walk1_end);
  if (t < t_walk2) return PHI_L;
  if (t < t_walk2_end) return PHI_L + (PHI_R - PHI_L) * span(t, t_walk2, t_walk2_end);
  return PHI_R;
}

// How far the body has turned from facing the middle of the photo toward walking along the rim.
function sigmaAt(t) {
  if (t < t_turn1) return 0;
  if (t < t_walk2) return span(t, t_turn1, t_turn1 + TURN) - span(t, t_turn2, t_turn2_end);
  return -(span(t, t_turn3, t_turn3 + TURN) - span(t, t_turn4, t_turn4_end));
}

const wrap = (t) => ((t % T) + T) % T;

// The big widow: the point on the rim, and a heading that faces the middle of the photo at rest and
// follows the rim while walking.
function widowPath(t0) {
  const t = wrap(t0);
  const phi = phiAt(t);
  const sg = sigmaAt(t);
  // During the two walks sigma is +1 then -1 (the turns before and after are the 0 to 1 and 1 to 0).
  const walkSign = t < t_walk2 - 0.0001 ? 1 : -1;
  void walkSign;
  const radial = atan2(cos(phi), -sin(phi));
  return { x: CX + RB * sin(phi), y: CY - RB * cos(phi), ang: radial + sg * (PI / 2), show: 1 };
}

// ---- the little spiders ----

// A path made of moves (a curve with a gentle ease), turns in place and holds.
function crawler(actions, windows) {
  const acts = actions.map((a) => ({ ...a }));
  // Work out headings: a move heads along its curve; a turn goes from where it was to `to`.
  let ang = 0;
  for (const a of acts) {
    if (a.type === "move") {
      const c = a.c ?? { x: (a.p0.x + a.p1.x) / 2, y: (a.p0.y + a.p1.y) / 2 };
      a.c = c;
      a.angStart = atan2(c.y - a.p0.y, c.x - a.p0.x);
      a.angEnd = atan2(a.p1.y - c.y, a.p1.x - c.x);
      ang = a.angEnd;
    } else {
      a.angStart = ang;
      let d = a.to - ang;
      d = atan2(sin(d), cos(d));
      a.angEnd = ang + d;
      ang = a.angEnd;
    }
  }
  const first = acts[0];
  const startAng = first.angStart;
  return (t0) => {
    const t = wrap(t0);
    let pos = { ...first.p0 };
    let heading = startAng;
    for (const a of acts) {
      if (t < a.t0) break;
      if (a.type === "move") {
        if (t <= a.t1) {
          const u = ease((t - a.t0) / (a.t1 - a.t0));
          const x = (1 - u) * (1 - u) * a.p0.x + 2 * u * (1 - u) * a.c.x + u * u * a.p1.x;
          const y = (1 - u) * (1 - u) * a.p0.y + 2 * u * (1 - u) * a.c.y + u * u * a.p1.y;
          const dx = 2 * (1 - u) * (a.c.x - a.p0.x) + 2 * u * (a.p1.x - a.c.x);
          const dy = 2 * (1 - u) * (a.c.y - a.p0.y) + 2 * u * (a.p1.y - a.c.y);
          return { x, y, ang: atan2(dy, dx), show: showAt(t, windows) };
        }
        pos = { ...a.p1 };
        heading = a.angEnd;
      } else {
        if (t <= a.t1) {
          const u = ease((t - a.t0) / (a.t1 - a.t0));
          return { x: pos.x, y: pos.y, ang: a.angStart + (a.angEnd - a.angStart) * u, show: showAt(t, windows) };
        }
        heading = a.angEnd;
      }
    }
    return { x: pos.x, y: pos.y, ang: heading, show: showAt(t, windows) };
  };
}

// Fades: each spider has a list of [from, to] visible windows; it fades over 0.22 s at each edge.
function showAt(t, windows) {
  let s = 0;
  for (const [a, b] of windows) {
    const up = max(0, min(1, (t - a) / 0.22));
    const down = max(0, min(1, (b - t) / 0.22));
    s = max(s, min(up, down));
  }
  return s;
}

// A point just under the widow's head plate when it rests at rim angle phi, in the world.
function underHead(phi, dx = 0, dy = 0) {
  const radial = atan2(cos(phi), -sin(phi));
  const o = { x: CX + RB * sin(phi), y: CY - RB * cos(phi) };
  const local = { x: 24 + dx, y: dy };
  return { x: o.x + local.x * cos(radial) - local.y * sin(radial), y: o.y + local.x * sin(radial) + local.y * cos(radial) };
}

const P = (x, y) => ({ x, y });
const rel = (x, y) => P(CX + x, CY + y); // a point on the face, measured from its middle

const L_START = t_turn2_end;
const R_START = 0;

// A crawl out from under the widow to a spot on the face, a pause with a turn, and back again.
function trip(a, b, via, out, back, turn) {
  const c2 = P(a.x + b.x - via.x, a.y + b.y - via.y);
  const acts = [{ type: "move", t0: out[0], t1: out[1], p0: a, c: via, p1: b }];
  if (turn) acts.push({ type: "turn", t0: turn[0], t1: turn[1], to: atan2(c2.y - b.y, c2.x - b.x) });
  acts.push({ type: "move", t0: back[0], t1: back[1], p0: b, c: c2, p1: a });
  return acts;
}

function smallSpiders() {
  const hR = (dx, dy) => underHead(PHI_R, dx, dy);
  const hL = (dx, dy) => underHead(PHI_L, dx, dy);
  const out = [];
  const make = (acts, wins, scale, step) =>
    out.push(new Spider({ path: crawler(acts, wins), scale, palette: PALETTES.small, stepScale: step, period: T }));

  // Spider 1: down the left of the face on one side, down the right on the other.
  {
    const aR = hR(0, -4);
    const bR = rel(54, 34);
    const aL = hL(0, 6);
    const bL = rel(-56, 34);
    const acts = [
      ...trip(aR, bR, P(aR.x + 6, aR.y + 46), [0.3, 1.2], [1.95, 2.55], [1.3, 1.7]),
      ...trip(aL, bL, P(aL.x - 30, aL.y + 36), [L_START + 0.45, L_START + 1.4], [L_START + 2.2, L_START + 2.85], [L_START + 1.5, L_START + 1.95]),
    ];
    make(acts, [[0.2, 2.65], [L_START + 0.35, L_START + 2.95]], 0.3, 0.75);
  }
  // Spider 2: across the forehead, from the other side of the widow's head.
  {
    const aR = hR(10, 8);
    const bR = rel(-30, -50);
    const aL = hL(10, -6);
    const bL = rel(30, -50);
    const acts = [
      ...trip(aR, bR, P(aR.x - 30, aR.y + 18), [0.7, 1.45], [2.0, 2.55], [1.55, 1.9]),
      ...trip(aL, bL, P(aL.x + 20, aL.y + 40), [L_START + 0.9, L_START + 1.75], [L_START + 2.3, L_START + 2.9], [L_START + 1.85, L_START + 2.2]),
    ];
    make(acts, [[0.6, 2.6], [L_START + 0.8, L_START + 3.0]], 0.26, 0.7);
  }
  // Spider 3: straight down the middle.
  {
    const aR = hR(-4, 2);
    const bR = rel(-2, 52);
    const aL = hL(6, 2);
    const bL = rel(6, 50);
    const acts = [
      ...trip(aR, bR, P(aR.x - 34, aR.y + 50), [0.95, 1.7], [2.05, 2.6], [1.8, 1.95]),
      ...trip(aL, bL, P(aL.x + 44, aL.y + 40), [L_START + 1.3, L_START + 2.05], [L_START + 2.4, L_START + 2.95], [L_START + 2.1, L_START + 2.3]),
    ];
    make(acts, [[0.85, 2.65], [L_START + 1.2, L_START + 3.0]], 0.24, 0.65);
  }
  return out;
}

// The widow's gestures while it rests: a front leg lifts and feels the air.
const WIDOW_NUDGES = [
  { leg: 0, t0: 0.55, t1: 1.85, x: 22, y: -2, air: 1 },
  { leg: 1, t0: 1.15, t1: 2.3, x: 20, y: 6, air: 1 },
  { leg: 1, t0: L_START + 0.7, t1: L_START + 1.95, x: 22, y: 2, air: 1 },
  { leg: 0, t0: L_START + 1.5, t1: L_START + 2.6, x: 20, y: -6, air: 1 },
];

// When the picture changes fast (turning and walking) it is recorded at a higher frame rate than
// while it rests, which keeps the file small.
export const BUSY = [
  [t_turn1, t_turn2_end],
  [t_turn3, t_turn4_end],
];

export function createScene() {
  const widow = new Spider({ path: widowPath, scale: 0.93, palette: PALETTES.widow, nudges: WIDOW_NUDGES, period: T });
  const small = smallSpiders();
  const all = [...small, widow]; // little ones first, so the widow covers them where it should
  for (const s of all) s.reset(0);
  return { T, W, R, SCALE_PERCENT, CX, CY, spiders: all, widow };
}

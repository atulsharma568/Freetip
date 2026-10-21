"use client";

import { useRef } from "react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

// The hero handoff. The fan's hand (chalk, left) pinches a lime ₹ note, thumb
// on its face. The streamer's hand (ash, right) arrives open, its fingers hook
// over the face of the note and its thumb closes behind it. The fan's hand
// opens, the note snaps free, and both hands pull back to the screen edges.
//
// The default markup is the exchange frame (both hands on the note), which is
// also the reduced-motion still. Every start state is set inside the motion
// branch with gsap.set.
//
// Every moving part is a group with no static transform of its own: travel
// (x, y) lives on an outer group and turns live on inner groups, each around
// its own pivot, so nothing ever turns around a far-away point while it is
// also sliding.
//
// Layers, back to front: streamer's thumb, fan's arm + curled fingers + palm
// + index, note, fan's thumb, streamer's arm + palm + fingers.

const W = 2800;
const CUT = "var(--color-ground)";
const FAN = "var(--color-text)";
const STREAMER = "var(--color-muted)";

type Pt = readonly [number, number];

const f = (v: number) => Math.round(v * 10) / 10;
const line = (pts: readonly Pt[]) => pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("");

// Catmull-Rom point between p1 and p2.
function cr(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const t2 = t * t;
  const t3 = t2 * t;
  const k = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return [k(p0[0], p1[0], p2[0], p3[0]), k(p0[1], p1[1], p2[1], p3[1])];
}

function normalsOf(c: readonly Pt[]): Pt[] {
  return c.map((_, i) => {
    const a = c[Math.max(0, i - 1)];
    const b = c[Math.min(c.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len] as const;
  });
}

// A tapered limb (finger or thumb) along a smooth centreline with a round tip.
// `a` is the side to the right of travel in screen terms (y down), `b` the
// other side; both run base to tip. `arc` runs from the end of `a` to the end
// of `b` around the tip.
type Limb = { a: Pt[]; b: Pt[]; arc: Pt[]; d: string };

function limb(points: readonly Pt[], half: readonly number[], per = 12): Limb {
  const c: Pt[] = [];
  const w: number[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p3 = points[Math.min(n - 1, i + 2)];
    for (let s = 0; s < per; s++) {
      c.push(cr(p0, points[i], points[i + 1], p3, s / per));
      w.push(half[i] + ((half[i + 1] - half[i]) * s) / per);
    }
  }
  c.push(points[n - 1]);
  w.push(half[n - 1]);
  const nn = normalsOf(c);
  const a = c.map((p, i) => [p[0] + nn[i][0] * w[i], p[1] + nn[i][1] * w[i]] as const);
  const b = c.map((p, i) => [p[0] - nn[i][0] * w[i], p[1] - nn[i][1] * w[i]] as const);
  const end = c[c.length - 1];
  const r = w[w.length - 1];
  const N = nn[nn.length - 1];
  const D = [N[1], -N[0]] as const; // forward
  const arc: Pt[] = [];
  for (let s = 1; s < 16; s++) {
    const th = (Math.PI * s) / 16;
    arc.push([end[0] + r * (N[0] * Math.cos(th) + D[0] * Math.sin(th)), end[1] + r * (N[1] * Math.cos(th) + D[1] * Math.sin(th))]);
  }
  const d = `${line([...a, ...arc, ...[...b].reverse()])}Z`;
  return { a, b, arc, d };
}

// Smooth polyline through points.
function curve(points: readonly Pt[], per = 12): Pt[] {
  const out: Pt[] = [];
  const n = points.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p3 = points[Math.min(n - 1, i + 2)];
    for (let s = 0; s < per; s++) out.push(cr(p0, points[i], points[i + 1], p3, s / per));
  }
  out.push(points[n - 1]);
  return out;
}

// Slice of a side by fraction (0 = base, 1 = tip).
const part = (side: readonly Pt[], from: number, to = 1) =>
  side.slice(Math.round(from * (side.length - 1)), Math.round(to * (side.length - 1)) + 1);

// Open outline of a limb: side a from `fa` to the tip, round the tip, then
// side b back down to `fb`. Leaves the base open so roots grow out of a palm.
const rim = (l: Limb, fa: number, fb: number) => line([...part(l.a, fa), ...l.arc, ...[...part(l.b, fb)].reverse()]);

// A tapered cut along a polyline: width goes from w0 to w1, round at the thick
// end. `shift` slides it sideways by that many half-widths (-1 puts it wholly
// on the right of travel, so it can sit just outside a limb's edge).
function taper(pts: readonly Pt[], w0: number, w1: number, shift = 0): string {
  const nn = normalsOf(pts);
  const m = pts.length - 1;
  const half = (i: number) => (w0 + ((w1 - w0) * i) / m) / 2;
  const mid = pts.map((p, i) => [p[0] + nn[i][0] * half(i) * shift, p[1] + nn[i][1] * half(i) * shift] as const);
  const L = mid.map((p, i) => [p[0] + nn[i][0] * half(i), p[1] + nn[i][1] * half(i)] as const);
  const R = mid.map((p, i) => [p[0] - nn[i][0] * half(i), p[1] - nn[i][1] * half(i)] as const);
  const end = mid[m];
  const r = half(m);
  const N = nn[m];
  const D = [N[1], -N[0]] as const;
  const cap: Pt[] = [];
  for (let s = 1; s < 8; s++) {
    const th = (Math.PI * s) / 8;
    cap.push([end[0] + r * (N[0] * Math.cos(th) + D[0] * Math.sin(th)), end[1] + r * (N[1] * Math.cos(th) + D[1] * Math.sin(th))]);
  }
  return `${line([...L, ...cap, ...[...R].reverse()])}Z`;
}

// ---- Fan (giver): palm down, thumb towards us, pinching the note's left edge.
// Local frame: wrist at 0,0, fingers to +x. The path includes the bare forearm.
const GIVER_AT = "translate(1196 88) rotate(10)";
// The whole arm sways from a pivot far off to the left, like a shoulder, so
// small turns bob the hand without swinging the sleeve. Only the inner sway
// group turns around it, never a group that is also sliding.
const SHOULDER = "200 88";
const giverPalm =
  "M-100 -14C-70 -16 -40 -18 -14 -19C6 -20 26 -25 50 -30C70 -34 88 -35 100 -33" +
  "C110 -31 118 -26 123 -18C129 -9 134 -2 136 6C120 22 88 30 60 31C36 32 16 28 -6 25C-36 22 -70 24 -100 26Z";
// Curled middle and ring fingers, one fat rounded shape each, under the palm.
const giverRing = limb([[66, 10], [86, 26], [94, 36]], [13, 12.5, 12]);
const giverMiddle = limb([[84, 4], [108, 22], [118, 40]], [15.5, 15, 14.5]);
const giverMiddleCut = taper(part(giverMiddle.a, 0.25, 0.9), 0, 3.4);
// Index: runs on behind the note, hooked a little at the tip.
const giverIndex = limb([[98, -19], [128, -21], [152, -14], [168, -2]], [11, 11, 10, 9]);
const GIVER_INDEX_PIVOT = "104 -20";
// Its lower edge fades in over the hand, then outlines it once it swings clear.
const giverIndexCut = taper(part(giverIndex.a, 0.12, 0.42), 0, 3.6, 1);
const giverIndexRim = rim(giverIndex, 0.4, 0.4);
const giverThumb = limb([[12, 8], [58, 20], [102, 18], [140, 4]], [17, 14.5, 12.5, 11.5]);
const GIVER_THUMB_PIVOT = "14 8";
// Thumb crease: grows out of the back of the hand, then becomes the tip outline.
const giverThumbCrease = taper(part(giverThumb.b, 0.42, 0.78), 0, 4);
const giverThumbUnder = taper(part(giverThumb.a, 0.4, 0.72), 0, 4);
const giverThumbRim = rim(giverThumb, 0.72, 0.78);
// Nail, edge-on, on the top of the thumb tip.
const giverNail = (() => {
  const s = part(giverThumb.b, 0.86, 1);
  const nn = normalsOf(s);
  return line(s.map((p, i) => [p[0] + nn[i][0] * 5.5, p[1] + nn[i][1] * 5.5] as const));
})();

// ---- Streamer (taker): back of hand to us, reaching left, thumb underneath.
// Drawn pointing +x, then mirrored.
const TAKER_AT = "translate(1612 150) scale(-1 1) rotate(-14)";
const TAKER_WRIST = "1612 150";
const takerPalm =
  "M-96 -40C-60 -34 -30 -27 -4 -25C20 -23 44 -30 70 -34C88 -36 100 -35 108 -32" +
  "C113 -29 115 -25 115 -20L115 24C113 38 100 45 82 43C56 40 26 33 -4 22C-34 14 -64 8 -96 6Z";

type Finger = { base: Limb; tip: Limb; root: Pt; joint: Pt };
// root, angle of the first segment (deg, + curls towards the palm), lengths, bend, widths.
function finger(root: Pt, ang: number, l1: number, l2: number, bend: number, w: readonly [number, number, number]): Finger {
  const r1 = (ang * Math.PI) / 180;
  const joint: Pt = [root[0] + l1 * Math.cos(r1), root[1] + l1 * Math.sin(r1)];
  const mid: Pt = [(root[0] + joint[0]) / 2, (root[1] + joint[1]) / 2];
  const r2 = ((ang + bend) * Math.PI) / 180;
  const tipEnd: Pt = [joint[0] + l2 * Math.cos(r2), joint[1] + l2 * Math.sin(r2)];
  const tipMid: Pt = [(joint[0] + tipEnd[0]) / 2, (joint[1] + tipEnd[1]) / 2];
  return {
    base: limb([root, mid, joint], [w[0], (w[0] + w[1]) / 2, w[1]]),
    // The tip segment starts exactly at the joint centre, so its flat base sits
    // on the base segment's round end at any bend and no corner pokes out.
    tip: limb([joint, tipMid, tipEnd], [w[1], (w[1] + w[2]) / 2, w[2]]),
    root,
    joint,
  };
}
// Top to bottom: little, ring, middle, index. The thumb is underneath, so the
// index is the lowest finger and reaches furthest; each finger above it is
// shorter and more curled, so the tips step back on a diagonal.
const takerFingers = [
  finger([100, -27], -5, 24, 17, 34, [8, 7.2, 6.6]),
  finger([106, -8], -3, 32, 22, 30, [9.4, 8.7, 8.1]),
  finger([106, 9], -1, 38, 26, 28, [10.2, 9.4, 8.8]),
  finger([102, 26], 0, 44, 30, 24, [10.8, 9.8, 9]),
];
// Visible cut width where a finger crosses the note or another finger.
const RIM = 3.6;
// Each finger's top edge fades in from the knuckles, so fingers grow out of
// the back of the hand instead of being glued on. The index also fades in
// along its lower edge, over the thumb.
const takerCuts = takerFingers.map((fi, i) => {
  const top = taper(part(fi.base.b, 0.2, 0.62), 0, RIM, -1);
  return i === 3 ? top + taper(part(fi.base.a, 0.2, 0.62), 0, RIM, 1) : top;
});

// Thumb: under the hand, its tip closing behind the note's lower edge.
const takerThumb = limb([[24, 12], [62, 31], [104, 46], [146, 52]], [12.5, 12.5, 11.5, 10.5]);
const TAKER_THUMB_PIVOT = "62 32";
// Cut where the hand overlaps the thumb.
const takerThumbCrease = taper(curve([[114, 31], [104, 41], [82, 43], [58, 40], [40, 35]]), 3.6, 0);

// The grip closes from the little finger down to the index, slightly uneven,
// and the thumb closes last.
const CLOSE = [0, 0.04, 0.065, 0.1];

// ---- Note: centred at 1400 116.
const NOTE_C = "1400 116";

export function HeroHands({ onDone, immediate }: { onDone?: () => void; immediate?: boolean }) {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(root);
      const gMove = q("[data-g-move]");
      const gSway = q("[data-g-sway]");
      const tMove = q("[data-t-move]");
      const tTilt = q("[data-t-tilt]");
      const nMove = q("[data-n-move]");
      const nSway = q("[data-n-sway]");
      const nTilt = q("[data-n-tilt]");
      const nTuck = q("[data-n-tuck]");
      const flex = q("[data-n-flex]");
      const gThumb = q("[data-g-thumb]");
      const gIndex = q("[data-g-index]");
      const tThumb = q("[data-t-thumb]");
      const tBase = q("[data-t-base]");
      const tTip = q("[data-t-tip]");
      const ticks = q("[data-tick]");

      const mm = gsap.matchMedia();
      mm.add(
        {
          motion: "(prefers-reduced-motion: no-preference)",
          reduce: "(prefers-reduced-motion: reduce)",
        },
        (context) => {
          if (context.conditions?.reduce) {
            onDone?.();
            return;
          }

          const fan = [...gMove, ...nMove];
          const fanSway = [...gSway, ...nSway];
          const streamer = [...tMove, ...nMove];

          // Start states: fan offstage left holding the note; streamer offstage right, open.
          gsap.set(fan, { x: -1460, y: 0 });
          gsap.set(fanSway, { rotation: -0.9, svgOrigin: SHOULDER });
          gsap.set(tMove, { x: 1400, y: 0 });
          gsap.set([...tTilt, ...nTilt], { rotation: 0, svgOrigin: TAKER_WRIST });
          gsap.set(nTuck, { x: 0, rotation: 0, svgOrigin: NOTE_C });
          gsap.set(flex, { skewX: 0, scaleX: 1, scaleY: 1, rotation: 0, svgOrigin: NOTE_C });
          gsap.set(gThumb, { rotation: 0, svgOrigin: GIVER_THUMB_PIVOT });
          gsap.set(gIndex, { rotation: 0, svgOrigin: GIVER_INDEX_PIVOT });
          gsap.set(tThumb, { rotation: 16, svgOrigin: TAKER_THUMB_PIVOT });
          // Open hand: fingers a little straighter and slightly spread, not a claw.
          tBase.forEach((el, i) => {
            const [x, y] = takerFingers[i].root;
            gsap.set(el, { rotation: [-4, -1.5, 1, 3.5][i], svgOrigin: `${x} ${y}` });
          });
          tTip.forEach((el, i) => {
            const [x, y] = takerFingers[i].joint;
            gsap.set(el, { rotation: -10, svgOrigin: `${x} ${y}` });
          });
          gsap.set(q("[data-burst]"), { opacity: 1 });
          gsap.set(ticks, { opacity: 0, scale: 0.2, svgOrigin: "1392 58" });

          const tl = gsap.timeline({ paused: true, onComplete: () => onDone?.() });

          tl
            // 0 - 0.82: the fan reaches in, overshooting slightly.
            .to(fan, { x: 14, duration: 0.82, ease: "power3.out" }, 0)
            .to(fanSway, { rotation: 0, duration: 0.82, ease: "power3.out" }, 0)
            // Anticipation: a small draw-back before the offer.
            .to(fan, { x: -10, duration: 0.2, ease: "sine.inOut" }, 0.82)
            .to(fanSway, { rotation: 0.4, duration: 0.2, ease: "sine.inOut" }, 0.82)
            // The offer: a short push toward the streamer, the note tipping forward.
            .to(fan, { x: 6, duration: 0.22, ease: "back.out(2)" }, 1.02)
            .to(fanSway, { rotation: -0.25, duration: 0.22, ease: "back.out(2)" }, 1.02)
            .to(fanSway, { rotation: 0, duration: 0.16, ease: "sine.out" }, 1.24)

            // 0.12 - 1.04: the streamer arrives open, a little short of the note.
            .to(tMove, { x: 60, duration: 0.92, ease: "power3.out" }, 0.12)
            // 1.1 - 1.32: reach in while the hand closes, little finger first, thumb last.
            .to(tMove, { x: 0, duration: 0.22, ease: "power2.out" }, 1.1)
            .to(tBase, { rotation: 0, duration: 0.18, ease: "power2.out", stagger: (i) => CLOSE[i] }, 1.1)
            .to(tTip, { rotation: 0, duration: 0.16, ease: "back.out(2)", stagger: (i) => CLOSE[i] }, 1.13)
            .to(tThumb, { rotation: 0, duration: 0.18, ease: "back.out(2)" }, 1.22)

            // 1.36 - 1.46: the tug. The note pulls taut between both grips.
            .to(tMove, { x: 10, duration: 0.1, ease: "power2.in" }, 1.36)
            .to(nMove, { x: 11, duration: 0.1, ease: "power2.in" }, 1.36)
            .to(gMove, { x: 9, duration: 0.1, ease: "power2.in" }, 1.36)
            .to(flex, { skewX: -3, scaleX: 1.02, scaleY: 0.98, rotation: -1, duration: 0.1, ease: "power2.in" }, 1.36)

            // 1.46: the fan lets go. Thumb lifts off the face, index drops off the back: the pinch opens.
            .to(gThumb, { rotation: -24, duration: 0.22, ease: "power3.out" }, 1.46)
            .to(gIndex, { rotation: 20, duration: 0.26, ease: "power3.out" }, 1.47)
            .to(flex, { skewX: 0, scaleX: 1, scaleY: 1, rotation: 0, duration: 0.28, ease: "back.out(1.8)" }, 1.46)
            .to(nMove, { x: 16, duration: 0.18, ease: "power2.out" }, 1.46)
            .to(tMove, { x: 15, duration: 0.18, ease: "power2.out" }, 1.46)
            .to(gMove, { x: -30, duration: 0.13, ease: "power2.out" }, 1.47)
            .to(streamer, { y: 5, duration: 0.12, ease: "power2.out" }, 1.5)
            .to(streamer, { y: 0, duration: 0.3, ease: "power2.inOut" }, 1.62)
            // The streamer's grip settles: the note slides a little deeper into the hand.
            .to(nTuck, { x: 10, rotation: 3, duration: 0.3, ease: "power2.out" }, 1.5)
            .to(ticks, { opacity: 1, scale: 1, duration: 0.18, ease: "expo.out", stagger: 0.025 }, 1.47)
            .to(ticks, { opacity: 0, duration: 0.22, ease: "power1.in" }, 1.7)

            // 1.6 - 2.74: both pull back. The streamer leaves with the note,
            // accelerating, so hand and note clear the edge together.
            .to(gMove, { x: -1500, duration: 0.95, ease: "power2.inOut" }, 1.6)
            .to(gSway, { rotation: 0.6, duration: 0.95, ease: "power2.inOut" }, 1.6)
            .to(streamer, { x: "+=1490", duration: 0.88, ease: "power3.in" }, 1.84)
            .to(streamer, { y: 10, duration: 0.9, ease: "power1.in" }, 1.84)
            .to([...tTilt, ...nTilt], { rotation: 5, duration: 0.9, ease: "power1.in" }, 1.84);

          const debug = new URLSearchParams(window.location.search).get("hands");
          if (process.env.NODE_ENV !== "production" && debug) {
            tl.seek(Number(debug));
            return () => tl.kill();
          }

          if (immediate) {
            tl.delay(0.3).play();
            return () => tl.kill();
          }

          const trigger = ScrollTrigger.create({
            trigger: root.current,
            start: "top 85%",
            once: true,
            onEnter: () => {
              tl.delay(0.45).play();
            },
          });

          return () => {
            trigger.kill();
            tl.kill();
          };
        },
      );
    },
    { scope: root },
  );

  return (
    <div ref={root} className="h-full w-full" aria-hidden="true">
      <svg
        viewBox={`0 0 ${W} 240`}
        preserveAspectRatio="xMidYMid slice"
        className="block h-full w-full"
        focusable="false"
      >
        <g strokeLinejoin="round" strokeLinecap="round">
          {/* Streamer, back layer: the thumb, behind the note and the hand. */}
          <g data-t-move>
            <g data-t-tilt>
              <g transform={TAKER_AT}>
                <path data-t-thumb d={takerThumb.d} fill={STREAMER} />
              </g>
            </g>
          </g>

          {/* Fan, back layer: sleeve, forearm, curled fingers, palm, index. */}
          <g data-g-move>
            <g data-g-sway>
              <g transform="rotate(2.2 1104 77)">
                <path d="M1094 41H-2800V113H1094Z" fill="var(--color-raised)" />
                <rect x="1092" y="39" width="24" height="76" rx="7" fill="var(--color-line)" />
              </g>
              <g transform={GIVER_AT}>
                <path d={giverRing.d} fill={FAN} />
                <path d={giverMiddle.d} fill={FAN} />
                <path d={giverMiddleCut} fill={CUT} />
                <path d={giverPalm} fill={FAN} />
                <g data-g-index>
                  <path d={giverIndexRim} fill="none" stroke={CUT} strokeWidth="7.2" />
                  <path d={giverIndex.d} fill={FAN} />
                  <path d={giverIndexCut} fill={CUT} />
                </g>
              </g>
            </g>
          </g>

          {/* The note. Outer groups follow the hands; the inner group flexes. */}
          <g data-n-move>
            <g data-n-sway>
              <g data-n-tilt>
                <g data-n-tuck>
                  <g data-n-flex>
                    <g transform="rotate(-5 1400 116)">
                      <rect x="1322" y="73" width="156" height="86" rx="10" fill="var(--color-accent)" stroke={CUT} strokeWidth="4" />
                      <rect x="1333" y="84" width="134" height="64" rx="5" fill="none" stroke="var(--color-ink)" strokeWidth="2.5" />
                      <path
                        d="M1373 98h28M1373 108h28M1373 98h10c11 0 11 20 0 20h-10M1379 118l18 16"
                        fill="none"
                        stroke="var(--color-ink)"
                        strokeWidth="5.5"
                      />
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* Fan, front layer: the thumb pressing on the note. */}
          <g data-g-move>
            <g data-g-sway>
              <g transform={GIVER_AT}>
                <g data-g-thumb>
                  <path d={giverThumb.d} fill={FAN} />
                  <path d={giverThumbCrease} fill={CUT} />
                  <path d={giverThumbUnder} fill={CUT} />
                  <path d={giverThumbRim} fill="none" stroke={CUT} strokeWidth="4" />
                  <path d={giverNail} fill="none" stroke={CUT} strokeWidth="2.4" />
                </g>
              </g>
            </g>
          </g>

          {/* Streamer, front layer: sleeve, forearm, palm, and the fingers on the note. */}
          <g data-t-move>
            <g data-t-tilt>
              <g transform="rotate(2.2 1708 156)">
                <path d="M1712 120H4400V192H1712Z" fill="var(--color-raised)" />
                <rect x="1696" y="118" width="24" height="76" rx="7" fill="var(--color-control)" />
                <circle cx="1734" cy="177" r="3.5" fill={CUT} />
              </g>
              <g transform={TAKER_AT}>
                <path d={takerPalm} fill={STREAMER} />
                <path d={takerThumbCrease} fill={CUT} />
                {takerFingers.map((fi, i) => (
                  <g key={i} data-t-base>
                    <path d={rim(fi.base, 0.62, 0.62)} fill="none" stroke={CUT} strokeWidth={RIM * 2} />
                    <g data-t-tip>
                      <path d={rim(fi.tip, 0, 0)} fill="none" stroke={CUT} strokeWidth={RIM * 2} />
                      <path d={fi.tip.d} fill={STREAMER} />
                    </g>
                    <path d={fi.base.d} fill={STREAMER} />
                    <path d={takerCuts[i]} fill={CUT} />
                  </g>
                ))}
              </g>
            </g>
          </g>

          {/* A tiny burst at the moment of transfer. Hidden in the still. */}
          <g fill="none" stroke={FAN} strokeWidth="5" opacity="0" data-burst>
            <path data-tick d="M1368 50l-10-22" />
            <path data-tick d="M1392 46V20" />
            <path data-tick d="M1416 50l10-22" />
          </g>
        </g>
      </svg>
    </div>
  );
}

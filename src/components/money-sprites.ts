import { INK_HEX as INK } from "@/lib/site";

// The lime ₹ notes and coins of the background and the money orbit, drawn once
// each onto small offscreen canvases and then stamped with drawImage every
// frame. Drawing the shapes, the text glyph and the glow live, for every item on
// every frame, was the single biggest cost on the home page (the "₹" fillText and
// the shadow blur); a stamped bitmap costs almost nothing.
//
// Near and far items glow differently, so each kind has a near and a far sprite
// with its glow baked in. A coin has two faces: with the ₹, and blank for when it
// is nearly edge-on.

const LIME = "#bfe84a";
// Items are drawn at up to about 61 px; sprites are made a little bigger and
// scaled down, which stays sharp.
const BASE = 64;

interface Sprite {
  canvas: HTMLCanvasElement;
  // Size and centre in CSS pixels at BASE size.
  w: number;
  h: number;
  cx: number;
  cy: number;
}

interface Set {
  note: Sprite;
  coin: Sprite;
  coinBlank: Sprite;
}

export interface MoneySprites {
  near: Set;
  far: Set;
}

function make(width: number, height: number, dpr: number, paint: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width * dpr);
  canvas.height = Math.ceil(height * dpr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.translate(width / 2, height / 2);
  paint(ctx);
  return { canvas, w: width, h: height, cx: width / 2, cy: height / 2 };
}

function note(dpr: number, blur: number, glow: string): Sprite {
  const w = BASE * 1.9;
  const h = BASE;
  const pad = blur * 1.6;
  return make(w + pad * 2, h + pad * 2, dpr, (ctx) => {
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
    ctx.fillStyle = LIME;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, BASE * 0.14);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgb(29 36 16 / 0.45)";
    ctx.lineWidth = Math.max(1, BASE * 0.05);
    ctx.beginPath();
    ctx.roundRect(-w / 2 + BASE * 0.12, -h / 2 + BASE * 0.12, w - BASE * 0.24, h - BASE * 0.24, BASE * 0.08);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.font = `700 ${BASE * 0.56}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("₹", 0, BASE * 0.03);
  });
}

function coin(dpr: number, blur: number, glow: string, withGlyph: boolean): Sprite {
  const r = BASE * 0.55;
  const pad = blur * 1.6;
  return make(r * 2 + pad * 2, r * 2 + pad * 2, dpr, (ctx) => {
    ctx.shadowColor = glow;
    ctx.shadowBlur = blur;
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, "#f2ffc8");
    g.addColorStop(0.45, LIME);
    g.addColorStop(1, "#6f8f1c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    if (withGlyph) {
      ctx.fillStyle = INK;
      ctx.font = `700 ${r * 1.05}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("₹", 0, r * 0.05);
    }
  });
}

function set(dpr: number, blur: number, glow: string): Set {
  return { note: note(dpr, blur, glow), coin: coin(dpr, blur, glow, true), coinBlank: coin(dpr, blur, glow, false) };
}

// Blur sizes are the ones the live drawing used, scaled up to the sprite size
// (items are drawn at roughly 0.4 to 0.95 of BASE).
export function buildSprites(dpr: number, glow = "rgb(191 232 74 / 0.6)"): MoneySprites {
  const d = Math.min(2, Math.max(1, dpr));
  return { near: set(d, 22, glow), far: set(d, 9, glow) };
}

// Stamps one item at the context's current origin. `size` is the item's size as
// the old live drawing took it, `flip` its coin-turn value.
export function drawMoney(
  ctx: CanvasRenderingContext2D,
  sprites: MoneySprites,
  kind: "note" | "coin",
  size: number,
  flip: number,
  near: boolean,
) {
  const s = near ? sprites.near : sprites.far;
  const k = size / BASE;
  let sprite: Sprite;
  if (kind === "note") {
    sprite = s.note;
  } else {
    ctx.scale(Math.max(0.12, Math.abs(flip)), 1);
    sprite = Math.abs(flip) > 0.35 ? s.coin : s.coinBlank;
  }
  ctx.drawImage(sprite.canvas, -sprite.cx * k, -sprite.cy * k, sprite.w * k, sprite.h * k);
}

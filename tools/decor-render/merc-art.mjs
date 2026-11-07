// Renders the Deadpool-template art (merc-art.html) into public/decorations/deadpool/.
//
//   node tools/decor-render/merc-art.mjs stills            review pictures in /tmp/merc-art
//   node tools/decor-render/merc-art.mjs build             animated WebP + poster for each slot
//
// Needs Google Chrome and img2webp (brew install webp), like render.mjs.
import { chromium } from "playwright";
import { mkdir, rm, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "..", "public", "decorations", "deadpool");
const work = "/tmp/merc-art";
const mode = process.argv[2] ?? "stills";

const SLOTS = [
  { scene: "avatar", name: "avatar-decoration", w: 512, h: 512, outW: 384, frames: 20, ms: 126, poster: 0.1 },
  { scene: "plate", name: "nameplate", w: 1000, h: 200, outW: 800, frames: 36, ms: 70, poster: 0.1 },
  { scene: "effect", name: "profile-effect", w: 600, h: 700, outW: 480, frames: 48, ms: 60, poster: 0.55 },
];

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto(pathToFileURL(join(here, "merc-art.html")).href);
await page.waitForFunction(() => window.ready === true);
await rm(work, { recursive: true, force: true });
await mkdir(work, { recursive: true });

async function shot(slot, t, file) {
  await page.setViewportSize({ width: slot.w, height: slot.h });
  await page.evaluate(([s, tt]) => window.draw(s, tt), [slot.scene, t]);
  const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: slot.w, height: slot.h } });
  // Saved smaller than it is drawn: the decoration is shown at about 260 px, so this is still sharp on a 2x screen.
  await sharp(png).resize({ width: slot.outW }).png().toFile(file);
}

const only = process.argv[3]; // optional: rebuild just one slot, e.g. "avatar"
for (const slot of SLOTS) {
  if (only && slot.scene !== only) continue;
  if (mode === "stills") {
    for (const t of [0.1, 0.45, 0.77]) await shot(slot, t, join(work, `${slot.name}-${t}.png`));
    continue;
  }
  const files = [];
  for (let i = 0; i < slot.frames; i++) {
    const f = join(work, `${slot.name}-${String(i).padStart(3, "0")}.png`);
    await shot(slot, i / slot.frames, f);
    files.push(f);
  }
  await mkdir(out, { recursive: true });
  execFileSync("img2webp", ["-loop", "0", "-lossy", "-q", "60", "-m", "4", "-d", String(slot.ms), ...files, "-o", join(out, `${slot.name}.webp`)], { stdio: "ignore" });
  const poster = join(work, `${slot.name}-poster.png`);
  await shot(slot, slot.poster, poster);
  await sharp(poster).webp({ quality: 88, alphaQuality: 100 }).toFile(join(out, `${slot.name}.poster.webp`));
  console.log("wrote", slot.name);
}
await browser.close();

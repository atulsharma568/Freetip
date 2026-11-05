// Records the decoration scene frame by frame in a headless Chrome and saves an animated WebP.
//
//   node tools/decor-render/render.mjs stills 0.5,3,6        review pictures at those seconds
//   node tools/decor-render/render.mjs webp [--fps 30]       the animated WebP (needs img2webp)
//
// Output goes to /tmp/decor-render (review pictures and frames); `webp` also writes the files the
// site uses. Chrome is the Mac's own (Playwright's channel "chrome").
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile, rm, readdir, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const work = "/tmp/decor-render";
const [, , mode = "stills", arg = ""] = process.argv;
const flag = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};

const mime = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer(async (req, res) => {
  try {
    const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const body = await readFile(join(here, path));
    res.writeHead(200, { "content-type": mime[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;

const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
const outSize = flag("out", "");
// --scene fog is the whole-header effect (fog.html); the default is the photo frame (index.html).
const sceneName = flag("scene", "frame");
const pageFile = sceneName === "fog" ? "fog.html" : "index.html";
await page.goto(`http://127.0.0.1:${port}/${pageFile}${outSize ? `?out=${outSize}` : ""}`);
await page.waitForFunction(() => window.sceneReady === true);
const info = await page.evaluate(() => window.scene.info());
console.log("scene", info);

const png = (dataUrl) => Buffer.from(dataUrl.split(",")[1], "base64");

// A stand-in for the page: dark ground, the accent ring and a round photo, so a review picture shows
// the art the way a visitor sees it.
async function onStandInHeader(art) {
  // A stand-in header the size of the art: the banner strip, the round photo overlapping it, a name,
  // a channel line and two lines of bio, on the page's dark ground.
  const W = info.OUT;
  const Hh = info.OUTH;
  const k = W / 448; // the real header is about 448 px wide on the tip page
  const bannerH = Math.round(W * (5 / 16));
  const photoR = Math.round(40 * k);
  const photoY = bannerH - Math.round(18 * k);
  const banner = await sharp("/tmp/ap-research/banner.jpg").resize(W, bannerH, { fit: "cover" }).png().toBuffer().catch(() => null);
  const photo = await sharp("/tmp/ap-research/avatar.jpg")
    .resize(photoR * 2, photoR * 2, { fit: "cover" })
    .composite([{ input: Buffer.from(`<svg width="${photoR * 2}" height="${photoR * 2}"><circle cx="${photoR}" cy="${photoR}" r="${photoR}"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer()
    .catch(() => null);
  const ty = photoY + photoR * 2 + Math.round(30 * k);
  const text = `<svg width="${W}" height="${Hh}"><rect width="${W}" height="${Hh}" fill="#0c0c12"/>
    <rect width="${W}" height="${bannerH}" fill="#1f2a44"/>
    <circle cx="${photoR + 24 * k}" cy="${photoY + photoR}" r="${photoR + 5 * k}" fill="#0c0c12" stroke="#ca1b19" stroke-width="${2 * k}"/>
    <text x="${20 * k}" y="${ty + 30 * k}" font-family="Helvetica, Arial" font-weight="800" font-size="${52 * k}" fill="#f4f4f6">AcePressure</text>
    <text x="${20 * k}" y="${ty + 54 * k}" font-family="Helvetica, Arial" font-size="${13 * k}" fill="#9a9aa8">youtube.com/@acepressure</text>
    <text x="${20 * k}" y="${ty + 86 * k}" font-family="Helvetica, Arial" font-size="${17 * k}" fill="#b4b4c0">Tip the stream, and the alert plays live.</text>
    <text x="${20 * k}" y="${ty + 110 * k}" font-family="Helvetica, Arial" font-size="${17 * k}" fill="#b4b4c0">Thank you for keeping the lights on.</text>
  </svg>`;
  const layers = [];
  if (banner) layers.push({ input: banner, left: 0, top: 0 });
  if (photo) layers.push({ input: photo, left: Math.round(24 * k), top: photoY });
  layers.push({ input: art });
  return sharp(Buffer.from(text)).composite(layers).png().toBuffer();
}

async function onStandIn(art) {
  if (info.kind === "header") return onStandInHeader(art);
  const W = info.OUT;
  const R = (info.R * info.OUT) / info.W;
  const photoR = R * 0.84;
  const photo = await sharp("/tmp/ap-research/avatar.jpg")
    .resize(Math.round(photoR * 2), Math.round(photoR * 2), { fit: "cover" })
    .composite([{ input: Buffer.from(`<svg width="${photoR * 2}" height="${photoR * 2}"><circle cx="${photoR}" cy="${photoR}" r="${photoR}"/></svg>`), blend: "dest-in" }])
    .png()
    .toBuffer()
    .catch(() => null);
  const ground = `<svg width="${W}" height="${W}"><rect width="${W}" height="${W}" fill="#0c0c12"/><rect y="0" width="${W}" height="${W * 0.34}" fill="#1f2a44"/><circle cx="${W / 2}" cy="${W / 2}" r="${R}" fill="#0c0c12" stroke="#ca1b19" stroke-width="3"/></svg>`;
  const layers = [];
  if (photo) layers.push({ input: photo, left: Math.round(W / 2 - photoR), top: Math.round(W / 2 - photoR) });
  layers.push({ input: art });
  return sharp(Buffer.from(ground)).composite(layers).png().toBuffer();
}

// The times to record: busy stretches (turning, walking) at --busy fps, the rest at --calm fps. Each
// frame lasts until the next one, and the last until the loop ends, so the length stays exact.
function schedule() {
  const busyFps = Number(flag("busy", 24));
  const calmFps = Number(flag("calm", 15));
  const inBusy = (t) => info.busy.some(([a, b]) => t >= a - 0.05 && t < b + 0.05);
  // A stretch where nothing is drawn (info.idle) is one frame, held for the whole stretch.
  const idleAt = (t) => (info.idle ?? []).find(([a, b]) => t >= a - 1e-9 && t < b);
  const times = [];
  for (let t = 0; t < info.T - 1e-6; ) {
    times.push(t);
    const idle = idleAt(t);
    t = idle ? idle[1] : t + 1 / (inBusy(t) ? busyFps : calmFps);
  }
  return times;
}

// Encode the frames saved in the work folder: a lossless animated WebP first (img2webp, which is
// fast and keeps only what changes between frames), then one lossy pass with its own, lower
// transparency quality (sharp), which is where most of the size goes.
async function encode(files, times) {
  const quality = Number(flag("q", 72));
  const alphaQ = Number(flag("aq", 35));
  const effort = Number(flag("effort", 4));
  const name = flag("name", info.name ?? "black-widow");
  const durations = times.map((t, i) => Math.round(((times[i + 1] ?? info.T) * 1000)) - Math.round(t * 1000));
  const lossless = join(work, "lossless.webp");
  const args = ["-loop", "0"];
  files.forEach((f, i) => args.push("-d", String(durations[i]), "-lossless", f));
  args.push("-o", lossless);
  execFileSync("img2webp", args, { stdio: "ignore" });
  const outDir = join(root, "public", "decorations");
  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, `${name}.webp`);
  const t0 = Date.now();
  await sharp(lossless, { animated: true }).webp({ quality, alphaQuality: alphaQ, effort, loop: 0, delay: durations }).toFile(outFile);
  // The still shown until the device may play motion: the settled pose at the start of the loop.
  // (or, when the scene names one, the frame nearest that time).
  const posterAt = info.posterAt ?? 0;
  const pi = times.reduce((best, t, i) => (Math.abs(t - posterAt) < Math.abs(times[best] - posterAt) ? i : best), 0);
  await sharp(files[pi]).webp({ quality: 88, alphaQuality: 90 }).toFile(join(outDir, `${name}.poster.webp`));
  const { size } = await stat(outFile);
  console.log("wrote", outFile, `${(size / 1024 / 1024).toFixed(2)} MB`, "frames", files.length, `q${quality}/a${alphaQ}`, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

// How well the loop closes: the picture one step after the last frame (which is the loop's first
// frame again) against the first frame, as the average difference per colour channel (0 to 255).
async function loopGap(firstFile, lastFile) {
  const read = (f) => sharp(f).ensureAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([read(firstFile), read(lastFile)]);
  let sum = 0;
  let worst = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    sum += d;
    if (d > worst) worst = d;
  }
  console.log(`loop gap (last frame vs the first, after one more step): mean ${(sum / a.length).toFixed(3)}, worst ${worst} of 255`);
}

try {
  if (mode !== "encode") {
    await rm(work, { recursive: true, force: true });
    await mkdir(work, { recursive: true });
  }

  if (mode === "stills") {
    const times = arg.split(",").filter(Boolean).map(Number).sort((a, b) => a - b);
    // Warm up one whole loop first, so the feet are where they are in the finished loop.
    await page.evaluate((T) => window.scene.advance(T), info.T);
    for (const t of times) {
      await page.evaluate((to) => window.scene.advance(to), info.T + t);
      const art = png(await page.evaluate(() => window.scene.render()));
      await writeFile(join(work, `art-${t.toFixed(2)}.png`), art);
      await writeFile(join(work, `still-${t.toFixed(2)}.png`), await onStandIn(art));
    }
    // One contact sheet of all of them.
    const cells = await Promise.all(times.map((t) => readFile(join(work, `still-${t.toFixed(2)}.png`))));
    // --crop x,y,w,h cuts each picture down to the part worth looking at; --cols sets the sheet width.
    const crop = flag("crop", null)?.split(",").map(Number);
    const cw = crop ? crop[2] : info.OUT;
    const ch = crop ? crop[3] : (info.OUTH ?? info.OUT);
    const cols = Number(flag("cols", Math.min(4, cells.length)));
    const rows = Math.ceil(cells.length / cols);
    const pieces = await Promise.all(
      cells.map((c) => (crop ? sharp(c).extract({ left: crop[0], top: crop[1], width: cw, height: ch }).png().toBuffer() : c)),
    );
    const sheet = await sharp({ create: { width: cols * cw, height: rows * ch, channels: 4, background: "#000" } })
      .composite(pieces.map((input, i) => ({ input, left: (i % cols) * cw, top: Math.floor(i / cols) * ch })))
      .png()
      .toFile(join(work, "sheet.png"));
    console.log("sheet", sheet.width, "x", sheet.height, "->", join(work, "sheet.png"));
  } else if (mode === "measure") {
    // How close does anything drawn come to each edge over the whole loop? (alpha above 6 of 255)
    const fps = Number(flag("fps", 10));
    const frames = Math.round(info.T * fps);
    await page.evaluate((T) => window.scene.advance(T), info.T);
    const m = { top: 1e9, bottom: 1e9, left: 1e9, right: 1e9 };
    for (let i = 0; i < frames; i++) {
      await page.evaluate((to) => window.scene.advance(to), info.T + i / fps);
      const { data, info: im } = await sharp(png(await page.evaluate(() => window.scene.render()))).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = im.width;
      const Hh = im.height;
      for (let y = 0; y < Hh; y++) {
        for (let x = 0; x < W; x++) {
          if (data[(y * W + x) * 4 + 3] > 6) {
            m.top = Math.min(m.top, y);
            m.bottom = Math.min(m.bottom, Hh - 1 - y);
            m.left = Math.min(m.left, x);
            m.right = Math.min(m.right, W - 1 - x);
          }
        }
      }
    }
    console.log("closest approach to each edge (px, 0 means cut off):", m);
  } else if (mode === "webp") {
    const times = schedule();
    await page.evaluate((T) => window.scene.advance(T), info.T);
    const files = [];
    for (let i = 0; i < times.length; i++) {
      await page.evaluate((to) => window.scene.advance(to), info.T + times[i]);
      const art = png(await page.evaluate(() => window.scene.render()));
      const f = join(work, `f${String(i).padStart(4, "0")}.png`);
      await writeFile(f, art);
      files.push(f);
    }
    // One more step round to the loop's start, to see how well the ends meet.
    await page.evaluate((to) => window.scene.advance(to), info.T + info.T);
    const wrapFile = join(work, "wrap.png");
    await writeFile(wrapFile, png(await page.evaluate(() => window.scene.render())));
    await loopGap(files[0], wrapFile);
    await writeFile(join(work, "times.json"), JSON.stringify(times));
    await encode(files, times);
  } else if (mode === "encode") {
    const times = JSON.parse(await readFile(join(work, "times.json"), "utf8"));
    const files = times.map((_, i) => join(work, `f${String(i).padStart(4, "0")}.png`));
    await encode(files, times);
  }
} finally {
  await browser.close();
  server.close();
}

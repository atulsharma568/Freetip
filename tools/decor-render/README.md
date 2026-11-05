# decor-render

Draws a Freetip photo-frame decoration in code and saves it as an animated WebP, so a decoration is
just a file the site serves (no work in the visitor's browser). First one: **Black Widow**.

Not part of the site build: nothing here is imported by the app, `tools/**` is skipped by eslint, and
the site only needs the files this writes to `public/decorations/`.

## What is in it

| File | What it does |
|---|---|
| `spider.js` | The spider: a body and eight legs, a two-bone leg solver with a stepping gait (an alternating tetrapod: four feet carry the body while the other four swing), body sway and a lagging back, shaded drawing (glossy body, lit legs, cast shadows). Height is added on the screen (body and knees lifted, shadows left on the ground). |
| `widow.js` | The scene and its one timeline (about 14 s): the widow rests, turns, walks along the rim, turns and rests on the other side, and back; three little spiders crawl out from under its head over the face; a front leg lifts and feels the air now and then. The loop begins and ends with the widow settled, and breathing rhythms take a whole number of turns per loop, so the ends meet. |
| `index.html` | The page the renderer loads: steps the simulation, draws at twice the size, shrinks once (clean thin legs). |
| `fog.js`, `fog.html` | The **Widow's fog** banner effect (`--scene fog`): a whole-header layer, 480 by 576 units (5 to 6). Drifting fog (low-resolution noise drawn big), a fir forest drawn once, the widow rig (dark palette, scale 0.86) crossing on one curve, a puff of white smoke (soft puffs cut through a wisp texture), one 14 s timeline. About half of the loop is clean, so those stretches are one held frame each (`IDLE`). |
| `render.mjs` | The driver (Playwright with the Mac's own Chrome, `sharp`, `img2webp` from libwebp). |

## Run it

From the repo root (Node 22 or newer, Google Chrome, `img2webp` on the path, for example `brew install webp`):

```
node tools/decor-render/render.mjs stills 0.5,3.4,7.2          review pictures at those seconds (over a stand-in photo)
node tools/decor-render/render.mjs measure                      how close anything gets to each edge of the canvas (0 means cut off)
node tools/decor-render/render.mjs webp --out 480               the finished files in public/decorations/
node tools/decor-render/render.mjs encode --q 70 --aq 30        only re-encode the frames already saved
```

Review pictures and frames go to `/tmp/decor-render`. `stills` takes `--crop x,y,w,h` and `--cols n`.
`webp` takes `--busy 24 --calm 15` (frames per second while the spider turns and walks, and while it
rests; the picture changes less when it rests, which keeps the file small), `--q` (picture quality,
72), `--aq` (transparency quality, 35; this is where most of the bytes go), `--effort`, `--name`.

The fog effect is recorded with `--scene fog`; the one used on the site is

```
node tools/decor-render/render.mjs webp --scene fog --out 360 --busy 18 --calm 10 --q 62 --aq 72
```

(`widow-fog.webp`, 2.3 MB, and a still `widow-fog.poster.webp` of the forest in thin fog). Transparency quality is what costs bytes: 70 gives 2.0 MB, 76 gives 3.0 MB, 80 gives 3.5 MB; below about 70 the smoke and the fog show rings, which is why the smoke is cut through a wisp texture. Do not dither the transparency (it made the file 6 MB). `stills` and `webp` show the effect over a stand-in header (banner, photo, name, bio).

The result is checked as it is made: the output prints how well the loop closes (the last step against
the first frame) and the size. Keep the file under the budget in `test/page-decor.spec.ts` (2.6 MB).

## How the art meets the page (the photo frame)

The art is a square (`W` = 528 in `widow.js`, saved at 480). The circle of radius `R` in its middle is
where the photo's ring sits, so the page draws the file at `W / (2R)` times the ring: 220 percent, the
largest frame size (`FRAME_SCALE.max`). That number is `scale` in `FILE_FRAMES` in
`src/lib/page-doc/decor.ts`; change `W` or `R` and it must change with them. The first frame is saved as
`black-widow.poster.webp`, which the page shows until the device may play motion.

Run `measure` after changing the spider or the path: the canvas has about 13 px to spare at the top, and
anything that touches an edge is cut off.

## How the fog effect meets the page

`FILE_FX` in `src/lib/page-doc/decor.ts` names the file and its still; the header block draws it over the
whole header (banner, photo, name and bio) with `object-cover object-bottom`, so only the top is trimmed
when the header is wider than 5 to 6. It plays **behind** the photo and the words (`z-[1]` under their
`z-[2]` in `CreatorPanel.tsx`), because the forest and fog would otherwise hide the name; an uploaded
whole-header effect still plays over everything. Keep the creature's path in the middle of the art.

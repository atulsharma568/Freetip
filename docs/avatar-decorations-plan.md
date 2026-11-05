# Avatar decorations and banner effects: plan (2026-11-05)

Status: PLAN ONLY. Nothing here is built. Written after reading the code and after looking at the owner's screen recording of a Discord profile (11 s, frames pulled out with ffmpeg).

## 1. What the reference does

Two separate layers, both pre-rendered transparent animation on Discord's side:

- **Avatar decoration.** A black widow spider walks over the top of the avatar and settles on one side; small spiders crawl down the face. The layer is bigger than the avatar circle and spills outside it. The avatar picture underneath does not move.
- **Profile effect.** A loop of about 10 s over the whole card, not only the banner: dark fog and forest fade in, a large dark creature crosses, a puff of white smoke, then it fades back to clean. It plays on a timer, so most of the time the card is calm.

## 2. What Freetip already has (found in the code, not new)

- `src/lib/page-doc/decor.ts`, `src/components/tip/Decor.tsx`, `CreatorPanel.tsx`, `HeaderBlock.tsx`: a photo frame (flame ring, pulsing aura, slash ring, fox-fire) and a banner effect (embers, slashes, soft glow, clutch pulse, spider crawl, storm, neon glitch, petals), all drawn in CSS and SVG, plus "custom" (a picture or GIF from the page's asset library).
- `/dashboard/effects` lets the owner pick a frame and an effect for the owner's own page (`users.tip_decor`, migration 0058). The page editor can pick them per creator page.
- Creators cannot upload their own; uploads are owner-only through the page editor.

## 3. The gaps against the reference

1. **Look.** The existing spider is a small, flat, top-down SVG with two leg groups swapping. The reference is large, shaded and has weight. The existing storm is two CSS fog layers and a bolt. Not the same class.
2. **Uploads can't carry this kind of art.** `assets.ts` allows only a still picture or a GIF for the frame and the effect. A GIF has one-bit transparency (ragged edges), so a decoration like the reference looks bad as a GIF. Animated WebP and APNG are refused on purpose (they ignore the motion rules), and WebM is not allowed in the header at all.
3. **No size or position control.** A decoration is a fixed overhang; the reference's spill outside the circle is bigger.
4. **No timeline.** Everything loops forever. The reference calms down between bursts.
5. **Owner only.** No path for a creator to use it (that is a plans and pricing decision, not code).

## 4. Part A: creator uploads of transparent layers

Goal: an owner (later a paying creator) can upload a transparent animation and have it draw over the photo or over the banner and card.

Format choice (the one real technical decision):
- **Animated WebP**: real 8-bit alpha, full colour, works in every current browser including Safari and iPhone. One file. Heavier than video for the same length. Likely the main format.
- **Transparent WebM (VP9 with alpha)**: small and smooth, but Safari and iPhone do not play it; they need HEVC with alpha in an MP4 or MOV. Treat as an optional second source, with the still poster as the fallback.
- **GIF**: kept, but only as the fallback look.
To confirm before building: the rules `media.ts` and `assets.ts` apply today to animated WebP (the sniffing code refuses it) and what the Blob upload and poster steps need.

Changes, in order:
1. `assets.ts`: let `frame` and `fx` take animated WebP (and optionally WebM), keeping the size caps (3 MB image, 8 MB WebM, 15 s) and the "still picture until motion is allowed" rule through `use-motion.ts`.
2. Poster: a still of the first frame, made in the browser before upload (as the GIF path does).
3. `Decor.tsx`: a `CustomPicture` that can draw a video element (muted, looping, `playsInline`, paused off-screen and under reduced motion) and an image.
4. Header settings gain `frameScale` (1.0 to 1.8) and a nudge up or down, and `fxArea` ("banner only" or "whole header"); a parser and editor field each, with tests.
5. A take-down path already exists in `/admin/media`; check it covers the new kinds.
6. Creators: only after the owner decides the switch and plan (see section 7). Needs a review of what a creator may upload (moderation, copyright) before it opens.

## 5. Part B: our own decorations at reference quality

Honest limit: the reference is hand-animated art. We can match its motion quality and polish with procedural animation, not its painted realism. The aim is a stylised, shaded, alive look, judged frame by frame against the recording.

Technique (each piece, and why it is enough):
- **The creature as a rig, not a drawing.** A spider with a body and eight legs of two segments each, solved with inverse kinematics, a stepping gait (opposite legs in turn, each foot planted, then lifted and placed), body bob and a slight lean. This is the part that makes it feel alive, and it is what the current flat SVG lacks. Path: it walks around and over the avatar's edge, stops, settles, repeats; small spiders follow their own paths. Drawn on a 2D canvas with gradient shading, a rim light and the red hourglass mark. Canvas, because the number of moving parts is too high for CSS.
- **Fog and a big shape crossing.** A small fragment shader (layered drifting noise, a darker shape moving through, tinted by the page accent), faded in and out by one timeline. WebGL on its own small canvas; falls back to a still gradient if WebGL is missing.
- **Smoke puff.** A short burst of soft particle sprites.
- **One timeline.** A single GSAP timeline (about 10 to 12 s) runs the calm, the fade in, the crossing, the puff and the fade out, so the layers agree instead of running on separate loops.
- **Render once, ship as a file.** The same code can be recorded in a headless browser (Playwright is already in the project) and encoded to transparent WebP or WebM. That makes a decoration just another Part A upload: light on the phone, same on every browser, no per-frame work for the visitor. Live canvas stays an option on strong devices only.

First set (three, not twenty, each worth doing properly):
1. **Black Widow**: the reference's idea, our own art.
2. **Flame Fist**: flames wrapping the avatar and licking over the card (fits the AcePressure brand; a fire shader).
3. **Storm Eye**: fog, lightning and a creature crossing.

Budget and safety rules for every one: no work while off-screen; capped frame rate and pixel ratio on phones; respects reduced motion and the existing `mayPlayMotion` rules; never takes a click; fixed seeds so the server page and the first browser draw agree; the photo's own description stays the only thing a screen reader reads.

## 6. How we will know it is good

- Pull frame strips from the new decoration the same way as from the reference recording (ffmpeg, same crop) and compare side by side with the owner.
- Measure on the emulated low-end Android (as done for the home page) and in real Chrome; no dropped frames on a mid-range phone, no layout shift.
- Tests: the parser, the settings, the upload rules, a baseline picture per decoration with motion paused.

## 7. Decisions for the owner

1. Format: animated WebP as the main upload (recommended), with WebM optional?
2. Render-once files, live canvas, or both (recommended: render once as the default, live as a bonus)?
3. Is the first set right (Black Widow, Flame Fist, Storm Eye)?
4. Who may use them: owner only for now, or a paid switch for creators (which plan: Creator, or its own)?
5. Order: Part A first (smaller, useful at once), or Part B first (the look)? Recommended: A first, then the widow, so one real file goes through the whole path early.

## 8. Effort

- Part A: (touches the upload rules, the parser, the editor and the renderer).
- Part B, the widow rig and timeline: xhigh (the hard part is the motion, and it needs many rounds against the reference).
- A review of the creator-upload opening (moderation, copyright):, before it opens to anyone but the owner.

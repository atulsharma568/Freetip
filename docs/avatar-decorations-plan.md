# Avatar decorations and banner effects: plan (2026-11-05)

Status (2026-11-05): Part A is built. Part B is under way: the Black Widow frame is built (section 9); Flame Fist, Storm Eye and the widow's fog-and-creature banner effect are not. Written after reading the code and after looking at the owner's screen recording of a Discord profile (11 s, frames pulled out with ffmpeg).

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

## 9. Part B status (2026-11-05)

Owner's answers to section 7: render once as a file (decision 2), the first set of three is right (decision 3), owner only for now with a paid switch wired in Part A (decision 4), Part A first (decision 5).

**Black Widow frame, built (no extra review, no migration).** Code in `tools/decor-render/` (see its README): a spider rig with a stepping gait and shaded drawing, one 14 s timeline, recorded in the Mac's Chrome and saved as `public/decorations/black-widow.webp` (480 px, about 2.0 MB, 278 frames, 24 frames a second while it walks and 15 while it rests) with a still `black-widow.poster.webp`. It is a new ready-made frame, "Black Widow", offered in the Effects tab and the page editor (`FILE_FRAMES` in `src/lib/page-doc/decor.ts`), drawn at 220 percent of the photo ring through the same path as an uploaded animation (still until the device may play motion). What it does: the widow perches on the rim facing the middle of the photo, turns, walks along the rim to the other side head first, perches again, and back; three small red spiders crawl out from under its head over the face and go back; a front leg lifts and feels the air now and then; the loop starts and ends settled and closes (mean difference 0.001 of 255).

Honest limits: this is procedural art, shaded and lit like the reference but not painted; the widow covers part of the photo while it rests (the reference does too); the frame size is fixed at 220 percent because the spider's legs reach that far.

Not built yet: the fog-and-creature banner effect that goes with the widow in the reference (a whole-header layer), Flame Fist, Storm Eye. The plan's live-canvas option was not chosen.

Weight: the 2.0 MB file is loaded only after the page has loaded and only when the device may play motion (`mayPlayMotion`: not with reduced motion, data saver, a 3G or slower connection, or 2 GB of memory or less); every other device gets the 17 KB still. If it is too heavy for the owner, the levers are `--out 400`, `--calm 12` and `--aq 25`, each in `tools/decor-render/README.md`.

## 10. Dragon's fog banner effect (2026-11-05, no migration)

Built: the profile effect half of the reference. A ready-made banner effect, id `widowfog` (`FILE_FX` in `decor.ts`), shown to creators as "Dragon's fog". About 14.5 s: fog and a fir forest roll over the whole header, a dark dragon rises into the picture from the right, tips its head back and roars (two pale rings spread from the mouth), lowers its head and breathes a long stream of fire across the header (the fire lights the fog and the dragon's head orange), closes its mouth and sinks back out of sight, and the fog thins out to clean; the rest of the time the header is clean, like the reference. The first version (2026-11-05, earlier the same day) had a spider crossing and a smoke puff; the owner said the reference had a dragon that comes in, roars, breathes fire and goes back, so the spider was replaced (it stays in the photo frame). Drawn once by `tools/decor-render/` (`--scene fog`), saved as `public/decorations/widow-fog.webp` (360 by 432, 159 frames, 2.4 MB; loop closes exactly because the first and last stretches are empty) with a 40 KB still of the forest in thin fog. Offered in the Effects tab and the page editor; goes through the same motion rules as every file (loaded after the page has loaded and only where `mayPlayMotion` allows, otherwise the still).

Decisions and limits: it plays behind the photo and the words (the forest and fog would hide the name otherwise); the art is a fixed 5 to 6 shape shown cut to the header, anchored at the bottom; fog is kept thin over the middle. Honest limits: procedural, faceted art, not painted: the dragon is a dark silhouette in fog with a bright fire, not a detailed beast; the neck is nearly lost in the fog by design; the forest reads as soft dark fir shapes; a faint rectangular band can show in the fog on a frame or two (the animation encoder updates only the part that changed); the id `widowfog` was kept so nothing stored breaks.

Not built: Flame Fist, Storm Eye. The pfps.gg suggestion is a separate question (section 11).

## 11. pfps.gg (2026-11-05): not used so far

The owner suggested taking avatars and banners from pfps.gg (animated pfps and banners). Its terms (read 2026-11-05): uploaders keep ownership and must hold the rights; the licence they grant runs to pfps.gg only; the site describes the files as "free to use on social media platforms"; commercial use, re-hosting and redistribution are not addressed. This repo is public and decorations are a paid feature, so shipping those files in `public/` is not safe. Nothing was downloaded. Options to put to the owner: (a) use the site for inspiration only and keep drawing our own; (b) let a creator download a file for themselves and upload it to their own page (their rights to answer for, which needs the moderation and copyright review that is already ahead); (c) ask individual artists for written permission, per file.

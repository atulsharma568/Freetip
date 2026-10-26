# Hero hands artwork review

The standalone artwork is in `src/components/hero/HeroHandsArt.tsx`.

The temporary preview route was deleted after review. These screenshots preserve the four review rounds:

- `round-1-desktop.png` — initial 1440 × 900 review.
- `round-1-phone.png` — initial 360 × 800 review.
- `round-2-desktop.png` — after the mobile scale, note position and ₹ glyph fixes.
- `round-2-phone.png` — same revision at 360 × 800.
- `round-3-desktop.png` — after moving the note into the left-hand overlap.
- `round-3-phone.png` — same revision at 360 × 800.
- `round-4-desktop.png` — final preview after bringing the cuffs slightly inward.
- `round-4-phone.png` — final 360 × 800 preview.

The artwork was checked with `npm run lint`, `npx tsc --noEmit`, `npm run build` and `git diff --check`. The artwork has not been wired into `Hero.tsx`, and no commit or push was made for this artwork-only task.

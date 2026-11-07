# Plan: library for alert media, sounds and page music (deferred from phase 2)

Status: DECIDED, nothing to build now. Alert media: leave as is (owner, 2026-11-07). Sounds and page music sharing: not built; the owner is not sure they want it, so it stays off until they say so.

## Why it was deferred
Phase 2 (banner library, migration 0063) reused `decor_items` because images share one set of limits. These three kinds do not fit that table cleanly:
- Alert media (`creator_media`, `src/app/actions/media.ts`): image or GIF up to 3 MB, WebM up to 8 MB, 10 s, 4096 px. Already has its own review flow (`/admin/media`, `review_state`, takedown in `admin.ts`), and its own rules in `media.ts`.
- Sounds (`src/lib/sounds.ts`): audio, stored as 16-bit PCM WAV, max 8 MB and 30 s, 2 per creator, 10 MB per creator. No width or height.
- Page music (`src/lib/page-music-store.ts`, `page-music.ts`): one audio file per page. No width or height.
`decor_items` needs width and height as required values, so audio would need them made nullable.

## Options
A. Leave alert media alone (it already has a review and takedown path) and build a sharing library only for page music and sounds.
B. One generic `library_items` table for all audio and video, separate from `decor_items`.
C. Do nothing: owners share by sending files. (Cheapest; no sharing.)

Recommendation: A. Alert media already has admin review; sharing it adds a second review path. Sharing sounds and music between creators is probably unwanted, so confirm that first.

## Open questions for the owner
1. Should creators be able to share sounds or page music with each other at all? (Phase 2 notes said "not wanted unless the owner asks".)
2. Should alert media be shareable, given it already goes through `/admin/media`?
3. If yes to 1 or 2: nullable width/height on `decor_items`, or a new table?

## Steps (only after answers)
1. Migration: make `decor_items.width/height` nullable if audio goes there; widen `kind` check. Name it `0064_…`.
2. `decor-library.ts`: add kinds; keep the grant/withdraw logic shared.
3. Sounds and music pickers: "My uploads" and "Shared with you", as in the banner page.
4. Admin Decorations page: kind filter already exists; add labels.
5. Tests: PGlite spec like `test/decor-library.spec.ts`; browser fixture like `src/app/dev-fixtures/banner`.

## Not in scope
Changing the upload limits of any existing kind.

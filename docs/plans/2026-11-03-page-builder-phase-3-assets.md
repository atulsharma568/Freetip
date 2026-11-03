# Page builder, phase 3 (assets) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner uploads pictures, GIFs and short looping videos for a creator from the editor, uses them as the tip page backdrop and header banner, replaces them, and removes them, with a still picture always shown where a fan's device should not play motion. Fans see nothing different until Publish.

**Architecture:** A new table `page_assets` holds one row per uploaded file (migration 0052). The document stores only an asset id; the tip page resolves ids to files in one query, for that creator only, approved files only, and a missing or taken-down asset gives the normal look. Files go from the browser straight to Vercel Blob under `page/<creatorId>/` with an owner-only token, and the server looks at the first bytes again before saving the row (the pattern of `src/lib/media.ts` and `src/app/actions/media.ts`, reused, not copied). Animated files (GIF, WebM) carry a still poster made in the browser. A small client component plays the video only when the device and the fan's settings allow.

**Tech Stack:** Next.js 16 App Router (breaking changes: read the docs), React 19, TypeScript, Tailwind 4, `postgres`, `@vercel/blob`, Playwright (also the unit runner), PGlite for database specs.

**Spec:** `docs/specs/2026-11-03-page-builder-design.md` ("Assets", decision 7, phase 3). **Earlier plans:** phase 1 and phase 2 in this folder; `PROGRESS.md`.

## Global Constraints

- Before writing Next.js code, read the relevant guides in `node_modules/next/dist/docs/01-app/` (route handlers, server actions, client components) (`GUIDELINES.md`).
- Payment code is not touched. The page must stay payable and readable whatever a background does: text sits on a dimmed layer (see decision 4).
- The phase 1 gate still passes untouched: with no asset chosen, the owner page and a normal page are pixel-identical (320, 390, 1280 px), tab order and served text unchanged. New settings default to "no asset", which means today's look.
- A bad stored value must render the default look, never a broken page. The parser stays lenient and never throws. A document can name only assets of its own creator.
- Owner-only everywhere (upload route, every action): `requireOwner()`, and each action re-checks the creator's `pageBuilder` switch. A hidden button is not a lock.
- Uploaded files never run code and are served only from our own Blob store: first-bytes check by the server, the allowed kinds listed in one place, `isOwnBlobUrl` on every URL before it is saved or drawn.
- Public repo: no secrets, no company details. `package-lock.json` only references `https://registry.npmjs.org/`. No plan or price on the public site.
- Migration: **0052 `page_assets`**. The owner runs it BEFORE the deploy. The tip page must still load before it is run (read errors are logged and the normal look is used, as with 0051).
- Commits: unsigned, as the owner's GitHub no-reply identity, with NO `Co-Authored-By` line (owner rule). Before pushing, `git log -1 --format=%B | grep -ci co-authored` must print `0`. Never force-push, never bypass hooks. Update `PROGRESS.md` and `OPERATIONS.md` (7g, new steps for assets and migration 0052) in the same commit as the last task. Push to `main` only when lint, type check, build and the specs pass.
- Run unit-style specs with `npx playwright test -c playwright.unit.config.ts test/<file>.spec.ts`. Browser specs: `npx playwright test --project=chromium-desktop test/<file>.spec.ts` (see `GUIDELINES.md` section 5 if Chromium is missing).

## Decisions made in this plan (the owner may change any)

1. **Where assets are used: backdrop and header banner only.** `backdrop` gets `style: "ember" | "media"`, `asset` (id or none) and `dim` (a number from 0 to 80, default 40). `header` gets `bannerAsset` (id or none), a picture or GIF only, which replaces the creator's YouTube or uploaded banner. A picture on the thank-you screen, a logo block and a free "image" block are left for later (each is a new block type and a new layout case).
2. **Replacing does not edit a file in place.** The spec said replace keeps the asset id, so a replaced file changes the live page at once, bypassing Publish and Revert. Instead, "Replace" uploads a new asset and rewrites every place the draft uses the old one; it goes live at Publish like any other change, and "Swap with previous version" still shows the old picture because the old file still exists. The goal ("replacing keeps its place on the page") is met. **Deviation from the spec: tell the owner.**
3. **Removing is refused while any stored document uses the file** (draft, published or previous), and says which. A removed asset's files are deleted from Blob and the row is kept as `removed` (audit trail, like alert media). The owner's take-down in `/admin/media` works the same and is allowed even if a document uses it: the page then shows the normal look.
4. **A backdrop picture is always dimmed** by `dim` percent of the page ground colour, on top of the file, so text stays readable. The editor shows a live preview, so a too-bright picture is seen before Publish.
5. **Limits** (in one table in code): picture and GIF 3 MB, WebM 8 MB and at most 15 seconds, at most 4096 px on a side, 10 live assets per creator, 40 MB in all, poster at most 300 KB. The editor tells the owner AI-made clips usually need compressing first and shows the size.
6. **WebM only, no MP4.** WebM is what `src/lib/media.ts` already checks. A browser that cannot play WebM shows the still poster, which is the same fallback the data-saver rule uses, so nothing breaks. Whether current iPhones play WebM is unverified; the owner checks on a real iPhone. MP4 is a later add only if that check fails.
7. **Every animated file has a poster; a still picture does not need one.** The browser draws the first frame (video or GIF) to a canvas and uploads it as a WebP next to the file. A video whose poster cannot be made is refused ("this browser could not read the video").
8. **Motion rules** (spec decision 7): the still shows first and in the served HTML. After the page has loaded, the video (or the GIF itself) replaces it only if the fan has not asked for reduced motion, is not in data-saver mode, is not on a 2G or 3G connection, and the device does not report 2 GB of memory or less. The video is muted, looping and `playsinline`, and stops when the tab is hidden.
9. **Moderation:** uploads are owner-only, so they are live to the owner's own pages at once; `/admin/media` lists page assets next to alert media (with the creator, size and a preview) and can take any down.
10. **Assets are not copied between creators**; copying a page as a template is phase 5.

## Review Focus

Most likely first. Each has a test in the task named.

1. A document that names an asset of another creator, a deleted asset, a non-number or an asset of the wrong kind (a video as a banner). Expect the normal look and a note, never a broken page or someone else's file. (Tasks 1, 4)
2. An upload that lies: a `.webm` name on an EXE, a PNG over the size cap, a poster that is not a picture, a URL outside our store or outside `page/<id>/`. Expect refusal and no row. (Tasks 2, 3)
3. A token or action used for a different creator's folder, by a signed-in non-owner, or for a creator with the switch off. Expect refusal. (Task 3)
4. Remove or Replace while the file is in use, and a double click. Expect a clear message and no half state (row removed but file still used). (Tasks 2, 6)
5. Phase 1 gate regression: the default pages must not change by a pixel, and the served HTML must not gain a `<video>` or large image when no asset is chosen. (Task 4)
6. Reduced motion, data saver and low memory: the video must not start; the still must show. (Task 5)
7. Migration 0052 not yet run: the tip page and the editor must still open with a clear message. (Tasks 1, 6)

## File Structure

**New**
- `db/migrations/0052_page_assets.sql`: the table.
- `src/lib/page-doc/assets.ts`: pure rules: kinds, limits, asset reference checks, "which asset ids does this document use", rewriting a reference (used by Replace). No site imports.
- `src/lib/page-doc/asset-store.ts`: database half: list, add, remove, resolve for a page. No site imports, runs on PGlite.
- `src/app/api/page-assets/upload/route.ts`: owner-only upload token.
- `src/app/actions/page-assets.ts`: `addPageAsset`, `removePageAsset`, `replacePageAsset` (owner actions).
- `src/components/tip/blocks/BackdropMedia.tsx`: client component for the motion rules.
- `src/app/admin/creators/[id]/page/AssetLibrary.tsx` and `AssetPicker.tsx`: the library and the picker used by the settings panel; `poster.ts` (browser: first frame to WebP).
- Specs: `test/page-assets.spec.ts` (pure), `test/page-assets-store.spec.ts` (PGlite), additions to `test/page-doc.spec.ts`, `test/page-editor.spec.ts`.

**Modified**
- `src/lib/page-doc/types.ts`, `blocks.ts`, `parse.ts`, `edit.ts`, `fields.ts`: new settings and their checks.
- `src/app/[handle]/tip-page-data.ts`, `TipPageView.tsx` and `TipFormContext`: resolved assets travel with the page data.
- `src/components/tip/blocks/BackdropBlock.tsx`, `HeaderBlock.tsx` (and the banner `Image` unoptimized rule in `CreatorPanel.tsx`).
- `src/app/admin/creators/[id]/page/BlockSettings.tsx`, `PageEditor.tsx`.
- `src/app/admin/media/page.tsx`, `src/app/actions/admin.ts`: list and take down page assets.
- `src/app/api/cron/sound-orphans/route.ts` or a sibling: clean up uploaded files that never got a row.
- `OPERATIONS.md` (7g), `PROGRESS.md`, `docs/next-steps.md` next steps.

## Tasks

### Task 1: the table, the rules and the parser
- [ ] Write migration 0052: `page_assets` (id, creator_id references users on delete cascade, kind in image/gif/webm, name 1 to 40, blob_url, poster_url null, mime, size_bytes, poster_bytes, width, height, duration_ms, review_state in approved/removed, created_at, removed_at); index by creator.
- [ ] `assets.ts`: limits table (decision 5), `allowedKindFor(block, setting)` (backdrop: any; banner: image or gif), `usedAssetIds(doc)`, `replaceAssetId(doc, from, to)`; reuse `sniffMedia`/`checkMediaFile` from `media.ts` (raise its picture limit by argument, as the banner does).
- [ ] Types and parser: `backdrop.style/asset/dim`, `header.bannerAsset`; asset ids must be positive whole numbers; `dim` clamped to 0 to 80; unknown style falls back to ember with a note. Failing specs first (bad id, wrong type, dim out of range, default documents unchanged byte for byte).
- [ ] Run `test/page-doc.spec.ts` and the phase 1 and 2 specs: all still pass.

### Task 2: the store (database half)
- [ ] `asset-store.ts`: `addAsset` (checks count and bytes allowance), `listAssets(creatorId)`, `resolveAssets(db, creatorId, ids)` (approved, that creator, one query), `removeAsset` (refused while draft, published or previous uses it; audit row `creator.page_asset_removed`), `replace` helper that returns the new id and the rewritten draft ready for the save path of phase 2.
- [ ] PGlite specs: allowance limits, another creator's id is not resolved, removed is not resolved, remove refused while used (three places), double remove, audit rows.

### Task 3: upload route and actions
- [ ] Read the current `@vercel/blob/client` and route handler docs. Route: `requireOwner`-equivalent for a route handler (a helper that returns owner access without redirecting), creator must exist with `pageBuilder` on, path must start with `page/<thatCreatorId>/`, allowed types from `media.ts`, 8 MB cap, random suffix. The creator id comes from the path, which the route checks against the database.
- [ ] `addPageAsset`: fetch the file, `checkMediaFile`, poster checked as an image of at most 300 KB (required for gif and webm), `isOwnBlobUrl` for both URLs against `page/<id>/`, name cleaned, row inserted; on any refusal delete the uploaded blobs. `removePageAsset` deletes the blobs after the row change. `replacePageAsset` is `addPageAsset` plus the document rewrite in one step.
- [ ] Specs for the checks that can run without the network (pure functions, mocked fetch) and the owner/switch gate.

### Task 4: show assets on the tip page
- [ ] `tip-page-data.ts` resolves the document's asset ids once and passes a map. A document asset that does not resolve, or is the wrong kind, gives the normal look.
- [ ] `BackdropBlock`: style `media` draws the file (a plain `img`, not `next/image`, because it can be animated and the Blob host is not in the image list), dimmed by `dim`, `aria-hidden`, behind everything, over or instead of the ember layer (style `ember` unchanged). `HeaderBlock` passes `bannerAsset` as the banner, unoptimized, as an upload. The served HTML carries only the still poster/img.
- [ ] Gate: the phase 1 pixel and served-text comparison for both default pages, plus new fixtures (a picture backdrop, a missing asset) in `/dev-fixtures/tip`.

### Task 5: the motion rules
- [ ] `BackdropMedia.tsx`: shows the poster first; after window load, mounts a muted looping `video` (or swaps in the GIF) only when the rules in decision 8 allow; pauses on `visibilitychange`; `preload="none"` until it starts. The rules are a small pure function with specs (each condition on its own).
- [ ] Browser spec: with reduced motion emulated, no `video` element is mounted; with it off, one is.

### Task 6: the editor
- [ ] `poster.ts`: draws the first frame of a video or GIF (video seeked to 0.1 s) to a canvas at most 1280 px wide, returns a WebP blob; refuses a clip over 15 s.
- [ ] `AssetLibrary` (list with preview, kind, size, where it is used; Upload, Replace, Remove with the "in use by ..." message), `AssetPicker` for the backdrop and banner settings, the `dim` slider, uploads with progress and a clear refusal reason. The editor tells the owner AI-made clips usually need compressing and shows size and length before upload.
- [ ] Replace rewrites the draft and autosaves through the phase 2 path; nothing is live until Publish. If migration 0052 is missing, the panel says "run migration 0052".
- [ ] Editor browser specs: upload (with blob calls stubbed), pick, replace, remove refused while used, old tab conflict still works.

### Task 7: take-down, clean-up and docs
- [ ] `/admin/media` lists page assets and takes one down (blobs deleted, row `removed`, audit row); the tip page then shows the normal look.
- [ ] Orphan clean-up: files uploaded under `page/` with no row are deleted by the existing daily orphan job (check its age rule so an upload in progress is never deleted).
- [ ] `OPERATIONS.md` 7g (run 0052, upload steps, what to check on a phone), `PROGRESS.md`, `docs/next-steps.md` next steps.

### Task 8: independent review and verification
- [ ] Lint, type check, build, all page-doc specs, a Lighthouse run of both default pages (no worse than owner 84/97, normal 85/97).
- [ ] A fresh reviewer reads the diff against the Review Focus list (as in phase 2 task 8), fixes follow, then commit and push.

## Owner to do after the build
Run 0052, deploy, tick the switch for a test creator, open the editor on a laptop, upload a picture and a short WebM, set it as the backdrop, check the dimming in the preview, Publish, open the page on a phone (also with the phone's reduced-motion or data-saver setting on), Replace the picture, Swap with the previous version, Remove the unused file. Not verifiable here: a real Blob upload, the page on a real phone (WebM on iPhone), a real AI-made clip.

## Not in this phase
Pressure meter (phase 4), OBS overlays in the builder and template copy (phase 5), a picture on the thank-you screen, a logo block, MP4, assets for creators themselves.

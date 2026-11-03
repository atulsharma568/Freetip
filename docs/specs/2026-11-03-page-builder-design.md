# Page builder for the tip page, with the weekly Pressure meter

Status: draft for the owner's approval, 2026-11-03. Nothing is built.
Audience: the engineer who will plan and build it. The owner is not a programmer and will use the result, not read the code.

## Intent and the why

The owner's own tip page (handle `acepressure`) was built by hand. Its red, tagline, Instagram handle, ranks (Rookie to Pirate King), the top of the pressure bar (₹5,000), the backdrop (smoke, slashes, embers, petals), the strip and the "GG" sign-off are all fixed in code (`src/lib/owner-page.ts`, `src/components/tip/Owner*.tsx`, `TipForm.tsx` `variant === "owner"`). Any change means asking the developer.

The owner wants to change every part of that page from the dashboard, upload or replace pictures and animated backgrounds (including AI-made ones), and later sell a custom tip page to other creators by switching the same feature on for them. So the owner is never blocked on a developer for the page, and the page becomes a product.

Also wanted: a Pressure meter, the owner's weekly goal (usually ₹1,000) drawn as a bar in OBS and on the tip page.

## Goals

1. A tip page is a list of blocks the owner can reorder, hide, restyle and re-word, with a live preview that is the real page.
2. Everything the owner page does today is a block with settings, and the owner page renders from those settings. Today's look is the default, so nothing changes until the owner edits.
3. An asset library: upload, replace and remove images, GIFs and looping video backgrounds. Replacing a file keeps its place on the page.
4. Draft, Publish, restore the previous version, reset to default.
5. A per-creator switch (off for everyone) in `/admin/creators/<id>`, like the other paid features. **Only the owner edits a tip page**, from the owner console, on a creator's request (a done-for-you custom page). Creators have no page editor in their dashboard (owner decision, 2026-11-03).
6. The Pressure meter as a block and as an OBS overlay, driven by the existing weekly goal engine.
7. Later, the same builder for the OBS overlays, and copying one creator's page to another as a template.

## Non-goals

- Free pixel positioning. Blocks move between sections and rows only.
- A site-wide theme editor or editing the marketing site.
- Showing a plan or a price anywhere on the public site (owner rule: not until the owner decides).
- A new goal engine. The Pressure meter reads the existing `goals` data.
- Fan accounts or anything that identifies fans beyond what exists (name only).
- Creators editing their own tip page, or uploading to it. A self-serve tier is a possible later add-on, not part of this design.

## Anti-goals (a failure even if it works)

- A published page where a fan cannot pay.
- A page that scrolls sideways or breaks at 320 px.
- A looping video that makes the page heavy on a low-end phone.
- Uploaded files that can run code or be served from outside our own storage.
- The owner's page getting worse before the owner edits anything (regression in layout, speed or accessibility).

## Constraints from the repo

- Next.js here has breaking changes: read `node_modules/next/dist/docs/` before writing code (see `GUIDELINES.md`).
- Paid features are keys in `src/lib/plans.ts` (`FEATURES`), stored in `users.paid_features`, ticked in `/admin/creators/<id>`, checked again at render time with `requireFeature` / `hasFeature`. The page builder follows that pattern.
- Per-creator settings are small JSON columns on `users` (for example `alert_layout`, migration 0047), parsed by a pure function that falls back to the normal value for anything invalid. The builder follows that: a bad stored value must render the default page, never a broken one.
- Uploads go from the browser straight to Vercel Blob; the server issues a token only for the creator's own folder and re-checks the file's first bytes (`src/lib/media.ts`, `src/lib/sounds.ts`). Owner take-down lives in `/admin/media`. The builder reuses this; it adds a folder prefix, not a new pipeline.
- Migrations are run by the owner in Neon before the deploy; the work log and `OPERATIONS.md` are updated in the same commit.
- Payment-critical code in `TipForm.tsx` (Razorpay order, amount, message limit, filters) must not move into editable settings.
- Accessibility: the owner page's red `#ca1b19` fails 4.5:1 for small text on black, so small text stays white or grey. The builder's colour controls must keep a contrast check for text colours.
- Public repo: no secrets, no company details in commits.

## Approaches considered

1. **Special-case for one handle.** A hidden owner-only page and one settings record. Fast, but it adds a second special case beside the existing `isOwnerTipPage` and does not serve "enable it for a paying creator later". Rejected.
2. **General per-creator feature with a block model (chosen).** The owner page becomes the default layout of a general, switchable feature. Fits the repo's existing paid-feature pattern, serves the future paid use, and removes `OWNER_*` constants as the source of truth.
3. **Free-form page builder (drag anywhere, arbitrary elements).** Most flexible, breaks on small phones, makes the payment form easy to damage, and is several times the work. Rejected; approach 2 keeps its useful part (reorder, hide, restyle, upload) without those risks.

The owner chose the broad builder and delegated the details; every choice below marked (my call) is the author's, for the owner to change.

## Design

### Page model

One JSON document per creator describes the page: `{ version, blocks: [...], theme }`.

Each block has: `id`, `type`, `visible`, `slot`, `settings` (typed per block type), `assets` (asset ids). The document is checked by one pure parser (`parsePageDoc`) that returns a clean document or the default; unknown block types, bad colours, bad asset ids and over-long text are dropped or replaced individually, not by throwing away the whole document.

Block types (from what exists today): `backdrop`, `header` (photo, banner, name, bio), `creatorLinks` (tagline, Instagram, YouTube), `pressureMeter` (new), `amount` (presets, custom amount, rank bar), `note` (name, message, extras), `picks`, `soundboard`, `send` (pay button), `strip`, `successScreen`, `alertPreview`.

Settings the owner can change per block include: text (every visible word, within length limits), colours (with contrast check for text), which asset it shows, animation on or off, and for `amount` the rank ladder: names, thresholds and the top of the bar (replacing the fixed Rookie to Pirate King and ₹5,000).

Layout: a small fixed set of sections (for example `top`, `main`, `side`, `bottom`; the exact set is left to the builder) and blocks are ordered within and moved between them. The current two-column desktop and one-column phone behaviour stays; the section decides where a block sits in each.

Protected blocks (my call): `amount`, `note` and `send` can be moved within their section, restyled and re-worded, but not hidden or removed, and the publish step refuses a document in which any of them is missing or hidden. The page must always be payable.

Default: `defaultPageDoc(creator)` reproduces today's default page, and `ownerPageDoc()` reproduces today's owner page (red, backdrop, strip, ranks). The owner page then renders from its stored document if it has one, and from `ownerPageDoc()` if not. `isOwnerTipPage` and `OWNER_TIP_HANDLES` remain only to pick which default a creator gets.

### Storage and versions

- `users.page_draft jsonb` and `users.page_published jsonb`, plus `users.page_previous jsonb` (one step back). Reset to default sets them to null. Null published means the normal rendering for that creator (the owner default for the owner). (my call: columns on `users`, matching `alert_layout`; no separate table until multiple templates need it.)
- Publish copies draft to published and the old published to previous, in one statement. Restore swaps published and previous.
- An audit entry for every publish, restore and reset (existing audit log, `creator.page_published` etc.).

### Live preview

The editor shows the real tip page component tree rendered from the draft document, inside a phone-width and a laptop-width frame, in preview mode (no payment; the existing `previewMode` prop). No second implementation of the page for preview. Changing a setting updates the preview at once, without saving.

### Editor

Owner console page `/admin/creators/<id>/page` (owner only; there is no creator-facing editor). The owner opens it from a creator's detail page, where an "Edit tip page" link appears once the creator's switch is on. Three panels: block list (drag to reorder, eye to hide), the live preview (clicking a piece selects its block), settings for the selected block. Phone/laptop toggle, Publish, Restore previous, Reset to default, unsaved-changes warning. Keyboard-operable reorder (move up/down buttons) as well as dragging (accessibility). Mobile editing is not a goal for the first version (my call); the page shows "open on a laptop" on narrow screens.

Every publish, restore and reset is audited with the creator it was for. A creator whose switch is on sees a short note on their dashboard ("Your custom tip page is set up by Freetip; ask through the contact form to change it") and, once the meter is on, the OBS link for it beside their other overlay links; nothing else.

### Assets

An asset library per creator under a new Blob prefix (for example `page/<creatorId>/`), reusing the upload route pattern, the first-bytes check and `isOwnBlobUrl`. Kinds: image (PNG, JPEG, WebP), GIF, looping video (WebM; MP4 is a question for the builder because of browser support and size). Per-file and per-creator size caps are set in code (starting points, my call: image 3 MB, video 8 MB, 10 assets). Replace keeps the asset id, so every block using it updates. Remove is refused while a published block uses it (or it falls back to the default).

Animated backgrounds: the video is muted, looping, `playsinline`, lazy and starts only on a connection that is not in data-saver mode. A still first frame (poster) is stored with it. Under `prefers-reduced-motion`, and on very small or slow devices, only the poster shows. A static image is always offered as the fallback.

Moderation follows the existing media rule: uploads go live at once, the owner reviews afterwards in `/admin/media` (extended to list page assets) and can take any down; a taken-down asset renders as the default for that block.

### Pressure meter

- The block and an OBS overlay at `/overlay/<token>/pressure` (the existing overlay token pattern; link shown like the other overlays), both reading an existing goal through `loadGoalProgress`. The period is the creator's choice, set where goals are already set on their dashboard: each goal is daily, weekly, monthly or never repeating, restarts on its own clock in the goal's timezone (weeks start Monday), and can carry a shortfall over. A creator has up to 3 goals; the meter follows one goal, which the owner picks in the editor (the first by default) (my call). The meter has no period logic of its own.
- Settings: which goal, the rank words and thresholds (its own ladder, in percent of the goal; see "Decisions added after review"), colours, an optional picture or animation, a "goal reached" celebration, whether to show rupees or only a percent, and whether to show it on the tip page, in OBS, or both.
- Live: the tip page meter and the OBS meter refresh by polling the same way the goal bar does today (5 s in OBS; the tip page polls more slowly, my call), so no new realtime infrastructure.
- It is a separate overlay from the current goal bar, so existing creators' goal bars do not change.

### Switches

New feature keys in `plans.ts`: `pageBuilder` (the editor, assets and blocks) and `pressureMeter` (the meter block and overlay, needs `pageBuilder`). Both off by default, the owner ticks them for `acepressure` first. With `pageBuilder` off, the creator's published document is ignored and the normal page renders (so turning it off works at once, like the other features).

## Decisions added after review (all are the author's calls; the owner may change any)

A fresh reviewer read this document and asked eight questions. None needed the owner, so they are settled here.

1. **Two separate ladders, not one.** The `amount` block's ladder scores the amount a fan is typing: a log scale in rupees from the minimum tip to a configurable top (today ₹5,000, Rookie to Pirate King, `pressureFraction` in `owner-page.ts`). The `pressureMeter` block scores weekly goal progress that other fans already paid: a linear scale, its words attached to percentages of the goal (for example 0, 25, 50, 75, 100). They share the default words but are separate settings, each with its own "top". The earlier "shared or linked" wording is withdrawn.
2. **"Identical to today" for the phase 1 gate.** The page stays server-rendered with its text in the served HTML. The block renderer wraps and reuses the existing components (`TipForm` parts, `CreatorPanel`, `ExtraPicker`, `Owner*`); it does not rewrite them. DOM order and tab order stay as they are. The gate is screenshot comparison of the owner page and a normal creator page at 320, 390 and 1280 px (Playwright, small tolerance), the existing test suite, and a Lighthouse run no worse than before.
3. **One rendering path.** Once phase 1 passes the gate, every creator's tip page renders through blocks, and the `variant` branches in `TipForm.tsx` are deleted. A creator with `pageBuilder` off, or with no published document, gets `defaultPageDoc` (the owner gets `ownerPageDoc`); a stored document is used only while the switch is on. Until the gate passes, the old path stays.
4. **Locked and editable words.** Locked or filled from the real values (never typed by the owner): the message character limit, the minimum tip, any fee or processing-charge wording, "tips are final", the anonymous option and the name field's behaviour, and what the Pay button does. Editable: headings, step titles, placeholders, helper text, button label, tagline, links, sign-off words. The `note` block cannot change limits or the anonymous option.
5. **Goal reached and no goal.** With no goal, or the switch off, the meter block is hidden on the page and the OBS overlay shows nothing. When the goal is reached the bar stays full with a "goal reached" moment, and the goal's own period (the creator's choice: daily, weekly, monthly or never) starts it again from empty through the existing reset. Words such as "this week" on the meter follow the goal's period. A stretch goal is a later idea, not in phase 4.
6. **Public meter data.** The tip page reads a new read-only public endpoint that returns only the goal's title, target and raised amount (or only a percent when the owner chooses), rate-limited, polled every 30 seconds. The owner asked for a meter every fan sees, so showing the weekly total is the intent. Nothing else from the goal engine is exposed.
7. **Video.** WebM first; MP4 only if Safari needs it. The poster is the first frame, made in the browser when the file is uploaded and stored with it. Only the poster shows when `prefers-reduced-motion` is set, when the browser reports data-saver mode or a 2G or 3G connection, or when device memory is 2 GB or less. A video background starts after the page has loaded, never blocking first paint.
8. **One editor.** Only the owner edits, so there is one draft per creator and no editing conflict between a creator and the owner. A cheap safeguard stays (the draft carries a version number, so a second open tab cannot silently overwrite the first). Uploads to the asset library are owner-only, which also means the first-bytes check and size caps run once, on the owner's side; `/admin/media` still lists and can take down every page asset.

## Phases (each one shippable and checked on its own)

1. **Foundation.** Page document, parser, `defaultPageDoc` and `ownerPageDoc`, the block renderer replacing the `variant` branches in `TipForm.tsx`, migration for the three columns, the feature switch, publish and restore actions. Gate: the owner page and a normal creator page look identical to today (visual and test comparison), and tests cover bad documents falling back.
2. **Editor (owner console only).** Block list with reorder, settings panel, live preview, show/hide, rank ladder and text editing, contrast check, reset, the "Edit tip page" link and the creator's dashboard note.
3. **Assets.** Library, upload, replace, remove, poster and reduced-motion handling, `/admin/media` listing and take-down.
4. **Pressure meter.** Block, OBS overlay, settings, goal-reached moment.
5. **Later.** OBS overlays (alert, goal) in the same builder; copy a page as a template to another creator.

## What the owner does to test (after each phase)

Run the migration BEFORE the deploy, tick the switches for `acepressure`, open the editor on a laptop, change a word and a colour, check the preview, publish, open the page on a phone, then restore the previous version. Nothing from the alert studio or the owner page has been seen in a real browser or OBS yet, so expect adjustments.

## Risks and honest limits

- Rebuilding the owner page from a document is the riskiest step: a regression would hit the one live page. Mitigation: the phase 1 identical-output gate and a one-click reset.
- Looping video costs bandwidth and battery. Mitigation: size caps, poster, reduced-motion and data-saver handling. The owner should expect AI-generated clips to need compressing before upload.
- "Editable everything" means more ways to make an unreadable page. Mitigation: contrast check on text colours, a visible Reset, and the previous version one click away. It cannot stop all bad taste.
- A small goal (for example ₹1,000) fills fast on a busy period; the celebration and carry-over exist for that, and a stretch goal is a later idea.
- Done-for-you means every change a creator wants is the owner's work. If requests pile up, a self-serve tier (with the same editor, creator-facing, behind its own switch) can be designed later; the block model does not prevent it.

## Left to the builder

Exact section names and the drag library; the document version number scheme; how the editor preview frame isolates styles; MP4 support; the CSS for protected blocks; how `/admin/media` lists page assets; the test and visual-comparison tooling; names of the audit events.

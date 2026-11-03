# Page builder phase 5 (part two): OBS overlays in the owner's editor

Status: BUILT 2026-11-03 (the owner said "proceed with what you think is right"). See "What was built, and what changed from the proposal" at the end. Spec: `docs/specs/2026-11-03-page-builder-design.md` ("Later" list). Effort for the build: (owner's choice, 2026-11-03); a read-only review of the finished work with an independent review is suggested at the end, as in phase 4.

The owner asked for a plan instead of questions, so every choice below is our call and the owner may change any of them.

## Why, and what the code looks like today

The owner wants to change how a creator's stream looks (the donation alert and the goal bar) from the owner console, with a live preview and an undo, without asking a developer, as with the tip page.

What exists now:

- **Alert settings already exist and are creator-run.** Text and colours (`users.alert_text`), animations and timing (`alert_motion`), volume and picture side (`alert_layout`), theme and font (`overlay_theme`, `overlay_font`), rules and variations by tip size (tables `alert_rules`, `alert_variations`) and custom alert media. Each has its own paid switch in `plans.ts`, a pure parser (`src/lib/alert-*.ts`), a creator action (`src/app/actions/alert-*.ts`) and a dashboard page. Every one saves **live**, at once, with no draft and no undo. `alert-extras.ts` reads them all when an alert plays and drops any piece whose switch is off, so a bad or missing value gives the plain card, never a lost alert.
- **The goal bar** (`GoalBar.tsx`, `/overlay/<token>/goal`) has no settings of its own beyond the creator's accent colour. It is free for everyone.
- **The Pressure meter** is already the one overlay in the builder (a block in the page document, polled at `/api/overlay/<token>/pressure`).

## Decision: one source of truth, no second alert editor

A new "overlay document" that also described the alert would disagree with the settings creators already have. So:

1. The owner editor edits the **same columns and tables** the creator pages use, through the **same pure parsers**. The alert looks exactly as it does today, read by the same code.
2. The editor adds what the owner is missing: a **draft, Publish, and Swap with previous version** for overlay settings (the live-stream safety net), and a **live preview** that uses the real overlay code.
3. The only new look is the **goal bar's**, which has nothing today. It is stored as a small checked document and works like the meter's settings.
4. Creators still do not edit their own page or overlays through this editor. Their existing dashboard pages keep working and are not changed.

## Scope

### 1. Draft and publish for overlay settings (migration 0053)

- Migration `0053_overlay_builder.sql` (run BEFORE the deploy; everything still opens without it and says so): on `users`, add `overlay_draft jsonb`, `overlay_previous jsonb` and `goal_bar_style jsonb`. All null by default; null means today's behaviour.
- `overlay_draft` holds the owner's edits in one object: `{ text, motion, layout, theme, font, goalBar }`, each part optional. Nothing in it reaches a stream until Publish.
- **Publish** (one transaction, row locked, owner re-checked): reads each part of the draft back through its existing parser (`parseAlertText`, `parseAlertMotion`, `parseAlertLayout`, theme and font keys, new `parseGoalBarStyle`), writes the live columns, and first copies the live values into `overlay_previous`. A part whose paid switch is off is refused with a message ("switch it on first"), because the overlay would ignore it anyway. One audit row `creator.overlay_published`.
- **Swap with previous version** writes `overlay_previous` back and keeps what was live as the new previous (same behaviour as the tip page). **Revert to published** drops the draft. Autosave with the same compare-and-swap as the page editor (a second tab gets the "changed somewhere else" message).
- Rules and variations by tip size are **not** in draft/publish in this phase (they are rows in their own tables, edited one by one). The editor links to the creator's existing rules and variations screens through the owner's creator-view, or says they are managed there. See "Left out".

### 2. The owner's overlay editor

- New owner-only route `/admin/creators/<id>/overlays` (button "Edit overlays" in the creator console's "Custom tip page" box, shown while `pageBuilder` is on). Same shell as the page editor (`PageEditor.tsx`), tabs: **Alert**, **Goal bar**, **Pressure meter** (a link to the page editor's meter block).
- **Alert tab:** headline, colours, text size and weight, animations and length, picture side and master volume, theme and font. The fields are the ones the creator dashboard has, drawn from the same field tables so wording and limits cannot drift. Colour contrast uses `colourProblem` against the card the colours sit on.
- **Goal bar tab:** heading, bar colour (contrast-checked like the meter's), rupees or percent only, "goal reached" moment on or off, which goal(s) to show, and an optional picture from the creator's `page_assets` library (new asset use `goalbar`, picture or GIF, same Remove and Replace rules as the banner and meter picture). Stored in `goal_bar_style`.
- **Live preview:** a frame that loads the real overlay stage (`AlertStage` with a fake queue, `GoalBar` with a fake reading) on a transparent-over-checker or a chosen stream-colour ground, in landscape 1080p and vertical canvases, fed the draft by `postMessage` like `/page-preview/<id>`. A **Test alert** button plays a sample alert (small, big, with message, with picture side) **in the preview only**; it never sends anything to the creator's real OBS and never touches the tips table.

### 3. Reading the goal bar's new style

- `GoalBar` and `/api/overlay/<token>/goal` read `goal_bar_style` only while `pageBuilder` is on and the value parses; anything else is today's bar, pixel for pixel. The numbers still come from `loadGoalProgress`. A picture follows the tip page's motion rules (still first, a GIF's first frame under reduced motion).
- The alert needs **no change** in how it reads settings; Publish writes the columns it already reads. This is the main safety argument: the live alert code path is untouched.

### 4. Copy as a template

- The existing "Copy another creator's page" copies the page draft only. Extend it to also copy the other creator's published overlay settings (the live columns, resolved through the parsers) into this creator's **overlay draft**, with pictures and goal picks removed (as `asTemplate` does for the page). Same audit row pattern. Switches on the target decide what Publish accepts.

## Safety rules (live streams)

- A bad or half-written draft never reaches a stream: Publish parses everything again and refuses the whole publish on one failure, writing nothing.
- A setting whose switch is off is never written live.
- Alerts keep playing through any failure of the goal bar style, the picture or the new columns (missing column before migration 0053 means plain bar; the alert is not touched at all).
- The goal-bar picture is `page_assets`, so the take-down list in `/admin/media` and the 'Remove is refused while a stored page uses it' rule include it (`usedAssetIds` learns the overlay places).
- No fan-visible or creator-visible plan or price text anywhere.

## Tasks, in order

1. Migration 0053 and `goal-bar-style.ts` (types, parser, defaults, contrast rule, field table), pure tests.
2. Overlay draft store (`overlay-doc/store.ts`): load, autosave with compare-and-swap, publish, swap, revert; audit rows; in-memory Postgres tests (publish writes the live columns, previous kept, a switch off refuses, a bad part refuses everything, double publish refused, missing column answer).
3. `goalbar` asset use in `assets.ts` and `usedAssetIds` / `replaceAssetId`; tests.
4. `GoalBar` and its API read the style; browser specs for the plain bar unchanged (a pixel check against today's bar) and the styled bar at 320, 1080p and vertical.
5. The editor route, tabs and preview frame (reusing `PageEditor` pieces); owner re-check on every server action.
6. Test alert in the preview; browser specs for the editor and the preview, including that Test alert makes no request that writes.
7. Copy-as-template extension and tests.
8. Docs in the same commit as the code: `OPERATIONS.md` 7g item 12 (migration 0053, steps), `docs/owner-try-list.md` (not-yet-seen checks as `- [ ]` items, never ticked), `PROGRESS.md`, the `docs/next-steps.md` next steps.
9. Lint, type check, production build, the logic suite, the page, editor, meter and new browser specs. Then a read-only review (an independent review is suggested here, not for the build), and its fixes.

## Left out on purpose

- Rules and variations by tip size, custom alert media and the soundboard inside draft/publish (separate tables; later if the owner wants them in the same undo).
- A free-form alert layout (blocks moved around inside the alert card). The alert's shape stays the one `AlertStage` draws; the owner changes its look through the existing settings.
- A picture or video **inside the alert card** from the page library (custom alert media already does this for the alert; unifying the two libraries is a bigger, separate job).
- The other overlays (streak, top supporter, recent supporters, pinned message).
- Letting creators edit overlays in their own dashboard through the editor.
- A picture on the OBS Pressure meter (can be added with the goal bar picture since they share the code; the plan keeps it out unless the owner asks, to keep this phase's size down).

## Not verifiable here (goes to the owner's try list)

Real OBS (browser source on a real scene, the vertical canvas, a real GIF in the goal bar), the editor with a real login against Neon, migration 0053 against Neon, a real tip while a draft is open (it must keep playing with the live settings), the preview in a real phone-size browser.

## What was built, and what changed from the proposal

Built as proposed: migration `0053_overlay_builder.sql` (`overlay_draft`, `overlay_previous`, `goal_bar_style`); `src/lib/overlay-doc/` (`goal-bar-style.ts`, `draft.ts`, `store.ts`, `goal-api.ts`); the owner-only editor at `/admin/creators/<id>/overlays` with an Alert tab and a Goal bar tab, a draft that autosaves with a compare-and-swap, Publish, Swap with previous version, Revert to live; the preview made of the real `AlertStage` and `GoalBar` with made-up tips (a Test alert button that works in the editor only); `GoalBar` and `/api/overlay/<token>/goal` reading the style; the "Edit overlays" link in the console box; actions in `src/app/actions/overlay-doc.ts`; a test-only fixture at `/dev-fixtures/overlays`. The alert code (`AlertStage`, `alert-extras.ts`) was **not** changed in how it reads settings.

Changed from the proposal (our calls, the owner may change any):

- **A part whose paid switch is off is skipped and named, not refused.** Publish still writes the other parts. (Refusing the whole Publish for a greyed-out field the editor would not let you change seemed worse.)
- **No picture on the goal bar in this phase.** It would have tied the goal bar into the asset library (`usedAssetIds`, Remove refusal, Replace) and the take-down list; it stays a later step. The goal bar's look is a bar colour, rupees or percent only, and the goal-reached moment.
- **Copy-as-template for overlay settings is not built.** The existing "Copy another creator's page" still copies the page only.
- **Which goals the bar shows is not a setting** (it still shows every goal, up to three).
- **Publish refuses a draft that changes nothing**, and a draft with a part that does not pass the creator's own rules; neither writes anything.
- The goal API's answer moved into `src/lib/overlay-doc/goal-api.ts` so it can be tested against the real schema; with "percent only" it sends no rupee figure at all.

Checks: `test/overlay-builder.spec.ts` (31 logic specs: the goal bar style rules, the draft, Publish, Swap, the goal answer including a missing column) and `test/overlay-editor.spec.ts` (14 browser specs, installed Chrome); lint, type check and the production build pass; the existing goal bar browser specs still pass.

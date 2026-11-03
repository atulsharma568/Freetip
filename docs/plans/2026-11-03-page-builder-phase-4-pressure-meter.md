# Page builder, phase 4 (Pressure meter) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A creator's chosen goal (daily, weekly, monthly or never repeating) shows as a "Pressure meter": a block on the tip page that every fan sees, and an OBS overlay at `/overlay/<token>/pressure`. The owner adds it from the page editor and picks the goal, the words, the colour and whether rupees show. Nothing changes on any page until the owner switches it on for a creator and publishes.

**Architecture:** The meter has no period or money logic of its own. It reads `loadGoalProgress` (the goal engine behind the goal bar) for one goal and turns it into a small result: percent, the rank word, reached or not, and rupee figures only when the owner allows them. The block is a new `pressureMeter` type in the page document (settings live in the stored jsonb, so **there is no migration**). The tip page draws the first reading in the served HTML and then polls a small public, read-only endpoint; the OBS page polls a token endpoint like the goal bar. The two share one pure module for choosing the goal and shaping the reading.

**Tech Stack:** Next.js 16 App Router (breaking changes: read the docs), React 19, TypeScript, Tailwind 4, `postgres`, Playwright (also the unit runner), PGlite for database specs.

**Spec:** `docs/specs/2026-11-03-page-builder-design.md` ("Pressure meter", decisions 1, 5, 6, phase 4). **Earlier plans:** phases 1 to 3 in this folder; `PROGRESS.md`.

## Global Constraints

- Before writing Next.js code, read the relevant guides in `node_modules/next/dist/docs/01-app/` (route handlers, client components) (`GUIDELINES.md`).
- Payment code is not touched. The meter is never protected, can be hidden, and the page stays payable and readable with it absent, hidden, failing to load or empty.
- The phase 1 gate still passes untouched: default pages (and the owner page) contain no meter, so they stay pixel-identical (320, 390, 1280 px), same tab order, same served text. The new block is added only by the owner, from the editor.
- A bad stored value renders the normal page, never a broken one. The parser stays lenient and never throws. A goal id that is not the creator's own, or no longer exists, falls back to the creator's first goal; no goals means no meter.
- The public endpoint exposes only what the spec allows: the goal's title, its repeat kind, and the raised and target amounts (or only a percent when the owner chose that). With "percent only", the rupee figures must not be in the response at all, not merely hidden on screen.
- Both switches are checked on the server, every time: `pageBuilder` and `pressureMeter`. A hidden button is not a lock. Switching either off removes the meter from the page and the overlay at once (the overlay shows nothing, the page endpoint answers 404).
- The OBS overlay and the tip page endpoint are rate-limited and read-only; they never write.
- Public repo: no secrets, no company details. `package-lock.json` only references `https://registry.npmjs.org/`. No plan or price on the public site.
- Commits: unsigned, as the owner's GitHub no-reply identity, with NO `Co-Authored-By` line (owner rule). Before pushing, `git log -1 --format=%B | grep -ci co-authored` must print `0`. Never force-push, never bypass hooks. Update `PROGRESS.md`, `OPERATIONS.md` (7g, new steps for the meter), `docs/owner-try-list.md` and the `docs/next-steps.md` next steps in the same commit as the last task. Push to `main` only when lint, type check, build and the specs pass.
- Run unit-style specs with `npx playwright test -c playwright.unit.config.ts test/<file>.spec.ts`. Browser specs: `npx playwright test --project=chromium-desktop test/<file>.spec.ts` (see `GUIDELINES.md` section 5 if Chromium is missing).

## Decisions made in this plan (the owner may change any)

1. **No migration.** The document is jsonb and the goals already exist. The owner has nothing to run before the deploy for this phase.
2. **One new block type, `pressureMeter`, in the left column** (`side`), after the header and links and before the alert preview. It is **not in any default document**: the owner adds it from the editor ("Add a Pressure meter"), like the backdrop. A creator whose published page has none shows none.
3. **Settings:** `goal` (a goal id, or none = the first goal), `levels` (the rank words, as percent of the goal), `show` (`"rupees"` or `"percent"`), `where` (`"both"`, `"page"` or `"obs"`), `celebrate` (on or off), `fill` (a bar colour, or none = the page accent), `heading` (a short word above the bar, standard "Pressure"). Defaults: the One Piece words, rupees shown, both places, celebration on, accent colour.
4. **The rank words are a second, separate ladder** (spec decision 1): linear, in percent, default from `ONE_PIECE_LADDER.levels` (25, 50, 75, 95, 100). A bar at 100% shows the last word, "Pirate King" by default. The amount block's ladder is untouched.
5. **A picture or animation on the meter is left out of this phase.** The spec lists it; the cost is one more asset kind in the picker and a motion rule inside a small component. It is a later add (phase 5 or on request). **Deviation from the spec: tell the owner.**
6. **Words follow the goal's period.** The text under the heading reads "today", "this week", "this month" or nothing (never repeating), taken from the goal's repeat kind, never typed. A goal carrying a shortfall shows "includes ₹X carried over" (same as the goal bar) when rupees are shown.
7. **Percent only** hides every rupee figure, the carry-over note and the "of ₹X" part on the page and in OBS, and the server leaves the figures out of the response.
8. **The goal-reached moment.** On the tip page: the bar stays full, the heading line says "Goal reached", no motion beyond a colour change (and none under reduced motion). In OBS: a one-off flash when the overlay watches the bar cross 100 (as the goal bar does), not when it loads already full. The goal's own period restarts it from empty.
9. **Polling.** Tip page every 30 seconds, only while the tab is visible, stopped in the editor preview. OBS every 5 seconds, and once a minute after a 404 (as the goal bar does).
10. **The public endpoint is `GET /api/pressure/<handle>`**, 404 unless both switches are on and the published page has a visible meter set to show on the page; short shared cache (10 seconds) and a small in-memory per-network limit (60 a minute) as a backstop. Changed while building: the plan first said to use the hourly limiter the contact form uses, but that limiter writes a database row per call, which a poll must not do; the edge cache is the main protection.
11. **The OBS link is the alert link plus `/pressure`** (the secret is not stored in plain text, so it cannot be shown again; the dashboard says how to make it, as for the streak, top and recent overlays). The overlay follows the **published** page's meter settings, so Publish also changes OBS. It shows nothing when the meter is hidden, set to "page" only, or either switch is off.
12. **The editor preview shows the creator's real current reading**, loaded once with the page (no polling), so the owner sees the real bar and words. With no goal it shows a note ("This creator has no goal yet") instead of a bar.

## Review Focus

Most likely first. Each has a test in the task named.

1. A stored `goal` id of another creator's goal, a deleted goal, a string, a negative number. Expect the first goal of this creator, or nothing; never another creator's numbers. (Tasks 1, 2)
2. "Percent only": the JSON of both endpoints and the served HTML must not contain the raised or target amount. (Tasks 2, 3, 4)
3. A switch off, a hidden block, `where` set to the other place, no goal: the page, the endpoint and the overlay all stay empty or 404, and the tip page still pays. (Tasks 3, 4, 5)
4. Period edges: a daily goal just after its midnight, a weekly goal on Monday in the goal's own timezone, a goal reached then the period turns over, carry-over making the target larger. The meter must agree with the goal bar for the same goal at the same moment. (Task 2)
5. Phase 1 gate regression: default and owner pages unchanged, no extra query, no meter markup when the block is absent. (Task 4)
6. A busy fan page: many fans polling must not become many goal queries; shared cache and the rate limit. (Task 3)
7. Layout: a long goal title, a long word, 320 px, large numbers (₹1,00,00,000), reduced motion, forced colours. (Tasks 4, 5)
8. Colour: a bar colour the owner picks must show against the page ground (3 to 1), as the page accent is checked; otherwise refused with a reason. (Tasks 1, 6)

## File Structure

**New**
- `src/lib/page-doc/pressure.ts`: pure rules and shaping: pick the goal, percent, rank word, period wording, reading for the page and for OBS (rupees left out when percent only). Database half reads through `loadGoalProgress`. No site imports; runs on PGlite.
- `src/app/api/pressure/[handle]/route.ts`: the public reading for the tip page.
- `src/app/api/overlay/[token]/pressure/route.ts`: the reading and settings for OBS.
- `src/app/overlay/[token]/pressure/page.tsx`: the OBS page (transparent, secret link).
- `src/components/tip/blocks/PressureBlock.tsx`: the tip page block (client, polling).
- `src/components/overlay/PressureBar.tsx`: the OBS component.
- `src/app/admin/creators/[id]/page/MeterSettings.tsx`: goal picker, words, switches, colour (reuses `LadderEditor` in percent mode).
- Specs: `test/pressure.spec.ts` (pure and PGlite), `test/pressure-routes.spec.ts`, additions to `test/page-doc.spec.ts`, `test/page-doc-edit.spec.ts`, `test/page-editor.spec.ts`.

**Modified**
- `src/lib/plans.ts`: feature key `pressureMeter`.
- `src/lib/page-doc/types.ts`, `blocks.ts`, `parse.ts`, `edit.ts`, `fields.ts`, `store.ts` (switch check on publish), `ladder.ts` (share the levels check).
- `src/app/[handle]/tip-page-data.ts` and `TipPageView.tsx`: the first reading rides with the page data, only when the block is present and visible.
- `src/components/tip/blocks/PageLayout.tsx`: draw the new block in `side`.
- `src/app/admin/creators/[id]/page/BlockList.tsx`, `BlockSettings.tsx`, `PageEditor.tsx`, `page.tsx`: add the block, edit it, pass the creator's goals.
- `src/app/dashboard/OverlayTile.tsx` (or where the streak hint lives): one line about the `/pressure` link when the switch is on.
- `OPERATIONS.md` (7g), `PROGRESS.md`, `docs/owner-try-list.md`, `docs/next-steps.md` next steps.

## Tasks

### Task 1: the switch, the block type and the parser
- [ ] `plans.ts`: add `pressureMeter` ("Pressure meter", group "Tip page", built, description says it needs "Custom tip page" and that it draws a goal as a bar on the tip page and in OBS).
- [ ] Types: `SettingsByType.pressureMeter` (decision 3); `BlockType` gains `pressureMeter`; `ALLOWED_SLOTS` (`side` only), `BLOCK_LABELS` ("Pressure meter"), `LIMITS` (heading 16, levels as the ladder), `defaultSettings`.
- [ ] Parser: `goal` a positive whole number or none; `levels` through the same check as the ladder's levels (factor `parseLevels` out of `parseLadder`; bad words drop to the default with a note); `show`, `where` any other value falls back to the default; `fill` a valid `#rrggbb` that passes 3:1 on the page ground or dropped with a note; `heading` text within the limit. Not protected; a document without it is valid and unchanged byte for byte.
- [ ] Failing specs first: bad goal ids, bad levels (out of order, not ending at 1, empty names), bad colour, unknown `show` or `where`, default documents unchanged, a stored document from phase 3 still parses to the same result.
- [ ] Run `test/page-doc.spec.ts`, `test/page-doc-fields.spec.ts` and the phase 1 to 3 specs: all still pass.

### Task 2: the reading (pure plus database)
- [ ] `pressure.ts`: `pickGoal(progress, goalId)` (the matching goal of this creator, else the first, else null); `meterReading(goal, settings, now)` gives percent (whole, 0 to 100, via `goalPercent`), the rank word (`ladderLevel` on the fraction against `levels`), `reached`, `periodWord`, and, only when `show` is rupees, `raisedPaise`, `targetPaise` (the effective target) and `carryPaise`.
- [ ] `loadMeterReading(db, creatorId, settings)`: calls `loadGoalProgress`, picks, shapes. No goals gives null.
- [ ] Specs (PGlite): period edges and carry-over agree with `loadGoalProgress`; another creator's goal id is ignored; percent-only reading has no rupee keys; a reached goal shows the last word and `reached`; a raised amount over the target stays at 100.

### Task 3: the two endpoints
- [ ] `GET /api/pressure/<handle>`: validate the handle, read the published document (only while both switches are on), find a visible meter with `where` of `both` or `page`, return the reading with `Cache-Control: public, s-maxage=10`; 404 otherwise; small in-memory per-network limit (`src/lib/window-limit.ts`); 503 with a logged error if the database fails.
- [ ] `GET /api/overlay/<token>/pressure`: token pattern check and hash lookup as the goal route does; same document read; needs `where` of `both` or `obs`; returns the reading plus the settings OBS needs (levels, heading, `fill`, `celebrate`, `show`); `Cache-Control: no-store`; 404 for no meter.
- [ ] Specs: both switches off, one off, block hidden, `where` the other way, no goal, percent-only (no amount anywhere in the body), bad token, rate limit hit, a database error. The tip page endpoint never returns the settings of another creator.

### Task 4: the tip page block
- [ ] `loadTipPageData`: when the document has a visible meter set to show on the page and both switches are on, read the first reading with the page (one `loadGoalProgress`); otherwise no extra query. Failures are logged and the meter is left out.
- [ ] `PressureBlock.tsx`: heading line (with the period word and "Goal reached"), the bar (`role="progressbar"` with label and value), the rank word, the figures when `show` is rupees, the carry-over note; polls the endpoint every 30 s while the tab is visible; not in `previewMode` or `editing`; keeps the last reading on a network error; hides itself on a 404. The first reading is in the served HTML.
- [ ] `PageLayout.tsx`: draw it in `side` in its stored order, with the same `enter` wrapper pattern and `blockAttrs` so the editor can pick it.
- [ ] Specs (browser): the bar and word in the served HTML, percent-only page has no rupee text, reduced motion, 320 px with a long title and large figures, tab order unchanged, default and owner pages unchanged (existing screenshot comparison).

### Task 5: the OBS overlay
- [ ] `/overlay/<token>/pressure/page.tsx` as the goal page does (transparent, `noindex`, `no-referrer`, accent from `getOverlayAccent`); `PressureBar.tsx` polls the token endpoint every 5 s (60 s after a 404), draws the same bar and words, flashes once when it watches the bar cross 100, shows nothing with no reading, keeps the last bar on a network blip.
- [ ] Reuse `panel.tsx`, `stage.ts`, `vars.ts` (the stage handles 1080p, 2K and vertical as the other overlays do).
- [ ] Specs (browser): empty with no reading; the flash only on a crossing; percent-only draws no rupees; vertical stage.

### Task 6: the editor
- [ ] Block list: replace the one-off "add backdrop" button with a small "Add a block" list that offers the backdrop and the Pressure meter when the creator's `pressureMeter` switch is on and the block is not already there. Adding goes through `edit.ts` (`addBlock`), a pure change that returns problems like the others; hide, move and remove work as for other blocks (the meter is not protected).
- [ ] `MeterSettings.tsx`: goal picker (the creator's goals by name and period; "the first goal" is the default), rank words in percent (the `LadderEditor` with the rupee top replaced by the fixed 100%), show rupees or percent, where (page, OBS, both), celebration, bar colour (checked as the accent is), heading. The creator's goals are read in the editor's server page and passed down.
- [ ] Publish refuses a document whose meter is set while `pressureMeter` is off (clear message); the existing publish checks stay.
- [ ] The preview shows the real reading (decision 12) and a note when the creator has no goal.
- [ ] Specs: add, remove, edit each setting, refusal with the switch off, goals list for another creator never offered, keyboard operable.

### Task 7: docs and the owner's list
- [ ] `OPERATIONS.md` 7g: new steps (tick the Pressure meter switch beside Custom tip page, add the block in the editor, pick the goal, Publish, make the OBS link by adding `/pressure` to the alert link, what each setting does); no migration to run.
- [ ] `docs/owner-try-list.md`: add `- [ ]` items for what only the owner can see (the meter on a real phone with the goal at 0, 50 and 100%, a real tip moving the bar within 30 s, the OBS source in real OBS at 5 s and the reached flash, percent-only, a daily goal over midnight, a long goal title, reduced motion).
- [ ] `PROGRESS.md` log and `docs/next-steps.md` next steps (phase 4 built; next: the owner tries it; phase 5 later).
- [ ] Run lint, type check, build and all specs. Commit and push as the Global Constraints say.

### Task 8: independent review
- [ ] A fresh reviewer reads the finished diff against the Review Focus list ( as this repo's rules say) and the fixes are made before the last push.

## Open points for the owner (none block the build)

- The meter sits in the left column under the header and links. Say if it should go elsewhere (above the amount box, under the form).
- The picture or animation on the meter is left out (decision 5).
- The goal-reached moment on the page is quiet (colour change and words only). Say if it should do more.

# Page builder, phase 1 (foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every tip page (the owner's and everyone else's) renders from a checked JSON "page document" made of blocks, looks exactly like today, and a stored document can be published, restored and reset, with nothing visible changing until the owner edits.

**Architecture:** A pure `src/lib/page-doc/` module defines the document, one lenient parser that always returns a usable page, the two default documents (today's normal page and today's owner page) and the publish check. `TipForm.tsx` keeps all state and payment code untouched and only its returned JSX moves into block components that read a shared context; a layout component places blocks in sections. A server component `TipPageView` is shared by the real page and a test-only fixture route, so the "identical to today" gate can run without a database. Stored documents (three jsonb columns on `users`, migration 0051) are used only while the new `pageBuilder` switch is on.

**Tech Stack:** Next.js 16 App Router (breaking changes: read the docs), React 19, TypeScript, Tailwind 4, `postgres` driver, Playwright (also the unit runner), PGlite for database specs.

**Spec:** `docs/specs/2026-11-03-page-builder-design.md` (phase 1 and "Decisions added after review" 2, 3, 4).

## Global Constraints

- Before writing any Next.js code, read the relevant guides in `node_modules/next/dist/docs/01-app/` (`01-getting-started/05-server-and-client-components.md`, `02-project-structure.md` for private folders) (`GUIDELINES.md`).
- Payment-critical code in `TipForm.tsx` (Razorpay order, amount, message limit, filters) must not move into editable settings. The state, effects and `handlePay` in `TipForm.tsx` (today lines 1 to 351) stay where they are; only the returned JSX moves.
- A bad stored value must render the default page, never a broken one. Anything invalid is dropped or replaced individually.
- Locked words, never in the document: the message character limit, the minimum tip, any fee or processing-charge wording, "tips are final", the anonymous option and the name field's behaviour, what the Pay button does.
- The gate: the owner page and a normal creator page look identical to today at 320, 390 and 1280 px (Playwright, small tolerance), DOM order and tab order unchanged, page text still in the served HTML, the existing test suite passes, Lighthouse no worse than before.
- The owner page's red `#ca1b19` fails 4.5:1 for small text on black: small text stays white or grey.
- Migrations are run by the owner in Neon BEFORE the deploy. `OPERATIONS.md` and `PROGRESS.md` are updated in the same commit as the migration work. Migration 0050 is the last one; this phase adds 0051. The page must still load when 0051 has not been run (read the new columns apart, in a try).
- Per-creator settings are parsed by a pure function that falls back to the normal value for anything invalid (the `alert_layout` pattern). Paid features are keys in `src/lib/plans.ts`, checked again at render time with `hasFeature`.
- No plan or price anywhere on the public site. The public repo gets no secrets and no company details. No new dependency is needed; `package-lock.json` must only reference `https://registry.npmjs.org/`.
- Commits: unsigned, as the configured owner no-reply identity, with NO `Co-Authored-By` line and no other attribution line (owner rule). Before pushing, `git log -1 --format=%B | grep -ci co-authored` must print `0`. Never force-push, never bypass hooks. Push to `main` once, at the end of Task 8, after lint, `tsc` and `npm run build` pass.
- Run unit-style specs with `npx playwright test -c playwright.unit.config.ts test/<file>.spec.ts`. Browser specs: `npx playwright test --project=chromium-desktop test/<file>.spec.ts` (builds and starts the app on port 3300). If Chromium is not installed, use installed Chrome through a temporary copy of `playwright.config.ts` with `channel: "chrome"` and delete the copy afterwards (`GUIDELINES.md` section 5).

## Decisions made in this plan (the owner may change any)

1. **Sections:** `background`, `side` (the left, sticky column), `main` (the form card), `bottom` (under the card) and `success` (the screen shown after a tip). Phase 1 gives each block type one allowed section; phase 2 widens a table.
2. **`note` contains the extras** (anonymous switch, name, message, pin offer and the soundboard, picks and voice picker, which are one component today). The spec's separate `picks` and `soundboard` blocks wait for phase 2, when the editor needs to reorder them.
3. **A `qr` block is added** (the spec's list omitted the QR tile). **`creatorLinks` attaches to `header`:** directly after it in `side` it shares its wrapper, so spacing stays pixel-identical.
4. **No `assets` field yet** (phase 3 adds it). **`defaultPageDoc()` takes no creator:** every creator-specific value (name, photo, bio, banner) is real data passed to the blocks, not document content.
5. **Parser:** text over its limit is cut, not rejected; a missing or hidden `amount`, `note` or `send` is repaired (appended, visible) at render time, while publishing refuses such a draft.
6. **Nothing writes the draft column in phase 1** (the editor does, in phase 2). Publish exists as a tested store function only; the owner console gets Restore and Reset buttons.
7. **A test-only fixture route** `/dev-fixtures/tip` renders the same `TipPageView` with made-up data. It answers 404 unless `PAGE_FIXTURES=1`, which only the Playwright config sets.
8. **The gate's pixel baseline is local.** Screenshots are captured from today's code into the git-ignored `test-baseline/`; what is committed and runs in CI is text: ARIA snapshots of today's pages.

## Review Focus

Failure modes the spec implies that no feature task would otherwise test, most likely first. Each has a test in the task named.

1. The stored value is not a page at all: a string, an array, a number, `{}`, version 2, jsonb handed back as text, 500 blocks, a megabyte of text. Expect the default page and no throw. (Task 2)
2. A stored document hides or omits the pay blocks. Expect a payable page anyway, and publish refuses. (Tasks 2, 4, 5)
3. The Instagram handle goes into a link. Only `[A-Za-z0-9._]{1,30}` may survive; anything with `/`, spaces, quotes or `javascript:` is dropped. (Tasks 2, 5)
4. The switch is off while a published document exists, or migration 0051 is not run. Expect the normal page, no error. (Task 4)
5. A degenerate rank ladder: top at or below the minimum tip, unsorted or empty levels, `NaN`. Expect no crash and no bar. (Tasks 2, 3)

## File Structure

**New**
- `src/lib/page-doc/types.ts`, `blocks.ts`, `parse.ts`, `ladder.ts`, `defaults.ts`, `theme.ts`, `store.ts`: the document model, all pure except `store.ts` (database half, no site imports so tests run it in memory).
- `db/migrations/0051_page_builder.sql`.
- `src/lib/page-fixtures.ts`: `fixturesEnabled`.
- `src/app/[handle]/TipPageView.tsx`: the server component both the real page and the fixture use.
- `src/app/dev-fixtures/tip/page.tsx`: the test-only route.
- `src/components/tip/TipFormContext.tsx`, `src/components/tip/blocks/*.tsx`: the block layer.
- `src/app/actions/page-doc.ts`, `src/app/admin/creators/[id]/TipPageBox.tsx`: the owner console box.
- Tests: `test/page-doc.spec.ts`, `test/page-doc-store.spec.ts`, `test/page-fixtures.spec.ts`, `test/tip-page-blocks.spec.ts`, `test/gate/tip-page-identical.gate.ts`, `test/snapshots/*.aria.yml`, `playwright.gate.config.ts`.

**Modified**
`src/lib/plans.ts`, `src/lib/owner-page.ts`, `src/app/[handle]/{TipForm,page,creator}.tsx|ts`, `src/components/tip/OwnerExtras.tsx`, `src/app/admin/creators/[id]/page.tsx`, `playwright.config.ts`, `.gitignore`, `test/owner-page.spec.ts`, `OPERATIONS.md`, `PROGRESS.md`, `docs/next-steps.md`.

---

### Task 1: A page that renders without a database, and a baseline of today

The gate needs both pages to render in Playwright, which runs with no database. This task changes no behaviour: it extracts the page's rendering into a shared server component, adds a test-only route that uses it, and records what today's pages look like before anything else is touched.

**Files:**
- Create: `src/lib/page-fixtures.ts`, `src/app/[handle]/TipPageView.tsx`, `src/app/dev-fixtures/tip/page.tsx`, `test/page-fixtures.spec.ts`, `test/tip-page-blocks.spec.ts`, `test/gate/tip-page-identical.gate.ts`, `playwright.gate.config.ts`, `test/snapshots/*.aria.yml`
- Modify: `src/app/[handle]/page.tsx`, `playwright.config.ts` (webServer `env` gets `PAGE_FIXTURES: "1"`), `.gitignore` (add `/test-baseline/`)

**Interfaces:**
- Produces: `fixturesEnabled(env?: NodeJS.ProcessEnv): boolean` in `src/lib/page-fixtures.ts`; `TipPageView({ data }: { data: TipPageData })` where `TipPageData` is exported from `TipPageView.tsx`: `handle, displayName, ownerPage: boolean, accent: string | undefined, themeStyle: Record<string, string> | undefined, pictureUrl, bannerUrl, ytChannelName, ytChannelUrl, minTipPaise, messageMaxChars, bio, alertMode, sounds: TipSound[], rules: TipRule[], voiceMinPaise: number | null, pinOffer: PinOffer | null, previewMode: boolean`. It renders exactly what `page.tsx` lines 83 to 108 render today (`PageShell slim`, the `div.contents` theme wrapper, `OwnerBackdrop` when `ownerPage`, `TipForm`).
- Fixture URL: `/dev-fixtures/tip?page=default|owner&view=form|success`. Later tasks add `&doc=<base64url JSON>`.

- [ ] **Step 1: Read the docs.** Read the two Next.js guides named in Global Constraints, and `src/app/admin/creators/[id]/page.tsx` for the `export const dynamic = "force-dynamic"` usage.

- [ ] **Step 2: Write the failing guard test** `test/page-fixtures.spec.ts`: `fixturesEnabled({ PAGE_FIXTURES: "1" })` is true; false for `{}`, `"0"`, `"true"`, `""`; with no argument it reads `process.env`. Run with the unit config; expect FAIL (module missing).

- [ ] **Step 3: Implement `fixturesEnabled`** (`env.PAGE_FIXTURES === "1"`). Re-run; expect PASS.

- [ ] **Step 4: Extract `TipPageView`.** Move the JSX of `page.tsx` lines 83 to 108 into `TipPageView.tsx` as a server component over `TipPageData`; `page.tsx` builds the data object exactly as today and renders `<TipPageView data={...} />`. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`; all pass, no visible change.

- [ ] **Step 5: Add the fixture route** `src/app/dev-fixtures/tip/page.tsx`: `export const dynamic = "force-dynamic"`, metadata `robots: { index: false }`, `notFound()` unless `fixturesEnabled()`. Made-up data: handle `samplecreator`, name "Sample Creator", `pictureUrl` `/owner/avatar-cutout.webp`, a bio, `bannerUrl` null, three sounds (one above the minimum), two rules (sound only), `voiceMinPaise` 5000, a pin offer, `alertMode` "split", `previewMode` false. `page=owner` sets `ownerPage` true and the owner theme exactly as `page.tsx` does today (`OWNER_ACCENT`, `ownerThemeStyle`, brand `ownerBrand()`). `view=success` renders, inside `PageShell slim` and the same theme wrapper, the success component today's `TipForm` picks (`OwnerSuccess` for the owner page, `SuccessScreen` otherwise) with sample props (₹100, reference `order_sample`). Add `PAGE_FIXTURES: "1"` to the webServer `env` in `playwright.config.ts`.

- [ ] **Step 6: Write the baseline specs, then generate from today's code.**
  - `test/tip-page-blocks.spec.ts` (runs in CI): for `page` in default, owner at widths 1280 and 390, `page.emulateMedia({ reducedMotion: "reduce" })`, open the fixture, wait for fonts and images, take `await page.locator("body").ariaSnapshot()` and expect it to equal the text of `test/snapshots/tip-page-<page>-<width>.aria.yml`; the same for `view=success` at 390 (`tip-success-<page>.aria.yml`). Also, for both pages at 320, 390 and 1440, `document.documentElement.scrollWidth === innerWidth`. A `WRITE_SNAPSHOTS=1` environment variable makes the spec write the yml files instead of comparing.
  - `test/gate/tip-page-identical.gate.ts` with `playwright.gate.config.ts` (`testDir: "./test/gate"`, `testMatch: "*.gate.ts"`, `snapshotPathTemplate: "test-baseline/{arg}{ext}"`, one desktop Chromium project, same `webServer` as the main config but `reuseExistingServer: true`). For default and owner, form view at 320, 390 and 1280 and success view at 390: reduced motion, `animations: "disabled"`, fonts and images loaded, then `toHaveScreenshot(name, { fullPage: true, maxDiffPixelRatio: 0.002 })`; the sequence of focused elements over 60 Tab presses (tag plus accessible name) compared with `toMatchSnapshot("<name>.tabs.json")`; the served HTML from `request.get` contains the display name and the words "Amount", "Your note" and "Send".

- [ ] **Step 7: Generate the baseline.** Run `WRITE_SNAPSHOTS=1 npx playwright test --project=chromium-desktop test/tip-page-blocks.spec.ts` then `npx playwright test -c playwright.gate.config.ts --update-snapshots`. Expect the yml files in `test/snapshots/` and the png and json files in `test-baseline/`. Run the gate again without `--update-snapshots`, twice; expect all PASS both times (proves the harness is deterministic). If a screenshot flickers, fix the cause in the harness (a late image, a font), not by raising the tolerance.

- [ ] **Step 8: Record the performance baseline.** With the fixture server running, run `npx lighthouse` on `/dev-fixtures/tip?page=owner` and `?page=default` (mobile preset, three runs each) and save the median performance and accessibility scores to `test-baseline/lighthouse.txt`. If Lighthouse cannot be fetched, write that in the file; Task 8 then reports it as not verified.

- [ ] **Step 9: Commit** `test/`, `src/`, `playwright*.ts`, `.gitignore` (not `test-baseline/`): `git commit -m "Tip page: shared view, test-only fixture route, baseline of today's pages"`.

---

### Task 2: The page document: types, parser, publish check

**Files:**
- Create: `src/lib/page-doc/types.ts`, `blocks.ts`, `parse.ts`
- Test: `test/page-doc.spec.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `PAGE_DOC_VERSION = 1`; `type Slot = "background" | "side" | "main" | "bottom" | "success"`;
  - `type BlockType = "backdrop" | "header" | "creatorLinks" | "alertPreview" | "qr" | "amount" | "note" | "send" | "strip" | "successScreen"`;
  - `interface Level { upTo: number; name: string }`; `interface Ladder { topRupees: number; levels: Level[] }`;
  - `interface SettingsByType`: `backdrop { style: "ember" }`, `header {}`, `creatorLinks { tagline: string; instagram: string }`, `alertPreview {}`, `qr {}`, `amount { ladder: Ladder | null }`, `note {}`, `send {}`, `strip { left: string; right: string }`, `successScreen { style: "default" | "owner" }`;
  - `type Block<T extends BlockType = BlockType>` (discriminated on `type`: `{ id: string; type: T; visible: boolean; slot: Slot; settings: SettingsByType[T] }`); `interface Theme { accent?: string; ink?: string }`; `interface PageDoc { version: 1; blocks: Block[]; theme: Theme }`.
- Produces (`blocks.ts`): `BLOCK_TYPES: readonly BlockType[]`; `ALLOWED_SLOTS: Record<BlockType, readonly Slot[]>` (first entry is the default; phase 1: backdrop `background`; header, creatorLinks, alertPreview, qr `side`; amount, note, send `main`; strip `bottom`; successScreen `success`); `PROTECTED: readonly BlockType[] = ["amount", "note", "send"]`; `defaultSettings<T extends BlockType>(type: T): SettingsByType[T]` (strings empty, `ladder: null`, styles the first value); `LIMITS = { blocks: 30, raw: 100_000, tagline: 60, strip: 40, levelName: 24, levels: { min: 2, max: 8 }, topRupees: { min: 100, max: 100_000 } }`.
- Produces (`parse.ts`): `interface ParsedPage { doc: PageDoc; repairedProtected: BlockType[] }`; `parsePageDoc(raw: unknown): ParsedPage | null` (null means "not a usable document at all"); `pageDocOrDefault(raw: unknown, fallback: PageDoc): PageDoc`; `validateForPublish(raw: unknown): { ok: true; doc: PageDoc } | { ok: false; message: string }`.

- [ ] **Step 1: Write the failing tests** in `test/page-doc.spec.ts` (a local `minimal` literal holds `amount`, `note`, `send` in `main`; Task 3 adds the real defaults):
  - `null for something that is not a page`: `parsePageDoc` is null for `undefined`, `null`, `5`, `"x"`, `[]`, `"[]"`, `{ version: 1 }` (no blocks), `{ version: 2, blocks: [] }`, and a string over `LIMITS.raw`.
  - `jsonb handed back as text is read`: `parsePageDoc(JSON.stringify(minimal))?.doc` equals `minimal`.
  - `unknown types and a second block of one type are dropped`.
  - `a block in a section it may not use goes to its own section` (a `strip` with `slot: "main"` ends in `bottom`).
  - `at most 30 blocks are read`.
  - `amount, note and send are visible and present`: a draft with `send` hidden and `note` missing parses with both visible, `note` appended to `main`, and `repairedProtected` equal to `["note"]` (hidden-then-forced-visible blocks are listed too).
  - `validateForPublish`: refuses that draft with the message `The amount, note and send blocks must stay on the page.`; refuses `null` with `This draft is not a page.`; accepts a clean one and returns the cleaned `doc`.
  - `colours`: `theme.accent` and `theme.ink` are kept only as lowercase `#rrggbb`; an accent whose contrast against its ink (`contrast` from `src/lib/accent.ts`; ink is `theme.ink` if valid, else `inkFor(accent)`) is under 4.5 is dropped; `#ca1b19` with `#f6f6f1` is kept.
  - `instagram`: `acepressure.gg` kept; `a/b`, `x y`, `javascript:alert(1)`, `"><b>` and a 31-character name become `""`.
  - `text limits`: a 200-character tagline is cut to 60; control characters are removed; a non-string becomes `""`.
  - `ladder`: a valid ladder (2 to 8 levels, `upTo` ascending in (0, 1], last `upTo` exactly 1, names up to 24 characters, `topRupees` 100 to 100000) is kept; unsorted `upTo`, a last `upTo` other than 1, one or nine levels, `topRupees` 99 or `NaN`, or a non-array each give `ladder: null` while the block's other settings survive.
  Run with the unit config; expect FAIL.

- [ ] **Step 2: Implement the three files.** `parse.ts` order: size cap, text-to-object, version check, blocks array, per-block checks (known type, one per type, `visible` boolean defaulting to true, slot from `ALLOWED_SLOTS`, id regenerated as the type name, settings parsed per type with `defaultSettings` for any invalid field), cap at 30, protected repair, theme. `pageDocOrDefault` returns `fallback` for null. Never throw: wrap the whole parse in a try that returns null.

- [ ] **Step 3: Run `test/page-doc.spec.ts`; expect all PASS.** Run `npx tsc --noEmit`.

- [ ] **Step 4: Commit** `git commit -m "Page document: types, lenient parser, publish check"`.

---

### Task 3: Rank ladder and the two default documents

**Files:**
- Create: `src/lib/page-doc/ladder.ts`, `defaults.ts`, `theme.ts`
- Modify: `src/lib/owner-page.ts`, `test/owner-page.spec.ts`, `test/page-doc.spec.ts`

**Interfaces:**
- Consumes: Task 2 types and `parsePageDoc`.
- Produces (`ladder.ts`): `ONE_PIECE_LADDER: Ladder` (top 5000; Rookie 0.25, Supernova 0.5, Warlord 0.75, Yonko 0.95, Pirate King 1); `ladderFraction(amountRupees: number, minRupees: number, topRupees: number): number` (log scale as `pressureFraction` is today: 0 at or below the minimum, 1 at or above the top, never `NaN`; if `topRupees <= minRupees` it returns 1 when `amountRupees >= topRupees` else 0); `ladderLevel(fraction: number, levels: readonly Level[]): string` (the first level whose `upTo` is above the fraction, else the last name).
- Produces (`defaults.ts`): `defaultPageDoc(): PageDoc` and `ownerPageDoc(): PageDoc`, each a fresh copy. Default blocks in order: `header`, `alertPreview`, `qr` (side); `amount` (`ladder: null`), `note`, `send` (main); `successScreen` (success, style `default`); theme `{}`. Owner: the same plus `backdrop` (background), `creatorLinks` (after `header`; tagline `Valorant / Live & Highlights`, instagram `acepressure.gg`), `strip` (bottom; left `YouTube / AcePressure`, right `@acepressure.gg`), `amount.ladder = ONE_PIECE_LADDER`, `successScreen` style `owner`, theme `{ accent: "#ca1b19", ink: "#f6f6f1" }`.
- Produces (`theme.ts`): `themeFor(doc: PageDoc, storedAccent: string | null): { style: Record<string, string> | undefined; accent: string | undefined }`: a doc accent gives `--color-accent` and `--color-ink` (ink from the doc, else `inkFor(accent)`) and that accent; otherwise `accentStyle(storedAccent)` and `safeAccent(storedAccent)` from `src/lib/accent.ts`, which is what the page does today.
- `owner-page.ts` keeps `isOwnerTipPage` and `ownerBrand`. Its other exports (`OWNER_ACCENT`, `OWNER_INK`, `ownerThemeStyle`, `OWNER_COPY`, `pressureFraction`, `pressureLevel`) stay for now but are derived from `ownerPageDoc()` and `ladder.ts`, so the values live in one place; Task 5 deletes them with their last consumer.

- [ ] **Step 1: Write the failing tests.** In `test/page-doc.spec.ts`: both defaults parse to themselves with `repairedProtected` empty; each call returns a fresh copy (mutating one does not change the next); the owner doc has the strings and theme above; `ladderFraction(20, 20, 5000) === 0`, `(5000, 20, 5000) === 1`, `(99999, 20, 5000) === 1`, `(0, 20, 5000) === 0`, `(100, 20, 5000) > (50, 20, 5000)`; degenerate input: `ladderFraction(100, 20, 20) === 1`, `(10, 20, 20) === 0`, `ladderFraction(NaN, 20, 5000) === 0`, `ladderFraction(50, 20, NaN) === 0`; `[0, 0.3, 0.6, 0.9, 1].map(f => ladderLevel(f, ONE_PIECE_LADDER.levels))` equals `["Rookie", "Supernova", "Warlord", "Yonko", "Pirate King"]`; `themeFor` cases for owner doc, default doc with a saved accent (use a hex from `ACCENT_PRESETS`) and a doc accent without ink. In `test/owner-page.spec.ts`, keep the detection and brand tests and point the colour test at `ownerPageDoc().theme`. Run both; expect FAIL.

- [ ] **Step 2: Implement** `ladder.ts`, `defaults.ts`, `theme.ts`, and re-derive the `owner-page.ts` exports. Run both specs and `npx tsc --noEmit`; expect PASS.

- [ ] **Step 3: Commit** `git commit -m "Page document: rank ladder, default and owner documents, theme"`.

---

### Task 4: Storage, the switch, publish and restore

**Files:**
- Create: `db/migrations/0051_page_builder.sql`, `src/lib/page-doc/store.ts`
- Modify: `src/lib/plans.ts`
- Test: `test/page-doc-store.spec.ts`; adjust `test/paid-features.spec.ts` only if it counts features

**Interfaces:**
- Consumes: `parsePageDoc`, `validateForPublish`, `hasFeature`, `LedgerDb` and `Query` from `src/lib/accrual.ts`, `freshDatabase` and `asLedgerDb` from `test/helpers/pg.ts`.
- Produces (`plans.ts`): feature key `pageBuilder`, label "Custom tip page", group "Tip page", `built: true`, description saying the owner edits the page from the owner console, off by default, and a creator never edits it.
- Produces (`store.ts`):
  - `interface PageRow { paid_features: string[] | null; page_published: unknown }`
  - `resolvePageDoc(row: PageRow | null, fallback: PageDoc): PageDoc` (pure: the switch is on and `page_published` parses, else `fallback`)
  - `loadPageRow(db: Query, handle: string): Promise<PageRow | null>` (reads `paid_features` and `page_published` in their own try; any error is logged and returns null)
  - `type PageResult = { ok: true; message: string } | { ok: false; message: string }`
  - `interface PageSummary { switchOn: boolean; hasDraft: boolean; hasPublished: boolean; hasPrevious: boolean }` and `getPageSummary(db: Query, creatorId: number): Promise<PageSummary>`
  - `publishDraft(db: LedgerDb, creatorId: number): Promise<PageResult>`, `restorePrevious(db: LedgerDb, creatorId: number): Promise<PageResult>`, `resetPage(db: LedgerDb, creatorId: number): Promise<PageResult>`.
- Behaviour: `publishDraft` and `restorePrevious` refuse (`ok: false`) when the creator's `pageBuilder` switch is off. Publish runs in a transaction: lock the row `for update`, run `validateForPublish` on `page_draft`, then one statement `update users set page_previous = page_published, page_published = page_draft where id = ...` (the right-hand sides read the old values). Restore swaps `page_published` and `page_previous` in one statement. Reset sets all three columns to null. Each success writes one `audit_events` row in the same transaction with `actor_role 'owner'`, `entity_type 'user'`, `entity_ref` the creator id and `after_json` `{ published, previous }` booleans (bind an object with `::jsonb`, as `src/lib/handle.ts:87` does; the in-memory helper refuses a JSON string): `creator.page_published`, `creator.page_restored`, `creator.page_reset`. A reset when all three are already null returns ok with "Already the normal page." and writes no audit row.

- [ ] **Step 1: Write the migration** `0051_page_builder.sql` in the style of `0047_alert_layout.sql` (header comment saying what each column holds, the code checks every value again at render time, run BEFORE the deploy, safe to re-run): `alter table users add column if not exists page_draft jsonb;` and the same for `page_published` and `page_previous`.

- [ ] **Step 2: Write the failing tests** in `test/page-doc-store.spec.ts` (PGlite via `freshDatabase`, a creator inserted as in `test/paid-features.spec.ts`):
  - the migration runs twice without error and the three columns exist, null for a new creator;
  - `planFeatures({ paid_features: ["pageBuilder"] }).pageBuilder` is true, and `sanitizeFeatureKeys(["pageBuilder"])` keeps it;
  - `resolvePageDoc`: switch off with a valid published doc returns the fallback; switch on with a valid doc returns it; switch on with garbage, with null, and with a doc that hides `send` (repaired, payable) return respectively the fallback, the fallback and the repaired doc;
  - `loadPageRow` after `alter table users drop column page_published` returns null and does not throw (Review Focus 4);
  - publish with no draft returns `There is no draft to publish.`; publish with a draft hiding `send` is refused and `page_published` is unchanged; publish with the switch off is refused; a good draft sets published to the draft and previous to the old published; a second publish makes previous the first published; one audit row per success with the creator id;
  - restore with no previous returns `There is no earlier version to restore.`; with one it swaps, and a second restore swaps back;
  - reset nulls all three and writes `creator.page_reset`; a second reset writes nothing;
  - `getPageSummary` reports the four booleans.
  Run with the unit config; expect FAIL.

- [ ] **Step 3: Implement** the `plans.ts` entry and `store.ts`. Run the store spec, `test/paid-features.spec.ts`, `test/foundation.spec.ts` (it runs every migration) and `npx tsc --noEmit`; expect PASS.

- [ ] **Step 4: Commit** `git commit -m "Page builder: migration 0051, switch, publish and restore store"` (include the `OPERATIONS.md` section 5 note listing 0051 if the file tracks migrations there; the full `OPERATIONS.md` and `PROGRESS.md` text is Task 8).

---

### Task 5: Render the tip page from blocks

The riskiest task: the live pages change how they are built. The gate from Task 1 is the test. Blocks are created first (the app compiles and renders as before), then `TipForm` switches over in one step.

**Files:**
- Create: `src/components/tip/TipFormContext.tsx`, `src/components/tip/blocks/` (`registry.tsx`, `PageLayout.tsx`, `HeaderBlock.tsx`, `CreatorLinksBlock.tsx`, `AlertPreviewBlock.tsx`, `QrBlock.tsx`, `AmountBlock.tsx`, `NoteBlock.tsx`, `SendBlock.tsx`, `StripBlock.tsx`, `BackdropBlock.tsx`, `SuccessBlock.tsx`)
- Modify: `src/app/[handle]/TipForm.tsx`, `TipPageView.tsx`, `page.tsx`, `src/app/dev-fixtures/tip/page.tsx`, `src/components/tip/OwnerExtras.tsx`, `src/lib/owner-page.ts` (delete the legacy exports), `test/owner-page.spec.ts`, `test/tip-page-blocks.spec.ts`

**Interfaces:**
- Consumes: Tasks 2 and 3 (`PageDoc`, `Block<T>`, `defaultPageDoc`, `ownerPageDoc`, `ladderFraction`, `ladderLevel`, `themeFor`).
- Produces:
  - `TipFormState` and `useTipForm(): TipFormState` in `TipFormContext.tsx`: exactly the identifiers today's returned JSX (`TipForm.tsx` lines 382 to 721) reads from `TipForm`'s scope (amount, custom, presets, name, message, extras, pin, phase, errors, `handlePay` and the derived flags such as `amountLocked`, `extraBlocked`, `messageTooLong`), no more. Derived values used by one block only (`digitCount`, `customBelowMin`, the `chip` classes) move into that block.
  - Every block component is `({ block }: { block: Block<"type"> }) => JSX`. `PageLayout({ doc }: { doc: PageDoc })`. `SuccessBlock` additionally takes the success screen's props. `TipForm`'s props lose `variant` and gain `doc: PageDoc` (required); `TipPageData` loses `ownerPage` and gains `doc: PageDoc` and `storedAccent: string | null`, and `TipPageView` calls `themeFor` itself, so the real page and the fixture share it.
- Rendering rules (they reproduce today's DOM; do not "improve" them):
  1. `TipForm` keeps the root `div ref={containerRef}` and the preview banner; `PageLayout` renders the grid and what follows it. `TipPageView` renders `BackdropBlock` before `TipForm`, inside the theme wrapper, when the doc has a visible `backdrop` block (as `page.tsx` placed `OwnerBackdrop` today), so the success phase keeps the backdrop.
  2. A block with `visible: false` renders nothing.
  3. `side` renders inside `div.contents.lg:sticky.lg:top-24.lg:block.lg:space-y-8`: the `header` block in `div.enter.space-y-5` with entrance step 0, and a `creatorLinks` block directly after it inside that same wrapper (otherwise in its own `div.enter` step 0); `alertPreview` as `section.enter.hidden.lg:block.space-y-3` with `aria-label="Alert preview"`, step 2; `qr` in `div.enter.hidden.lg:block`, step 3.
  4. `main` is the card `div.enter.space-y-8` (step 1, same classes as today) holding the `sr-only` status paragraph (`role="status"`, the `announce` text) and then `amount`, `note`, `send` in document order. When a visible `alertPreview` exists, its mobile twin (`section.space-y-3.lg:hidden`) is rendered immediately after the `amount` block, as today.
  5. `amount` shows the rank bar when `settings.ladder` is not null: `PressureBar` takes `{ amountRupees, minRupees, ladder }` and uses `ladderFraction` and `ladderLevel`; the hot style at fraction 0.95 stays. `creatorLinks` renders the tagline line only if the tagline is non-empty and the Instagram link only if the handle is non-empty, with the href built as `https://www.instagram.com/${handle}` from the parsed handle alone. `strip` renders `left` and `right` as today's `OwnerStrip` does.
  6. `TipForm`'s `phase === "success"` branch renders `SuccessBlock` using the doc's `successScreen` block (default style if absent): `OwnerSuccess` for style `owner`, `SuccessScreen` otherwise.
  7. Block components that use the context or hooks start with `"use client"`, like the existing tip components.

- [ ] **Step 1: Write the failing tests** (they need `&doc=<base64url JSON>` in the fixture, which does not exist yet) in `test/tip-page-blocks.spec.ts`, all driven through the fixture at 1280 px unless stated, helper `docUrl(doc)` encoding a doc:
  - `the default page renders from the default document`: no `doc` parameter still matches the committed ARIA snapshots (already passing; it keeps passing).
  - `hiding the QR block removes the QR tile`; `a different strip text is shown on the owner page`; `a custom ladder's words appear under the bar when the amount is raised`.
  - `a document that is not a page shows the normal page` (`doc` = base64 of `"nope"`) and matches the default snapshot.
  - `a document that hides send still has a working Pay button`: the `button` named like `Tip ₹` is visible and enabled.
  - `the Instagram link is built from the handle only`: with `instagram: "a/b"` there is no link to `instagram.com`; with `acepressure.gg` the href is exactly `https://www.instagram.com/acepressure.gg`.
  - `DOM order and tab order of the owner page match today`: covered by the ARIA snapshots and the gate.
  Run `npx playwright test --project=chromium-desktop test/tip-page-blocks.spec.ts`; expect the new tests to FAIL.

- [ ] **Step 2: Create the context and the block components** (additive; nothing uses them yet). Move each region of today's JSX verbatim into its block: header (`CreatorPanel` call), `creatorLinks` (`OwnerLinks`), `alertPreview` (the `preview` fragment), `qr` (`QrTile`), `amount` (JSX of step "01 Amount" including the `onClickCapture` wrapper), `note` (step "02 Your note" including the pin offer and `ExtraPicker`), `send` (step "03 Send"), `strip`, `backdrop` (`OwnerBackdrop`), `success`. Build `PageLayout` and `registry.tsx` per the rules. Run `npx tsc --noEmit` and `npm run lint`; expect clean.

- [ ] **Step 3: Switch over in one change.** In `TipForm.tsx` replace the returned JSX with `<TipFormContext.Provider value={state}>` plus `PageLayout`, swap `variant` for `doc`, and pick the success block from the doc. `TipPageView` and `page.tsx` pass `doc = ownerPage ? ownerPageDoc() : defaultPageDoc()` and `storedAccent`; the fixture decodes `doc` (via `pageDocOrDefault` with the page's default as fallback) and its `view=success` renders `SuccessBlock` instead of the two components it called directly. Delete the legacy exports from `owner-page.ts` and the `variant` branches; fix `test/owner-page.spec.ts`. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`.

- [ ] **Step 4: Run the permanent specs.** `npx playwright test --project=chromium-desktop test/tip-page-blocks.spec.ts test/owner-page.spec.ts`; expect all PASS, including the committed ARIA snapshots from Task 1.

- [ ] **Step 5: Run the gate.** `npx playwright test -c playwright.gate.config.ts`. Expect all PASS (pixels, tab order, served HTML) for the default and owner pages at 320, 390 and 1280 and for both success screens. Any difference is a bug in the block layer: fix the layer, never the tolerance or the baseline. Do not continue until it is green.

- [ ] **Step 6: Run the whole existing browser suite** `npm run test:e2e -- --project=chromium-desktop --project=chromium-mobile`; expect no new failures (known failures from `.env.local` having a `DATABASE_URL` are listed in `PROGRESS.md`).

- [ ] **Step 7: Commit** `git commit -m "Tip page: render every page from blocks, one path, same look"`.

---

### Task 6: The real page uses stored documents

**Files:**
- Modify: `src/app/[handle]/creator.ts`, `src/app/[handle]/page.tsx`

**Interfaces:**
- Consumes: `loadPageRow`, `resolvePageDoc` (Task 4), `defaultPageDoc`, `ownerPageDoc`, `isOwnerTipPage`.
- Produces: `getPageRow(handle: string): Promise<PageRow | null>` in `creator.ts` (`React.cache`, `getDb()` cast with `as unknown as Query` like the other loaders), added to the existing `Promise.all` in `page.tsx`. `page.tsx` passes `doc = resolvePageDoc(row, ownerPage ? ownerPageDoc() : defaultPageDoc())`.

- [ ] **Step 1: Implement** the loader and wiring. `isOwnerTipPage` and `OWNER_TIP_HANDLES` now only choose the fallback document and the brand name. A stored document is used only while the creator's `pageBuilder` switch is on (that is `resolvePageDoc`, already tested in Task 4).

- [ ] **Step 2: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm run build`; then the Task 4 store spec, `test/tip-page-blocks.spec.ts` and the gate again; all PASS. With `DATABASE_URL` empty the page code path takes the default document (the fixture route covers rendering; the real route has no database in tests, a limit written in Task 8).

- [ ] **Step 3: Commit** `git commit -m "Tip page: read the stored page document while the switch is on"`.

---

### Task 7: Owner console box: Restore and Reset

**Files:**
- Create: `src/app/actions/page-doc.ts`, `src/app/admin/creators/[id]/TipPageBox.tsx`
- Modify: `src/app/admin/creators/[id]/page.tsx`

**Interfaces:**
- Consumes: `restorePrevious`, `resetPage`, `getPageSummary` (Task 4), `requireOwner`, `AdminAction` and `AdminActionState` (`src/lib/admin/action-state.ts`), the `refreshCreator` revalidation set from `src/app/actions/admin.ts` (also revalidate the creator's tip page path).
- Produces: server actions `restoreCreatorPage(creatorId: number, _prev: AdminActionState, formData: FormData): Promise<AdminActionState>` and `resetCreatorPage(...)` (same signature), each starting with `await requireOwner()`, checking the id with the same digits test the admin actions use, calling the store function and returning `ok(message)` or the failure message; `TipPageBox({ summary, restoreAction, resetAction })`.

- [ ] **Step 1: Implement** the actions (`"use server"`, only async exports, following `setCreatorFeatures` in `src/app/actions/admin.ts`) and the box. The box sits under "Paid features" and shows: "Custom tip page: on or off" (with a pointer to the Paid features box when off), "Published page: normal, or custom" and, when they apply, a "Restore previous version" button and a "Reset to normal page" button, each behind the existing `ConfirmAction` step and showing `ActionStatus`. There is no publish button and no editor link (phase 2). The page reads the summary through `load("the tip page", ...)` so a missing migration shows "Could not read the tip page settings. Run migration 0051 in Neon." instead of breaking the page.

- [ ] **Step 2: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm run build`. The signed-in owner pages cannot be driven without a login and a database, so these are checked by the owner (Task 8 lists it); the store functions behind them are covered in Task 4.

- [ ] **Step 3: Commit** `git commit -m "Owner console: restore and reset for a creator's tip page"`.

---

### Task 8: Verify, document, ship

**Files:**
- Modify: `OPERATIONS.md`, `PROGRESS.md`, `docs/next-steps.md`

- [ ] **Step 1: Full verification.** Run `npm run lint`, `npx tsc --noEmit`, `npm run build`; the unit run `npx playwright test -c playwright.unit.config.ts test/page-doc.spec.ts test/page-doc-store.spec.ts test/page-fixtures.spec.ts test/owner-page.spec.ts test/paid-features.spec.ts test/foundation.spec.ts`; the browser suite for `chromium-desktop` and `chromium-mobile`; the gate once more. All must pass. Re-run Lighthouse as in Task 1 Step 8 and compare with `test-baseline/lighthouse.txt`: performance and accessibility no worse (a drop of more than 2 points is a failure to fix, not to explain).

- [ ] **Step 2: Update the docs.** `OPERATIONS.md`: a new section after 7f (call it 7g, "The page builder foundation") saying: run migration 0051 in Neon BEFORE the deploy (the page also works without it); the "Custom tip page" switch in `/admin/creators/<id>` (off for everyone; nothing changes until a document is published, and the editor arrives in phase 2); the "Tip page" box with Restore and Reset; `/dev-fixtures/tip` and `PAGE_FIXTURES` are for tests only and must never be set in Vercel; add 0051 to the migration list in section 5 if one exists. `PROGRESS.md`: a new top entry for phase 1 (what is built, files, verified, not verified, owner to do), replacing the "Next: the build plan" line. `docs/next-steps.md`: rewrite the page-builder next-steps item to "phase 1 built 2026-11-03, run migration 0051 BEFORE the deploy; next: the phase 2 build plan (editor)". State plainly what was not verified: the real route against Neon and a real creator row, the owner console box with a real login, the live pages on a real phone and in real OBS, Lighthouse if it could not run.

- [ ] **Step 3: Commit and push.** `git add` the docs, commit `git commit -m "Page builder phase 1: documentation and status"`. Check `git log -3 --format=%B | grep -ci co-authored` prints `0`. `git push origin main`. If a hook or the push fails, stop and report; do not force.

- [ ] **Step 4: Hand over to the owner**, in the final message: run migration 0051 in Neon, deploy, open `freetip.in/acepressure` and a normal creator page on a phone and a laptop and confirm they look the same as before, tick "Custom tip page" for a test creator and look at its box in `/admin/creators/<id>`, and tell what looks different if anything.

# Page builder, phase 2 (the editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner opens `/admin/creators/<id>/page`, edits a creator's tip page (reorder, hide, re-word, rank ladder, colours) with a live preview that is the real page, saves a draft, publishes it, and can put the previous version back or reset, all from a laptop. Fans see nothing different until Publish.

**Architecture:** Phase 1 already draws every tip page from a checked document. Phase 2 adds (a) the words a block may change, as new optional settings where empty means today's wording; (b) pure editing functions and one field table, so the settings panel is generated, not hand-built per block; (c) a draft store with compare-and-swap saving; (d) an owner-only preview route shown in an iframe at phone and laptop width, fed the draft by `postMessage`, rendering the real `TipPageView`; (e) the editor page itself. No new dependency.

**Tech Stack:** Next.js 16 App Router (breaking changes: read the docs), React 19, TypeScript, Tailwind 4, `postgres` driver, Playwright (also the unit runner), PGlite for database specs.

**Spec:** `docs/specs/2026-11-03-page-builder-design.md` (Editor, Live preview, Storage and versions, "Decisions added after review" 4 and 8). **Phase 1 plan and review notes:** `docs/plans/2026-11-03-page-builder-phase-1-foundation.md`, `PROGRESS.md`.

## Global Constraints

- Before writing Next.js code, read the relevant guides in `node_modules/next/dist/docs/01-app/` (server and client components, route handlers, `headers` in `next.config`, forms and server actions) (`GUIDELINES.md`).
- Payment-critical code in `src/app/[handle]/TipForm.tsx` (state, effects, `handlePay`) is not touched. Locked words never become settings: the message character limit, the minimum tip, fee or processing-charge wording, "tips are final", the anonymous option and the name field's behaviour, what the Pay button does, the amount shown on the Pay button.
- A bad stored value must render the default page, never a broken one. The parser stays lenient and never throws.
- The page must always be payable: `amount`, `note` and `send` stay protected (see decision 1 for `header`).
- The phase 1 gate must still pass untouched: with no new setting filled in, the owner page and a normal creator page are pixel-identical (320, 390, 1280 px), tab order and served text unchanged, Lighthouse no worse (owner 84/97, normal 85/97). New settings default to empty, meaning "today's wording".
- The real tip page's DOM must not change for fans: edit-mode attributes (`data-block-id`) exist only in the preview route.
- Owner-only everywhere: every page and action calls `requireOwner()`; every action re-checks the creator's `pageBuilder` switch in the store. A hidden button is not a lock.
- Accessibility of the editor itself: labelled fields, keyboard reorder with up/down buttons (the primary control; dragging is an extra), a polite live region announcing moves, visible focus. Mobile editing is not a goal: under 1024 px show "open this on a laptop".
- Public repo: no secrets, no company details. `package-lock.json` must only reference `https://registry.npmjs.org/`. No plan or price on the public site.
- Migration: **none planned.** The conflict check uses the stored draft itself (decision 4), so the owner has nothing new to run. If Task 4 finds this cannot work, stop and report before adding migration 0052.
- Commits: unsigned, as the owner's GitHub no-reply identity, with NO `Co-Authored-By` line and no other attribution line (owner rule). Before pushing, `git log -1 --format=%B | grep -ci co-authored` must print `0`. Never force-push, never bypass hooks. Update `PROGRESS.md` and `OPERATIONS.md` (7g) in the same commit as the last task. Push to `main` once, at the end of Task 8, after lint, `tsc` and `npm run build` pass.
- Run unit-style specs with `npx playwright test -c playwright.unit.config.ts test/<file>.spec.ts`. Browser specs: `npx playwright test --project=chromium-desktop test/<file>.spec.ts`. If Chromium is not installed, use installed Chrome through a temporary copy of `playwright.config.ts` with `channel: "chrome"` and delete the copy afterwards (`GUIDELINES.md` section 5).

## Decisions made in this plan (the owner may change any)

1. **`header` becomes protected** (cannot be hidden or removed; can move within `side`). Without it a page can lose the creator's name and the page's only `h1`. This answers the phase 1 review question; reversing it is one line in `PROTECTED`. A missing or hidden header is repaired at render and refused at publish, first in `side`.
2. **Reorder inside a section only; no moving between sections yet.** Up/down buttons plus mouse drag within the section, show/hide for the five unprotected types (`backdrop`, `creatorLinks`, `alertPreview`, `qr`, `strip`). Widening `ALLOWED_SLOTS` later is a table edit, but the layout has special cases (the header and its links share a wrapper; the phone alert preview follows `amount`) that moving across sections would have to redo. The phone preview keeps following `amount` wherever it sits.
3. **Words: empty means the standard wording.** New optional text settings (all cut at their limit by the parser, empty by default): `amount.heading` (Amount), `amount.barLabel` (Pressure), `note.heading` (Your note), `note.namePlaceholder`, `note.messagePlaceholder`, `send.heading` (Send), `send.buttonLabel` (Tip; the amount is always appended), `alertPreview.label` (Preview on stream), `successScreen.line` (the small line, "Thanks for hanging out." on the owner style). Locked texts stay in code. The document version stays 1 (additive, the parser fills gaps).
4. **Saving without a migration.** The draft is autosaved to `users.page_draft` about 1.5 s after the last change. A save sends the draft the editor last received (`base`) and the new one; the store updates only `where page_draft is not distinct from base` (jsonb equality), so a second tab or an old tab gets "changed elsewhere, reload" instead of overwriting. A save stores the cleaned document (what the parser returns) and sends it back; the editor re-bases on it. Autosaves are not audited; publish, restore and reset are.
5. **Publish stores the checked document**, not the raw draft, in one statement, and refuses a draft the parser has to repair. Publish is only enabled when the draft is saved (no pending autosave) and differs from the published page.
6. **Parser reports what it changed.** `ParsedPage` gains `notes: string[]` (plain English: "Tagline cut to 60 letters", "Colours dropped: the text on the colour is hard to read"). The editor shows them after a save; they are rare because the editor stops most mistakes as you type.
7. **Colour rule (one pair, two checks).** The page accent and the ink on it: ink on accent at least 4.5:1 (as today) and the accent on the page ground at least 3:1 (it is used for large numerals, fills and focus rings; small text stays white or grey). The owner red `#ca1b19` (about 3.4:1 on the ground) must stay allowed; a test pins that. The editor shows the two ratios live and refuses to apply a failing pair; the parser enforces the same rule.
8. **Preview is an iframe, not an inline copy.** Tailwind's `lg:` breakpoints follow the viewport, so a phone and a laptop view need real viewports. The preview route renders the real `TipPageView` in a client host (decision 9) with `previewMode` on (payment disabled). The laptop view is a 1280 px wide frame scaled down with CSS to fit. It lives at `/page-preview/<id>` (outside `/admin`, to avoid the admin chrome), owner-only, `noindex`, and needs `X-Frame-Options: SAMEORIGIN` for that path only (the whole site sends `DENY` today in `next.config.ts`). Task 5 starts with a spike that settles the two unknowns (decisions 8 and 9) before anything else is built.
9. **Client-side rendering of the preview tree.** The preview host is a client component that holds the document and renders the same tree as `TipPageView`. If `TipPageView` cannot be imported from a client component (a server-only import), split its pure JSX into `TipPageTree.tsx` used by both. The fallback if the spike fails: autosave first, then reload the iframe with the draft read on the server (slower, same result).
10. **Editor is built from a field table.** `src/lib/page-doc/fields.ts` lists, per block type, the editable fields (label, key, max length, standard wording shown as the placeholder). The panel renders from it; the parser, the editor and the tests share its limits. Special editors only for the rank ladder and the colour pair.
11. **No undo stack.** The safety nets are "Revert to published" (throw away the unpublished draft), Restore previous and Reset to normal. Restore stays a swap, but the console says so and shows the time of the last change (read from the audit log, no new column).
12. **Deferred, on purpose:** assets (phase 3), the pressure meter and narrowing the block context (phase 4), the OG image and the creator's own accent ignoring a document colour, folding `getPageRow` into `getCreator`, moving blocks between sections.

## Review Focus

Failure modes the spec implies that no feature task would otherwise test, most likely first. Each has a test in the task named.

1. Two tabs, or an old tab, saving over each other, and a double-clicked Publish or Restore. Expect a conflict message and no lost draft. (Task 4)
2. A draft the editor allowed that the parser then changes (a long word, an odd colour, a ladder out of order). Expect the cleaned document stored and the changes listed, never a silent difference between preview and live. (Tasks 1, 4)
3. The preview receiving a message that is not from the editor, or not a page. Expect it to be ignored (same origin check, parser first). (Task 5)
4. The editor opened for a creator whose switch is off, whose columns are missing (migration 0051 not run), or who has no draft. Expect a clear message or the current published page as the starting draft, never a blank page. (Tasks 4, 6)
5. A reorder that breaks the layout: links separated from the header, the amount last, the phone alert preview following the amount, step numbers 1 2 3 following the visible order. (Tasks 3, 6)
6. A published page with every new word at its limit and no spaces, at 320 px. Expect no sideways scroll. (Task 3)
7. The preview route reachable by anyone who is not the owner, or indexed. (Task 5)

## File Structure

**New**
- `src/lib/page-doc/fields.ts`: the field table (decision 10).
- `src/lib/page-doc/edit.ts`: pure editing functions (move, show/hide, set text, ladder, colours), each returning a new document and a list of problems; no site imports.
- `src/app/page-preview/[id]/page.tsx`, `PreviewHost.tsx`: the owner-only preview route and its client host.
- `src/lib/tip-page-data.ts`: the real route's data loading extracted so the preview shares it (or kept in `creator.ts` if smaller).
- `src/app/admin/creators/[id]/page/page.tsx`, `PageEditor.tsx`, `BlockList.tsx`, `BlockSettings.tsx`, `LadderEditor.tsx`, `ColourEditor.tsx`, `PreviewFrame.tsx`: the editor.
- `src/app/dev-fixtures/editor/page.tsx`: test-only editor with in-memory save and publish (404 unless `PAGE_FIXTURES=1`).
- Tests: `test/page-doc-edit.spec.ts`, `test/page-doc-fields.spec.ts`, `test/page-editor.spec.ts` (browser), additions to `test/page-doc.spec.ts`, `test/page-doc-store.spec.ts`, `test/tip-page-blocks.spec.ts`.

**Modified**
- `src/lib/page-doc/types.ts`, `blocks.ts`, `parse.ts`, `defaults.ts`, `store.ts`, `theme.ts`.
- `src/components/tip/blocks/*` (read the new words, step numbers from order, edit-mode attributes), `PageLayout.tsx`, `src/components/tip/StepHeading.tsx` call sites, `OwnerExtras.tsx`, `OwnerSuccess.tsx`, `SuccessScreen.tsx`.
- `src/app/[handle]/page.tsx` (use the shared loader), `TipPageView.tsx`.
- `src/app/actions/page-doc.ts` (save draft, publish, revert, restore, reset).
- `src/app/admin/creators/[id]/page.tsx`, `TipPageBox.tsx` (Edit link, honest state, last change).
- The creator dashboard overview (a short note while the switch is on).
- `next.config.ts` (frame header for the preview path), `OPERATIONS.md` (7g), `PROGRESS.md`, `docs/next-steps.md` (next steps).

## Tasks

Recommended effort per task is in brackets; none needs an independent review except the final review in Task 8.

### Task 1: The document learns its words and the new rules [high]

- [ ] Add the optional text settings of decision 3 to `SettingsByType`, `defaultSettings`, the parser and `LIMITS` (new limits listed beside the existing ones). Failing tests first in `test/page-doc.spec.ts`: each field is cut at its limit by whole characters, control characters are removed, a non-string gives empty, an old document with none of them still parses to a clean one.
- [ ] Add `header` to `PROTECTED`. Parser: a missing or hidden header is put back first in `side` and listed in `repairedProtected`. Update the existing tests that list the three pay blocks.
- [ ] Add `notes: string[]` to `ParsedPage`: one plain sentence for each thing the parser cut, dropped or repaired (long text, colours, bad Instagram handle, ladder replaced by none, a block put back). Test each, and that a clean document has no notes.
- [ ] Colour rule (decision 7) in `parseTheme`: keep the pair only if ink on accent is at least 4.5 and accent on the ground at least 3. Export the two ratios from `accent.ts` (`GROUND` already exists there). Tests: the owner red and ink pass; a pale yellow on the dark ground passes; a near-black accent fails the ground check; the default pair is unchanged.
- [ ] `ladder` rules: a ladder whose top is at or below the minimum tip draws no bar (the parser cannot know the minimum, so this is a render rule, Task 3); the parser keeps its current checks.
- [ ] Run the unit specs. Commit locally (not pushed).

### Task 2: Pure editing functions and the field table [high]

- [ ] `fields.ts`: per block type the list of `{ key, label, max, standard }`, plus which types may be hidden (from `PROTECTED`) and the order rules (reorder within a slot). A test checks every field's `max` equals the parser's `LIMITS` and every settings key the parser reads is in the table or intentionally special (ladder, colours, instagram).
- [ ] `edit.ts`: `moveBlock(doc, id, "up" | "down")` (inside its slot, skips hidden blocks only for the announcement, never leaves the slot, no-op at the ends), `setVisible(doc, id, visible)` (refuses protected types), `setText(doc, id, key, value)`, `setLadder(doc, ladder | null)` with problems (top range, 2 to 8 levels, names, strictly rising percentages ending at 100), `setTheme(doc, accent, ink)` with the two ratios and a refusal when either check fails, `resetBlock(doc, id)`. All return `{ doc, problems }`, never mutate, never throw. Property-style tests: any sequence of moves and toggles leaves a document the parser accepts with no notes.
- [ ] Commit locally.

### Task 3: Blocks read the words; step numbers follow the order [high]

- [ ] Each block component uses `settings.x || standard`. `StepHeading` numbers come from the visible order of the three step blocks (`amount`, `note`, `send`), computed in `PageLayout` and passed down; with the standard order the numbers are 1, 2, 3 as today. `OwnerExtras` and the two success screens take the new words; long words break anywhere (`[overflow-wrap:anywhere]`, as phase 1 fixed).
- [ ] Hide the rank bar when `ladder.topRupees` is at or below the minimum tip (decision in Task 1).
- [ ] `PageLayout` takes an `editing` flag (from the context or a prop) that adds `data-block-id` to each block's wrapper and nothing else; the real page never sets it. A test proves the served HTML of the real page has no `data-block-id`.
- [ ] Browser tests in `test/tip-page-blocks.spec.ts`: each new word shows, a reordered main section renumbers its steps, a reordered side keeps links with the header only when adjacent, every word at its limit with no spaces causes no sideways scroll at 320 px, the document accent reaches the page and the payment window's colour (`themeFor` unit test plus a computed-style check).
- [ ] Run the phase 1 gate (`playwright.gate.config.ts`) and the text snapshots: they must pass unchanged (12 of 12). Commit locally.

### Task 4: Draft store and owner actions [high]

- [ ] `store.ts`: `loadDraft(db, creatorId)` (returns the draft, else the published page, else the default for that creator, plus whether it is the draft or a starting copy), `saveDraft(db, creatorId, base, next)`: lock the row, check the switch, parse `next`, refuse when it is not a page, update `where page_draft is not distinct from base` (when there is no draft yet, `base` null matches), store the cleaned document, return `{ doc, notes }` or a conflict. `publishDraft` stores the parsed document (one statement, previous kept) and refuses repairs. New `discardDraft` (draft back to null, or to the published page: choose null, so "no draft" means "same as published").
- [ ] Console summary: `getPageSummary` also says whether the stored published document is readable (`parsePageDoc` is not null) and the time of the last `creator.page_*` audit row.
- [ ] Actions in `src/app/actions/page-doc.ts`: `savePageDraft`, `publishPage`, `discardPageDraft` (next to the existing restore and reset), each with `requireOwner`, id check, the store, audit for publish only, `revalidatePath` for the creator's page and the console, a plain error when migration 0051 is missing.
- [ ] Tests against in-memory Postgres (`test/page-doc-store.spec.ts`): save then save with a stale base gives a conflict and keeps the first; two saves in a row with the returned doc succeed; switch off refuses; a not-a-page value refuses; the cleaned document is what is stored; publish stores the cleaned document, keeps the old as previous, writes one audit row; a second publish of an unchanged draft is refused or a no-op (state which and test it); discard; summary reports an unreadable published document. Confirm the jsonb equality works in PGlite and note if Neon needs a different cast.
- [ ] Commit locally.

### Task 5: The preview route [high]

- [ ] **Spike first (stop and report if either answer is no):** (a) can a client component render the tip page tree (is anything in `TipPageView`, `PageShell` or the blocks server-only)? If not, split the pure JSX as in decision 9. (b) does `next.config.ts` let a more specific `headers()` entry replace the global `X-Frame-Options: DENY` for `/page-preview/:path*` (check the docs and test with `curl -I` against a local build)? If not, exclude that path from the global rule with a negative-lookahead source.
- [ ] Extract the real route's data loading (everything between `getCreator` and `<TipPageView data=...>`) so the real page and the preview share it; the real route's behaviour and the gate stay as they are.
- [ ] `/page-preview/[id]/page.tsx`: `requireOwner()`, not-found for a bad id, `noindex`, `force-dynamic`; loads the creator's real data (sounds, rules, pin offer, banner, photo) with `previewMode` on, whatever the creator's status; starts with the saved draft (or published page, or default).
- [ ] `PreviewHost.tsx`: holds the document, listens for `message` events, accepts only `event.origin === window.location.origin` and `event.source === window.parent`, runs the payload through `parsePageDoc`, ignores anything else. Replies `ready` to the parent on mount. In editing mode a click on a block wrapper posts `{ select: blockId }` to the parent, and the selected block gets a visible outline (preview only).
- [ ] Tests: unit test of the message filter (wrong origin, wrong shape, a page that needs repairing); browser test through a fixture variant that the preview re-renders from a posted document without a reload and ignores a foreign message; a check that a request without the owner cookie does not get the page (use the existing owner-auth test helpers).
- [ ] Commit locally.

### Task 6: The editor page [high]

- [ ] `/admin/creators/[id]/page`: server component, `requireOwner`, loads the draft state; if the switch is off it explains and links back; if the columns are missing it says "run migration 0051"; under 1024 px shows "open this on a laptop".
- [ ] `PageEditor.tsx` (takes `save`, `publish`, `discard` as props, so the fixture can pass in-memory fakes): three panels. Left, `BlockList` per section: each row shows the block's name, an eye (hidden for protected types, with a "Required" tag), up and down buttons, and optional drag within the section; a live region announces "Moved Strip up". Middle, `PreviewFrame`: a phone/laptop toggle, the iframe, messages to and from it, a "Reload preview" button. Right, `BlockSettings`, generated from `fields.ts`, plus `LadderEditor` (top in rupees, level names with percentages, add and remove a level, "No bar", "Use standard words") and `ColourEditor` (accent and ink, preset swatches including the owner red, the two contrast ratios, refuse to apply a failing pair).
- [ ] Saving: debounce 1.5 s; status chip "Saving…", "Saved", "Changed elsewhere, reload" (conflict, stops autosave and keeps the local copy visible), "Could not save, retry"; parser notes shown under the chip. `beforeunload` warns while a save is pending. Buttons: **Publish** (enabled only when saved and different from published, asks once, says what fans will see), **Revert to published**, plus links to the console for Restore and Reset (they stay there, with their double confirm).
- [ ] `/dev-fixtures/editor` (404 unless `PAGE_FIXTURES=1`) renders `PageEditor` with in-memory fakes, including a switch to force a conflict.
- [ ] Browser tests in `test/page-editor.spec.ts` on the fixture: change a word and see it in the preview without saving; reorder with the buttons and with the keyboard and see the preview and step numbers follow; hide the QR; a protected block has no eye; set a failing colour pair and see it refused with the ratios, set the owner red and see it accepted; edit the ladder to an invalid state and see the message; autosave fires once after typing stops; a forced conflict stops autosave with the message; Publish disabled until saved; Revert; the phone and laptop toggle changes the frame width and the laptop view shows the two-column layout; axe-style checks that every control has a name (use the existing accessibility approach in the repo's tests).
- [ ] Commit locally.

### Task 7: Links, notes, console wording, documentation [medium]

- [ ] Creator detail page: an "Edit tip page" button (to `/admin/creators/<id>/page`) once the switch is on; the box says "Custom", "Normal" or "Unreadable (fans see the normal page)", shows the time of the last change, and calls Restore a swap ("Swap with previous version").
- [ ] The creator's dashboard overview shows, while their switch is on and only then, the short note: "Your custom tip page is set up by Freetip. To change it, send a message through the contact form." No link to an editor, nothing else.
- [ ] `OPERATIONS.md` 7g: how to open the editor, edit, publish, revert, restore, reset; what each button does; the conflict message; the laptop-only rule; still no migration. `PROGRESS.md`: current state, what was verified and not, owner to-do. `docs/next-steps.md`: rewrite the page builder next-step item (phase 2 built, phase 3 next).
- [ ] Commit locally.

### Task 8: Verify, independent review, push [high; the review step recommended with an independent review]

- [ ] Lint, `tsc`, `npm run build`; the whole unit run; the whole browser suite on desktop Chrome and the mobile Chrome profile; the phase 1 gate (12 of 12); Lighthouse median of three on the owner page and a normal page (no worse than 84/97 and 85/97).
- [ ] Look at the editor in a real browser with a screenshot at 1440 px for each panel, and at 800 px to see the laptop-only message. Say plainly what was not seen (real Neon, a real owner login, a real phone).
- [ ] A fresh reviewer (a new agent with no context, given the diff and the Review Focus list, not this plan's conclusions) reads the whole branch. Fix what it finds with a failing test first.
- [ ] `git log -1 --format=%B | grep -ci co-authored` prints `0`; confirm `package-lock.json` has no private registry URLs; push to `main` once.

## What the owner does to test

No migration to run. Deploy, then: tick "Custom tip page" for `acepressure` (or a test creator), click "Edit tip page" in `/admin/creators/<id>` on a laptop, change a word and the Pressure label, move a block, try a colour, watch the preview, wait for "Saved", Publish, open the page on a phone, then use Swap with previous version in the console and Reset to normal. Say what looks wrong. Nothing from the page builder has been seen in a real browser with a real login yet, so expect adjustments.

## Not verified by this plan (will be stated honestly after the build)

The editor against real Neon and a real owner login, the jsonb equality save on Neon (PGlite is the test database), the iframe frame header on Vercel (checked locally only), the editor on a real laptop screen size other than the ones tested, and fans' pages on a real phone.

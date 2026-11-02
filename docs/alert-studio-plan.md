# Alert studio: Streamlabs-style donation alert settings as a paid feature (proposal, 2026-11-02)

Owner request, 2026-11-02: add the kind of controls Streamlabs gives for its donation alert box, in our own overlay, as a paid feature. This file compares the two and proposes what to build. **Nothing here is built; the owner approves the shortlist first.** Owner chose for this planning step. No plan name or price goes on the site.

## What our alert box already has (checked in the code, 2026-11-02)

- Card with name, amount and message; landscape, 2K and vertical; instant, split or approve-first; creator accent colour; screen position (`overlay_position`).
- Custom media (GIF, WebM, image; placed above, behind or fullscreen), soundboard with per-sound minimum tip and volume.
- Five card themes and five fonts (`src/lib/overlay-themes.ts`), switched by `overlayThemes`.
- Rules (`alert_rules`): a rule is a **pick the fan taps on the tip page** (fixed amount, no message). A rule applies only to a tip that picked it (`tip_orders.alert_rule_id`); a rule can also keep a big tip's alert on screen longer (`stay_seconds`, from ₹1,000, up to 5 minutes).
- Voice (Hindi, English, regional) with its own minimum tip; test, skip and replay controls; a pinned-message card.

## What Streamlabs' donation alert settings have that we do not

| Streamlabs setting | Ours today | Gap |
|---|---|---|
| Message template (`{name} donated {amount}`), text colour, highlight colour, size, weight, alignment | Fixed wording; 5 themes and 5 fonts only | **Yes** |
| Enter and exit animations (fade, slide, bounce, zoom, flip...) | One wipe in, one wipe out | **Yes** |
| Alert length, delay before the message text, gap between alerts | Length follows the content; a rule can lengthen it | **Yes** |
| Variations: "from this amount up, use this image, sound, text, length", applied automatically | Rules apply only to fan picks; a plain tip never gets a rule | **Yes** (the biggest) |
| Layout (image left, right, above, text over image) | Media above, behind or fullscreen | Partly |
| Volume for the alert and the voice | Per-sound volume only | Small |
| Custom CSS and HTML | None | **Not proposed** (see below) |

## Proposed shortlist (build in this order, each behind its own switch in the "Alert box" group)

1. **Alert text and colours** (`alertText`, size M). The creator edits the line shown on the card with `{name}` and `{amount}`, and picks text, amount and background colours from a safe palette plus their accent, with size and weight steps. Stored as small, validated values (keys and hex colours checked on the server, a length cap on the template, asterisks and markup stripped), never free HTML. Banned words still apply to the name.
2. **Animations and timing** (`alertMotion`, size S to M). A fixed list of enter and exit animations (fade, slide, zoom, bounce, the current wipe), a length for every alert (5 to 30 seconds, never shorter than the voice or sound needs), a delay before the message appears and a gap between alerts. Pure CSS keyframes, honours reduced motion.
3. **Automatic variations by tip size** (`alertVariations`, size M, needs a design decision). A tip of at least X plays media, sound, text style and length chosen by the creator without the fan picking anything. Open question for the owner: today rules are fan picks at a fixed amount (decided 2026-11-02). An automatic variation could reuse `alert_rules` with a flag, but then a pick and a variation can both match; the rule would be that a fan pick always wins and a variation applies only to a tip with no pick. Keep the same big-tip floor for long stays.
4. **Volume and layout presets** (small, later): a master volume for sounds and voice, and image-left or image-right layouts.

## Not proposed, and why

- **Custom CSS or HTML.** Streamlabs offers it, but on our public, shared overlay origin it is a way to inject scripts or hide the amount and the creator's own banned-word filter, and it becomes a support burden. If a creator asks, offer more presets instead.
- **A drag-and-drop layout editor.** Large, and the presets above cover most of what streamers change.

## Shared rules for all of it

- Every switch is OFF by default and set per creator in `/admin/creators/<id>` ("Paid features"); entries go into `FEATURES` in `src/lib/plans.ts` first (`built: false`), so nothing shows until built. No price or plan name on the site, and the fee stays flat.
- The overlay and the dashboard preview must render from the same stored values (as themes do today), and the preview must run the real card, not a copy.
- Stored values are keys and numbers, validated server-side; an unknown or removed value falls back to the default so an overlay never breaks. A feature switched off at play time must show the normal alert.
- Migration 0044 onwards (next free number); run in Neon BEFORE the deploy; `OPERATIONS.md` gets the migration and any new admin step in the same commit.
- Tests in the style of `test/pinned.spec.ts`: rules, validation, the overlay resolver with the switch on and off, fallbacks. Not verified until seen in real OBS (nobody has seen the existing overlays there yet either).


1. Build items 1, 2 and 3 in that order, item 4 later.
2. For item 3, a fan's pick always wins; a variation applies only to a tip with no pick.
3. Separate switches (`alertText`, `alertMotion`, `alertVariations`), so each can be turned on or charged for on its own.

## Status

- Item 1, alert text and colours: built 2026-11-02 (`alertText`, migration 0044, `/dashboard/text`, `src/lib/alert-text.ts`); details in `PROGRESS.md`. One change from the proposal: the headline may use `{name}` once (required) and `{amount}` (optional); the message card keeps "Name says".
- Item 2, animations and timing: built 2026-11-02 (`alertMotion`, migration 0045, `/dashboard/motion`, `src/lib/alert-motion.ts`); details in `PROGRESS.md`. Changes from the proposal: no "delay before the message appears" (the spoken words are lit in time with the voice, and a delayed message would drift from it); the length is chosen from 5, 8, 12, 20 and 30 seconds, and the pause between alerts from 2, 5 and 10.
- Item 3, automatic variations by tip size: built 2026-11-02 (`alertVariations`, migration 0046, table `alert_variations`, `/dashboard/variations`, `src/lib/alert-variations.ts`); details in `PROGRESS.md`. A separate table, not a flag on `alert_rules`, so fan picks and variations never mix.
- Item 4: not built.

## What was to decide (answered above)

1. Which of items 1 to 4 to build, and in what order (recommended: 1, 2, then 3).
2. For item 3: fan pick always wins, or the creator chooses per rule.
3. Whether to group items 1 and 2 under one switch ("Alert studio") or keep them separate so the owner can charge for them separately.

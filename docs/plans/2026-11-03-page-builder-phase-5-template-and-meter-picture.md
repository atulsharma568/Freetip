# Page builder phase 5 (part one): a picture on the meter, and a page copied as a template

Spec: `docs/specs/2026-11-03-page-builder-design.md` ("Later" list). No migration. Effort for the build: (owner's choice, 2026-11-03).

Scope chosen by the owner: these two. Left for later: OBS overlays (alert, goal) in the builder (they touch the live alerts), and a picture on the OBS meter.

## 1. Meter picture

- `pressureMeter` settings gain `picture: number | null` (an id in `page_assets`, a picture or GIF, never a video). Old stored documents have none, and the parser reads that as null.
- New asset use `meter` in `assets.ts` (kinds image and gif); `usedAssetIds` and `replaceAssetId` know the new place, so Remove is refused while a page uses the file and Replace carries over.
- `setAsset` takes `pressureMeter`; the editor's picker works for it (`BlockSettings`, `AssetPicker` wording).
- `PressureBlock` draws a 28 px square beside the heading, a GIF showing its still until the device allows motion (`useMotionAllowed`, like a GIF banner). A missing, taken-down or wrong-kind file draws nothing.
- Tip page only. The OBS endpoint and `PressureBar` are not changed.

## 2. Copy a page as a template

- `copyPageFrom(db, sourceId, targetId, sourceFallback)` in `store.ts`: locks both rows in id order, requires the target's "Custom tip page" switch, takes the page fans see on the source (`resolvePageDoc`: published while the source's switch is on, else the fallback the caller gives, the owner page for the owner), cleans it with `asTemplate`, reads it back through the parser and writes it to the target's **draft only**. Published and previous are untouched. One audit row `creator.page_copied` against the target, naming the source.
- `asTemplate` takes out what belongs to one creator: the backdrop picture, the banner picture, the meter picture and the meter's goal pick. Everything else is copied. The message lists what was left out.
- Console: `CopyPageForm` in the "Custom tip page" box (pick a creator, then a two-step confirm that warns when a draft will be replaced); server action `copyCreatorPage` (owner re-checked, source id validated as untrusted).
- Not done: copying files between creators (pictures must be picked again from the target's own library).

## Checks

`test/page-phase5.spec.ts` (14 logic specs against in-memory Postgres), two browser specs added to `test/pressure-ui.spec.ts`, lint, type check, build, and the page, editor and meter browser specs.

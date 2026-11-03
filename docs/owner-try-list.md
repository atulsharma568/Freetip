# Owner's try list

Things only the owner can check, kept so they can be tried together at the end. This gets additions after every phase or feature that has parts it could not see for itself (a real phone, a real login, Neon, a real upload), and ticks nothing off: the owner ticks `[x]` when tried and writes what they saw under it. Details of how each thing works are in `PROGRESS.md` and `OPERATIONS.md`.

## Before trying anything (run and set up)

- [ ] Run migration `0051_page_builder.sql` in Neon (before the deploy).
- [ ] Run migration `0052_page_assets.sql` in Neon (before the deploy, after 0051).
- [ ] Deploy (push to `main` already done for phases 1 to 3).
- [ ] In `/admin/creators/<id>`, tick "Custom tip page" for a test creator (use your own account or a spare one).

## Page builder, phase 2: the editor (steps in `OPERATIONS.md` 7g)

- [ ] Open `/admin/creators/<id>/page` on a laptop. Does the preview look like the real tip page?
- [ ] Change a word and a colour; the preview should change at once. Wait for "Draft saved".
- [ ] Move a block with the arrows and by dragging; hide and show one.
- [ ] Press Publish; open the real tip page on a phone. Does it match?
- [ ] "Swap with previous version" and "Reset to normal page" in the creator's console box.
- [ ] Open the editor in two tabs; the second save should say "changed somewhere else".

## Page builder, phase 3: pictures and videos

- [ ] In the editor, press "Add a picture or video behind the page" (or open Backdrop on your own page).
- [ ] Upload a picture. Is it picked, and does it show in the preview? Set "Darken the picture" so the words are easy to read.
- [ ] Upload a short WebM video (try one made with an AI tool; if it is refused, note the message and the file size). Does a still of the first frame appear in the library?
- [ ] Upload a GIF.
- [ ] Try a file that should be refused: an animated WebP or PNG, a file over the size limits, a video longer than 15 seconds. Are the messages clear?
- [ ] Header block: choose a picture or GIF as the banner. A video should not be offered.
- [ ] Publish, then look at the real page on a phone: picture first, then GIF or video starts after loading.
- [ ] On the phone, turn on reduced motion (or data saver, or use a slow connection) and reload: only the still should show.
- [ ] On an iPhone: does the WebM video play? If not, the still shows; say if MP4 is needed.
- [ ] Replace a picture: it should change only the draft; after Publish the page changes; "Swap with previous version" brings the old picture back.
- [ ] Remove a file the page uses: the Remove button should be off. Remove an unused file: it asks, then it is gone.
- [ ] `/admin/media`, section "Tip page pictures": Take down a file; the page that used it should show its normal look.
- [ ] Check Lighthouse (pagespeed.web.dev) on a page that uses a backdrop; note the numbers.
- [ ] Is the "keeps the page readable" darkening enough for your pictures? Say if the default (40%) should change.

## Older items still waiting (from earlier work)

See the "Owner to do" lines in `docs/next-steps.md` and `PROGRESS.md` (alert studio in real OBS, the owner's `acepressure` page on a phone and a laptop, a real small tip and the sign-off, the voice with real emoji, the Streamlabs bridge with a real account, and so on).

## Added later

(we: add new items here as phases are built, for example phase 4, the Pressure meter.)

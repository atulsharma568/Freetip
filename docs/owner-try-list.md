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

## Page builder, phase 4: the Pressure meter

- [ ] In `/admin/creators/<id>`, Paid features, tick "Pressure meter" (next to "Custom tip page") for a test creator who has a goal. Is there nothing to run in Neon? (There is no migration.)
- [ ] In the editor press "Add a Pressure meter". Is it under the header and links? Does the preview show the goal's real numbers?
- [ ] Pick a different goal (the creator needs two): does the title, percent and "today / this week / this month" change?
- [ ] Change a rank word and the heading; try a bar colour that is too dark (it should be refused with a reason).
- [ ] Set "Numbers" to "Only a percent": no rupee amount should show anywhere on the page.
- [ ] Publish, then open the real tip page on a phone with the goal empty, about half full, and full. Does "Goal reached" look right? Is the bar readable on the page colour?
- [ ] Send a small real tip: does the bar on an already open page move within about 30 seconds?
- [ ] Add the alert link with `/pressure` at the end as a Browser source in real OBS. Does it show over the stream? Does it move within a few seconds of a tip? Does it flash once when the goal is reached (and not when OBS loads with the goal already full)?
- [ ] Try OBS on a vertical canvas, and a long goal title.
- [ ] Set "Shown" to "In OBS only", then "On the tip page only", and Publish each time: does the other place go empty?
- [ ] Hide the meter (the eye) and Publish: do both places go away? Untick "Pressure meter" for the creator: does the page lose it at once?
- [ ] A daily goal over midnight in India: does it restart from empty?
- [ ] With the phone's reduced-motion setting on, is the bar still fine (no sliding)?
- [ ] Check Lighthouse (pagespeed.web.dev) on a page that has the meter; note the numbers.

## Older items still waiting (from earlier work)

See the "Owner to do" lines in `docs/next-steps.md` and `PROGRESS.md` (alert studio in real OBS, the owner's `acepressure` page on a phone and a laptop, a real small tip and the sign-off, the voice with real emoji, the Streamlabs bridge with a real account, and so on).

## Added later

## Page builder, phase 5: a meter picture and page copy (steps in `OPERATIONS.md` 7g item 11)

- [ ] In the editor, pick the Pressure meter and give it a picture, then a GIF: does the small square sit well beside the heading on a phone and a laptop? Does the GIF stay still with the phone's reduced-motion setting on?
- [ ] Remove the picture, and try Replace: does the draft change and does Publish carry it?
- [ ] On a spare creator with "Custom tip page" ticked, copy another creator's page (Copy another creator's page as a template, on `/admin/creators/<id>`): does the message list what was not copied? Is the real tip page unchanged until you Publish?
- [ ] Copy over a creator who already has a draft: does the panel warn first, and is the draft replaced?
- [ ] With the editor already open in another tab, copy a page: does that tab say the draft changed somewhere else (it should, and never overwrite)?
- [ ] Copy the owner's `acepressure` page to a spare creator: do the words and colours come over, and are the backdrop and banner pictures left out?
- [ ] Look at the Audit log: one `creator.page_copied` row against the spare creator.

## Page builder, phase 5 part two: the overlay editor, alert and goal bar (steps in `OPERATIONS.md` 7g item 12)

- [ ] Run migration 0053, deploy. Without touching anything, do a real alert and the goal bar look exactly as before in OBS?
- [ ] Tick "Custom tip page" and the four alert switches for a test creator. Open `/admin/creators/<id>` and press Edit overlays. Does the editor open on the creator's current settings (what they saved on their own pages)?
- [ ] Change the headline and a colour: does the preview change at once, and does "Draft saved" appear a moment later? Is the real alert in OBS still unchanged until you Publish?
- [ ] Type a colour pair that is hard to read: is it refused with a clear message, and is Publish off until fixed?
- [ ] Publish, then send a small real tip: does the real alert in OBS use the new text, colours, animation and timing without an OBS reload?
- [ ] Press Swap with previous version: does the next alert use the old look? Swap again: the new one?
- [ ] Switch one alert feature off for the creator: is that part greyed out in the editor and named when you Publish, and does the creator's live alert ignore it as before?
- [ ] Goal bar tab: pick a bar colour, "Percent only" and turn off the goal-reached moment. Publish and add `/goal` to the alert link as a Browser source in OBS: does it match the preview? With percent only, does no rupee figure show anywhere (look at the browser source's network response too)?
- [ ] Look at the editor on a laptop and confirm a narrow screen only says to use a laptop.
- [ ] Open the editor in two tabs, change something in one, then the other: does the second say the overlays were changed somewhere else and refuse to overwrite?
- [ ] Press Test alert several times: does a real alert ever reach the creator's OBS? (It must not.)
- [ ] Audit log: one `creator.overlay_published` row per Publish and one `creator.overlay_swapped` per Swap.

## The "tip is final" tick box (2026-11-03)

- [ ] Open a creator's tip page on a real phone: is there a tick box above the Tip button, never pre-ticked, with working Terms and Refund Policy links (they open in a new tab)? Is the Tip button greyed out until you tick it?
- [ ] Tick it and make a real small tip through Razorpay: does the payment open and the tip arrive as before? Untick after a failed payment: does the button grey out again?
- [ ] Look at the box on the owner page (`acepressure`) and in the editor preview (the box should be disabled there, and the preview says payments are off).

## A picture on the OBS Pressure meter (2026-11-03)

- [ ] Give the Pressure meter a picture in the editor, show it "In OBS" or "Both", Publish, then open the OBS link plus `/pressure` in real OBS: does the small picture sit before the heading, not too big or blurry? Try a GIF: does it move?
- [ ] Remove the picture from the meter and Publish: does the OBS bar go back to words only within about a minute?

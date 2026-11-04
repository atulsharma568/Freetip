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

## Textured backdrop on the creator dashboard and owner console (2026-11-03)

- [ ] Open `/dashboard` and any `/admin` page on a laptop and a phone: is the faint dot grid, lime glow and grain pleasant and does it stay behind the cards without making any text harder to read?

## Fee rates per creator (2026-11-03, run migration 0054 BEFORE the deploy)

- [ ] Run `0054_creator_fee_rates.sql` in Neon, deploy, then open `/admin/creators` and your own creator page: does the **Fee rates** box say you pay no fees (0% + 0%) and keep ₹100.00 of a ₹100 tip? Does the Audit log show one `creator.fee_rates_changed` row for your account?
- [ ] Open `/admin/fees`: does it show the site rates (5% + 2.75%), how many creators follow them, and your account under "No fees"?
- [ ] On a spare test creator, give them their own rates (for example 3 and 1) in their Fee rates box, send a small real tip to them and one to your own page, then check `/admin/finance/payments`: your tip should show no platform fee and no processing charge, and the test creator's the 3% and 1% amounts. The creator's own dashboard "you'd keep" line should name their rates.
- [ ] Change the site rates (for example to 4 and 2) on `/admin/fees`: after the two-step confirm, tips made before the change must keep their old amounts in the books; a new tip to a creator on the site rates uses the new ones.
- [ ] Tick two or three creators on `/admin/fees` and use "Apply these rates" then "Put back on the site rates": do the counts in the message and the Audit log match?
- [ ] Decide the public wording: home, pricing and terms say "5% of every tip". With custom rates that is the standard rate, not everyone's. Say if you want it changed to "standard".


## Polish pass after the page builder (2026-11-03)

None of this has been seen in a browser with a real login or in real OBS.

- [ ] Alert box, real OBS: send two tips close together, then press Skip on the dashboard while the first is on screen. Does the first one go away at once (not the second)? Press Test alert while one is on screen: does the test queue behind it?
- [ ] Alert box, real OBS: replace the alert link in the dashboard while the old OBS source is still running, then wait a minute. Does the old source show the "no longer valid" banner and stay quiet, and does it show alerts again if the link comes back? Is the old banner too loud on a live stream?
- [ ] OBS alert animations: do slide, zoom and bounce still move (not only fade) in the OBS version your creators run? (OBS 28 to 30 may be too old for them; if they only fade, say so.)
- [ ] Leave an OBS overlay open for an hour: is there any lag, fan noise or climbing CPU? (The site's smooth-scroll loop and sign-in check no longer run on overlay pages.)
- [ ] Break an overlay on purpose (a bad token inside the page does not count; a render error does): does it stay empty and recover by itself within seconds instead of putting the site's error page over the stream? Hard to cause; skip if you cannot.
- [ ] Tip page on a real phone: tick nothing and look under the Tip button. Does it say "Tick the box above to send your tip." and is the Tip button greyed out? Tick it and make a real small tip: does the payment window open noticeably faster than before (the payment script now loads when you tick)?
- [ ] Tip page: put a GIF or WebM in a streamer's pick, open it with the phone's reduced-motion or data-saver setting on. Does the pick show a still icon instead of moving?
- [ ] Tip page for `acepressure`: share the link in WhatsApp. Does the preview image say AcePressure in red (not the Google name)? Same for a highlights page link.
- [ ] Tip page loading: throttle the network in the browser (Slow 3G) and reload. Does the grey placeholder match the real page's width and not jump when the page arrives?
- [ ] Dashboard, Streamlabs: connect a Streamlabs account, then untick the Streamlabs switch for that creator in `/admin/creators/<id>`. Does the creator still reach `/dashboard/streamlabs` by its address and see only a Disconnect button? After disconnecting, does it go back to the overview?
- [ ] Dashboard, Timestamps: do Disconnect YouTube, Disconnect Discord, Remove the link and Remove the token each ask first, and does the page keep other half-typed fields (the webhook box) instead of reloading?
- [ ] Dashboard, Banner: press "Use my YouTube photo" on a phone. Does the answer appear under the button, not in the banner tile above?
- [ ] Dashboard, Pinned: does Save answer under the Save button, and Take down now answer in the list tile? Does a pinned message show only "Pinned now" with no stale second count?
- [ ] Dashboard, Rules: with no sounds, does the Save rule button say why it is greyed out?
- [ ] Admin: Reset to pending on a suspended creator asks first (with an optional reason); an absurdly large creator number in the address shows "not found", not an error.
- [ ] Admin, handle requests: approve a request, then look at the creator's handle in Neon. (A crash between the rename and the mark is fixed in code and tested, but never seen for real.)
- [ ] Sign in with a second, non-owner Google account. `/admin/creators/<id>/page`, `/overlays` and `/page-preview/<id>` must show a 404, and a POST to `/api/page-assets/upload` must return 403. Signed out goes to the sign-in page.
- [ ] Page and overlay editors: type a change and close the tab, or follow a link inside the site, before "Draft saved" shows. Does the change survive? After Publish, does "Swap with previous version" appear at once in the overlay editor (no reload), and is it greyed out while a change is unsaved?
- [ ] "Revert to published" when nothing was ever published. Publish refused when a picture was taken down in `/admin/media` meanwhile.

## Switched-off pages (2026-11-04)

- [ ] For a test creator with the Timestamps switch OFF but a YouTube or Discord connection saved: `/dashboard/timestamps` opens with only the remove buttons; removing works; with nothing saved it goes back to the overview.
- [ ] Same for Alert media OFF with a stored file (Delete only, no upload) and Tip page banner OFF with a saved banner (Remove only; the tip page shows no banner behind the photo).

## Paid features page (2026-11-04)

- [ ] Signed in as a creator: "Paid features" is the last link in the dashboard menu; the page lists the features in groups, ticks the ones on for you with an Open link, and says "In the paid plan" for the rest.
- [ ] A creator with nothing switched on sees no "Pinned messages" row; switch it on in `/admin` and it appears.
- [ ] Read the wording of each feature line and say what to change.


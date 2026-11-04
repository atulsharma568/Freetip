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
- [ ] Open `/admin/fees`: does it show the site rates (5% + 3% since 2026-11-04; if it shows a pair you saved earlier, such as 5% + 2.75%, that saved pair wins over the new standard, so set it to 5% and 3% yourself), how many creators follow them, and your account under "No fees"?
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

- [ ] Dashboard menu: open Sounds and media, then Tip page; with Media, Pinned, Picks, Automatic tiers or Banner switched on, a second row of tabs appears under the menu and works on a phone.
- [ ] Alert studio forms (Style, Layout, Text, Motion) and the Picks and Automatic tiers add forms: change something without saving, then reload or close the tab; the browser asks first. After Save it does not ask.
- [ ] `/admin/finance`: the "GST trigger" block shows this financial year's tips and fees against ₹15 lakh, in plain rupees, and the percent looks right for what you know you have taken.
- [ ] `/admin/creators/<id>` Fee rates box: the two choices (Follow the site rates, Their own rates) look like the dashboard's option blocks, switch with a click or the arrow keys, and Save still works.
- [ ] PayU, once step B puts the Buy button on `/dashboard/plans` (prices set): with `PAYU_MODE=test` pay a small order from your own account with PayU's test card; the features switch on once, the pass end date is right, `/admin/creators/<id>` shows the features on, and the Audit log has `plan.purchased`. Close the PayU page without paying: the order stays pending and nothing switches on. Then try the failing test card.
- [ ] PayU's dashboard webhook for `https://freetip.in/api/webhooks/payu` (Successful, Failed): after a test payment, PayU's Webhook logs show a reply of 200.
- [ ] A pass ending: set a test creator's `creator_until` (or `starter_until`) in the past in Neon (and check `pass_keys`), call `/api/cron/plan-orders` once; the pass's features go, your manual ones stay.

## PayU purchase, step B: the Buy form (2026-11-04)

- [ ] Tell me the prices (monthly, yearly, and whether to have an early price and how many seats); until then there is no Buy form, only "The price will be announced soon". (Suggestion in `docs/competitor-findings.md`: ₹299 a month or ₹2,499 a year, early ₹149 or ₹1,299 for the first 50. After GST registration 18% would come out of the same price, see `docs/rules-check.md` section 2.)
- [ ] With `PAYU_MODE=test` and prices set, open `/dashboard/plans` as yourself: the Buy form shows two terms, a mobile number box, the tick box and "Pay ₹... with PayU" (off until the number is 10 digits and the box is ticked). A different creator's account must see "Buying opens soon" in test mode.
- [ ] Pay with PayU's test card: you land back on `/dashboard/plans` with "Payment received. Your paid features are on until ..."; "Your payments" lists it; the receipt opens, looks like a plain receipt, says it was a test payment, and prints or saves as PDF on a phone and a laptop.
- [ ] Press Cancel on PayU's page: the page says you cancelled and nothing was charged. Use the failing test card: it says the payment did not go through.
- [ ] Open the receipt address of another creator's order (change the number in the address): it must show "not found".
- [ ] Buy a second term while the first runs: the end date moves out by the new term, and the page says the new term starts when this one ends.
- [ ] The reminder: in Neon set a test creator's `creator_until` (or `starter_until`) to 3 days ahead, call `/api/cron/plan-orders` with the secret: the reply says `reminders off` until `CONTACT_FROM_EMAIL` is set to a Resend-verified address, then `1 reminders sent` and the email arrives once (a second call sends nothing). The plans page shows "Your Creator plan ends on ..." (or Starter) for that creator either way.
- [ ] Read the new wording in the terms (Fees section, "Paid features"), the refund policy ("Paid feature passes"), the privacy policy (pass record, mobile number) and the pricing page ("Optional paid features") and say what to change. A lawyer has not read them.

- [ ] Plan cards (`/dashboard/plans`, no migration): open it on a phone and a laptop. Starter and Creator cards show a price with a 1 month / 12 months switch, the early price line and an off "Buying opens soon" button; the Custom page card shows "From ₹2,999 once" and "Ask about it" opens the contact form. Read the card words and the prices (placeholders, change `TIER_PRICES` in `src/lib/pricing.ts`) and say what to change. Below the cards a feature that is off says "In Starter", "In Creator" or "In Custom page".
- [ ] Plans, buying (run migration 0056 after 0055 and BEFORE the deploy, and deploy straight after; `PAYU_MODE=test`): on `/dashboard/plans` as yourself, press "Choose Starter": a pay step opens under the cards with the price of the chosen term (switch 1 month / 12 months above the cards and the amount follows; the mobile number and tick stay). Pay a small order with PayU's test card: you land back with "Payment received. Your Starter plan is on until ..."; only Starter's features are on (not the Creator ones); "Your payments" says "Starter". Then do the same with Creator: its extra features switch on and Starter keeps its own end date. A different creator's account must see "Buying opens soon" on both cards.
- [ ] Plans, edges: with Creator running, "Choose Starter" for a term that Creator already covers is refused with a plain message; open the Creator receipt: it says "Creator plan". In Neon set one plan's end date to the past and call `/api/cron/plan-orders` with the secret: only the features no running plan covers go. Check the early price shows only while seats are left, and that live sales stay shut (`LIVE_SALES_OPEN` is false in `src/lib/pricing.ts`) even with live keys.
- [ ] Plans bought box (`/admin/creators/<id>`, after migration 0056): for a creator who paid a test order it shows each plan's end date ("not running" for the other); press "End Creator now", confirm with a reason: the Creator-only features go from that creator's dashboard, anything you ticked by hand stays, and `/admin/audit` shows one `plan.ended_by_owner` line with your reason. Pressing it for a plan that is not running does not show a button. The money is not touched: refund in PayU yourself.

- Owner reported 2026-11-04 (left unticked for the owner to confirm): a test payment of both Starter and Creator worked, with receipts, end dates and `plan.purchased` audit lines. Still to try from the PayU items above: close PayU's page without paying, the failing test card, the webhook log showing 200, and End Starter now / End Creator now.

- [ ] Admin tables scroll (2026-11-04): on `/admin/creators` (and features, sounds, media, finance payments, fees) swipe two fingers up and down on the touchpad over the table: it scrolls inside the box, and at the end of the box the page scrolls on. The page and overlay editors' side panels on a laptop too.

- [ ] Owner console look (2026-11-04): after deploying, open `/admin` on a laptop and a phone. The dot grid and lime glows should show through frosted panels and the sticky top bar; text should stay easy to read everywhere (check the finance tables, creators list, health). Say if the glass is too faint or too strong.
- [ ] Jump palette (2026-11-04): press Ctrl K (Cmd K on a Mac) on any owner page or press the Jump to button: type "fee" and Enter goes to Fee rates; type a creator's name and the first row, Find creator, opens the creators list searched for it; arrows move, Esc closes and focus returns. Check it with a screen reader if you can.
- [ ] Overview shortcuts (2026-11-04): `/admin` now ends with every owner page as a tile under Operate, Money and System; a tile shows a number when something is waiting there, and the numbers match the sidebar badges.
- [ ] Dark Reader (2026-11-04): turn Dark Reader on in Chrome, hard-refresh the home page, the creator dashboard and `/admin`: the colours should stay as they look with it off. (Lock tag only works for the page it is on; if you list the site in Dark Reader's own settings it can still force it.)
- [ ] Photo frame and banner effect (2026-11-04): in `/admin/creators/<id>` make sure "Custom tip page" is ticked for your own account, open the page editor, click Header, pick a Frame (Flame ring, Pulsing aura, Slash ring) and an Effect (Rising embers, Sweeping slashes, Soft glow sweep), watch the live preview, Publish, then open your tip page on a phone and a laptop. Say which looks you like, which to change, and whether the speed and brightness feel right.
- [ ] Your own frame (2026-11-04): in the same place choose "Your own picture or GIF" for the frame, upload a square PNG with a see-through middle (or a GIF), check it sits around the photo and does not cover it, Publish. Try Replace and Remove (Remove is refused while the page uses the file). An animated WebP or PNG is refused with a message to save it as a GIF.
- [ ] Reduced motion (2026-11-04): turn "reduce motion" on in your phone or computer settings and reload the tip page: the rings stand still, the embers and sparks are not drawn, a custom GIF shows its still picture.
- [ ] AcePressure page default (2026-11-04, changed the same day): after the deploy, open your tip page (`/acepressure`) on a phone and a laptop without changing anything: the banner (over your banner picture if you have one, else a dark crimson strip) should show a heart-monitor line running across and spiking, a quick flash, and a crosshair that locks on at the spike, repeating every few seconds; there is no ring over your photo. Say if the speed, brightness or position is wrong. To try the others (Flame ring, Pulsing aura, Slash ring, Rising embers and so on) or switch it off, use Frame and Effect in the editor (needs "Custom tip page" ticked for your account, then Publish).

- [ ] Effects tab (2026-11-04; run migration 0058 BEFORE the deploy): sign in as AcePressure, open Dashboard, Tip page, Effects. Tap each frame (No frame, Flame ring, Pulsing aura, Slash ring, Fox-fire) and each banner effect and watch the preview; pick Fox-fire and Clutch pulse, press Save, open `/acepressure` on a phone and a laptop and check it matches. Then pick No frame and No effect, Save, and check the page is plain; then put your favourites back.
- [ ] Fox-fire (2026-11-04): look at the three small flames crawling over the top of your photo (not the lower half). Say if they are too small, too fast, too bright, or if you want a different creature or shape (a tiny fox, a blade, a bird) instead of flames.
- [ ] New banner effects (2026-11-04, no migration): in Dashboard, Tip page, Effects pick Spider crawl, Storm, Neon glitch and Falling petals one at a time, Save, and look at your tip page on a phone and a laptop. Say which to keep, and what to change (spider size and speed, fog amount, how often the lightning and glitch fire, petal count). Not yet seen in a browser.
- [ ] Preview beside the options (2026-11-04, no migration): on a laptop open Dashboard, Words, Motion, Layout, Style and Tip page, Effects: the options are on the left and the preview stays in view on the right as you scroll; click an option and watch it change. On a phone: tap an option far down the page and the page should scroll up to the preview, with a "Back to options" button that takes you back to where you were. Tapping again while the preview is on screen should not move the page. Check the colour pickers on Words too, and that nothing overlaps at a tablet width (about 800 to 1100 px).
- [ ] New standard rate, 5% + 3% (2026-11-04, no migration): send a small real tip (₹100) to a test creator on standard rates and check the books: creator share ₹92.00, platform fee ₹5.00, processing charge ₹3.00 in `/admin/finance/payments`, and the creator's tips page shows ₹92.00. Then read the home, pricing and terms pages and the FAQ: every worked example should say ₹92.00 and ₹3.00. A tip made before the change keeps ₹92.25.
- [ ] Review fixes for the PayU purchase (2026-11-04; run migration 0057 BEFORE the deploy): (a) on `/dashboard/plans` as yourself with `PAYU_MODE=test`, press Pay, then on PayU's page press Cancel or the browser Back, press Pay again, and again: it never says "several payments", and `/admin/plan-orders` shows only the newest order pending and the older ones failed ("replaced by a newer order"). (b) Pay a test order, but close the PayU tab before the redirect comes back (or turn off your network at the redirect): reopen `/dashboard/plans` within a minute: it says "Payment received" by itself, with no wait for the daily job. (c) With the Buy form on a phone, switch the network off and press Pay: a plain message, not the dashboard error page. (d) `/admin/plan-orders` lists your orders with "Agreed" (the time you ticked the box) and "terms of 4 November 2026". (e) Set `PAYU_MODE=live` while `LIVE_SALES_OPEN` is false: you still see the Buy form and another creator's account sees "The price will be announced soon" and no button; pay the smallest live term, check the receipt, then End ... now and refund it in PayU. (f) Print a receipt (Print or save as PDF): black on white, nothing else on the page. (g) In `/admin/creators/<id>` untick a feature that a plan switched on, Save, then buy that plan again: the feature stays off; tick it again and it is allowed. A feature from a plan shows "Keep after the plan ends": tick it, end the plan: it stays. (h) Read the new privacy paragraph ("If you buy a paid features pass"), the pricing page's Early price paragraph and the two FAQ answers; a native reader should check the Hindi rows in `docs/hindi-copy.md`. (i) On `/admin/plan-orders`, a payment under "To look at" has a Mark handled button: press it with a reason and the row and the overview count go away. (j) In `/admin/creators/<id>` with a running plan press Turn all off: the box lists the features under "Held back on purpose" and they stay off after you reload (a plan does not put them back). (k) After End ... now the creator's receipt for that term says "Plan ended early" and Your payments says so too. (l) Open `/dashboard/plans` ten times quickly while an order is pending: PayU's dashboard shows at most one verify call per order every 20 seconds.
- [ ] A PayU offer (2026-11-04, only if you have one to try): pay with an offer or coupon that lowers the amount. Nothing is switched on; `/admin/plan-orders` shows the order under "To look at" and the overview shows a number.
- [ ] Creator earnings page (2026-11-04, no migration): sign in as a creator who has a posted live tip (send a small real tip to a test creator first). Open Dashboard, Earnings: Balance and Pending show, the newest tip is the first row with its fee, processing charge and what you keep (a ₹100 tip on standard rates shows −₹5.00, −₹3.00, ₹92.00 and says Pending until a date 1 day later for a UPI tip). Compare the Balance with `/admin/finance/balances` for the same creator: same figure. Download the CSV and open it in a spreadsheet: the amounts add up and a fan name starting with = shows as text. Look at it on a phone: the three tiles stack and each row fits without sideways scrolling. A creator with no tips sees the empty messages. Refund a test tip in Razorpay and check the row turns to Reversed with ₹0.00 kept. Read the note under the page: is it clear that a payout is paid by hand after you ask for it and no payout day is promised?
- [ ] Payout requests, paid by hand (2026-11-04; run migration 0059 BEFORE the deploy; needs a live tip posted to the books, so use a test creator with a real small tip of at least ₹600 sent a day ago, or wait a day): (a) as that creator open Dashboard, Earnings: the **Get paid** box shows the button "Request payout of ₹X" and the UPI ID it will go to; a creator with less than ₹500 available, or a tip from today, sees the explanation and no button. (b) Press the button: it says Requested, the box then says your request is waiting, Balance drops by the amount, and Payout history shows "Requested, waiting to be paid". Press it again or reload and press: it must not make a second request. (c) You get an email "Payout request FT-n: ₹X" (needs `RESEND_API_KEY` and `CONTACT_NOTIFY_EMAIL` in Vercel; without them just look at the page); it has no UPI ID in it. (d) As yourself open `/admin/payouts` (also in the sidebar under Money, with a count): the request shows the amount, the reference, the UPI ID, the tips and fee breakdown and "Paid out before". Pay a small real amount from your UPI app to that ID, enter the UTR with the tick box, press Mark as paid: the request moves to "Paid and cancelled" and the creator sees Paid and a Paid out tile. Try a wrong UTR (too short), the same UTR on a second payout, and no tick: each refuses with a plain message. (e) Make another request and press Cancel this request with a reason: the money returns to the creator's balance and they can ask again. (f) Change the creator's UPI ID after a request (in `/admin/creators/<id>` when it is allowed): the request page warns "UPI ID changed since this request". (g) Check `/admin/finance/balances` agrees with the creator's Earnings page after each step, and `/admin/audit` has `payout.requested`, `payout.paid` and `payout.cancelled`. (h) On a phone: the Get paid box and the request button fit, and on the admin page the UTR field and tick box are easy to use. (i) Say whether ₹5,000 for a first payout and ₹25,000 after that are right, and whether card tips waiting 30 days (60 for a new creator) is too long now that UPI tips wait only 1 day.

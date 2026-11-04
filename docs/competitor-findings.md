# Competitor findings

Last reviewed: 1 November 2026

This document records the public, passive reverse-engineering pass of
StreamTipz, SuperTips and HyperChat. It is product research, not proof of
private backend behavior. Authenticated dashboards, private APIs and source
repositories were not accessed.

## Evidence

The pass used REA 6.4.0 against public pages and public creator pages:

- HyperChat public creator runtime: `ev_a39fc5989c11010d5225b78a5020d57f29a2c674cdbec5b5011d8ed052781c2b`
- HyperChat static bundle: `ev_d21387211bb6382fd3a044b0437f01478ec4e82614774e8476afa40f9a45908d`
- StreamTipz public homepage runtime: `ev_76b2eb00b1e79f12104ee6215a6cda10b8300729e6d59ab710d926d0f819209c`
- SuperTips creator-directory runtime: `ev_39859ae45dcd5ed2d1397c5ec82edfd01c2a30ffdd45cbc38e241b9c44dda819`
- SuperTips creator-page runtime: `ev_fdf03e1e98cb8a942e2830fa1fb5846151488910306b7098df21026deac5ed3f`
- SuperTips static bundle: `ev_2f860d42e91d53c428311c3fab618633fb19e9b315e1e1b41ff93f99a13625da`

## StreamTipz

### Observed public product

- India-first direct UPI routing.
- Public claims of direct bank payment and no intermediary hold.
- Merchant routes for Paytm Business, PhonePe Business, Google Pay Business
  and HDFC SmartHub.
- Personal Amazon Pay UPI route with a different fee claim.
- Prepaid Alert Tokens used to deduct platform fees and support alert tooling.
- OBS alertbox, TTS, GIF/WebM/custom sound uploads, donation goals, supporter
  leaderboard, recent-tip ticker, Streamlabs/StreamElements and an OBS dock.
- Dashboard access redirects to a WordPress login page; private dashboard
  behavior remains unknown.

### Product lesson

The strongest lesson is clarity around payment routing and creator setup. The
riskiest pattern is personal UPI credential or OTP automation. Freetip should
start with one verified Razorpay integration, not consumer-payment automation.

## SuperTips

### Observed public product

- Next.js public application with creator directory and public creator pages.
- Public creator page includes name, email, preset amounts, custom amount,
  message input, UPI payment method and Razorpay checkout.
- Public creator page exposes supporters, XP ranks, Today and 30 Days filters,
  live-status data and leaderboard data.
- Public page shows a 150-character message counter and says higher tips unlock
  longer messages.
- Public bundles reference `/api/creators`, `/api/creators/:id/live-status`,
  `/api/transactions/leaderboard` and `/api/users/me`.
- Public pricing bundle contains Free at 8% commission and Pro at ₹999/month
  with 6% commission, detailed analytics, CRM, loyalty, goals and moderation.

### Product lesson

Public creator discovery, simple time filters and stream summaries are useful
later. XP, loyalty, CRM, membership detection, chat bot and multi-goal systems
are expansion features, not Freetip v1 requirements. The public page currently
asks for fan email; Freetip intentionally does not.

## HyperChat

### Observed public product

- Public creator page supports text, voice, sound and media contributions.
- Razorpay checkout is loaded on the public creator page.
- Public pricing data was fetched from a Supabase function:

```json
{
  "minText": 40,
  "minTts": 40,
  "minVoice": 80,
  "minHypersound": 300,
  "minMedia": 20,
  "ttsEnabled": true,
  "currency": "INR",
  "messageCharTiers": [
    { "min_amount": 0, "max_chars": 70 },
    { "min_amount": 100, "max_chars": 150 },
    { "min_amount": 300, "max_chars": 200 }
  ],
  "voiceDurationTiers": [
    { "min_amount": 0, "max_duration_seconds": 8 },
    { "min_amount": 150, "max_duration_seconds": 12 },
    { "min_amount": 300, "max_duration_seconds": 15 }
  ]
}
```

- Static bundle references a unified Razorpay order flow,
  `upload-voice-message-direct`, a status page with order/status tokens and
  creator-specific pricing.
- Public architecture copy describes a transaction ledger, audio queue,
  supporter aggregates, pre-aggregated totals, cursor pagination, RLS,
  signed moderation actions, manual/automatic moderation, Telegram/Discord
  moderation routing, an alert renderer and an idempotent event bus.

### Product lesson

The valuable pattern is the event lifecycle:

`tip input → payment order → verified status → moderation → queue → OBS alert`

Freetip should adopt the explicit status page, signed moderation actions,
idempotent event handling and pre-aggregated reporting. Voice, media, sound,
Hyperstore and multi-channel moderation should remain later work.

## Stack observations (1 November 2026)

A manual passive pass, because REA was not installed on this machine: public
homepages and their JavaScript bundles only, searched for API calls, hosts and
service names. No login, no private endpoints. These are what the public code
references, not proof of server behavior.

### SuperTips (supertips.store)

- Next.js (Turbopack) on Firebase: Firestore (about 140 references), Realtime
  Database in `asia-southeast1`, Firebase Auth and App Check. Firestore
  `onSnapshot` listeners and WebSocket references suggest the OBS overlay
  listens to Firestore directly.
- Razorpay is named once and UPI twelve times; the checkout and webhook code is
  not in the public bundles. Only `/api/users/me` is visible as an API path.
- Core feature is paid featured messages on stream, plus YouTube live-chat
  moderation and custom commands.

### HyperChat (hyperchat.space)

- Vite single-page app (4 MB bundle) on Supabase edge functions. Functions the
  browser calls: `create-razorpay-order-unified`, `check-payment-status-unified`,
  `upload-voice-message-direct`, `upload-donation-media`, `issue-upload-grant`,
  `get-overlay-config`, `get-streamer-pricing`, `get-goal-progress`,
  `get-leaderboard-data`, `get-pusher-config`, `list-hypersounds`,
  `list-streamer-soundboard`, `get-discord-link`; `get-payout-status` exists.
- Realtime alerts go through Pusher. The overlay URL carries a secret token
  checked by an `obs_tokens` table and `validate_obs_token_secure`.
- Sarvam does voice transcription and speech; ElevenLabs is referenced; Resend
  sends email; Telegram and Discord handle moderation; Cashfree appears once.

### Takeaways

Both follow `tip, Razorpay order, verified status, moderation, realtime push,
OBS overlay`, which Freetip already mirrors. Worth borrowing: short-lived upload
grants (like our Blob uploads) and a server-checked secret in the OBS link.
Neither publishes payout rules, so the payout design question is not answered.

## Freetip decisions

### Build first

- INR-only public creator page.
- UPI and card through Razorpay.
- No fan account and no fan email.
- Optional name and anonymous mode.
- Text-only message with a minimum tip and length limit.
- Screened message queue with approve-before-play.
- English and Hindi TTS after approval.
- One OBS browser-source alert path.
- Read-only owner finance dashboard and immutable ledger foundation.
- Explicit captured, failed, pending, refunded, disputed and reconciled states.

### Build later

- Tiered message length.
- Donation goals.
- Recent-tip ticker.
- Custom alert themes.
- Multiple voices.
- Voice and media tips.
- Telegram/Discord moderation.
- Supporter history and public creator directory.

### Do not copy initially

- Consumer UPI credential automation.
- Personal UPI OTP/session flows.
- Multiple payment-provider integrations.
- Token wallets.
- XP, loyalty and CRM.
- YouTube membership detection.
- Chat bot and broad multi-platform support.
- Instant payout or zero-hold promises before the account model is verified.

## Strimome (added 2026-11-01)

Indian streamer tipping site, `strimome.in`. A client-rendered React app (Firebase and Razorpay), so search engines see an empty page; read from its public JavaScript, not from watching it run. Fee numbers sit in its admin settings and are not public. Tagline: "Where support becomes a stream moment"; promises same-day payouts.

Ideas worth taking (all switched off by default; the owner turns them on per creator in `/admin/creators/<id>`, see `src/lib/plans.ts`):

- Support streak overlay (a counter with a countdown that keeps going while tips keep coming). Built 2026-11-01.
- Top supporter and recent supporters overlays, each with its own OBS link. Built 2026-11-01.
- Fan voice notes priced by length (5, 10, 15, 20 seconds), sold to creators as a paid subscription. Planned.
- Themed alert styles, many fonts, GIF placement. Planned.
- Birthday message. Planned. Fan levels, a fan list and paid highlighted messages are also on the planned list.
- Remember the fan's name on their device (no account): built 2026-11-01 (phase 1 polish, off by default, name only, `localStorage`).
- A TEST badge on test alerts and warnings never to show the overlay link on stream: built 2026-11-01 (phase 1 polish; TEST pill in `AlertStage.tsx`, warning in `OverlayTile.tsx`).

Not taken for now: international tips in USD, EUR and GBP (their code shows a 7% fee, a ₹200 cap and a separate 7-day settlement; it touches the same money rules as our payout engine), settle-on-demand (blocked by the aggregation question in `docs/rules-check.md`), a public streamer directory, and fan accounts with a follow list.

## How competitors move money to creators (deeper public pass, 2026-11-03)

Question asked by the owner: do the competitors pass tip money through their own gateway account, or do creators receive it directly? Three research agents read only public material (public pages, the JavaScript each site serves to every visitor, public legal text, public repos and registries). No logins, no account sign-ups, no calls to any backend. Nothing is confirmed by the competitors themselves; each claim is marked CONFIRMED (read directly), INFERRED or NOT VISIBLE.

### Two different "SuperTips" (do not blend them)

- **SuperTips, supertips.store** (also supertips.in): operated by Untested Technology Ventures LLP (Indore). This is the 8% free plan, 6% Pro at ₹999 a month product in the section above. The Pro "free until June 2026" notice is still shown in November 2026.
- **SuperTip, supertip.live**: operator not named, India-only, waitlist, Razorpay. It sits behind a bot check, so it was read only through search-tool summaries of its cached pages (second hand: re-read it in a browser before relying on it). `docs/rules-check.md` cites this one.
- `supertip.gg` is a US, Stripe-based product by another company and is unrelated.

### Answers

| Product | How money reaches creators | Confidence |
|---|---|---|
| HyperChat (hyperchat.space, Streamheart Private Limited) | Pass-through. One Razorpay account for all creators (its own public repo docs say a single `primary` account), no Route, split or linked-account code found. Creators give bank details and a required PAN, and HyperChat pays them itself. Its repo says payouts are "out of scope" of the app, so they are probably manual (INFERRED). | About 85% on "collected centrally"; about 65% on "payouts are manual" |
| SuperTips (supertips.store) | Probably a pass-through. The public checkout uses one hard-coded Razorpay key for every creator (a test-mode key in the build), the order comes from their server, and there is a Cashfree branch. Terms say earnings are "settled to the creator's registered bank account on a regular schedule". Whether payouts are manual, by API, or by Route/Easy Split set server-side is NOT VISIBLE. | Low to medium |
| SuperTip (supertip.live) | The creator's own connected payment account (Razorpay): "does not hold the funds", "Direct Settlement Architecture", creator does their own KYC and tax. Whether "connected" means pasted keys, Razorpay partner OAuth or Route is NOT VISIBLE. Second-hand only. | Medium |
| StreamTipz | Creator's own UPI or merchant ID; platform fee from prepaid Alert Tokens (see above). | Confirmed on its site |
| Coffee & Toffee (timewheel.co.in) | Razorpay Route linked accounts, release 2 days after payment (7 in the first month), creator pays Razorpay's fee. Its legal basis and Route eligibility were not found. | Confirmed on its site |

### HyperChat details

- Entity: Streamheart Private Limited, CIN U62099UP2025PTC235918, incorporated 4 November 2025, ₹10,000 paid-up capital (registry listing). The terms carry earlier dates, so earlier operation was probably by an individual.
- Terms: payouts monthly and "not guaranteed"; HyperChat may withhold a month's payout if the streamer starts using another tipping platform without telling it (a soft exclusivity lock-in). Tips are final. Chargebacks are not mentioned. Its About page says it does not process or store financial transactions and is not a settlement facilitator, which does not match collecting tips and paying creators out.
- Fee percentage, payout day, minimum, hold length and payout rail: NOT VISIBLE. A `₹299 monthly subscription` tag in the homepage HTML is unexplained.
- Creator KYC today: PAN and bank details only. Document, selfie and AML checks are planned in its repo, not live.
- **Correction:** the prices listed above (text ₹40, voice ₹150, sound ₹30, media ₹100) are per-creator settings or client fallbacks (the creator the first pass read had text ₹40, voice ₹80, sound ₹300, media ₹20). Do not quote them as HyperChat's prices. "Cashfree appears once" is a logo-list entry only.
- Its terms ban building tools on its alert data (liquidated damages of ₹25,000 to ₹50,000 a day). Do not copy clauses like these or the payout-withholding lock-in.

### SuperTips (supertips.store) details

- Fees: 8% free, 6% on Pro at ₹999 a month; the pricing page promises "3 business day payouts", while the terms say "a regular schedule". No minimum payout is published. Terms allow delaying, withholding or reversing settlements for fraud, chargebacks or violations.
- Creators need Google sign-in, YouTube channel verification and a valid bank account. No PAN, GST or document KYC is mentioned publicly (it may sit behind the login).
- Fan form: email required for guests, ₹20 to ₹25,000, UPI only, card listed as "coming next". All tips final; a chargeback without contacting support "may result in permanent suspension".
- Operator registry details (LLPIN, GST, directors) were not found.

### Providers and rules (from the payout-models pass)

- Razorpay Route: published gate is domestic turnover above ₹40 lakh plus a use-case review (the owner's own Razorpay reply says the same; RazorpayX needs ₹1.5 crore). Razorpay's Technology Partner (OAuth) programme lets a platform act on each creator's own Razorpay account; no turnover text is published, and where settlements land was not found.
- Cashfree Easy Split: "marketplaces and multi-vendor platforms", no turnover test published, but "settlement options depend on configuration and eligibility". Cashfree Embedded Payments gives each creator their own merchant ID, and the platform can mark up the fee; no formal criteria published. PayU split settlements and Paytm split settlement also publish no turnover test (not confirmed to accept a zero-turnover platform).
- RBI Payment Aggregator Directions (15 September 2025): no clause found that exempts a pure agent, a commission agent or "the tip is our own revenue"; one law-firm article says a platform that takes payments into its normal account and pays vendors less commission is an unlicensed aggregator and that the length of the hold is irrelevant. Whether tips count as a sale by the creator is unresolved.
- Razorpay's merchant terms (via a third-party archive) bar letting third parties use the service, limit marketplace payments to onboarded sellers, and let Razorpay suspend settlement at once. No documented freeze of a small tipping platform was found.
- Easebuzz declined by phone on 2026-11-03 (it does not onboard social media platforms).


- HyperChat and probably SuperTips (supertips.store) do what a manual payout sheet would do: collect into one gateway account and pay creators themselves. They are small and nobody has stopped them yet, but that is not evidence it is allowed.
- The clean models are creator-owned accounts (StreamTipz, supertip.live) or a licensed aggregator's split product. Two open questions to ask in writing: Razorpay's partner team (can each creator keep their own Razorpay account while we create orders and take a commission, and is there a turnover rule?), and Cashfree (Embedded Payments and Easy Split for a new platform). PayU is a third provider not yet asked.

## Re-check, 2026-11-03 (public pages only, nothing logged into)

Seen on each site's public page today unless marked "inferred". HyperChat and Strimome did not load (client-rendered), so the notes above stand for them.

### Changes to ones already recorded

- SuperTips (`supertips.store/pricing`): prices unchanged (Free 8%, Pro ₹999 a month at 6%). The Free plan now lists 3 business day payouts, no platform branding, one stream goal and a top-10 supporters view. Pro adds YouTube membership detection, a chat bot (up to 50 commands, still marked "Coming Soon" on the home page), stream widgets (goals, polls, timers) and loyalty tracking. "Free until June 2026" is still shown and is stale. The home page now lists custom alert themes and a smart stream recap.
- StreamTipz (`streamtipz.in`): still 5% on merchant UPI and 7% on personal Amazon Pay UPI, paid from prepaid tokens (1 token = ₹1); says money is never held in escrow. New: BharatPe route, an OBS custom activity dock, supporter receipts (merchant plan only), and a claim of Streamlabs and StreamElements integration. A rival's blog lists ₹149 to ₹399 a month plans for it; that contradicts its own page, so treat it as unreliable.
- HyperChat: only search snippets (a "Hyperpoints" rewards scheme). Fees and payouts not verified.

### New competitors

- Tips On Stream (`tipsonstream.in`): flat 10%, weekly Sunday payouts, UPI, cards, net banking and PayPal, goal widgets, moderation, TTS.
- StreamDono (`streamdono.in`): Razorpay; 5% for the first 30 days, then 10%; alerts with TTS, soundboard, goals, leaderboards.
- SuperStreamer (`superstreamer.in`): Starter ₹0 at 8% plus 2% processing; Premium ₹749 a month at 5% plus 2%; Ultra ₹2,499 a month at 2% plus 2%; payouts about 2 working days; 69 overlays; its own keep-rate figures contradict each other.
- Stream Alert (`streamalert.in`): an Android app that reads UPI notifications, 0% commission, ₹49 to ₹499 a month, Indic TTS, viewer GIF, voice note or video with approval through Discord, Telegram or web. Its 12,500+ streamers is its own unverified claim.
- StreamerHub (`streamerhub.in`): direct UPI at 0%, optional Razorpay tipping at 5%, free plan and ₹99 Pro, StreamElements and Streamlabs mirroring; the page contradicts itself on some counts.


- Behind on the headline fee against the direct-UPI and subscription models (0% to 5%). Freetip's 5% plus 2.75% is 7.75%. Ahead of the 10% sites. Against SuperStreamer it is better only than Starter (10%); Premium is 7% and Ultra 4%. So any "lowest total cost" claim would be false; the public pages make none and must not start.
- Ahead: no fan email, UPI and card in one flow, one flat fee with no subscription, Hinglish and regional voices, overlay variety (except SuperStreamer), the page builder.
- Payout timing: others publish 2 to 3 business days or a weekly day; Freetip promises none (honest, weaker as a pitch; the owner decided this on 2026-10-25).
- Worth considering: approving tips from Discord or Telegram (approve-before-play exists; only the channel is new). Streamlabs and StreamElements mirroring exists for Streamlabs.
- Not worth building now: viewer voice-note or video tips (moderation and storage cost; the owner dropped voice notes), chat bots and polls (a different product), membership detection, PayPal and international tips (touches payout rules).

## Subscription prices, public pages only (2026-11-04)

For the paid plan. Public pricing pages and review sites, no logins; re-check before quoting. Indian competitors mostly sell monthly only; where a yearly price exists the discount is 17% to 42%.

| Site | Monthly | Yearly | Note |
|---|---|---|---|
| Stream Alert (`streamalert.in`) | ₹49 / ₹249 / ₹499 | "Save 17%" toggle, no yearly amount shown | 50 / 500 / unlimited alerts a month; tip page and Indic voice only on ₹499; 5-day trial |
| SuperStreamer (`superstreamer.in`) | ₹749 (5% fee), ₹2,499 (2% fee) | none shown | Free Starter at 8% plus 2%; billed monthly via Razorpay |
| SuperTips (`supertips.store`) | ₹999 (6% fee) | none found | Free plan at 8%; Pro "free until June 2026" notice still shown |
| DonatorApp | ₹499 | none found | second-hand (a rival's blog) |
| StreamerHub | ₹99 Pro | not checked | from the 2026-11-03 pass |
| Streamlabs Ultra | $27 | $189 (about 42% off) | 7-day refund window; promo ended 1 Nov 2026 |
| Ko-fi Gold | $12 | no longer offered to new users | creators are told they no longer need Gold |
| Buy Me a Coffee | no paid plan | none | 5% fee plus card processing |
| StreamElements | free | free | earns from a processing fee (about 2.9%, June 2026); layoffs and sale talks reported May 2026 |

Reading: the Indian mid tier is ₹249 to ₹499 a month; ₹749 and above buys a lower fee, which Freetip does not sell. Freetip keeps the same fee on every plan, so its plan is features only and should sit near ₹299 with a yearly price about 30% lower. **No price is decided**: the owner said (2026-11-04) they will give the numbers later; `src/lib/pricing.ts` holds them and shows "price will be announced" until they are set. Suggested to the owner, not adopted: ₹299 a month or ₹2,499 a year, and an early plan of ₹149 a month or ₹1,299 a year for the first 50 creators, kept while they keep renewing.


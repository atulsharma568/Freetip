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

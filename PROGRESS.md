# Progress

Living status of the project. Read this first; it is updated with every commit. Product decisions are in `PRODUCT.md`, the design system is in `DESIGN.md`, the next steps, research findings and owner direction are in `docs/next-steps.md`, and `git log` has the detail.

## Current state (2026-10-25, updated after dashboard share controls)

Creator dashboard share controls (2026-10-25): the QR tile (`src/app/dashboard/CreatorQR.tsx`) now has Copy link (with a polite live-region confirmation), Share (only where the browser has the Web Share API), Download PNG (1024px, white margin, no smoothing so it scans) and Download SVG. Written in our own code; the idea came from Vengeance UI's Share Sheet (MIT) but no code was copied. Skiper UI is inspiration only: its terms ban copying and its source is paid, and this repo is public.

- Verified: tsc clean, lint clean on the file, build clean. Not tried in a browser (the dashboard needs a signed-in creator), so check Copy, Share (on a phone) and both downloads by hand.
- Live tip island (2026-10-25): `src/app/dashboard/TipIsland.tsx` polls `GET /api/dashboard/tips?after=<id>` every 8 s (paused while the tab is hidden). A new captured tip makes a pill rise from the bottom with name and amount, open to show the message, and fold away (6 s, 10 s with a message; holds while hovered or focused; tips queue). Rejected messages are never shown. The route only reads, so it does not touch the OBS alert's shown flags. Reduced motion keeps a quick fade. Not tried against real tips or in a browser (needs a signed-in creator with captured tips). Shortcut: it only announces tips that arrive while the dashboard is open and polls rather than pushes.
- Landing polish (2026-10-25), own code, ideas from Vengeance UI (MIT) and Skiper UI (inspiration only): `RevealHeading` (GSAP SplitText lines come into focus on first scroll; words are in the HTML from the start; skipped under reduced motion; used on Why, Fees, FAQ and On stream, not on the pinned steps or the closer), `ScrollEffects` (lime scroll-progress line using a CSS scroll-driven animation, hidden where unsupported; soft masked blur under the nav), `SafetySteps` (a lime block glides between the three speech-safety steps on mouse hover only) and `AsciiWordmark` (footer wordmark in ASCII that lights up near the pointer, repaints only while the pointer moves, still under reduced motion and on touch). Verified in installed Chrome against a production build: no horizontal overflow at 1440 and 320, progress line reaches full at the bottom, headings resolve with descenders intact, the footer lights up near the pointer. Local console shows the existing sign-in 500 because the local server has no `AUTH_*` settings. Not measured: PageSpeed with these added; re-run it.
- Tip page feel (2026-10-25), `src/app/[handle]/TipForm.tsx`: a big amount numeral above the presets that follows the chosen or typed amount (smaller as digits grow, a quick settle on each change, no motion under reduced motion), and a new success screen: a lime ₹ note slides in and flies off, the amount's reels spin, then "Send another tip" and Share (phone share sheet) or Copy link for the creator's page. Whole-rupee amounts use the reels; odd paise show as plain text. Checked in installed Chrome at 390 px through a temporary page (since deleted): numeral updates ₹10 to ₹12,500, success text and buttons present, no horizontal overflow (the flying note first caused some; fixed with `overflow-x-clip`). The real payment path (checkout to success) was not exercised: it needs Neon and a Razorpay test payment. Not built: the smooth-caret message field, judged low value for the risk.
- AWS account for Polly is still awaiting activation (2026-10-25); the TTS steps in the section below are unchanged.

## Current state (2026-10-23, updated after overlay text-to-speech)

Text-to-speech on the OBS overlay (2026-10-23): built, not yet heard. It has not been tried against real Polly or inside real OBS (no AWS credentials exist yet, and the Polly setup wizard is gone from `/tmp`).

- How it works: the overlay API marks an alert `speech: true` when the rules allow it; the overlay then downloads `GET /api/overlay/[token]/speech/[id]` (an MP3) before showing the card, plays it with the card, and keeps the card up until the voice ends (+1.5 s). Any failure (speech off, engine down, slow network, 204) shows the alert silently.
- Rules (pure, `src/lib/tts-rules.ts`, `test/tts-rules.spec.ts`): only the fan's message is spoken, never the name. It needs `tts_enabled`, a tip of at least `users.tts_min_paise` (default ₹49, creator's "Read aloud from" setting), and a message that is approved, or pending with "approve before play" off. A rejected message is never spoken. Links and invisible characters are stripped, and the text is capped at the creator's message limit or 300 characters. The speech route re-checks every rule from the database and speaks only the stored text, only for a message shown in the last 10 minutes.
- Previously `approve_before_play` was saved but not used anywhere. It now gates speech. Shortcut: in `instant` mode the message still shows on screen before approval (existing behaviour); with approve-before-play on it is just never spoken.
- Engine: Amazon Polly, Kajal neural (`src/lib/tts.ts`), Devanagari text read as `hi-IN`, everything else `en-IN`. Roman-script Hindi is read with an English accent (known limit). Plain text, never SSML. Env vars are `POLLY_ACCESS_KEY_ID`, `POLLY_SECRET_ACCESS_KEY`, optional `POLLY_REGION` (default `ap-south-1`), not `AWS_*`, which Vercel reserves. Without them alerts play silently. Swapping to Sarvam later only changes `synthesize()`.
- Browser note: a normal browser tab blocks sound until a click, so the voice is only heard in OBS (its browser source allows autoplay; tick "Control audio via OBS" to put it on the mixer). The `/overlay/preview` page does not speak.
- **To activate:** run `db/migrations/0010_tts_threshold.sql` in Neon **before or right after the deploy** (the dashboard and overlay queries read `tts_min_paise` and fail until it exists), create an IAM user allowed only `polly:SynthesizeSpeech`, add the two `POLLY_*` variables in Vercel, then test in real OBS.
- Verified: tsc clean, lint 0 errors (1 old warning), build clean, 12 new tts-rules tests plus 3 new overlay browser tests (speech downloaded and played; 204 plays silently; bad id and no database) and the existing overlay tests, all 32 passing in installed Chrome.

## Current state (2026-10-23, updated after OBS alerts)

OBS alerts, visual only (2026-10-23): a creator gets one private overlay link for an OBS Browser source; captured tips play as alerts. Text-to-speech is the next slice (speech inside OBS's browser source is unreliable and needs its own testing).

- Layouts: one link, the layout follows the source size. 1080p (1920×1080) and 2K (2560×1440) are one 16:9 design drawn at their own size; vertical (1080×1920) is a stacked layout. Everything is sized from one unit (1% of the stage width, measured with a ResizeObserver), not viewport or container units, which older OBS browsers may lack. Reduced motion falls back to a fade.
- Alert modes (creator's choice, `users.alert_mode`, default `split`): `instant` plays everything at once; `split` plays name and amount at once and the message as its own card once approved; `approve` plays nothing until the message is decided. A rejected message is never shown (in `approve` mode the tipper is still thanked). Rules are pure and tested: `src/lib/alerts.ts`, `test/overlay-rules.spec.ts`.
- Delivery: the overlay polls `GET /api/overlay/[token]` every 4 s. One query finds the creator by token hash plus candidate tips; the endpoint hands out at most one alert and marks it shown in the same request (`alert_shown_at` / `message_shown_at`), so it plays once. Shortcut: an OBS reload between hand-out and animation loses that one alert; an ack round trip would fix it. Alerts older than an hour are dropped so a late-opened overlay does not replay old tips.
- Link security: 32 random bytes, only the SHA-256 hash is stored (`users.overlay_token_hash`), shown once, regenerating kills the old link. Overlay pages are `noindex`, `no-referrer`, disallowed in robots.txt; the API is `no-store`, 404s on a malformed or unknown token before any lookup beyond one indexed query.
- Dashboard: "Alerts on stream" tile (create or replace link, OBS sizes, preview link), "Messages to approve" queue (hidden in `instant` mode), alert-mode radio in settings. `/overlay/preview` shows sample alerts at all three sizes, no secret needed.
- `decideMessage` lives in `src/app/actions/messages.ts`, not `creator.ts`: a "use server" file that a server component imports is evaluated on the server, and `creator.ts` exports plain constants, which fails the build.
- **To activate:** run `db/migrations/0009_obs_alerts.sql` in Neon.
- Verified: tsc clean, lint 0 errors (1 old warning), build clean, all 5 overlay browser tests and 15 rules tests pass in installed Chrome (Playwright's own browser download is blocked here; run with `channel: "chrome"`). 6 other desktop tests fail: 5 `/signup` waitlist/metadata tests expect the old waitlist form and title ("Sign up" vs "Get early access"), and the skip-link test on `/kabirplays`. Not caused by this slice; not checked against a clean `main`. Not done: end-to-end with real captured tips (needs Neon migrated and a Razorpay test payment), a check in real OBS.

## Current state (2026-10-22, updated after payment flow)

Razorpay payment flow (2026-10-22, commit d49eaee): fans can now pay on an active creator's tip page.

- `src/app/actions/tip.ts`: `createTipOrder` server action — validates amount (≥ min, ≤ ₹1,00,000), fetches active creator by handle, calls `POST /v1/orders` on Razorpay, persists `tip_orders` + `payment_attempts` rows, returns `razorpayOrderId` and `razorpayKeyId` to the client.
- `src/app/[handle]/TipForm.tsx`: real payment flow. Phase machine: idle → creating → checkout → success | error. Razorpay checkout.js loaded lazily at pay time. Success screen shows paid amount and "Send another tip".
- `src/app/api/webhooks/razorpay/route.ts`: handles `payment.captured` and `payment.failed`. Idempotent via `payment_attempts.provider_payment_ref` UNIQUE constraint. Updates `tip_orders.status` and `payment_attempts` on capture or failure.
- **Razorpay test keys are in Vercel.** To test end-to-end: activate a creator in `/admin/creators`, visit their tip page, and tip with Razorpay's test card (4111 1111 1111 1111, any CVV/expiry). The webhook fires if the webhook URL is registered in Razorpay dashboard.
- Not yet built: OBS alerts, text-to-speech, creator payout initiation.

## Current state (2026-10-22, updated after Razorpay activation gate)

Razorpay activation gate (2026-10-22, commit e1a6c60): creator payout onboarding flow that gates tip page activation.

- `db/migrations/0008_payout_onboarding.sql`: adds `upi_vpa`, `legal_name` and `onboarding_state` (`not_started` → `submitted` → `active` | `rejected`) to users.
- `submitPayoutDetails` server action: validates legal name and UPI VPA (regex `name@bankhandle`), stores to DB, sets `onboarding_state = 'submitted'`. Only accepted when state is `not_started` or `rejected`.
- `PayoutOnboarding.tsx`: dashboard tile that branches by state — form → under-review panel → live. Pre-fills legal name from Google name, shows submitted UPI VPA back to creator.
- Dashboard: pending tile replaced with `PayoutOnboarding`.
- `setCreatorStatus` (admin): now syncs `onboarding_state` — approving → `active`, resetting to pending → `not_started`.
- `rejectCreatorOnboarding` (admin): sets `onboarding_state = 'rejected'`; creator can resubmit.
- Admin creators page: Payout column shows `onboarding_state` badge + UPI VPA; Reject button for submitted-but-pending creators.
- `POST /api/webhooks/razorpay`: HMAC-SHA256 signature verified with `RAZORPAY_WEBHOOK_SECRET`; stubs for `payment.captured` and `payment.failed`.
- `.env.example`: documents `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- **To activate:** run `0008_payout_onboarding.sql` in Neon. Add `RAZORPAY_WEBHOOK_SECRET` to Vercel when the Razorpay account is created.

## Current state (2026-10-22, updated after security pass)

Security hardening (2026-10-22): confirmed live bypass of admin layout auth via RSC partial render — all 8 admin page.tsx files now call requireOwner() directly, independent of the layout; handle param validated against HANDLE_PATTERN before any DB query in [handle]/page.tsx; admin.ts args runtime-validated; auth.ts: email_verified required, fail-closed in production when DB missing, email unique-collision handled, access_type offline removed; next.config.ts: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy headers on every route; cron route: timingSafeEqual for bearer secret; creator.ts: redirect moved after try block, generic error catch, expanded RESERVED set; db.ts: ssl: "require" explicit.

## Current state (2026-10-22, updated after creator onboarding slice)

Creator onboarding / public tip-page data (2026-10-22): two gaps that blocked creators from feeling fully onboarded are now closed.

1. **Custom display name**: new `display_name` column (migration `0007_display_name.sql`). Creators set a streamer name in dashboard settings (first field, above bio, 50-char limit). The tip page uses `display_name ?? name` everywhere — h1, `<title>`, og metadata. Falls back to Google name when unset.
2. **Self-preview on the tip page**: `/[handle]` now calls `auth()` server-side and compares the viewer's Google ID against the creator's. When a creator visits their own page while `pending` or `suspended`, they see the full `TipForm` with a "Preview — your page isn't live yet." banner instead of the generic "Not live yet" screen. Non-creator visitors on a non-active page still see the `NotReady` screen. Active creators show the standard "Tips open soon" banner to all visitors.

**To activate display names:** run `db/migrations/0007_display_name.sql` in the Neon SQL Editor (safe to re-run).

Lint: 0 errors (1 pre-existing warning in `date-range.ts`). tsc: clean. Build: clean.

## Current state (2026-10-22, updated after skill pass)

Multi-skill enhancement pass (2026-10-22): a code review found 7 code-quality issues (2 must-fix before Razorpay, tracked in PROGRESS); design critique (two-reviewer, 24/40 fan, 21/40 creator) applied: upfront "Tips open soon" banner on fan tip page, removed Razorpay KYC CTA from dashboard, promoted creator h1 to display type, moved anonymous toggle above name field, added "No account or email" trust line, added handle rules hint in HandleSetup, "Saving…" → "Claiming…", fixed 8 mechanical design-system violations (beam on lime buttons, lime glow shadow on inputs, mono on counters, border-control on non-interactive tiles, rounded-2xl → 20px, text-accent on success text, select chevron added, aria-live only near char limit). Lint, tsc and build pass.

## Current state (2026-10-22, updated)

Pre-launch landing page for a UPI-first tipping site for Indian YouTube live streamers, built with Next.js 16, Tailwind v4, GSAP, Lenis and one React Bits component.

Page sections, in order:
- Hero: headline, subline, a call to action, a hands-handoff animation and a self-playing sample tip card that starts after the hands finish.
- How it works: four steps (claim, share, go live, get paid) that slide sideways under a lime progress line on desktop.
- On your stream: a labeled sample OBS alert whose message lights up word by word, like text-to-speech reading it.
- Why Tipsite: no fan account or email, optional anonymous tips, UPI + card in one flow, a clearly labelled sample QR-first sharing treatment, and safer text-to-speech with screening and creator approval in the planned flow.
- Payments and fees: UPI, cards and "We take 5% of every tip."
- FAQ and a closing section: a money orbit around the glitching wordmark, then the waitlist form (optional handle with the typing handle field, plus email).
- `/signup` and `/signin` use Google OAuth (next-auth v5). On sign-in the creator's YouTube channel is fetched and saved. `/dashboard` is a protected early-access holding page. Nav switches between Sign in/Sign up (logged out) and Dashboard/Sign out (logged in).
- **Needs Vercel env vars before auth works:** `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `db/schema-users.sql` run in Neon.
- Deployed (2026-10-16) at https://tipsite.vercel.app on Vercel, with the server pinned to Singapore (`sin1` in `vercel.json`) next to the Neon Postgres database (AWS Singapore).
- A real waitlist: a Server Action saves entries to Neon Postgres with server-side checks, a bot trap, a per-network rate limit and a daily clean-up job. It needs `DATABASE_URL`, `WAITLIST_SALT` and `CRON_SECRET` in Vercel and `db/schema.sql` run once (see "Waitlist setup" below); without them the form says the waitlist isn't working.
- A share image for link previews, an iPhone home-screen icon, a 404 page that explains creator links aren't live yet, `robots.txt` and `sitemap.xml`.
- Policy and company pages: `/terms`, `/privacy`, `/refunds`, `/delivery`, `/contact` (with Grievance Officer), `/pricing` and `/about`, linked from a new footer on every page. They are drafts: operator details are `[placeholders]` in `src/lib/legal.ts`, and the text needs legal review before launch.

Creator tip page and handle setup are now built (commit a1ea23e, 2026-10-22). Not built yet: Razorpay payment processing, real KYC onboarding flow, OBS alerts, text-to-speech. The first approved implementation slice is a read-only owner-finance foundation: forward ledger schema, server-side owner authorization, protected `/admin` pages and honest empty states. The product name "Tipsite" and the domain `tipsite.in` are placeholders.

## Owner-finance foundation (2026-10-22)

- Scope: read-only owner finance foundation; no Razorpay payment execution, webhooks, refunds or payouts yet.
- `db/migrations/0001_finance_foundation.sql`: double-entry ledger, tip orders, payment attempts, fee lines, refunds, disputes, settlements, creator payouts, reconciliation, audit events. Append-only triggers on ledger and audit tables.
- `db/migrations/0002_finance_gap_fill.sql`: fills four gaps in 0001 — versioned `platform_fee_policies` (seeds 5% launch rate), `provider_events` for idempotent Razorpay webhook ingestion, `settlement_items` linking payments to settlement batches, `tip_orders.anonymous` flag, and `updated_at` columns + triggers on mutable tables.
- `src/lib/owner-auth.ts` + `owner-auth-core.ts`: server-side owner guard using `OWNER_GOOGLE_IDS` env var; unauthenticated → redirect to `/signin`, non-owner → 404.
- `/admin` layout + pages: protected admin shell with nav; sub-pages (`/admin/finance`, `/admin/audit`, `/admin/reconciliation`) are honest empty states — no fabricated totals.
- Splash/scroll-lock isolated from `/admin`: `SplashScreen` sets `data-splash="true"` on body; `SmoothScroll` only freezes Lenis when that flag is present. Admin pages scroll freely.
- **To activate:** run `0001` then `0002` in Neon SQL Editor; add `OWNER_GOOGLE_IDS=<your-google-id>` to Vercel env vars.
- Competitor findings from the public REA pass are maintained in `docs/competitor-findings.md`.
- `db/migrations/0001_finance_foundation.sql` now defines the forward-only finance tables, ledger accounts, reconciliation records and append-only history triggers. It does not connect to Razorpay.
- `src/lib/owner-auth.ts`, `src/app/admin/` and the owner route test now provide a server-side owner allowlist and read-only admin shell. Unauthenticated `/admin` requests redirect to `/signin`; the owner allowlist fails closed when unset.
- Finance, reconciliation and audit pages currently show empty states only. No payment, refund, settlement or payout action is exposed.

## Creator tip page and handle setup (2026-10-22, commit a1ea23e)

- `db/migrations/0003_creator_onboarding.sql`: adds `creator_status` (pending/active/suspended, default pending) and `razorpay_account_id` (nullable) to `users`. Safe to re-run.
- `src/app/actions/creator.ts`: `setHandle` server action — validates handle regex, checks uniqueness, redirects to `/dashboard` on success.
- `src/app/dashboard/HandleSetup.tsx` + updated `page.tsx`: dashboard now fetches the user row and branches — no handle → handle-picker form; handle set → tip page link + StatusBadge (pending/active/suspended) + next-step tile linking to `/contact` until Razorpay onboarding is built.
- `src/app/[handle]/page.tsx`: dynamic server route; unknown handle → 404; non-active creator → NotReady screen; active creator → tip form. Includes `generateMetadata` per creator.
- `src/app/[handle]/TipForm.tsx`: fan tip form — ₹49/99/199/499 presets + custom, optional name (disabled when anonymous), 150-char message with live counter, plasma anonymous Switch, beam Tip button. `useGSAP` (scoped) staggers five sections in on mount. Tip button shows a "payments coming soon" message since Razorpay is not yet integrated.
- **To activate a creator:** run migration 0003 in Neon, then `UPDATE users SET creator_status = 'active' WHERE handle = 'yourhandle';`

## Implemented in the latest changes

Fee correction and UPI MDR FAQ (2026-10-21, commit cd2c5a9):

- `src/lib/legal.ts`: gateway fee corrected to Razorpay standard 2% + 18% GST = 2.36% effective; worked example updated from ₹92.50 → ₹92.64 on a ₹100 tip.
- `src/components/sections/Faq.tsx`: "What does it cost?" answer updated to match; new FAQ item "Is there an extra charge on large tips?" explains the govt-mandated 0.4% UPI MDR on tips above ₹2,000 (comes out of creator payout, not the fan's tip).

TTS decision (2026-10-21):
- Engine: Amazon Polly, Kajal Neural voice (bilingual Hindi+English). Free tier: 1M chars/month for 12 months. After month 12: switch to Sarvam AI Bulbul V4 Flash (better Hinglish, ~6x cheaper at ₹200/10,000 alerts vs Polly's ₹1,350). Switch is a single API call change.
- Rejected: Web Speech API and Edge TTS (poor Hinglish), ElevenLabs (mispronounces Roman-script Hindi), Sarvam now (only 100 free credits on signup, not enough for MVP).
- TTS is a threshold feature, not default-on: creator sets a minimum tip amount (e.g. ₹49+) and a message character cap (e.g. 100 chars). Tips below the threshold get a silent alert only. This controls API cost and mirrors how StreamElements handles it.
- Setup wizards: Razorpay KYC at /tmp/razorpay-kyc-wizard.sh, Polly at /tmp/polly-setup-wizard.sh.
- Not built yet — decisions recorded here for when the tip page is built.

Payment provider decision (2026-10-21): Razorpay confirmed as the payment provider. Cashfree was considered (lower headline rate) but Razorpay wins on zero annual fee, higher UPI success rate (~93% vs ~80–85%) and lower total cost at early volumes. Cashfree breaks even only above ~₹2 crore/year GMV.

Google OAuth live (2026-10-21):

- `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` added to Vercel production env vars.
- `db/schema-users.sql` run in Neon — `users` table created.
- Google Cloud Console: OAuth 2.0 client created, YouTube Data API v3 enabled, redirect URI `https://tipsite.vercel.app/api/auth/callback/google` added, owner added as test user.
- Sign-in tested live: Google popup opens, owner signed in, `/dashboard` early-access screen shown correctly. Auth is fully working on `tipsite.vercel.app`.
- When the real domain is ready: add the new redirect URI in Google Cloud Console and update `AUTH_URL` / `NEXT_PUBLIC_SITE_URL` in Vercel — no code changes needed.

Google + YouTube OAuth sign-up and sign-in (2026-10-21):

- `next-auth@beta` (v5) installed; `src/auth.ts` configures Google OAuth with `youtube.readonly` scope.
- On first sign-in the access token is used to call the YouTube Data API v3 and persist the creator's channel ID, name and URL to the new `users` table (`db/schema-users.sql` — run once in Neon).
- `src/app/api/auth/[...nextauth]/route.ts` exposes the NextAuth handlers.
- `/signup` now shows a single "Continue with Google" button; `/signin` shows "Sign in with Google". Both redirect to `/dashboard` on success.
- `/dashboard` is a server component that requires a session (redirects to `/signin` if absent) and shows an early-access holding screen with what's coming.
- Nav shows Dashboard + Sign out when signed in, Sign in + Sign up when signed out.
- `SessionProvider` added to the root layout.
- `GlassOrbButton` extended to accept `onClick` as an alternative to `href`.
- Pre-existing lint error in `GlobalBackground.tsx` fixed (setState inside effect body).

**Env vars needed in Vercel before this works:**
- `AUTH_SECRET` — generate with `openssl rand -base64 32`
- `AUTH_GOOGLE_ID` — Google Cloud Console OAuth 2.0 client ID
- `AUTH_GOOGLE_SECRET` — matching client secret
- Authorised redirect URI to add in Google Cloud Console: `https://tipsite.vercel.app/api/auth/callback/google`

**DB:** run `db/schema-users.sql` once in the Neon SQL Editor.

Three animation correctness fixes (after the splash/title-screen feature):

- `SplashScreen.tsx`: removed dead `splash-done` class addition (CSS was already updated to use `page-scrolled`; the old class had no effect).
- `globals.css`: `.rise` and `.enter` animations are paused while `body` lacks `page-scrolled`, so they play from the start when the user first scrolls rather than silently completing during the invisible splash phase.
- `GlobalBackground.tsx`: checks for `page-scrolled` on mount so it sinks immediately under reduced-motion (where the SplashScreen adds the class in a layout effect before this component's regular effect runs).

Commit `f72dd37`–`f6175c4` added:

- A full-viewport `SplashScreen` that plays the hands animation once on page load, then fades out.
- A `GlobalBackground` with orbiting ₹ notes/coins and the glitch wordmark. After the splash it shows at full opacity as a title-screen moment; it sinks to `blur(28px) / opacity 0.22` on the user's first scroll/wheel/touchmove, while the page content simultaneously fades in (both 600 ms).
- `globals.css`: `.page-content` is opacity 0 until `body.page-scrolled` is set; animations inside it are paused during that phase.

Commit `186664c` added and pushed:

- A flat SVG handoff animation in the hero: one hand brings a lime ₹ note, the other receives it, and both retreat. Reduced motion holds a static handoff frame.
- A "Why Tipsite" section covering the competitor-derived choices: no fan account or email, anonymous tips, UPI + card, QR-first sharing and safer approved text-to-speech.
- A clearly labelled non-scannable sample QR illustration; live creator QR generation is not implemented.
- Sample-card labels for optional names, anonymous tipping, message limits and approval-before-play.
- Updated stream copy, FAQ, primary navigation, footer navigation, README, product notes and project guidance.

The landing page presents these as samples or planned product behavior. It does not claim that the backend already exists.

## Not implemented yet

- Razorpay checkout, payment verification or INR payouts.
- Creator tip pages, handles, dashboards or authentication.
- Live QR generation per creator.
- OBS connection or real text-to-speech playback.
- Message-limit enforcement, profanity/banned-word filtering and creator approval controls.
- Real accounts (sign-in method undecided) and launch emails to the waitlist.

## Decisions

- Tips by UPI or card, no fan account. Payments through Razorpay with INR payouts (planned, not integrated).
- OBS stream alerts and text-to-speech of the fan's message, so fans can add an optional name and message.
- Platform fee: 5% of every tip. Razorpay's charges sit on top of the 5% and are paid by the creator out of the payout; fans pay exactly the tip (owner, 2026-10-14). At Razorpay's standard rate (2% + 18% GST on that charge) a ₹100 tip leaves the creator ₹92.64.
- Product edges to carry into the future tip page: no fan email, anonymous tips, QR-first sharing, message limits, profanity/banned-word screening and creator approval before text-to-speech.
- Look: dark, flat, one lime accent.
- Audience: Indian live streamers first.
- Scope for now: landing page only.
- The page stays short, clean and to the point: only what is necessary, and something new rather than a copy of the reference sites (owner, 2026-10-13).

## Open questions

- Hands animation in the hero: the polished version is committed "for now" (owner, 2026-10-14). The owner said it is not what they imagined, so a further revision may follow.
- Payout timing, paid highlighted messages, product name and domain, sign-up and sign-in mechanism (email code, password or Google).
- Exact message length, moderation settings and the approval interface for text-to-speech (needed with the tip page).

- Legal drafts set these defaults for the owner and a lawyer to confirm: everyone (fans too) must be 18+; refund requests within 7 days, acknowledged in 24 hours with a ticket, decided in 5 working days, started within 2 working days, banks take 5 to 7 working days; grievances acknowledged in 24 hours and resolved in 15 days (content removal 24 to 72 hours); privacy requests done in 30 days; support replies within 1 working day; tip names and messages kept 90 days, waitlist entries at most 12 months after the waitlist closes, payment records up to 8 years; liability capped at 12 months of fees (creators) or the tip (fans); 15 days' notice of term changes, 30 days for a fee rise.
- Operator details still needed in `src/lib/legal.ts`: legal name, business type, registered address, court city, support email, phone, hours, Grievance Officer name, designation and email, GSTIN (if any), data region.

## Search engines and sharing

- `robots.txt` blocks search engines until `NEXT_PUBLIC_SITE_URL` is set to the real domain, so the placeholder name and the vercel.app address stay out of search results. Set it in Vercel once the domain is chosen. Link-preview fetchers (WhatsApp/Meta, X, LinkedIn, Slack, Telegram, Discord) are allowed in meanwhile, since Meta's skips the preview when robots.txt turns it away.
- Draft policy pages carry `noindex` and stay out of the sitemap while `LEGAL_DRAFT` is true.
- Link previews use `src/app/opengraph-image.tsx` (fonts in `src/assets/fonts`, OFL-licensed). Without `NEXT_PUBLIC_SITE_URL`, Vercel's production address is used for the image link.

## Waitlist setup (done 2026-10-16; kept for a rebuild)

1. Create a free Neon project (region: Singapore or Mumbai if offered, closest to India) and copy the **pooled** connection string.
2. In the Neon console, open the SQL Editor, paste `db/schema.sql` and run it. Running it again is safe.
3. In Vercel, Project settings > Environment Variables, add `DATABASE_URL` (the pooled string), `WAITLIST_SALT` and `CRON_SECRET` (each from `openssl rand -hex 32`), then redeploy. `vercel.json` schedules the daily clean-up once the project is on Vercel.
4. `dataRegion` in `src/lib/legal.ts` names the Neon region for the privacy policy (Singapore); keep it and `regions` in `vercel.json` in step if the database moves.
5. To see sign-ups: Neon SQL Editor, `select * from waitlist order by created_at desc;`.

How it behaves: emails are trimmed and lower-cased, one entry per address. A repeat sign-up gets the same "You're on the list" answer and leaves the first entry untouched, so the form never reveals who has joined. Handles are noted, not reserved. Each entry stores the privacy notice version (`WAITLIST_CONSENT_VERSION` in `src/lib/legal.ts`). At most 20 saved sign-ups per network per hour; only an HMAC of the IP is stored, kept for the hour the limit needs and deleted on every sign-up and by the daily job (the privacy policy says within 48 hours at the latest).

## Next

See "Next steps" in `docs/next-steps.md`; that is the single list.

## Working agreement

Finished, verified changes (lint, type check and build pass) are committed and pushed to `main` together with an update to this file.

## Verification

Every change runs `npm run lint`, `npx tsc --noEmit`, `npm run build` and `git diff --check`. Since 2026-10-15 there is also a Playwright suite, `npm run test:e2e` (see README); run it before committing changes to pages or forms.

## Implemented in the latest change (2026-10-21, second commit)

- **GlobalBackground title-screen + sink**: after the splash the background (glitch wordmark + money orbit) is now at full opacity with no blur — a brief title-screen moment. On the user's first scroll, wheel or touch-move it sinks to `blur(28px) / opacity 0.22` over 600 ms simultaneously with the page content fading in. Wordmark resized to `clamp(5rem, min(28vw, 45vh), 28rem)` so it scales to the viewport on any device and fits on landscape mobile (constrained by 45 vh).
- **Content gated on scroll**: `.page-content` starts at `opacity: 0` and transitions to `opacity: 1` when `page-scrolled` is added to body on first scroll. Reduced-motion users skip the title-screen: both `splash-done` and `page-scrolled` are added immediately so content appears without needing a scroll. Lint, typecheck, build and `git diff --check` passed.

## Implemented in the previous change (2026-10-21, first commit)

- **Fullscreen splash intro**: `SplashScreen` component plays the handshake animation fullscreen (fixed, z-100, bg-ground) on every page load. When the animation completes the overlay fades out over 700 ms, revealing the landing page. Reduced-motion users get an instant fade (motion-reduce:duration-0). HeroHands gained an `immediate` prop that skips ScrollTrigger and plays on mount.
- **Global animated background**: `GlobalBackground` component renders a fixed full-viewport layer (z-[-1], pointer-events-none) behind the entire landing page — the orbiting ₹ notes and coins plus the glitching "Tipsite" wordmark, blurred 30 px and dimmed to 17% opacity via inline CSS. Pauses on hidden tab via visibilitychange. Content above it reads clearly; the effect reads as ambient light from below.
- **Cleanup**: removed `HeroHands` from the hero section (it now lives only in the splash). Removed local `MoneyOrbit` from the Closer section (replaced by the global background). Removed the `handsDone` state from Hero; TipCard now starts ready immediately.

## Log

- 2026-10-13: landing page built (hero with sample tip card, steps, fees, FAQ, closing claim form).
- 2026-10-13: added the "On your stream" sample alert, OBS and text-to-speech copy and the 5% fee; checked layouts from 320px to 1440px and reduced motion.
- 2026-10-13: published to GitHub; added this file and the working agreement.
- 2026-10-13: reviewed Hyperchat, StreamTipz and SuperTips; recorded the findings, the owner's direction (clean, to the point, hands animation idea), the proposed scope and the next steps in `docs/next-steps.md`.
- 2026-10-14: added the hero handoff prototype: flat SVG hands enter with a lime ₹ note, exchange it, and retreat; reduced motion holds a static handoff frame. `git diff --check` passed.
- 2026-10-14: added the competitor-led "Why Tipsite" section and aligned the sample card, stream copy, FAQ and navigation around no fan email/account, anonymous tips, QR-first sharing and safer approved text-to-speech. `git diff --check`, lint, typecheck and production build passed; no automated test suite is configured. A production server smoke check also returned the home page successfully.
- 2026-10-14: reconciled `README.md`, `docs/next-steps.md`, `PRODUCT.md`, `PROGRESS.md` and `DESIGN.md` with the shipped implementation, including the competitor strengths retained, the defaults rejected and the distinction between landing-page demonstrations and future product functionality. Markdown diff check, lint, typecheck and production build passed again.
- 2026-10-14: replaced the hero hands. Three hand-drawn GSAP SVG variants were built and judged; the winner was polished and committed. The fan's hand pinches a lime ₹ note, the streamer's hand closes on it, the fan's pinch opens, and the streamer leaves with the note (about 2.7 s, once, on scroll into view; reduced motion shows the exchange frame). The sample tip card now waits for the hands to finish so only one thing moves at a time. The owner approved it "for now"; it is not yet what they imagined. Also finished the FAQ (fan account/email, card, cost, payouts, OBS alerts, text-to-speech approval, QR code, Super Chat, live status), with no unconfirmed fee or payout numbers. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-14: researched Razorpay costs for the fee decision (standard 2% + GST; owner decision still open). Started a visitor-only competitor teardown with REA (`rea-agents@6.4.0`); Hyperchat is done (outputs kept outside the repo), SuperTips and StreamTipz are paused at the owner's request.
- 2026-10-14: built the three shortlisted pieces (owner request): a flat "Tip anonymously" switch in the sample card (clears and disables the name field), a stepped-ticks loader on the card's new "Sending" step before the success flood, and a letter-roll hover on the nav, hero, closing and card buttons. Tightened card spacing so the hero still ends 30px above the fold at 1440x900. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-14: built three more owner-picked ideas from ThreeUI, rebuilt flat: the nav eases into a floating capsule on scroll with a solid lime pill sliding behind the hovered or focused link; the sample card's success amount lands on odometer reels; the hero CTA ends in an ink circle whose arrow flies out and back in on hover. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-14: rebuilt five ThreeUI pieces the owner asked for, lighter and in our own code, with lime glow allowed only on them (owner-approved exception to the flat rule): a glass orb "Claim your handle" in the nav, a plasma canvas "Tip anonymously" switch, a frosted nav capsule whose links spring like a dock, a full uplink panel that counts the sample tip out before the success flood, and a ring of lime notes and coins circling a glitching "Tipsite" wordmark above the closing claim form. The odometer amount was not removed; it still lands on the success screen. Canvases pause off screen and reduced motion shows still frames. Checked at 1440, 390 and 320 (no horizontal overflow) and under reduced motion. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-14: owner decided that Razorpay's charges sit on top of the 5% and are paid by the creator from the payout. The fee tile now shows a worked ₹100 example (₹5 our fee, ₹2.36 Razorpay at its standard 2% + 18% GST, ₹92.64 to the creator) and the FAQ says the same. Also finished visitor-only legal/contact teardowns of SuperTips and StreamTipz with REA (outputs and a summary kept outside the repo) for the upcoming legal pages. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-15: added a Playwright end-to-end suite, added in PR #1: 47 tests across desktop Chrome, mobile Chrome and iPhone WebKit (WebKit skips the Tab test, which its emulation doesn't support). Review found the overflow test only measured the top and bottom of the page, so it missed the On stream overflow fixed on 2026-10-14; it now records the widest point while scrolling, and a new test waits for the approval row at 320px. Both fail when that bug is put back (424px instead of 320). The robots test now follows `NEXT_PUBLIC_SITE_URL` instead of assuming crawlers are blocked. Re-committed under the owner's no-reply address because the PR commit used a personal email; this repo's git config now uses the no-reply address. 94 of 94 Chromium tests passed locally in the installed Chrome (Playwright's browser download is blocked on this network, so WebKit was not rerun here).
- 2026-10-14: phone and launch checks (owner request). Emulated a low-end Android (360px at 3x, touch, CPU slowed 6x, no cache): on slow 4G the home page paints at 1.4s, largest paint 2.8s (the hero subline, held by its staggered fade-in, not by fonts), layout shift 0, blocking time 72ms, touch scrolling with no frame over 50ms, worst tap response 88ms; on 3G largest paint 3.3s; other pages paint fully under 0.9s. About 490 KB per page (227 KB JS, 219 KB fonts). Own accessibility checks (accessible names from Chrome's tree, duplicate ids, headings, text contrast on 135+ elements per page with the lowest at 6.69:1, target size, hidden focusables, keyboard tab order and focus rings) found two real issues, both fixed: "Back to home" was a 20px-tall target (now 44px), and when On stream's first sample approved itself, a keyboard user on Approve lost focus to the top of the page (now moves to "Send the sample tip again"). Added a share image, an iPhone icon, a 404 page, `robots.txt` and `sitemap.xml`, and `noindex` on draft policy pages. Lint, typecheck, both builds and `git diff --check` passed. A third-party scanner (axe) and Lighthouse were not run: the permission check blocked loading downloaded code into the test browser; run PageSpeed Insights on the deployed URL instead.
- 2026-10-14: made the waitlist real (owner request; owner chose Vercel + Neon Postgres). The closing form and `/signup` now send to a Server Action that re-checks every field, drops bot-trap submissions, rate-limits per network with a hashed IP, and saves to Postgres (`db/schema.sql`, `postgres` client); a Vercel Cron route deletes old rate-limit rows daily. The submit shows the stepped-ticks loader and "Joining", the handle field sweeps once, a consent line links the privacy policy, and invalid fields get focus back. Works without JavaScript too. The privacy policy now says hashed IPs are deleted within 48 hours (it said 24, which a daily job can't guarantee) and that the form used is stored. Also fixed a 104px horizontal overflow at 320px in On stream while the sample waits for approval. Tested against a local in-memory Postgres: valid, invalid email/handle/channel, repeat email, bot trap, rate limit, clean-up job, database down, no-JS; checked at 1440, 390 and 320. Lint, typecheck, both builds and `git diff --check` passed.
- 2026-10-14: added draft policy and company pages written in our own words from the SuperTips/StreamTipz/Hyperchat teardowns and Indian requirements (Razorpay website checklist, DPDP Act 2023 and Rules 2025, IT Rules 2021 grievance timelines, Consumer Protection E-Commerce Rules 2020): terms, privacy, refunds and cancellations, delivery, contact and grievances, pricing and about, plus a footer linking all of them on every page. Operator details are placeholders in one file (`src/lib/legal.ts`), every page shows a draft notice, and the fee example now comes from one shared constant. Checked at 1440 and 320 (no horizontal overflow). Lint, typecheck, build and `git diff --check` passed.
- 2026-10-16: first deploy (owner): Neon project in AWS Singapore with `db/schema.sql` run, Vercel project at https://tipsite.vercel.app with the three secrets. Pinned Vercel's server to Singapore (`sin1`) so each sign-up doesn't cross to the default US region and back; the first deploy ran from Mumbai's edge to the default region. The privacy policy now names Singapore as the data region, lists Vercel and Neon as in use rather than "from launch", and is dated 16 October; the waitlist consent version moved to `privacy-2026-10-16` to match. Checked the live site: every page 200, unknown paths 404, robots.txt blocks all crawlers, share image and icon load, the share image link points at the vercel.app address, and the clean-up job rejects calls without the secret (401). A live test sign-up was not run from here (the permission check blocks writing to the production database); the owner checks it in a browser. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-16: the owner's WhatsApp test showed no link preview. The tags, the image (1200x630 PNG, 53 KB, early in `<head>`, same for every user agent) and range requests were all fine; the blocker was robots.txt's blanket `Disallow: /`, which Meta's preview fetcher obeys. robots.txt now lets link-preview fetchers in (not `/api/`) while search engines stay blocked, and the e2e test checks it. PageSpeed Insights: the public API was out of daily quota and the report page needs JavaScript, so the owner sends the numbers. Lint, typecheck, build and `git diff --check` passed; robots.txt output checked against the test's patterns.
- 2026-10-16: PageSpeed Insights mobile on the vercel.app address (owner): Performance 86, Accessibility 96, Best Practices 100, SEO 63 (expected: robots.txt blocks search engines until the real domain), FCP 1.4s, LCP 3.7s, TBT 90ms, CLS 0, Speed Index 4.9s. The largest paint was the hero subline, held invisible by its staggered fade-in (and later still while the phone's main thread ran JavaScript). The headline lines and subline now show from the first paint and only rise into place; in the emulated low-end phone (slow 4G, CPU 6x) LCP now equals FCP (about 0.87s locally, was about 1s after it on the live site). Also moved the nav's sliding highlight out of the link list (lists may only hold list items; a likely accessibility deduction, though that nav is desktop-only); the pill still lines up with each link. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-16: PageSpeed's accessibility deduction was colour contrast. Our earlier contrast check skipped semi-transparent text; rerun with opacity counted, the only failure was the faded "yourname" in the `tipsite.in/yourname` link chip on the lime closing section (3.86:1 at 60% opacity). It is now at 75% and passes 4.5:1 there and on `/signup`; every other page passes. Lint, typecheck, build and `git diff --check` passed.
- 2026-10-16: owner re-ran checks: PageSpeed accessibility now 100, and the WhatsApp link preview works. The missing preview was WhatsApp's own "Disable link previews" setting on the owner's phone; the robots.txt change still matters for Meta's fetcher (Facebook, Instagram, WhatsApp's server-side previews).
- 2026-10-16: added GitHub Actions CI (`.github/workflows/ci.yml`), added in PR #2: on every PR and push to main it runs `npm ci`, lint, route type generation, `tsc`, build and the Chromium Playwright projects, with read-only permissions, no secrets, an empty `DATABASE_URL`, and actions pinned to commit SHAs (checked against the official v7.0.1 checkout and v7.1.0 setup-node tags). Review fixed the flaky "approval row fits a 320px phone" test: the sample approves itself after about 1.5s, so the test now touches a setting first (which keeps the row until Approve is pressed) and only clicks while the switch is on (React replays clicks made before hydration). 100 of 100 repeat runs passed, the full Chromium suite passed (94), it still fails at 424px when the overflow fix is removed, and CI passed on GitHub.
- 2026-10-16: owner asked for four tools. Playwright CLI 0.1.22 installed globally (pinned, public registry, install scripts off) and checked against the live site with the installed Chrome. Context7 reviewed: it runs as Upstash's hosted MCP server, so nothing installs locally; the owner adds `.mcp.json` (the permission check blocks the agent from editing its own server config). Strix not installed: it needs Docker, Python 3.12+ and a paid LLM key, and its official installer pipes an unpinned script to bash; run it only against a local build if adopted. Supabase is a backend choice, not a tool, left for when accounts are built. Details in `agent-skills/README.md`.
- 2026-10-16: reviewed and merged PRs #3 to #6.
  - #3 (test/waitlist-rules): 19 tests covering email, handle, channel, source and waitlistMessage. The 7 short @x channel forms are correctly marked test.fail(), documenting a real bug in CHANNEL_PATH's 3-char minimum. All 19 pass.
  - #4 (feature/export-waitlist): scripts/export-waitlist.mjs exports the waitlist as a dated CSV via a read-only Postgres transaction, refusing to overwrite, guarding formula injection, and printing only row count. 2 unit tests pass. The .gitignore now ignores waitlist-*.csv.
  - #5 (docs/hindi-copy): docs/hindi-copy.md — full Devanagari + Hinglish translation table for every visible string on /, /signup, /signin and the planned alert/TTS templates. Competitor rows are explicitly omitted; fee facts preserved exactly. Uncertain lines marked (?).
  - #6 (docs/launch-email): docs/launch-email.md — 5 subject lines, English and Hinglish email bodies (handle and no-handle variants), footer with unsubscribe and legal placeholders. Under 150 words; no undecided promises.
 All four commits use the no-reply address. 136/136 Chromium tests, lint and tsc passed after the merge.

- 2026-10-22: installed portable Node.js 24.20.0 and Playwright Chromium outside the project, ran REA 6.4.0 against public StreamTipz, SuperTips and HyperChat surfaces, and recorded the findings in `docs/competitor-findings.md`. No project files were changed by the reverse-engineering tooling.
- 2026-10-23: OBS alerts, visual only: private overlay link, three layouts (1080p, 2K, vertical), three alert modes, approval queue, preview page. Migration 0009 to run in Neon.
- 2026-10-23: text-to-speech on the overlay (Polly Kajal, message only, threshold and approval rules, silent fallback), "Read aloud from" setting, migration 0010. Tested with mocked speech only; real Polly and real OBS still to try.

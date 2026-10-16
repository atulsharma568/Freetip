# Progress

Living status of the project. Read this first; it is updated with every commit. Product decisions are in `PRODUCT.md`, the design system is in `DESIGN.md`, the next steps, research findings and owner direction are in `docs/next-steps.md`, and `git log` has the detail.

## Current state (2026-10-16)

Pre-launch landing page for a UPI-first tipping site for Indian YouTube live streamers, built with Next.js 16, Tailwind v4, GSAP, Lenis and one React Bits component.

Page sections, in order:
- Hero: headline, subline, a call to action, a hands-handoff animation and a self-playing sample tip card that starts after the hands finish.
- How it works: four steps (claim, share, go live, get paid) that slide sideways under a lime progress line on desktop.
- On your stream: a labeled sample OBS alert whose message lights up word by word, like text-to-speech reading it.
- Why Tipsite: no fan account or email, optional anonymous tips, UPI + card in one flow, a clearly labelled sample QR-first sharing treatment, and safer text-to-speech with screening and creator approval in the planned flow.
- Payments and fees: UPI, cards and "We take 5% of every tip."
- FAQ and a closing section: a money orbit around the glitching wordmark, then the waitlist form (optional handle with the typing handle field, plus email).
- `/signup` is the full waitlist form (optional handle, email, optional YouTube channel); `/signin` is still a stub that sends nothing. Both are reached from the nav.
- Deployed (2026-10-16) at https://tipsite.vercel.app on Vercel, with the server pinned to Singapore (`sin1` in `vercel.json`) next to the Neon Postgres database (AWS Singapore).
- A real waitlist: a Server Action saves entries to Neon Postgres with server-side checks, a bot trap, a per-network rate limit and a daily clean-up job. It needs `DATABASE_URL`, `WAITLIST_SALT` and `CRON_SECRET` in Vercel and `db/schema.sql` run once (see "Waitlist setup" below); without them the form says the waitlist isn't working.
- A share image for link previews, an iPhone home-screen icon, a 404 page that explains creator links aren't live yet, `robots.txt` and `sitemap.xml`.
- Policy and company pages: `/terms`, `/privacy`, `/refunds`, `/delivery`, `/contact` (with Grievance Officer), `/pricing` and `/about`, linked from a new footer on every page. They are drafts: operator details are `[placeholders]` in `src/lib/legal.ts`, and the text needs legal review before launch.

Not built yet: the fan tip page, creator dashboard, the rest of the backend, Razorpay payments and real accounts. The product name "Tipsite" and the domain `tipsite.in` are placeholders.

## Implemented in the latest landing-page change

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

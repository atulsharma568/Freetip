# Freetip

Pre-launch landing page for a tipping site for Indian YouTube creators. Fans pay a tip from a creator's page with UPI or card, with no account or email, and can leave their name blank for an anonymous tip. Payments are not integrated; creators can join a waitlist (stored in Postgres) until sign-up opens.

Next.js 16 (App Router), Tailwind v4, GSAP with ScrollTrigger, Lenis smooth scroll, and one vendored React Bits component (ClickSpark).

## Run

```bash
npm run dev      # http://localhost:3000
npm run build && npm run start
```

The waitlist needs a Postgres database. Copy `.env.example` to `.env.local`, fill in `DATABASE_URL`, `WAITLIST_SALT` and `CRON_SECRET`, and run `db/schema.sql` once against the database. To access the owner console locally, also set the server-only `OWNER_GOOGLE_IDS` value to one or more comma-separated Google account IDs. Without the waitlist variables the site still runs and the form says the waitlist isn't working. `NEXT_PUBLIC_SITE_URL` (the real domain, once chosen) lets search engines in; until it is set, `robots.txt` blocks them.

## Export the waitlist

With `DATABASE_URL` set, run:

```bash
DATABASE_URL=... npm run export:waitlist
```

This writes a dated CSV in the current directory. The CSV contains personal data and must be deleted after use.

## Where things are

- `PRODUCT.md`: what the product is, what is confirmed, and what must not be claimed.
- `DESIGN.md`: the visual system (colors, type, shapes, components, rules).
- `src/lib/site.ts`: placeholder name, host and sample handle.
- `src/app/actions/waitlist.ts`, `src/lib/waitlist.ts`, `src/lib/db.ts` and `db/schema.sql`: the waitlist (server checks, rate limit, storage); `src/app/api/cron/waitlist-purge` and `vercel.json`: its daily clean-up.
- `db/migrations/0001_finance_foundation.sql`, `src/lib/owner-auth.ts` and `src/app/admin/`: the read-only owner-finance foundation. Razorpay payment execution is not connected yet, so the admin pages show honest empty states.
- `src/lib/legal.ts`: operator details and fee numbers used by the policy pages.
- `src/components/hero/TipCard.tsx`: the self-playing sample tip card.
- `src/components/hero/HeroHands.tsx`: the one-shot hand-to-hand lime ₹ note animation, with a reduced-motion still frame.
- `src/components/sections/Differentiators.tsx`: the competitor-led "Why Freetip" section covering no fan email/account, anonymous tips, QR-first sharing and safer approved text-to-speech.

## Placeholders to replace

Name `Freetip`, host `tipsite.in`, sample handle `aarav`, the sample creator, and the operator details in `src/lib/legal.ts`.

## What is represented on the landing page

- Competitor strengths we kept: a short creator link, UPI payments, card payments, OBS alerts, text-to-speech, clear sample tip amounts and message moderation direction.
- Freetip differentiators: no fan account, no fan email, optional anonymous tips, UPI and card in one flow, QR-first sharing and creator approval before text-to-speech.
- Trust rules: every simulated payment, stream alert and QR is labelled as a sample; no customer numbers, testimonials or payout promises are fabricated.

## What is not built yet

The landing page communicates the planned product but does not process money. Real Razorpay payments, creator QR generation, OBS connection, text-to-speech playback, message screening, creator approval controls, accounts and the creator dashboard are future work. The owner console defines the future financial reporting surface, but it currently has no captured payment data. The waitlist is the only part that stores live user data.

## Checks

```bash
npm run lint
npx tsc --noEmit
npm run build
npm run test:e2e   # Playwright: builds, serves on port 3300 without a database, runs test/
```

The first time, download the test browsers with `npx playwright install chromium webkit`. The suite covers every page (status, one h1, no sideways scrolling at 320, 390 and 1440px, including mid-animation), the waitlist's validation and "isn't working" messages, robots, sitemap and share metadata, the skip link, the On stream switches and reduced motion. It runs on desktop Chrome, a mobile Chrome profile and iPhone WebKit.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, the type check, the build and the Chromium tests on every pull request and push to `main`.

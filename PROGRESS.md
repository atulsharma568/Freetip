# Progress

Living status of the project. Read this first; it is updated with every commit. Product decisions are in `PRODUCT.md`, the design system is in `DESIGN.md`, the next steps, research findings and owner direction are in `docs/next-steps.md`, and `git log` has the detail.

## Current state (2026-10-14)

Pre-launch landing page for a UPI-first tipping site for Indian YouTube live streamers, built with Next.js 16, Tailwind v4, GSAP, Lenis and one React Bits component.

Page sections, in order:
- Hero: headline, subline, a call to action, a hands-handoff animation and a self-playing sample tip card that starts after the hands finish.
- How it works: four steps (claim, share, go live, get paid) that slide sideways under a lime progress line on desktop.
- On your stream: a labeled sample OBS alert whose message lights up word by word, like text-to-speech reading it.
- Why Tipsite: no fan account or email, optional anonymous tips, UPI + card in one flow, a clearly labelled sample QR-first sharing treatment, and safer text-to-speech with screening and creator approval in the planned flow.
- Payments and fees: UPI, cards and "We take 5% of every tip."
- FAQ and a closing section: a money orbit around the glitching wordmark, then the claim form with a typing handle field (sign-up is a stub).
- `/signup` and `/signin` pages (stubs: nothing is saved or sent), reached from Sign in and Sign up in the nav.

Not built yet: the fan tip page, creator dashboard, backend (Postgres), Razorpay payments and real sign-up. The product name "Tipsite" and the domain `tipsite.in` are placeholders.

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
- Waitlist storage, legal pages and contact flow.

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

## Next

See "Next steps" in `docs/next-steps.md`; that is the single list.

## Working agreement

Finished, verified changes (lint, type check and build pass) are committed and pushed to `main` together with an update to this file.

## Verification for app commit `186664c`

- `npm run lint` passed.
- `npx tsc --noEmit` passed.
- `npm run build` passed.
- Production server smoke check returned the home page successfully.
- `git diff --check` passed.
- No automated test suite is configured yet.

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

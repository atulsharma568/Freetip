# Progress

Living status of the project. Read this first; it is updated with every commit. Product decisions are in `PRODUCT.md`, the design system is in `DESIGN.md`, the next steps, research findings and owner direction are in `docs/next-steps.md`, and `git log` has the detail.

## Current state (2026-10-13)

Pre-launch landing page for a UPI-first tipping site for Indian YouTube live streamers, built with Next.js 16, Tailwind v4, GSAP, Lenis and one React Bits component.

Page sections, in order:
- Hero: headline, subline, a call to action and a self-playing sample tip card.
- How it works: the steps from link to paid.
- On your stream: a labeled sample OBS alert whose message lights up word by word, like text-to-speech reading it.
- Payments and fees: UPI, cards and "We take 5% of every tip."
- FAQ and a closing claim form (sign-up is a stub).

Not built yet: the fan tip page, creator dashboard, backend (Postgres), Razorpay payments and real sign-up. The product name "Tipsite" and the domain `tipsite.in` are placeholders.

## Decisions

- Tips by UPI or card, no fan account. Payments through Razorpay with INR payouts (planned, not integrated).
- OBS stream alerts and text-to-speech of the fan's message, so fans can add an optional name and message.
- Platform fee: 5% of every tip.
- Look: dark, flat, one lime accent.
- Audience: Indian live streamers first.
- Scope for now: landing page only.
- The page stays short, clean and to the point: only what is necessary, and something new rather than a copy of the reference sites (owner, 2026-10-13).

## Open questions

- Does the 5% include Razorpay's payment charges, or are they on top?
- Hands animation in the hero (the owner's idea): go/no-go on a prototype.
- Payout timing, paid highlighted messages, product name and domain, sign-up mechanism.
- Message length limit and moderation for text-to-speech (needed with the tip page).

## Next

See "Next steps" in `docs/next-steps.md`; that is the single list.

## Working agreement

Finished, verified changes (lint, type check and build pass) are committed and pushed to `main` together with an update to this file.

## Log

- 2026-10-13: landing page built (hero with sample tip card, steps, fees, FAQ, closing claim form).
- 2026-10-13: added the "On your stream" sample alert, OBS and text-to-speech copy and the 5% fee; checked layouts from 320px to 1440px and reduced motion.
- 2026-10-13: published to GitHub; added this file and the working agreement.
- 2026-10-13: reviewed Hyperchat, StreamTipz and SuperTips; recorded the findings, the owner's direction (clean, to the point, hands animation idea), the proposed scope and the next steps in `docs/next-steps.md`.

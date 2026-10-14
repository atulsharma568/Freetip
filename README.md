# Tipsite

Pre-launch landing page for a tipping site for Indian YouTube creators. Fans pay a tip from a creator's page with UPI or card, with no account or email, and can leave their name blank for an anonymous tip. Payments are not integrated and sign-up is a stub.

Next.js 16 (App Router), Tailwind v4, GSAP with ScrollTrigger, Lenis smooth scroll, and one vendored React Bits component (ClickSpark).

## Run

```bash
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Where things are

- `PRODUCT.md`: what the product is, what is confirmed, and what must not be claimed.
- `DESIGN.md`: the visual system (colors, type, shapes, components, rules).
- `src/lib/site.ts`: placeholder name, host and sample handle.
- `src/components/hero/TipCard.tsx`: the self-playing sample tip card.
- `src/components/hero/HeroHands.tsx` and `HeroHands.module.css`: the one-shot hand-to-hand lime ₹ note animation, with a reduced-motion still frame.
- `src/components/sections/Differentiators.tsx`: the competitor-led "Why Tipsite" section covering no fan email/account, anonymous tips, QR-first sharing and safer approved text-to-speech.

## Placeholders to replace

Name `Tipsite`, host `tipsite.in`, sample handle `aarav`, the sample creator, and the claim form (it only validates and says sign-up is not open).

## What is represented on the landing page

- Competitor strengths we kept: a short creator link, UPI payments, card payments, OBS alerts, text-to-speech, clear sample tip amounts and message moderation direction.
- Tipsite differentiators: no fan account, no fan email, optional anonymous tips, UPI and card in one flow, QR-first sharing and creator approval before text-to-speech.
- Trust rules: every simulated payment, stream alert and QR is labelled as a sample; no customer numbers, testimonials or payout promises are fabricated.

## What is not built yet

The landing page communicates the planned product but does not process money or store data. Real Razorpay payments, creator QR generation, OBS connection, text-to-speech playback, message screening, creator approval controls, the waitlist, Postgres and the creator dashboard are future work.

## Checks

The latest verified app change was checked with:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

There is no automated test suite configured yet. A production-server smoke check also returned the home page successfully.

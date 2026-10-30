# Product

## Platform

web

## Stack

Next.js (App Router), TypeScript, Tailwind v4, Postgres for the later app. GSAP, Lenis and React Bits for motion and components (user-chosen). Payments via Razorpay (user-chosen, not yet integrated).

## Users

Indian YouTube creators who go live (gaming, chat, IRL), live streamers first. Their fans: viewers who want to tip from a link with UPI or a card, without making an account.

## Product Purpose

A tipping website for YouTube creators in the spirit of Hyperchat, StreamTips and SuperTips. Creators get a public page at a short link and fans pay a tip from it. Each tip shows up on the creator's live stream as an OBS alert, with the fan's message read out by text-to-speech. This surface is the pre-launch landing page that explains the product to creators.

Scope before 22 October 2026 (owner, 2026-10-13): the landing page only. The fan tip page, the creator dashboard and the backend were not being built yet. The next implementation slice is now the read-only owner-finance foundation; payment execution remains deferred.

The landing page is an explanation and prototype surface, not the product backend. Its tip card, stream alert, handoff animation and QR are demonstrations; they do not take payments, connect to OBS, generate a live QR or store submissions.

## Owner-finance foundation (2026-10-22)

The first product slice after the landing page is a server-protected, read-only
owner finance foundation. It may define ledger tables, owner access, dashboard
navigation and honest empty states, but it must not simulate successful tips or
claim that Razorpay is integrated. The foundation covers future reporting for
captured tips, refunds, provider fees/taxes, Freetip fees, creator net amounts,
settlements, pending balances, disputes, reconciliation and audit history.

The first slice is implemented under `/admin` with an `OWNER_GOOGLE_IDS`
server-only allowlist. Its finance, reconciliation and audit views are empty
until real provider-backed records exist.

Razorpay KYC is treated as complete according to the owner. Payment orders,
webhooks, refunds, settlements and payouts remain future work until the final
Razorpay account/product model and settlement behavior are confirmed.

## Positioning

UPI-first tipping for Indian YouTube live streamers: fans pay from the streamer's page with UPI or a card, with no account, and each tip lands on stream as an OBS alert with the message read out loud.

## Competitor-derived product decisions

The competitor review identified useful patterns worth keeping—short creator links, UPI, card support, OBS alerts, text-to-speech and clear fan inputs—and defaults we should avoid. Freetip therefore intends to combine those useful parts with:

- No fan account and no fan email.
- An optional fan name so a tip can be anonymous by choice.
- UPI and card in one tip flow rather than UPI only.
- A QR code per creator for viewers watching the stream.
- A bounded, screened message that waits for creator approval before text-to-speech.
- A plainly stated 5% platform fee with a worked example that includes the flat 2.75% processing charge, and no invented payout details.

We are deliberately leaving out competitor-style soundboards, XP levels, leaderboards, fan CRM, paid highlighted messages, inflated counters, testimonials and dense feature catalogues from the first landing page.

## Capabilities and Constraints

Confirmed by the owner: UPI and card tips from a creator's page with no fan account, and payments through Razorpay with INR payouts. Added on 2026-10-13: OBS live alerts, text-to-speech readout of the fan's message, and a platform fee of 5% of every tip. On 2026-10-14, the owner directed the landing page to foreground no fan email, optional anonymous tips, QR-first sharing and safer approved text-to-speech as product edges from the competitor review.

Not confirmed, so the page must not name them as features: paid highlighted messages (the owner has not mentioned them), creator dashboard details, and payout timing. Fees: a flat 2.75% processing charge (Freetip's own, no longer a pass-through of Razorpay's rate; owner, 2026-10-30) sits on top of the 5% and is paid by the creator out of the payout; fans pay exactly the tip (owner, 2026-10-14). A ₹100 tip leaves the creator ₹92.25.

Fan Name and Message: the OBS alert shows the fan's optional name, the amount and the message, and text-to-speech reads the message aloud only after creator approval, so the sample tip card keeps its optional Name and Message fields. The owner asked what these fields mean and then asked for alerts and text-to-speech, so the fields stay. The name can be left blank for an anonymous tip. The exact message limit, moderation settings and approval interface remain to be built on the future tip page.

Undecided: domain (the product name is final: Freetip), payout schedule, sign-in method for creator accounts (email code, password or Google); a waitlist collects sign-ups until then.

## Brand Commitments

User-pinned: dark and flat surfaces with one sharp accent colour. The page must not look AI-generated or templated; the user wants a premium feel with smooth animation built on GSAP, Lenis and React Bits.

## Evidence on Hand

The one fact on hand is the owner-set fee: 5% of every tip. No customers, testimonials, creator photos, logo or payout data exist yet. Future work must not fabricate them, and any sample content must be labeled as a sample.

## Product Principles

1. Name only capabilities the owner has confirmed. Anything not confirmed stays off the page.
2. Say what happens to the money in plain words, and never print a number the business has not set.
3. The fan's path from link to paid is short, and the page proves it by showing it working.
4. Premium means restraint and craft, not effects.

## Accessibility & Inclusion

Honor prefers-reduced-motion everywhere motion is used. Meet WCAG AA contrast. Keep the page light enough for mid-range Android phones on mobile data (inferred from the Indian audience, not confirmed).

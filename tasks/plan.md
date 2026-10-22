# Implementation Plan: Owner Dashboard → Creator Dashboard → Tipping Page

## Overview

Build the product in three dependency-ordered phases. First, add an owner-only financial operations dashboard that will become the source of truth for payments, creator earnings, platform fees, Razorpay costs, settlements, refunds, disputes and reconciliation. Second, turn the existing protected holding page into a creator dashboard with onboarding, handle ownership, creator settings and payout visibility. Third, add the public creator tipping page. Razorpay KYC is complete according to the owner, but the payment/settlement integration must still be designed and verified before live money is processed.

## Working assumptions

- The first owner dashboard is for one owner account, protected by a server-side allowlist.
- The initial owner dashboard is read-only for financial data: overview, creator earnings, payment ledger, settlements, refunds, disputes, reports and reconciliation. Money-moving actions remain disabled until the Razorpay integration is verified.
- Google OAuth remains the authentication mechanism.
- Creator accounts are distinct from waitlist entries; waitlist-to-account linking is a later explicit workflow.
- The accounting model records actual provider-reported fees/taxes and settlement data; it must not calculate Razorpay cost from a fixed marketing percentage.
- Payment integration, provider onboarding, KYC API fields, webhooks and creator payouts are deferred until the ledger contract is approved.
- Existing dark/lime design tokens and `PageShell` conventions remain the visual base.

## Architecture decisions

- Create shared server-only authorization helpers instead of checking email or Google ID inline in pages.
- Put the owner identity in a server-only environment variable first; do not trust a client-side role or hidden navigation.
- Add a typed current-user resolver that loads the persisted `users` row and rejects database-unavailable business operations.
- Keep database changes in forward SQL migrations rather than relying on rerunning the existing schema scripts.
- Separate immutable payment/provider events from derived reporting tables so financial reports can be rebuilt.
- Treat provider payment, refund, transfer, settlement and dispute identifiers as external references with idempotent event ingestion.
- Keep platform fee policy versioned by effective date; never overwrite historical fee calculations.
- Reserve future routes and system handles before implementing atomic handle claims.
- Use vertical slices: each slice includes schema, server logic, UI, and focused tests.
- Keep fake payment-success UI out of real dashboard/tipping workflows.

## Task List

### Phase 1: Owner financial dashboard foundation

- [ ] **Task 1: Establish typed identity and owner authorization**
  - Add a server-only current-user resolver based on the authenticated Google ID.
  - Add an owner allowlist configuration and an authorization guard.
  - Ensure unauthenticated, non-owner and database-unavailable requests fail closed.
  - Add focused tests for each access decision.

- [ ] **Task 2: Separate application layout from marketing motion**
  - Prevent the home-page splash/scroll lock from affecting `/admin` and future app routes.
  - Add an application shell with navigation, skip link, sign-out and responsive layout.
  - Keep the existing landing-page visual system.

- [ ] **Task 3: Financial ledger contract and provider event storage**
  - Define immutable payments, refunds, provider fees/taxes, creator allocations, transfers, settlements, disputes and reconciliation records.
  - Add idempotency keys and raw provider references without storing secrets or sensitive payment credentials.
  - Add a versioned platform-fee policy and explicit accounting formulas.

- [ ] **Task 4: Owner finance overview and creator earnings**
  - Show gross captured tips, refunds, actual Razorpay fees/taxes, Tipsite fee revenue, creator net payable, settled amounts, pending/unsettled funds and reconciliation status.
  - Support daily, weekly, monthly and custom date ranges in Asia/Kolkata with an explicit timezone label.
  - Show the same metrics per creator with drill-down links to their payment ledger.

- [ ] **Task 5: Owner payment, settlement, payout and reconciliation views**
  - Add searchable payment ledger, settlement batches, creator transfers/payouts, refunds and disputes.
  - Show provider IDs, statuses, timestamps and mismatch/error reasons.
  - Add protected CSV exports and read-only reports first; money-moving actions require a later approval gate.

- [ ] **Task 6: Owner waitlist and creator directory**
  - Show waitlist count/list/export and persisted Google/YouTube users with channel and handle state.
  - Show provider-account/KYC readiness separately from internal creator approval.
  - Do not add destructive account actions until account-state rules are defined.

### Checkpoint: Owner dashboard

- [ ] Owner-only access is enforced on the server.
- [ ] Anonymous users and non-owners cannot read owner data.
- [ ] Financial totals are derived from a ledger contract rather than UI calculations.
- [ ] Every report identifies its timezone, date basis and reconciliation state.
- [ ] Waitlist and creator data render without marketing scroll-lock behavior.
- [ ] Focused tests, lint, typecheck and build pass.

### Phase 2: Creator dashboard

- [ ] **Task 5: Creator onboarding and handle claim**
  - Resolve the current persisted user.
  - Add missing profile fields and an atomic, normalized handle claim.
  - Reserve system/future routes and reject collisions.
  - Define how existing waitlist handle preferences are displayed without treating them as reservations.

- [ ] **Task 6: Creator settings and publication state**
  - Persist profile, minimum tip, message/name limits and alert/TTS preferences.
  - Add an explicit draft/published state.
  - Add validation, ownership checks and cache/revalidation behavior.

- [ ] **Task 7: Creator preview and sharing**
  - Preview the public creator page and stream alert using persisted settings.
  - Add copy-link and QR presentation only after the public URL rules are settled.
  - Keep payment status clearly disconnected until Razorpay is integrated.

### Checkpoint: Creator flow

- [ ] A creator can sign in, claim one valid handle and save settings.
- [ ] A creator cannot read or mutate another creator's data.
- [ ] Draft and published states are explicit and tested.

### Phase 3: Public tipping page

- [ ] **Task 8: Public creator page without payment activation**
  - Resolve only published creators by handle.
  - Render creator profile, tip amounts, optional name and message inputs.
  - Validate limits and show a clear non-payable state while payments are deferred.

- [ ] **Task 9: Razorpay payment design and activation gate**
  - Confirm the Razorpay product/account model, settlement behavior and webhook contract.
  - Add provider references/status separately from internal creator approval.
  - Implement idempotent orders, verified payment events, refunds and reconciliation only after review.

- [ ] **Task 10: Paid-tip lifecycle and stream delivery**
  - Connect confirmed payments to alerts, moderation and approved text-to-speech.
  - Add auditability, retry handling and operational failure states.

## Verification strategy

- Focused tests for authorization, ownership, handle collisions, pagination/search and CSV export.
- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- `npm run test:e2e` for affected pages and flows.
- `git diff --check`
- Manual responsive and reduced-motion checks for dashboard and public page layouts.

## Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Authenticated users are treated as owners | High | Server-only owner guard on every read/action/export; no client-only role checks. |
| Database is unavailable during sign-in | High | Business routes require a persisted user and fail closed. |
| Handle collision or reserved route | High | Normalize and claim atomically with a reserved-word list. |
| Marketing scroll lock leaks into app routes | Medium | Split marketing motion from application layout before adding dashboard screens. |
| Payment state is simulated as successful | High | Keep payment-deferred states explicit until verified Razorpay events exist. |
| Schema scripts drift | Medium | Introduce forward migrations and record applied changes. |

## Open questions

- Which Google account(s) should be owner(s)?
- Should the owner dashboard route be `/admin`, or should `/dashboard` switch by role?
- Which waitlist operations are needed in v1: list, search, CSV export, invite email, delete?
- Which Razorpay operating model will be used: Route/linked-account transfers or a centrally collected account with a separate payout process?
- Should creator net earnings be calculated on captured date, settlement date, transfer date or a selectable accounting basis?
- Which adjustments belong in creator net: refunds, chargebacks, payment fees/tax, platform fee, transfer fee, manual credits/debits?
- Are owner reports read-only initially, or should refunds/holds/payout approvals eventually be performed from Tipsite?
- Is creator access open to every Google sign-in, invitation-only, or owner-approved?
- Is one YouTube channel allowed per account, or can a creator manage multiple channels?
- What are the final handle reserved words, rename rules and publication rules?
- What are the exact minimum tip, message limit and moderation rules?
- Which Razorpay account/product and settlement model will be used when payment work begins?

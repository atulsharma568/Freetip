# Owner Dashboard Specification

## Purpose

The owner dashboard is the financial operations console for Tipsite. It should answer, without spreadsheet work:

- How much money was captured from fans?
- How much belongs to each creator?
- How much did Tipsite earn?
- How much did Razorpay actually charge?
- What has settled, what is pending, and what needs attention?
- Can every total be traced back to an immutable payment or provider event?

This is an operations and accounting surface, not a marketing dashboard. It must never display simulated earnings or infer provider fees from a fixed percentage when actual provider data is available.

## Owner dashboard navigation

### 1. Overview

The first screen should have a date-range control and a clear timezone label: **Asia/Kolkata (IST)** by default. Presets:

- Today
- Yesterday
- This week
- Last week
- This month
- Last month
- Custom range

Top-level cards:

1. **Gross captured** — payment amounts successfully captured in the selected period.
2. **Refunded** — completed and pending refund amounts, shown separately.
3. **Razorpay costs** — actual provider-reported fees and taxes, never a guessed percentage.
4. **Tipsite fee revenue** — platform fee earned under the fee-policy version active for each payment.
5. **Creator net payable** — amount owed to creators after the configured deductions and adjustments.
6. **Settled to creators** — amount confirmed as transferred/settled.
7. **Pending or unsettled** — captured money not yet settled or paid out.
8. **Exceptions** — unmatched webhooks, amount mismatches, failed transfers, reversals, refunds and disputes.

Charts and tables:

- Gross captured, refunds, platform fee and creator net by day.
- Net revenue by week or month.
- Top creators by gross tips, creator net and Tipsite fee.
- Payment status breakdown: created, authorized, captured, failed, refunded, partially refunded and disputed.
- Settlement status breakdown: pending, processed, failed, reversed and held.

The overview should show **data freshness** and the last successful reconciliation run.

### 2. Creator earnings

One row per creator, with search, filters and export:

- Creator name and handle.
- YouTube channel.
- Provider-linked-account status, if applicable.
- Internal creator status.
- Gross captured tips.
- Number of successful tips.
- Refunds and chargebacks.
- Actual Razorpay fees and taxes allocated to the creator.
- Tipsite platform fee.
- Other adjustments.
- Creator net payable.
- Amount transferred or settled.
- Pending/unsettled amount.
- Last tip date.
- Last payout/settlement date.
- Reconciliation state.

Clicking a creator opens a detailed statement rather than editing totals.

### 3. Payment ledger

Searchable, filterable and paginated. Each payment must be traceable to its provider identifiers and internal accounting entries.

Columns:

- Internal payment ID.
- Creator and handle.
- Gross amount and currency.
- Payment method.
- Payment status.
- Captured timestamp.
- Provider payment ID and order ID.
- Provider fee and provider tax, when reported.
- Tipsite fee-policy version and calculated fee.
- Creator net amount.
- Refund amount/status.
- Transfer ID/status, if a creator transfer exists.
- Settlement ID/status, if settled.
- Dispute/chargeback status.
- Reconciliation status.

Payment detail should show a chronological event timeline:

- Order created.
- Authorization.
- Capture.
- Fee/tax recorded.
- Creator allocation recorded.
- Transfer created or held.
- Settlement reported.
- Refund or dispute events.
- Reconciliation checks.

Raw provider payloads should be stored privately for audit/debugging, but not rendered by default. Show a safe, redacted event view instead.

### 4. Settlements and creator payouts

This section separates **Razorpay settlement** from **creator payout/transfer**. They are not the same accounting event.

Settlement batch view:

- Provider settlement ID.
- Settlement date and expected date.
- Gross amount.
- Provider fees and taxes.
- Refunds, reversals and adjustments.
- Net amount received by Tipsite or the relevant linked account.
- Settlement status.
- Bank/reference identifiers where safe to show.
- Number of included payments.
- Reconciliation status.

Creator payout view:

- Creator.
- Amount due.
- Amount queued.
- Amount processing.
- Amount paid/settled.
- Failed or reversed amount.
- Provider transfer/payout ID.
- Hold reason, if any.
- Created, processed and completed timestamps.

For the first version, this should be read-only. Do not add a “Pay now” button until the provider operating model, approval rules and failure recovery are settled.

### 5. Refunds and disputes

Separate operational queues for:

- Full refunds.
- Partial refunds.
- Refunds pending.
- Refunds failed.
- Disputes/chargebacks.
- Reversed transfers.
- Negative creator balances.

Each item should show who is financially affected, the original payment, provider status, deadlines, current owner, internal notes and the resulting ledger adjustment.

### 6. Reconciliation center

This is essential before real money is enabled.

Checks should identify:

- Provider payment with no internal payment.
- Internal payment with no provider confirmation.
- Amount mismatch.
- Duplicate webhook/event.
- Missing fee or tax data.
- Transfer amount not matching creator allocation.
- Settlement batch total not matching included payments.
- Refund without a matching payment.
- Dispute without a matching payment.
- Stale pending payment or transfer.
- Failed webhook processing.

Every exception needs a status: open, investigating, resolved, ignored with reason. Manual corrections must create journaled adjustments; they must never overwrite the original event or payment amount.

### 7. Reports and exports

Owner-only exports:

- Payment ledger CSV.
- Creator earnings statement.
- Daily revenue report.
- Weekly revenue report.
- Monthly revenue report.
- Settlement reconciliation report.
- Refund/dispute report.
- Platform fee report.
- Creator payout report.
- Waitlist and creator directory exports.

Every export should include the date range, timezone, generation timestamp, filter set and accounting-basis label. CSV formula injection protections from the existing waitlist exporter should be reused.

### 8. Creators and provider readiness

The owner should be able to see, separately:

- Internal creator account status.
- Profile completion.
- Handle and publication status.
- Provider-linked-account ID, if used.
- Provider onboarding/KYC status, if available.
- Payout readiness.
- Payout hold/restriction reason.
- Last successful payment and last successful settlement.

Provider KYC status must not be treated as the same thing as Tipsite approval. A creator may be approved internally but not payout-ready, or provider-ready but not published on Tipsite.

## Accounting model

The dashboard needs an append-only financial ledger. UI totals should be derived from ledger entries and provider events, not independently calculated in React components.

Minimum entities:

- `payment_orders` — internal order and provider order reference.
- `payments` — authorization/capture state and gross amount.
- `payment_events` — immutable, idempotent provider webhook/event records.
- `payment_costs` — provider fee, tax and other provider-reported cost components.
- `creator_allocations` — versioned calculation of creator share for a payment.
- `platform_fee_policies` — effective-dated Tipsite fee rules.
- `creator_transfers` — transfer/payout intent and provider transfer reference.
- `settlements` — provider settlement batches and totals.
- `refunds` — full/partial refund requests and provider results.
- `disputes` — chargebacks/dispute lifecycle.
- `ledger_entries` — immutable debit/credit entries with source references.
- `reconciliation_runs` — run metadata and totals.
- `reconciliation_exceptions` — unmatched or inconsistent records.
- `audit_events` — owner actions, exports, status changes and manual adjustments.

Every financial amount should store:

- Integer minor units, never floating-point currency values.
- Currency code.
- Source event/reference.
- Effective timestamp and recorded timestamp.
- Creator ID where applicable.
- Provider ID where applicable.
- Accounting status.

### Planned definitions

For each captured tip, report these components independently:

```text
gross captured
- completed refunds
- chargebacks/reversals
- actual provider fee
- actual provider tax
- Tipsite platform fee
- other approved adjustments
= creator net payable
```

These are reporting definitions, not final payment terms. The exact allocation depends on whether Tipsite uses a centrally collected Razorpay account or a linked-account/transfer model. That choice must be made before payment implementation.

The platform report should distinguish:

- **Tipsite fee revenue** — the configured platform fee.
- **Provider costs** — actual Razorpay fees/taxes charged to the relevant account.
- **Net platform revenue** — platform fee revenue less approved platform-side costs and adjustments.
- **Creator net payable** — creator allocation after the deductions agreed in the product terms.

Never show “Razorpay took X%” as the source of truth. Show the actual provider-reported amount and, separately, any estimate used for projections.

## Permissions and safety

Initial owner role:

- Read all financial data.
- Export reports.
- View provider references and reconciliation details.
- No live refunds, payouts, holds or manual balance changes in the first slice.

Later roles:

- Owner: all approved operations.
- Finance operator: reports, reconciliation and refunds, but not owner/settings changes.
- Support operator: creator/payment lookup with masked sensitive data.
- Read-only auditor: view and export, no mutations.

Required safeguards:

- Server-side authorization on every page, query, export and action.
- Explicit confirmation and reason for refunds, holds, releases and adjustments.
- Immutable audit log for every financial mutation and export.
- Idempotency on every provider event and money-moving operation.
- No card numbers, CVV, OAuth tokens or provider secrets in the dashboard.
- Masked customer data by default.
- Re-authentication or step-up approval for high-risk actions when enabled.
- Clear distinction between live data, pending data, estimates and test data.

## MVP versus later

### Owner dashboard MVP before live payments

- Owner-only route and application shell.
- Overview cards with honest empty states.
- Creator directory.
- Waitlist list/search/export.
- Financial ledger schema and provider-event contract.
- Payment/creator/settlement report screens backed by empty states until integrations exist.
- Reconciliation screen structure.
- Audit log for owner access and exports.

### After payment integration

- Real payment ledger ingestion.
- Actual provider fee/tax data.
- Creator allocations and payout readiness.
- Settlement imports and reconciliation.
- Refund and dispute queues.
- Creator statements.
- Scheduled daily/weekly/monthly reports.

### Later operational features

- Refund action workflow.
- Payout holds and releases.
- Creator support notes.
- Finance-role delegation.
- Tax/invoice workflows.
- Automated anomaly alerts.
- Accounting-system export.

## Decisions required before implementation

1. **Razorpay operating model:** centrally collected account plus separate creator payout, or linked creator accounts/transfers through a Razorpay platform product.
2. **Payout ownership:** does Razorpay settle directly to creators, or does Tipsite receive funds and pay creators?
3. **Accounting basis:** should reports use capture date, settlement date, transfer date, or allow switching between them?
4. **Fee treatment:** which actual provider costs reduce creator net, and which are Tipsite costs?
5. **Refund policy:** who absorbs platform/provider fees on refunds?
6. **Dispute policy:** how are chargebacks allocated to creators and when does a creator balance become negative?
7. **Payout schedule:** daily, weekly, monthly, threshold-based, or provider-controlled?
8. **Owner actions:** read-only first, or should refunds/holds/payout approvals eventually run from Tipsite?
9. **Timezones:** default Asia/Kolkata, with UTC timestamps retained for audit.
10. **Data retention:** financial records, provider events, audit events and exports need explicit retention rules.

## Definition of done for the financial dashboard

- A total can be traced from overview → creator → payment → provider event → ledger entry.
- Every amount identifies whether it is captured, refunded, pending, settled, estimated or reconciled.
- Actual provider fees/taxes are stored separately from Tipsite fees.
- Reports are stable across daily, weekly, monthly and custom ranges.
- Re-running provider events does not duplicate money.
- Non-owners cannot access financial data or exports.
- No payment-success state is shown until a verified provider event exists.

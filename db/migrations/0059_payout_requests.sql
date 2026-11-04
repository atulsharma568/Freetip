-- Creator payout requests, paid by hand by the owner (owner decision, 2026-11-04). Safe to re-run.
--
-- Run this BEFORE deploying the code that uses it. Until it has run, nothing else changes: the
-- earnings page still loads and the Request payout button simply says it could not be saved.
--
-- What it adds:
--   * creator_payouts: the UPI ID the money is to go to (copied at the time of the request, so a later
--     change cannot redirect an open request), when it was requested, whether it was the creator's
--     first payout, the owner's tick that the name in their UPI app matched, and why a request was
--     cancelled. The UTR the owner enters is kept in the existing provider_transfer_ref (unique, so
--     one transfer cannot be recorded against two payouts).
--   * one open payout per creator, enforced by the database.
--   * a ledger account for money asked for and not yet paid, so a request leaves the creator's
--     balance at once (they cannot ask twice for the same money) and the books still balance:
--       request   debit creator_payable      credit payouts_in_flight
--       paid      debit payouts_in_flight    credit settlement_clearing
--       cancelled debit payouts_in_flight    credit creator_payable   (a reversal of the request)

alter table creator_payouts
  add column if not exists upi_vpa text,
  add column if not exists requested_at timestamptz,
  add column if not exists first_payout boolean not null default false,
  add column if not exists name_matched boolean,
  add column if not exists cancel_reason text;

create unique index if not exists creator_payouts_one_open
  on creator_payouts (creator_id)
  where status in ('initiated', 'in_transit');

insert into ledger_accounts (code, name, account_type)
values ('payouts_in_flight', 'Creator payouts requested, not yet paid', 'liability')
on conflict (code) do nothing;

-- Payout onboarding columns. Safe to re-run: ADD COLUMN IF NOT EXISTS.
--
-- onboarding_state lifecycle:
--   not_started → creator has not submitted payout details yet
--   submitted   → creator submitted UPI VPA and legal name; awaiting owner approval
--   active      → owner approved; creator_status set to 'active' at the same time
--   rejected    → owner or compliance rejected; creator can resubmit
--
-- upi_vpa stores the creator's UPI Virtual Payment Address for payouts.
-- legal_name is the creator's legal name used on payout records.

alter table users
  add column if not exists upi_vpa text,
  add column if not exists legal_name text,
  add column if not exists onboarding_state text not null default 'not_started'
    check (onboarding_state in ('not_started', 'submitted', 'active', 'rejected'));

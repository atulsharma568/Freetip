-- Creator onboarding columns. Safe to re-run: ADD COLUMN IF NOT EXISTS.
--
-- creator_status lifecycle:
--   pending   → account created, Razorpay KYC not complete (default)
--   active    → KYC verified, tip page is live
--   suspended → owner or Razorpay suspended the account
--
-- razorpay_account_id is null until the creator completes Razorpay onboarding.

alter table users
  add column if not exists creator_status text not null default 'pending'
    check (creator_status in ('pending', 'active', 'suspended')),
  add column if not exists razorpay_account_id text;

-- Buying the paid features with PayU (Part 2 of the paid features page). Safe to re-run.
--
-- plan_orders  — one row per attempt to buy a pass. Made before the creator is sent to PayU, with
--                the amount fixed on our side. It moves pending -> paid or pending -> failed,
--                never back, and a paid order is never overwritten (src/lib/plan-orders.ts).
--                  txnid        = the reference we send PayU as its `txnid` (20 letters and digits)
--                  term_months  = 1 or 12; the pass is a one-off that ends, renewed by hand
--                  amount_minor = the price in paise, copied from src/lib/pricing.ts when the
--                                 order was made (so a later price change never reaches it)
--                  livemode     = whether the order was made with PayU's live key. A test-mode
--                                 payment switches features on only for the owner's own account
--                  payu_ref     = PayU's own payment id (`mihpayid`); one PayU payment can pay at
--                                 most one order
--                  pass_starts_at, pass_ends_at, added_keys = filled when the order is paid: the
--                                 term it added and the feature keys it switched on
-- users.pass_keys          — the keys the current pass added to users.paid_features, so that when
--                            the pass ends only those are taken away and the owner's own ticks
--                            stay. Saving the owner's feature box forgets keys the owner unticked.
-- users.pass_until         — when the current pass ends (null: no pass). A new term is added to
--                            the end date when it is still in the future.
-- users.pass_reminded_until — the pass_until value a "5 days left" reminder was last sent for, so
--                            the reminder goes out once per end date.
-- The mobile number PayU asks for is passed to PayU and is not stored here.
--
-- Run BEFORE deploying the matching code. Until it is run: the owner's feature box still saves
-- (it only writes the pass columns when they exist), the finance page counts no pass sales, the
-- payment routes cannot settle anything (no order can exist), and the daily job reports an error
-- instead of ending passes (there are none).

create table if not exists plan_orders (
  id             bigint generated always as identity primary key,
  creator_id     bigint not null references users(id),
  txnid          text not null unique check (txnid ~ '^[A-Za-z0-9]{8,25}$'),
  term_months    smallint not null check (term_months in (1, 12)),
  amount_minor   bigint not null check (amount_minor > 0),
  early          boolean not null default false,
  livemode       boolean not null,
  status         text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  payu_ref       text,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 300),
  created_at     timestamptz not null default now(),
  paid_at        timestamptz,
  failed_at      timestamptz,
  pass_starts_at timestamptz,
  pass_ends_at   timestamptz,
  added_keys     text[] not null default '{}',
  -- A paid order carries everything the receipt and the books need.
  check (status <> 'paid' or (payu_ref is not null and paid_at is not null and pass_starts_at is not null and pass_ends_at is not null)),
  check (status <> 'failed' or failed_at is not null)
);

create index if not exists plan_orders_by_creator on plan_orders (creator_id, created_at desc);
create index if not exists plan_orders_pending on plan_orders (created_at) where status = 'pending';
-- One PayU payment pays one order, whatever is delivered twice.
create unique index if not exists plan_orders_payu_ref on plan_orders (payu_ref) where payu_ref is not null;

alter table users add column if not exists pass_keys text[] not null default '{}';
alter table users add column if not exists pass_until timestamptz;
alter table users add column if not exists pass_reminded_until timestamptz;

-- The daily job looks for passes that have ended.
create index if not exists users_pass_until on users (pass_until) where pass_until is not null;

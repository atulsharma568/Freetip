-- Hardening of the PayU plan purchase after the independent review (2026-11-04). Safe to re-run.
--
-- plan_orders.agreed_at, plan_orders.terms_version
--     — the proof of what the creator agreed to: the server's own time when the Buy form was
--       submitted with the box ticked, and the date of the Terms and Refund Policy text that was
--       published then (LEGAL_UPDATED in src/lib/legal.ts). Orders made before this migration have
--       neither (null). The time is the server's, never taken from the browser.
-- plan_orders.ended_at, plan_orders.ended_reason
--     — set when the owner ends a plan early ("End now", after a refund by hand) on the paid orders
--       that were still running. An ended order no longer holds an early seat, no longer gives the
--       early price on renewal and no longer counts as a sale in the books; the order row and its
--       receipt stay.
-- users.starter_anchor_day, users.creator_anchor_day
--     — the day of the month a plan's current run started (UTC). Adding a month to Jan 31 gives
--       Feb 28, and adding another to Feb 28 gives Mar 28: three days lost. With the anchor the
--       second step lands on Mar 31. Null until the next purchase; then behaves as before.
-- users.blocked_keys
--     — features the owner switched off by hand on purpose (a takedown). A plan never switches a
--       blocked feature back on; ticking it again in the owner's box clears it.
--
-- Run BEFORE deploying the matching code (the order insert names the new columns).

alter table plan_orders add column if not exists agreed_at timestamptz;
alter table plan_orders add column if not exists terms_version text
  check (terms_version is null or char_length(terms_version) <= 40);
alter table plan_orders add column if not exists ended_at timestamptz;
alter table plan_orders add column if not exists ended_reason text
  check (ended_reason is null or char_length(ended_reason) <= 300);

alter table users add column if not exists starter_anchor_day smallint
  check (starter_anchor_day is null or starter_anchor_day between 1 and 31);
alter table users add column if not exists creator_anchor_day smallint
  check (creator_anchor_day is null or creator_anchor_day between 1 and 31);
alter table users add column if not exists blocked_keys text[] not null default '{}';

-- The early-seat count and the renewal look-up read only orders that were not ended early.
create index if not exists plan_orders_early_running on plan_orders (plan, creator_id) where early and ended_at is null;

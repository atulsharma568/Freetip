-- OBS alerts. Safe to re-run.
--
-- users.overlay_token_hash — SHA-256 of the creator's secret overlay link token.
--                            The token itself is never stored; regenerating
--                            replaces the hash, which kills the old link.
-- users.alert_mode         — instant | split | approve (see src/lib/alerts.ts).
-- tip_orders.message_*     — creator's decision on the fan message.
-- tip_orders.*_shown_at    — set when the overlay hands the alert out, so each
--                            alert plays once.

alter table users
  add column if not exists overlay_token_hash text unique,
  add column if not exists alert_mode text not null default 'split'
    check (alert_mode in ('instant', 'split', 'approve'));

alter table tip_orders
  add column if not exists message_status text not null default 'pending'
    check (message_status in ('pending', 'approved', 'rejected')),
  add column if not exists message_decided_at timestamptz,
  add column if not exists alert_shown_at timestamptz,
  add column if not exists message_shown_at timestamptz;

create index if not exists tip_orders_overlay_candidates
  on tip_orders (creator_id, captured_at)
  where status = 'captured';

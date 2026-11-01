-- Paid highlighted messages (paid feature "highlightedMessages"). Safe to re-run.
--
-- A fan who tips at least the creator's pin minimum may ask for their message to be pinned
-- on stream for a while. It is priced as a minimum tip, not an extra fee: the fan still
-- pays exactly the tip. The creator always approves the message first, even in instant mode,
-- and can take it down at any time; either way the tip stays final.
--
-- users.highlight_min_paise — smallest tip that can pin a message; null (the default) means
--                             the creator does not offer it. At least the site minimum tip.
-- users.highlight_seconds   — how long an approved message stays pinned (10 to 120, default 30).
-- tip_orders.highlight      — the fan asked for this tip's message to be pinned (set in
--                             createTipOrder after re-checking the switch and the minimum).
-- tip_orders.highlight_until — when the pinned card ends. Null until the creator approves the
--                             message; set to the past by Unpin or when a newer message replaces
--                             it. A removed message only comes back if the creator pins it again.
--
-- Run BEFORE deploying the matching code (the code falls back, and the feature is off per
-- creator until the owner ticks it, but the settings page and the tip page read these columns).

alter table users add column if not exists highlight_min_paise integer
  check (highlight_min_paise is null or highlight_min_paise >= 2000);
alter table users add column if not exists highlight_seconds integer not null default 30
  check (highlight_seconds between 10 and 120);

alter table tip_orders add column if not exists highlight boolean not null default false;
alter table tip_orders add column if not exists highlight_until timestamptz;

create index if not exists tip_orders_pinned
  on tip_orders (creator_id, highlight_until)
  where highlight;

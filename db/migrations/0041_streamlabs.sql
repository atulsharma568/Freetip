-- Streamlabs bridge (paid feature "streamlabs"). Safe to re-run.
--
-- A creator who connects their own Streamlabs account gets each paid tip as an alert in
-- their Streamlabs alert box. Only creators the owner has switched the feature on for can
-- connect; nothing is sent for anyone else.
--
-- streamlabs_connections — one row per creator, the tokens Streamlabs gave us, sealed with
--   YT_TOKEN_KEY (src/lib/secret-box.ts) so a copy of the database alone cannot send alerts.
--   expires_at is null when Streamlabs did not say (their docs disagree on token life); a
--   refused token is then refreshed once and retried. reconnect_needed is set when a refresh
--   fails, and sending stops until the creator connects again. Disconnecting, or closing the
--   account, deletes the row.
-- streamlabs_outbox — one row per tip waiting to be sent, so a failure never touches the
--   tip or the books. state: queued, sent, or dropped (reason says why: too_late, rejected,
--   reconnect_needed, failed, disconnected, feature_off). An alert older than an hour is dropped, the same
--   freshness rule as the OBS alert. Rows hold no fan name or message: those are read from the
--   tip when it is sent.
--
-- Run BEFORE deploying the matching code (the code is off per creator until the owner ticks
-- the feature, but the capture step reads these tables once a creator is connected).

create table if not exists streamlabs_connections (
  creator_id        bigint primary key references users (id),
  access_token_enc  text not null,
  refresh_token_enc text,
  expires_at        timestamptz,
  display_name      text,
  connected_at      timestamptz not null default now(),
  reconnect_needed  boolean not null default false,
  last_error        text,
  last_error_at     timestamptz,
  last_sent_at      timestamptz
);

create table if not exists streamlabs_outbox (
  tip_order_id    bigint primary key references tip_orders (id),
  creator_id      bigint not null references users (id),
  state           text not null default 'queued' check (state in ('queued', 'sent', 'dropped')),
  attempts        integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  reason          text,
  created_at      timestamptz not null default now(),
  sent_at         timestamptz
);

create index if not exists streamlabs_outbox_due
  on streamlabs_outbox (next_attempt_at)
  where state = 'queued';

create index if not exists streamlabs_outbox_creator
  on streamlabs_outbox (creator_id, created_at desc);

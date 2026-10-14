-- Waitlist tables. Run once against the database, for example by pasting
-- this file into the Neon console's SQL Editor. Safe to run again: nothing
-- is created twice and no data is touched.

create table if not exists waitlist (
  id bigint generated always as identity primary key,
  -- Trimmed and lower-cased; one entry per address.
  email text not null unique check (char_length(email) <= 254),
  -- The handle someone would like. Requested, not reserved.
  handle text check (handle ~ '^[a-z0-9_]{3,20}$'),
  channel_url text check (char_length(channel_url) <= 200),
  source text not null check (source in ('home', 'signup')),
  -- Which version of the privacy notice they agreed to.
  consent_version text not null,
  created_at timestamptz not null default now()
);

-- One row per saved sign-up attempt, for the per-network rate limit.
-- ip_hash is an HMAC of the IP address, never the address itself. Rows are
-- only needed for an hour and are deleted on every sign-up and by a daily
-- cron job (see vercel.json).
create table if not exists waitlist_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists waitlist_attempts_ip_time
  on waitlist_attempts (ip_hash, created_at);

create index if not exists waitlist_attempts_time
  on waitlist_attempts (created_at);

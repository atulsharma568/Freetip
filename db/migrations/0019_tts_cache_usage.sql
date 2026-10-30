-- Voice clip cache and usage counters. Safe to re-run.
--
-- tts_cache: the MP3 for a given voice and text, so a replay or a repeated message
-- costs nothing. Keyed by a SHA-256 of the engine, voice and spoken text. Clips are
-- small (about 10 to 40 KB) and the daily cron removes ones unused for 30 days.
--
-- tts_usage: characters sent to a paid or limited engine, per day, creator and
-- engine. Drives the per-creator daily cap and the site-wide monthly cap that keep
-- the Azure free allowance (500,000 characters a month) from running out.

create table if not exists tts_cache (
  hash         text primary key,
  audio        bytea not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

create index if not exists tts_cache_last_used_idx on tts_cache (last_used_at);

create table if not exists tts_usage (
  day        date   not null,
  creator_id bigint not null,
  engine     text   not null,
  chars      integer not null default 0,
  primary key (day, creator_id, engine)
);

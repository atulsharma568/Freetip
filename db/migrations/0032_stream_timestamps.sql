-- Stream timestamps: viewers or mods type !ts in YouTube live chat (through Nightbot or
-- a similar bot calling a secret URL), each moment is saved, and once the stream ends
-- one comment with all the times is posted from the creator's own YouTube account.
-- Optionally each moment also goes to the creator's Discord channel.
--
-- Safe to run again.

alter table users
  -- Secret in the chat-command URL. Only the SHA-256 hash is kept; the URL is shown once.
  add column if not exists ts_token_hash text unique,
  -- Seconds the chat runs behind the stream, taken off each moment (stream latency).
  add column if not exists ts_delay_seconds integer not null default 22
    check (ts_delay_seconds between 0 and 120),
  -- Refresh token from the opt-in "connect YouTube" step (comment scope), encrypted with
  -- YT_TOKEN_KEY. Never returned to the browser.
  add column if not exists yt_refresh_token_enc text,
  add column if not exists yt_connected_at timestamptz,
  -- Set when Google refuses the token (expired or revoked) so the page can ask to reconnect.
  add column if not exists yt_reconnect_needed boolean not null default false,
  -- The creator's Discord webhook URL, encrypted. Never returned to the browser.
  add column if not exists discord_webhook_enc text;

-- One row per live stream that has at least one saved moment.
create table if not exists timestamp_streams (
  video_id     text primary key check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  creator_id   bigint not null references users (id),
  title        text,
  state        text not null default 'queued'
                 check (state in ('queued', 'posting', 'posted', 'skipped', 'failed')),
  -- Why a stream was skipped or failed (not_commentable, member_only, unavailable, ...).
  reason       text,
  -- YouTube's actual start time; moments are counted from here.
  started_at   timestamptz,
  attempts     integer not null default 0,
  -- When the posting job took it, so a job that died half way is not mistaken for a retry.
  claimed_at   timestamptz,
  comment_id   text,
  created_at   timestamptz not null default now(),
  posted_at    timestamptz
);

create index if not exists timestamp_streams_creator_idx on timestamp_streams (creator_id, created_at desc);
create index if not exists timestamp_streams_queue_idx on timestamp_streams (state) where state in ('queued', 'posting');

create table if not exists stream_timestamps (
  id            bigserial primary key,
  creator_id    bigint not null references users (id),
  video_id      text not null references timestamp_streams (video_id) on delete cascade,
  -- Who typed it (viewer name) and what they wrote. Viewer data: deleted after 90 days.
  chat_user     text,
  title         text,
  source        text not null default 'chat' check (source in ('chat', 'tip', 'goal')),
  delay_seconds integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists stream_timestamps_video_idx on stream_timestamps (video_id, created_at);
create index if not exists stream_timestamps_age_idx on stream_timestamps (created_at);

-- Attempts at the chat-command URL, for rate limiting. Keyed by a hash of the token (and
-- of the chat user), never by IP: bots like Nightbot call from shared addresses.
create table if not exists ts_rate (
  key_hash   text not null,
  created_at timestamptz not null default now()
);

create index if not exists ts_rate_key_idx on ts_rate (key_hash, created_at);
create index if not exists ts_rate_age_idx on ts_rate (created_at);

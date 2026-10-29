-- Alert sounds (the soundboard). Safe to re-run.
--
-- creator_sounds         — one row per sound a creator uploaded. The audio is a
--                          standard WAV in Vercel Blob (blob_url); the browser
--                          repairs every upload into that format first.
--                            enabled   = fans may pick it on the tip page
--                            min_paise = smallest tip that may pick it (0 = any)
--                            volume    = 10-100, 100 plays the file as uploaded
-- users.default_sound_id — plays when a fan picks nothing. Null = silent alert.
-- tip_orders.sound_id    — the fan's pick, saved with the order. The server
--                          checks it against the creator's rules when the order
--                          is created; a paid pick still plays if the creator
--                          later hides or reprices that sound. Deleting a sound
--                          clears the pick (there is no file left to play).

create table if not exists creator_sounds (
  id          bigint generated always as identity primary key,
  creator_id  bigint not null references users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  emoji       text check (emoji is null or char_length(emoji) <= 8),
  min_paise   integer not null default 0 check (min_paise between 0 and 1000000),
  volume      smallint not null default 100 check (volume between 10 and 100),
  enabled     boolean not null default true,
  blob_url    text not null,
  duration_ms integer not null check (duration_ms between 100 and 30050),
  size_bytes  integer not null check (size_bytes between 1 and 8388608),
  created_at  timestamptz not null default now()
);

create index if not exists creator_sounds_by_creator
  on creator_sounds (creator_id, created_at);

alter table users
  add column if not exists default_sound_id bigint
    references creator_sounds(id) on delete set null;

alter table tip_orders
  add column if not exists sound_id bigint
    references creator_sounds(id) on delete set null;

-- Fan identity (name only) for three paid features: fan levels, the fan list and the
-- birthday message. Safe to re-run.
--
-- fan_profiles   — one row per creator and fan, made only for creators who switched on
--                  fan levels or the fan list, and only for a tip that carries a name
--                  (an anonymous tip is never counted).
--                    fan_key = HMAC of the creator id and the normalised name (src/lib/fan-profiles.ts),
--                              so the same name on the same creator's page is one fan.
--                    xp      = 1 per whole rupee of captured tips; the level comes from it
--                              (src/lib/fan-levels.ts). A refunded or charged-back tip takes its XP back.
--                    birthday_md = 'MM-DD', day and month only, only if the fan typed it.
--                    note    = the creator's private note about the fan.
--                  Deleted 12 months after last_at (daily cron), when the creator deletes the
--                  fan, and when the account is closed. The privacy policy says so.
-- fan_xp_events  — one row per tip that has been counted (the tip order id is the key, so a
--                  repeated webhook counts once). Deleted with its profile.
-- users.birthday_message — the creator's greeting; {name} becomes the fan's name.
-- tip_orders.birthday_md — the birthday a fan typed with this tip; cleared with the tip's
--                  name after 90 days.
--
-- Run BEFORE deploying the matching code.

create table if not exists fan_profiles (
  creator_id   bigint not null references users(id) on delete cascade,
  fan_key      text not null,
  display_name text not null check (char_length(display_name) between 1 and 50),
  tips         integer not null default 0,
  total_paise  bigint not null default 0,
  xp           bigint not null default 0,
  birthday_md  text check (birthday_md is null or birthday_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  note         text check (note is null or char_length(note) <= 300),
  first_at     timestamptz not null default now(),
  last_at      timestamptz not null default now(),
  primary key (creator_id, fan_key)
);

create index if not exists fan_profiles_last_at on fan_profiles (last_at);

create table if not exists fan_xp_events (
  tip_order_id bigint primary key references tip_orders(id) on delete cascade,
  creator_id   bigint not null references users(id) on delete cascade,
  fan_key      text not null,
  xp           integer not null,
  paise        bigint not null,
  created_at   timestamptz not null default now()
);

create index if not exists fan_xp_events_by_fan on fan_xp_events (creator_id, fan_key);

alter table users add column if not exists birthday_message text
  check (birthday_message is null or char_length(birthday_message) <= 120);
alter table tip_orders add column if not exists birthday_md text
  check (birthday_md is null or birthday_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$');

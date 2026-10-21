-- Creator accounts. Run once against the database (Neon SQL Editor).
-- Safe to run again: nothing is created twice and no data is touched.

create table if not exists users (
  id            bigint generated always as identity primary key,
  -- Google account ID — stable unique key from OAuth.
  google_id     text not null unique,
  email         text not null unique check (char_length(email) <= 254),
  name          text,
  picture_url   text,
  -- YouTube channel populated at sign-up via the YouTube Data API.
  yt_channel_id   text,
  yt_channel_name text,
  yt_channel_url  text,
  -- Desired creator handle (reserved on account creation).
  handle        text unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Keep updated_at current automatically.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger users_updated_at
  before update on users
  for each row execute procedure set_updated_at();

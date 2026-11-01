-- Stream timestamps, phase 3: the OBS clip helper. A small program on the creator's own
-- PC asks Freetip which moments were saved, cuts each one out of the creator's own OBS
-- recording and uploads it to their Discord. Freetip never sees the video or the
-- Discord address used for it.
-- Run after 0033. Safe to run again.

alter table users
  -- Secret the helper sends to ask for new moments. Only the SHA-256 hash is kept; the
  -- token is shown once. Its own token, apart from the chat command and the editor link,
  -- so one leak does not expose the others.
  add column if not exists ts_helper_token_hash text unique,
  -- Last time the helper asked, so the page can say whether it is running.
  add column if not exists ts_helper_seen_at timestamptz;

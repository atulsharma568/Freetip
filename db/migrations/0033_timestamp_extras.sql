-- Stream timestamps, phase 2: moments added by big tips and completed goals, a public
-- highlights page per stream, and a private link for the creator's video editor.
-- Run after 0032. Safe to run again.

alter table users
  -- A tip at or above this many paise adds a moment when its alert plays (a completed
  -- goal does too). Null means no automatic moments at all. Never below the ₹20 minimum tip.
  add column if not exists ts_tip_min_paise integer
    check (ts_tip_min_paise is null or ts_tip_min_paise >= 2000),
  -- The creator's switch for public highlights pages (off until they turn it on).
  add column if not exists ts_public boolean not null default false,
  -- Secret in the editor link. Only the SHA-256 hash is kept; the link is shown once.
  add column if not exists ts_editor_token_hash text unique;

-- Which tip or goal an automatic moment came from, so an alert confirmed twice (OBS
-- reload) or a goal seen twice adds it once.
alter table stream_timestamps add column if not exists ref text;

create unique index if not exists stream_timestamps_ref_uniq
  on stream_timestamps (video_id, source, ref) where ref is not null;

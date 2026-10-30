-- Test, skip and replay controls for the OBS overlay. Safe to re-run.
--
-- The overlay already polls /api/overlay/<token>. The dashboard buttons write a
-- timestamp, the poll hands it to every open overlay, and an overlay acts when it
-- sees a newer one than the one it started with (so a reload never replays an old
-- command).
--
-- users.overlay_test_at   — "send a test alert" was pressed at this time.
-- users.overlay_skip_at   — "skip the current alert" was pressed at this time.
-- users.overlay_replay_at — last "replay the last alert"; only a cooldown, the
--                           replay itself resets that tip's shown/lease columns.

alter table users
  add column if not exists overlay_test_at timestamptz,
  add column if not exists overlay_skip_at timestamptz,
  add column if not exists overlay_replay_at timestamptz;

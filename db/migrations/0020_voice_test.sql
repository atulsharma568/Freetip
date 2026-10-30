-- Cooldown for the dashboard "Test voice" button. Safe to re-run.
--
-- users.tts_test_at: when this creator last pressed "Test voice". The button only
-- works if the last press was at least a few seconds ago, so one creator cannot use
-- up the free Azure Speech allowance of 20 requests a minute for the whole site.
-- Without this column the button still works, just without the cooldown.

alter table users
  add column if not exists tts_test_at timestamptz;

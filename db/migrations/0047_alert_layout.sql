-- Volume and layout presets for the OBS alert (paid feature "alertLayout").
--
-- users.alert_layout — what the creator changed, as one small JSON object:
--                      side (left or right: the picture beside the card instead of above it),
--                      soundVolume and voiceVolume (a master volume for alert sounds and the
--                      spoken voice, 10 to 99 percent; 100 is normal and not stored).
--                      Null is the normal alert. The code checks every field again when an
--                      alert is shown (src/lib/alert-layout.ts), so a bad value plays as the
--                      normal alert and never breaks an overlay.
--
-- The choice only shows while the creator's switch is on at play time.
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists alert_layout jsonb;

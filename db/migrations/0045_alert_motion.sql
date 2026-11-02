-- Alert animations and timing for the OBS alert card (paid feature "alertMotion").
--
-- users.alert_motion — what the creator changed, as one small JSON object:
--                      enter and exit (animation keys: fade, slide, zoom, bounce, wipe),
--                      seconds (how long the card stays, 5 to 30) and gap (a pause in
--                      seconds after the card leaves, 1 to 10). Null is the normal card.
--                      The code checks every field again when an alert is shown
--                      (src/lib/alert-motion.ts), so a bad value plays as the normal
--                      card and never breaks an overlay.
--
-- The choice only shows while the creator's switch is on at play time.
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists alert_motion jsonb;

-- Alert text and colours for the OBS alert card (paid feature "alertText").
--
-- users.alert_text — what the creator changed on the card, as one small JSON object:
--                    headline (text with {name} and {amount}), bg, text and amount colours
--                    (#rrggbb), size (small, normal, large) and weight (normal, bold).
--                    Null is the normal card. The code checks every field again when an
--                    alert is shown (src/lib/alert-text.ts), so a bad or unreadable value
--                    plays as the normal card and never breaks an overlay.
--
-- The choice only shows while the creator's switch is on at play time.
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists alert_text jsonb;

-- New creators start with a ₹20 minimum tip and the voice switched on.
-- Safe to re-run, with one note: the backfill below moves every creator still on
-- the old ₹49 default to ₹20, so run it once and do not re-run it after a creator
-- has deliberately chosen ₹49 again.
--
-- users.min_tip_paise — default ₹20 (was ₹49).
-- users.tts_enabled   — default on (was off). The voice is still only offered when
--                       the site-wide TTS_ENABLED switch is on.

alter table users alter column min_tip_paise set default 2000;
alter table users alter column tts_enabled set default true;

update users set min_tip_paise = 2000 where min_tip_paise = 4900;

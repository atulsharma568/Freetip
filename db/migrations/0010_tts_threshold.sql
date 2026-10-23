-- Text-to-speech threshold. Safe to re-run.
--
-- users.tts_min_paise — tips below this amount get a silent alert; only tips at
--                       or above it have their message read aloud. Keeps the
--                       speech bill and the stream noise down. Default ₹49.

alter table users
  add column if not exists tts_min_paise integer not null default 4900
    check (tts_min_paise >= 100 and tts_min_paise <= 100000);

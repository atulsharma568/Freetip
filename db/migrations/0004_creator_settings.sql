-- Creator tip-page settings. Safe to re-run: ADD COLUMN IF NOT EXISTS.
--
-- min_tip_paise  — minimum tip the fan must send, in INR paise (₹49 = 4900).
-- message_max_chars — fan message character cap the creator configures.
-- tts_enabled    — whether approved messages are read aloud via TTS.

alter table users
  add column if not exists min_tip_paise integer not null default 4900
    check (min_tip_paise >= 100 and min_tip_paise <= 100000),
  add column if not exists message_max_chars integer not null default 150
    check (message_max_chars >= 10 and message_max_chars <= 500),
  add column if not exists tts_enabled boolean not null default false;

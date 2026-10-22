-- Separate approve-before-play from TTS. Safe to re-run.
--
-- tts_enabled         — whether TTS reads the message aloud at all.
-- approve_before_play — whether the creator must approve a message before
--                       it is read. Only meaningful when tts_enabled is true.
--                       Defaults to true (safe/conservative default).

alter table users
  add column if not exists approve_before_play boolean not null default true;

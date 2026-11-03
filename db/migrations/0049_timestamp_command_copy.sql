-- Stream timestamps: let a creator see their current chat command again before they make a
-- new one. Only the SHA-256 hash was kept until now, so the command could be shown once.
-- This keeps an encrypted copy of the same secret (the same box as the YouTube token and
-- the Discord address, key YT_TOKEN_KEY). Commands made before this have no copy and stay
-- hidden until the creator makes one new command.
-- Run after 0034. Safe to run again.

alter table users
  add column if not exists ts_token_enc text;

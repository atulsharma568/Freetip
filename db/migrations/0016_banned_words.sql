-- Creator's own banned words. Safe to re-run.
--
-- users.banned_words — words or short phrases, one per line or comma separated.
--                      A tip whose message or name holds one is refused before
--                      payment, and one that slips through (the list changed
--                      after the tip) is never shown or read on the overlay.
--                      Our built-in profanity list always applies on top.

alter table users
  add column if not exists banned_words text not null default ''
    check (char_length(banned_words) <= 2000);

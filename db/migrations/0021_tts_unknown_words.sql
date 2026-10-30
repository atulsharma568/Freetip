-- Words the Hinglish converter did not know, to improve its dictionary. Safe to re-run.
--
-- Only single lower-case words and a count are stored, never the message or who sent
-- it. The owner reads them in /admin/tts-words, adds the Hindi ones to
-- src/lib/hinglish-words.ts, and marks each word reviewed so it stops showing.

create table if not exists tts_unknown_words (
  word       text primary key,
  seen       integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen  timestamptz not null default now(),
  reviewed   boolean not null default false
);

create index if not exists tts_unknown_words_open_idx on tts_unknown_words (reviewed, seen desc);

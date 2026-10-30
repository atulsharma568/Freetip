-- Automatic dictionary learning for the Hinglish voice. Safe to re-run.
--
-- A daily job (/api/cron/tts-learn, off until TTS_AUTOLEARN=true) asks a language model about
-- the words in tts_unknown_words that have been seen several times. Words it is
-- sure are ordinary Hindi, not rude and not also English, are saved here with their
-- Devanagari spelling and used by the converter as extra (weak) dictionary words.
-- The owner can remove any of them in /admin/tts-words.

alter table tts_unknown_words add column if not exists outcome text;
-- outcome: learned | english | rejected | known | removed (null while still open)

create table if not exists tts_learned_words (
  word       text primary key,
  devanagari text not null,
  created_at timestamptz not null default now()
);

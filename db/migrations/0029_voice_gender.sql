-- Female or male voice for reading a creator's tip messages aloud.
alter table users
  add column if not exists tts_voice text not null default 'female'
    check (tts_voice in ('female', 'male'));

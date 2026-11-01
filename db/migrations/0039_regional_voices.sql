-- Regional language voices (paid feature "regionalVoices").
--
-- users.tts_lang — the one regional language a creator's alerts may be read in
--                  (ta-IN Tamil, te-IN Telugu, kn-IN Kannada, ml-IN Malayalam,
--                  bn-IN Bengali, gu-IN Gujarati, mr-IN Marathi). Null (the default)
--                  keeps today's behaviour: Hindi and Hinglish read as Hindi, the
--                  rest as Indian English.
--
-- The language only counts while the creator's "Regional language voices" switch is on
-- at play time, and only for a message the fan wrote in that language's own script.
-- Marathi shares Devanagari with Hindi, so a creator who picks Marathi gets typed
-- Devanagari read in Marathi (Roman Hinglish still reads as Hindi).
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists tts_lang text
  check (tts_lang is null or tts_lang in ('ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'bn-IN', 'gu-IN', 'mr-IN'));

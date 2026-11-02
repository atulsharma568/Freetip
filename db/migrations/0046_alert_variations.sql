-- Automatic variations by tip size (paid feature "alertVariations"). Safe to re-run.
--
-- alert_variations — "from this tip size up, play this media, this sound, this text and
--                    colours, and stay this long", applied to a tip the fan did not pick a
--                    rule for. The highest min_paise at or below the tip wins; one variation
--                    per size per creator (Rs 1 up; the creator's normal settings cover
--                    every tip).
--                      media_id, sound_id  null = the normal media rotation and sound
--                      text                small JSON like users.alert_text (headline,
--                                          colours, size, weight); null = the creator's
--                                          standard text. Checked again when an alert is
--                                          shown (src/lib/alert-text.ts).
--                      stay_seconds        null = the normal length; 10 to 300 and only
--                                          from Rs 1,000 up, as for alert rules.
--                    Deleting a media or sound file clears it from the variation. A tip that
--                    picked an alert rule on the tip page never gets a variation.
--
-- Run BEFORE deploying the matching code: without the table the Variations page says so,
-- saving fails, and alerts play without variations (nothing else breaks).

create table if not exists alert_variations (
  id           bigint generated always as identity primary key,
  creator_id   bigint not null references users(id) on delete cascade,
  min_paise    integer not null check (min_paise between 100 and 10000000),
  media_id     bigint references creator_media(id) on delete set null,
  sound_id     bigint references creator_sounds(id) on delete set null,
  text         jsonb,
  stay_seconds integer check (stay_seconds is null or (stay_seconds between 10 and 300 and min_paise >= 100000)),
  created_at   timestamptz not null default now(),
  unique (creator_id, min_paise)
);

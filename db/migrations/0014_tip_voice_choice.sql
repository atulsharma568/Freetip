-- A tip uses either a sound or a spoken message, never both. Safe to re-run.
--
-- tip_orders.tts_requested — the fan chose "read my message aloud". The message
--                            is only read when this is true (and the creator and
--                            the site both have voice on). Tips made before this
--                            migration have false, so they are not read.

alter table tip_orders
  add column if not exists tts_requested boolean not null default false;

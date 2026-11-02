-- Fan-picked alert rules, and a place for site-wide settings. Safe to re-run.
--
-- tip_orders.alert_rule_id  the creator's alert rule (GIF and/or sound at a fixed tip
--                           size) the fan tapped on the tip page. A rule now applies to a
--                           tip only when the fan picked it, so it never overlaps with a
--                           sound from the soundboard or the voice. Null for every other
--                           tip. If the creator deletes the rule the tip just plays as a
--                           normal alert.
-- site_settings             one row per owner setting for the whole site (key and text
--                           value). Today: tts_floor_paise, the smallest tip that may have
--                           its message read aloud whatever the creator chose (no row =
--                           Rs 50). Changed in /admin/settings.
--
-- Run BEFORE deploying the matching code: without the column a rule pick cannot be saved
-- (the tip page says the pick is not available) and without the table the owner's voice
-- minimum falls back to Rs 50.

alter table tip_orders
  add column if not exists alert_rule_id bigint references alert_rules(id) on delete set null;

create table if not exists site_settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

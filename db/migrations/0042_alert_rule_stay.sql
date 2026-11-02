-- Alert rules: how long the alert stays on screen (the "stay on screen" setting).
--
-- stay_seconds  null = the normal alert length. Otherwise 10 to 300 seconds (5 minutes at
--               most), and only for a rule from Rs 1,000 up (min_paise >= 100000), so a
--               small tip can never hold the stage for minutes.
--
-- Safe to re-run. Run BEFORE deploying the matching code: without the column the rules
-- page cannot save and rules stop applying until it is run.

alter table alert_rules add column if not exists stay_seconds integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'alert_rules_stay_check') then
    alter table alert_rules add constraint alert_rules_stay_check
      check (stay_seconds is null or (stay_seconds between 10 and 300 and min_paise >= 100000));
  end if;
end $$;

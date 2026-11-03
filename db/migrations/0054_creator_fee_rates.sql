-- The owner's fee rates: a site-wide standard, an optional pair per creator, and the pair each tip
-- was charged at. Safe to re-run.
--
-- users.platform_bps_override,
-- users.processing_bps_override  a creator's own platform fee and processing charge, in basis
--                                points (500 = 5%). Both numbers or neither: null and null means
--                                the creator follows the site-wide rates, which the owner sets in
--                                /admin/fees (they live in site_settings, no column needed). Set per
--                                creator on the creator's page or in bulk in /admin/fees.
-- tip_orders.platform_bps,
-- tip_orders.processing_bps      the pair this tip is charged at, copied onto the order when it is
--                                created. The books, the creator's estimate and the CSV all read
--                                these, so changing a rate later never rewrites an old tip. Every
--                                existing order gets the rates it was charged at so far (5% and
--                                2.75%): a default that is a constant adds the column without
--                                rewriting the table.
--
-- The owner's own account (handle acepressure) starts with no fees (0% and 0%), as the owner
-- asked on 2026-11-03; it is an ordinary override that can be changed in /admin/fees, and the change
-- is written to the audit history. It only applies when that account has no override yet.
--
-- Run BEFORE deploying the matching code: the dashboard's estimates and the books read the new
-- tip_orders columns.

alter table users
  add column if not exists platform_bps_override integer,
  add column if not exists processing_bps_override integer;

alter table tip_orders
  add column if not exists platform_bps integer not null default 500,
  add column if not exists processing_bps integer not null default 275;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_fee_override_valid') then
    alter table users add constraint users_fee_override_valid check (
      (platform_bps_override is null and processing_bps_override is null)
      or (platform_bps_override is not null and processing_bps_override is not null
          and platform_bps_override between 0 and 5000 and processing_bps_override between 0 and 5000
          and platform_bps_override + processing_bps_override <= 6000)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tip_orders_fee_rates_valid') then
    alter table tip_orders add constraint tip_orders_fee_rates_valid check (
      platform_bps between 0 and 5000 and processing_bps between 0 and 5000
      and platform_bps + processing_bps <= 6000
    );
  end if;
end $$;

with set_free as (
  update users
     set platform_bps_override = 0, processing_bps_override = 0
   where handle = 'acepressure' and platform_bps_override is null and processing_bps_override is null
  returning id
)
insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
select null, 'owner', 'creator.fee_rates_changed', 'user', id::text,
       '{"mode":"site"}'::jsonb, '{"mode":"own","platformBps":0,"processingBps":0}'::jsonb,
       'no fees on the owner''s own account (migration 0054)'
  from set_free;

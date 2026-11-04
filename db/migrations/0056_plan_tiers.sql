-- Two plans, Starter and Creator, in place of the single pass from 0055. Safe to re-run.
--
-- Each plan is its own pass with its own end date: buying Starter extends Starter, buying Creator
-- extends Creator, and a creator may hold both (Creator includes everything in Starter, so the
-- features on are the union of the plans that are running). Nothing is carried from one plan to
-- the other, so neither can be used to get the other cheaper.
--
-- plan_orders.plan          — which plan an order bought. Orders made before this migration sold
--                             every feature, which is the Creator plan, so they read as 'creator'.
-- users.starter_until, users.creator_until
--                           — when each plan's pass ends (null: not running). A new term is added
--                             to the end date when it is still in the future.
-- users.starter_reminded_until, users.creator_reminded_until
--                           — the end date a "5 days left" reminder was last sent for, per plan.
-- users.pass_keys           — unchanged: the keys the running passes added to users.paid_features,
--                             so that when a plan ends only the keys no running plan still covers
--                             are taken away and the owner's own ticks stay.
-- users.pass_until, users.pass_reminded_until (from 0055) are no longer read or written. The
-- carry-over below moves a running 0055 pass into creator_until and empties them. The columns stay
-- in place so the previous deploy keeps running until the new one is live.
--
-- Run BEFORE deploying the matching code, and deploy straight after: a payment settled by the
-- OLD code between the two would write only the retired columns. Run this migration once more
-- right after the deploy to move such a payment over. (Only the owner can pay in test mode, so
-- nothing real is at risk.)

alter table plan_orders add column if not exists plan text not null default 'creator';
alter table plan_orders drop constraint if exists plan_orders_plan_check;
alter table plan_orders add constraint plan_orders_plan_check check (plan in ('starter', 'creator'));

alter table users add column if not exists starter_until timestamptz;
alter table users add column if not exists creator_until timestamptz;
alter table users add column if not exists starter_reminded_until timestamptz;
alter table users add column if not exists creator_reminded_until timestamptz;

-- A pass from 0055 sold every feature: it becomes a Creator pass. The later end date wins (a payment
-- settled by the old code between this migration and the deploy writes only the old column, so
-- running this again right after the deploy picks it up), and the old columns are emptied so a
-- second run finds nothing stale to copy back and a rolled-back deploy cannot end a running plan.
update users
   set creator_reminded_until = case when creator_until is null or pass_until > creator_until
                                     then pass_reminded_until else creator_reminded_until end,
       creator_until = greatest(creator_until, pass_until),
       pass_until = null,
       pass_reminded_until = null
 where pass_until is not null;

-- A 0055 pass also added the custom page and the Pressure meter. They are the owner's by-hand
-- features and belong to no plan, so they stop being remembered as a pass's keys: they stay on for
-- the creator and a plan ending never removes them. (Pinned messages were never part of a pass.)
update users
   set pass_keys = array(select k from unnest(pass_keys) k where k not in ('pageBuilder', 'pressureMeter', 'highlightedMessages'))
 where pass_keys && array['pageBuilder', 'pressureMeter', 'highlightedMessages']::text[];

-- The daily job looks for plans that have ended.
create index if not exists users_starter_until on users (starter_until) where starter_until is not null;
create index if not exists users_creator_until on users (creator_until) where creator_until is not null;
-- Early seats are counted per plan.
create index if not exists plan_orders_early_by_plan on plan_orders (plan, creator_id) where early;

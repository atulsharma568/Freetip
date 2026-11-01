-- Several goal bars at once, a timezone per goal, and carrying a shortfall over.
-- Safe to re-run.
--
-- goals           — one row per goal bar (a creator can have up to 3, enforced in
--                   the app). Moved here from the single goal on users
--                   (goal_title, goal_target_paise, goal_started_at, goal_repeat),
--                   which are no longer read; they are left in place, unused.
-- goals.timezone  — an IANA zone name from the list in src/lib/goal.ts. A repeating
--                   goal's day, week (Monday start) and month follow that clock.
-- goals.carry_over — when a repeating goal falls short, the shortfall is added to
--                   the next period's target (never more than one extra target).
-- goal_history    — now belongs to a goal (goal_id, set to null if the goal is
--                   removed so the past stays visible). carry_paise is the part of
--                   target_paise that was carried in; timezone names the clock the
--                   period was cut on. The old primary key allowed only one row per
--                   creator and repeat kind, so it goes; one row per goal and
--                   period replaces it.

create table if not exists goals (
  id            bigserial   primary key,
  creator_id    bigint      not null references users (id) on delete cascade,
  title         text        not null,
  target_paise  bigint      not null check (target_paise > 0),
  repeat        text        not null default 'never' check (repeat in ('never', 'daily', 'weekly', 'monthly')),
  timezone      text        not null default 'Asia/Kolkata',
  carry_over    boolean     not null default false,
  started_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists goals_creator_idx on goals (creator_id);

-- Bring over each creator's existing goal, once. goals_migrated stops a re-run from
-- bringing back a goal the creator has since removed.
alter table users add column if not exists goals_migrated boolean not null default false;

insert into goals (creator_id, title, target_paise, repeat, started_at)
select u.id, u.goal_title, u.goal_target_paise,
       case when u.goal_repeat in ('daily', 'weekly', 'monthly') then u.goal_repeat else 'never' end,
       coalesce(u.goal_started_at, u.created_at)
from users u
where not u.goals_migrated
  and u.goal_title is not null
  and u.goal_target_paise is not null
  and u.goal_target_paise > 0;

update users set goals_migrated = true where not goals_migrated;

alter table goal_history add column if not exists goal_id bigint references goals (id) on delete set null;
alter table goal_history add column if not exists carry_paise bigint not null default 0;
alter table goal_history add column if not exists timezone text not null default 'Asia/Kolkata';

-- Attach the history written so far to the goal it was about.
update goal_history h
   set goal_id = g.id
  from goals g
 where h.goal_id is null
   and g.creator_id = h.creator_id
   and g.repeat = h.repeat;

alter table goal_history drop constraint if exists goal_history_pkey;
create unique index if not exists goal_history_goal_period_idx
  on goal_history (goal_id, period_start) where goal_id is not null;
create index if not exists goal_history_creator_idx on goal_history (creator_id, period_start desc);

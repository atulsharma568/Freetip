-- Repeating goal bar (daily, weekly or monthly) and its history. Safe to re-run.
--
-- users.goal_repeat — 'never' (one goal counted from goal_started_at, as before),
--                     'daily', 'weekly' (weeks start on Monday) or 'monthly'. A
--                     repeating goal counts tips captured since the start of the
--                     current period in Indian time (Asia/Kolkata), so it starts
--                     again from zero by itself; no job has to run to reset it.
-- goal_history     — one row per finished period of a repeating goal: what was
--                     raised against the target. Written by the daily cron and
--                     when the creator opens the dashboard; never twice.

alter table users add column if not exists goal_repeat text not null default 'never';

create table if not exists goal_history (
  creator_id    bigint      not null references users (id) on delete cascade,
  repeat        text        not null,
  period_start  timestamptz not null,
  title         text        not null,
  target_paise  bigint      not null,
  raised_paise  bigint      not null,
  hit           boolean     not null,
  primary key (creator_id, repeat, period_start)
);

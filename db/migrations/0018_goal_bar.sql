-- Goal bar overlay. Safe to re-run.
--
-- A creator sets one goal: a title and a target amount. Progress is the sum of
-- tips captured since goal_started_at, so "restart" just moves that time forward.
-- No goal is active while goal_target_paise is null.

alter table users
  add column if not exists goal_title text,
  add column if not exists goal_target_paise bigint,
  add column if not exists goal_started_at timestamptz;

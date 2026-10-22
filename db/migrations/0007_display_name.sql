-- Custom display name for the creator's tip page. Safe to re-run.
-- Falls back to the Google account name when null.
-- Max 50 chars enforced at the app level; no DB constraint so future
-- increases don't require a migration.

alter table users
  add column if not exists display_name text;

-- Creator bio shown on the public tip page. Safe to re-run.
-- Max 160 chars enforced at the app level; the DB column has no constraint
-- so future increases don't need a migration.

alter table users
  add column if not exists bio text;

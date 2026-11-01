-- Paid features, switched on one creator at a time by the owner.
--
-- users.paid_features — the feature keys the owner has turned on for this creator
--                       (see src/lib/plans.ts for the list). Empty for everyone, so
--                       every paid feature is OFF until the owner turns it on in
--                       /admin/creators/<id>. This includes stream timestamps and the
--                       OBS clip helper, which were open to everyone before this
--                       migration: creators using them lose them until switched on.
--
-- Run BEFORE deploying the matching code.

alter table users add column if not exists paid_features text[] not null default '{}';

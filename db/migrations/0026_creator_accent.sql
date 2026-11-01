-- A creator's tip-page accent colour, and a plan slot for later.
-- Safe to re-run: ADD COLUMN IF NOT EXISTS.
--
-- users.accent — a lower-case #rrggbb colour, or null for the default lime. The
--                app only ever writes a preset or a colour taken from the
--                profile picture and checked for contrast, and it falls back to
--                the default when it reads anything it does not trust.
-- users.plan   — 'free' for everyone. Nothing reads it yet; it exists so a paid
--                plan can be added later without touching creator rows.

alter table users add column if not exists accent text;
alter table users add column if not exists plan text not null default 'free';

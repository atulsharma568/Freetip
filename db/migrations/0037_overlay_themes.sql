-- Overlay themes and fonts for the OBS alert card (paid feature "overlayThemes").
--
-- users.overlay_theme — which card style the creator picked (a key from
--                       src/lib/overlay-themes.ts: classic, midnight, paper, neon,
--                       blocky). An unknown key plays as classic, so a theme can be
--                       removed from the code without breaking anyone's overlay.
-- users.overlay_font  — which font (default, poppins, bangers, pixel, serif).
--
-- The choice only shows while the creator's switch is on at play time.
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists overlay_theme text not null default 'classic';
alter table users add column if not exists overlay_font text not null default 'default';

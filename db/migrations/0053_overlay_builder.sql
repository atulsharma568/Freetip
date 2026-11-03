-- The owner's overlay editor (page builder phase 5, part two). Safe to re-run.
--
-- users.overlay_draft    — the owner's unpublished edits to a creator's OBS overlays, as one JSON
--                          object (src/lib/overlay-doc): the alert's text, animations, layout, theme
--                          and font, and the goal bar's look. Nothing in it reaches a stream until
--                          the owner presses Publish, which checks every part again with the same
--                          rules the creator's own dashboard pages use and writes the live columns
--                          (alert_text, alert_motion, alert_layout, overlay_theme, overlay_font and
--                          goal_bar_style). The alert itself reads those same columns as before, so
--                          the alert code is not touched.
-- users.overlay_previous — the live values just before the last Publish, so "Swap with previous
--                          version" is one click and doing it again swaps back.
-- users.goal_bar_style   — the goal bar's own look (bar colour, rupees or percent, goal-reached
--                          moment). Null is today's bar. Read only while the creator's "Custom tip
--                          page" switch is on.
--
-- Run BEFORE deploying the matching code (the goal bar and the alerts keep working without it; the
-- editor says to run it).

alter table users add column if not exists overlay_draft jsonb;
alter table users add column if not exists overlay_previous jsonb;
alter table users add column if not exists goal_bar_style jsonb;

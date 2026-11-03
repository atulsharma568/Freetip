-- YouTube banner behind the creator's photo on the tip page (paid feature "tipBanner").
--
-- users.tip_banner_url — the creator's own YouTube channel banner address, copied from YouTube
--                        when the creator presses the button on /dashboard/banner. Only an
--                        https address on Google's image hosts is stored (checked again every
--                        time the tip page is drawn, src/lib/tip-banner.ts). Null is no banner.
--
-- The banner only shows while the creator's switch is on at the time the page is drawn.
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists tip_banner_url text;

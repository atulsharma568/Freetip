-- The creator's YouTube channel photo on the tip page (part of the paid feature "tipBanner").
--
-- users.tip_photo_url — the channel's own profile picture address, copied from YouTube when the
--                       creator presses the button on /dashboard/banner. Kept apart from
--                       picture_url (the Google account photo, rewritten at every sign-in) so
--                       signing in again does not undo the choice. Only an https address on
--                       Google's image hosts is stored (checked again when the tip page is
--                       drawn, src/lib/tip-banner.ts). Null means the account photo is used.
--
-- Run BEFORE deploying the matching code. Safe to re-run.

alter table users add column if not exists tip_photo_url text;

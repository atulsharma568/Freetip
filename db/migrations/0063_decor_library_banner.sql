-- Lets the library from 0062 hold tip page banners too (kind 'banner', up to 6 MB, files under
-- banners/<creator id>/). Safe to re-run. Run BEFORE deploying the matching code (without it a banner
-- upload cannot be saved to the library). Run 0062 first.
--
-- A creator wears a banner by setting users.tip_banner_url to the item's file address; when the page is
-- read, a banner that names a library item shows only while that item is approved and theirs or actively
-- granted, so a take-down or a withdrawn grant stops it at once.

alter table decor_items drop constraint if exists decor_items_kind_check;
alter table decor_items add constraint decor_items_kind_check check (kind in ('avatar', 'frame', 'banner'));
alter table decor_items drop constraint if exists decor_items_size_bytes_check;
alter table decor_items add constraint decor_items_size_bytes_check check (size_bytes between 1 and 6291456);

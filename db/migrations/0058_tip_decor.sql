-- A creator's own pick of the animated frame over their photo and the effect over their banner (the
-- dashboard page "Effects", the owner's page for now). jsonb like {"frame": "foxfire", "bannerFx":
-- "clutch"}; null means nothing was ever saved. Run BEFORE the deploy; without it the page opens on the
-- page's own look and saving says it could not save.
alter table users add column if not exists tip_decor jsonb;

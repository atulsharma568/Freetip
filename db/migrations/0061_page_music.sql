-- The owner's tip-page music: one uploaded track, played by a small player on the owner's own page
-- (the dashboard page "Effects", owner only). jsonb like {"url": "https://....public.blob.vercel-storage.com/
-- page-music/1/song.mp3", "title": "Song"}; null means no music. Run BEFORE the deploy; without it the
-- page simply shows no player and saving a track says it could not save.
alter table users add column if not exists page_music jsonb;

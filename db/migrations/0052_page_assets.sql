-- Pictures, GIFs and short videos for the tip page builder (phase 3). Safe to re-run.
--
-- page_assets — one row per file the owner uploaded for a creator's tip page (file in Vercel Blob
--               under page/<creator id>/, first bytes checked again by the server before the row
--               is saved). The page document stores only the row's id, so a picture is replaced by
--               uploading a new one and pointing the draft at it, and the old row stays until the
--               owner removes it (which is refused while any stored page still uses it).
--                 kind         = image | gif | webm
--                 poster_url   = a still picture of the first frame, made in the browser; always
--                                there for a gif or webm (shown on devices that should not play
--                                motion) and empty for a still image
--                 review_state = approved: may be drawn; removed: taken down (by the owner here or
--                                in /admin/media), its files are deleted and the page shows its
--                                normal look in its place
-- Only the owner uploads, so a file is live to the owner's own pages at once.
--
-- Run BEFORE deploying the matching code (the tip page still loads without it: an asset that cannot
-- be read gives the normal look).

create table if not exists page_assets (
  id           bigint generated always as identity primary key,
  creator_id   bigint not null references users(id) on delete cascade,
  kind         text not null check (kind in ('image', 'gif', 'webm')),
  name         text not null check (char_length(name) between 1 and 40),
  blob_url     text not null,
  poster_url   text,
  mime         text not null,
  size_bytes   integer not null check (size_bytes between 1 and 8388608),
  poster_bytes integer check (poster_bytes is null or poster_bytes between 1 and 307200),
  width        integer check (width is null or width between 1 and 4096),
  height       integer check (height is null or height between 1 and 4096),
  duration_ms  integer check (duration_ms is null or duration_ms between 1 and 15050),
  review_state text not null default 'approved' check (review_state in ('approved', 'removed')),
  created_at   timestamptz not null default now(),
  removed_at   timestamptz,
  check (kind = 'image' or poster_url is not null)
);

create index if not exists page_assets_by_creator on page_assets (creator_id, created_at);
-- One row per stored file: a retry or a double submit cannot make two rows over one file (removing
-- one would then delete the other's file).
create unique index if not exists page_assets_blob_url on page_assets (blob_url);
create unique index if not exists page_assets_poster_url on page_assets (poster_url) where poster_url is not null;

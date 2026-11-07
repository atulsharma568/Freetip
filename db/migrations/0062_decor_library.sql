-- The library of pictures creators upload for their tip page (profile picture and decoration), and the
-- admin's sharing of them. Safe to re-run. Run BEFORE deploying the matching code (without it the
-- Effects page cannot save an upload and the admin Decorations page is empty; a page that already
-- wears a picture keeps showing it, because the file address is also kept in users.tip_decor).
--
-- decor_items  — one row per uploaded picture (file in Vercel Blob under decor/<creator id>/, first
--                bytes and size checked again by the server before the row is saved).
--                  kind         = avatar (replaces the photo) | frame (a decoration over it)
--                  poster_url   = a still of the first frame for an animated file (shown to visitors
--                                 who ask for less motion)
--                  placement    = where a decoration sits: {"anchor","size","dx","dy"} (see decor.ts);
--                                 the creator's last choice, a starting point when it is reused
--                  review_state = approved: may be drawn; removed: taken down (by the creator, or by
--                                 the owner in /admin/decorations); a removed item stops showing at once
-- decor_grants — the owner lets another creator use a picture that belongs to someone else. A grant is
--                withdrawn by setting revoked_at, and the picture stops showing on that creator's page.

create table if not exists decor_items (
  id           bigint generated always as identity primary key,
  creator_id   bigint not null references users(id) on delete cascade,
  kind         text not null check (kind in ('avatar', 'frame')),
  name         text not null check (char_length(name) between 1 and 40),
  blob_url     text not null,
  poster_url   text,
  mime         text not null,
  size_bytes   integer not null check (size_bytes between 1 and 3145728),
  width        integer not null check (width between 1 and 4096),
  height       integer not null check (height between 1 and 4096),
  animated     boolean not null default false,
  placement    jsonb,
  review_state text not null default 'approved' check (review_state in ('approved', 'removed')),
  created_at   timestamptz not null default now(),
  removed_at   timestamptz
);

create index if not exists decor_items_by_creator on decor_items (creator_id, created_at);
-- One row per stored file: a retry or a double submit cannot make two rows over one file.
create unique index if not exists decor_items_blob_url on decor_items (blob_url);

create table if not exists decor_grants (
  item_id        bigint not null references decor_items(id) on delete cascade,
  to_creator_id  bigint not null references users(id) on delete cascade,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz,
  primary key (item_id, to_creator_id)
);

create index if not exists decor_grants_by_creator on decor_grants (to_creator_id) where revoked_at is null;

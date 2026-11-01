-- Custom alert media and alert rules by tip size. Safe to re-run.
--
-- creator_media — one row per GIF, image or WebM a creator uploaded for their OBS
--                 alert (file in Vercel Blob under media/<creator id>/, checked by its
--                 first bytes before saving).
--                   kind         = gif | image | webm
--                   placement    = where it shows on the alert (above, behind, fullscreen)
--                   review_state = new: the creator's first upload, held until the
--                                  owner approves it; approved: may play; removed:
--                                  taken down by the owner (the file is deleted)
--                   enabled      = the creator's own on/off
--                 A file plays only when enabled and approved (src/lib/media.ts).
-- alert_rules   — "from this tip size up, play this media and/or sound". The highest
--                 min_paise at or below the tip wins; one rule per size per creator.
--                 Deleting a media or sound file clears it from the rule.
--
-- Run BEFORE deploying the matching code.

create table if not exists creator_media (
  id           bigint generated always as identity primary key,
  creator_id   bigint not null references users(id) on delete cascade,
  kind         text not null check (kind in ('gif', 'image', 'webm')),
  name         text not null check (char_length(name) between 1 and 40),
  blob_url     text not null,
  mime         text not null,
  size_bytes   integer not null check (size_bytes between 1 and 8388608),
  duration_ms  integer check (duration_ms is null or duration_ms between 1 and 10050),
  width        integer check (width is null or width between 1 and 4096),
  height       integer check (height is null or height between 1 and 4096),
  placement    text not null default 'above' check (placement in ('above', 'behind', 'fullscreen')),
  enabled      boolean not null default true,
  review_state text not null default 'new' check (review_state in ('new', 'approved', 'removed')),
  created_at   timestamptz not null default now()
);

create index if not exists creator_media_by_creator on creator_media (creator_id, created_at);
create index if not exists creator_media_to_review on creator_media (created_at) where review_state = 'new';

create table if not exists alert_rules (
  id         bigint generated always as identity primary key,
  creator_id bigint not null references users(id) on delete cascade,
  min_paise  integer not null check (min_paise between 0 and 10000000),
  media_id   bigint references creator_media(id) on delete set null,
  sound_id   bigint references creator_sounds(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (creator_id, min_paise)
);

-- A creator may change their handle once, ever. The old handle is kept here so
-- nobody else can claim it (the old link and QR code stop working and never lead
-- to a stranger). One row per creator is enforced by the unique index on user_id.
create table if not exists handle_history (
  old_handle text primary key check (old_handle ~ '^[a-z0-9_]{3,20}$'),
  user_id    bigint not null references users(id),
  renamed_at timestamptz not null default now()
);

create unique index if not exists handle_history_user_idx on handle_history (user_id);

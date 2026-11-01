-- A creator no longer renames their own handle: they send a request and the owner
-- approves or rejects it in /admin/handle-requests. Approving runs the same one-time
-- rename as before (handle_history, migration 0030). A creator can have one open
-- request at a time; a rejected one does not use up their change.
create table if not exists handle_requests (
  id               bigint generated always as identity primary key,
  user_id          bigint not null references users(id),
  current_handle   text not null,
  requested_handle text not null check (requested_handle ~ '^[a-z0-9_]{3,20}$'),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decision_note    text,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);

create unique index if not exists handle_requests_one_pending_idx
  on handle_requests (user_id) where status = 'pending';
create index if not exists handle_requests_status_idx on handle_requests (status, created_at);

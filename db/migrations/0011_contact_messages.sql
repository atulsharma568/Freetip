-- Contact form. Safe to re-run.
--
-- contact_messages — what people send from /contact, read by the owner in
--                    /admin/messages. No IP address is stored with a message.
-- contact_attempts — one row per saved message, for the per-network rate
--                    limit. ip_hash is an HMAC of the IP address, never the
--                    address itself. Rows are only needed for an hour and are
--                    deleted on every message and by the daily cron job.

create table if not exists contact_messages (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  topic text not null check (topic in ('general', 'payment', 'creator', 'report', 'privacy')),
  -- Optional payment ID or UPI reference (UTR) for a payment problem.
  payment_ref text check (char_length(payment_ref) <= 60),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'new' check (status in ('new', 'handled')),
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_status_time
  on contact_messages (status, created_at desc);

create table if not exists contact_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists contact_attempts_ip_time
  on contact_attempts (ip_hash, created_at);

create index if not exists contact_attempts_time
  on contact_attempts (created_at);

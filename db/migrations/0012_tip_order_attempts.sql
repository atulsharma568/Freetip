-- Rate limit for starting a tip. Safe to re-run.
--
-- tip_order_attempts — one row per tip started (a Razorpay order created), for
--                      the per-network limit in createTipOrder. ip_hash is an
--                      HMAC of the IP address, never the address itself. Rows
--                      are only needed for an hour and are deleted on every
--                      new tip and by the daily cron job.
--
-- Until this is run, createTipOrder logs that the check failed and lets tips
-- through, so running it late never blocks a payment.

create table if not exists tip_order_attempts (
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists tip_order_attempts_ip_time
  on tip_order_attempts (ip_hash, created_at);

create index if not exists tip_order_attempts_time
  on tip_order_attempts (created_at);

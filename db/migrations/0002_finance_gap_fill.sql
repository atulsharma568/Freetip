-- Finance gap fill: fee policies, raw provider events, settlement items,
-- anonymous tip flag and updated_at housekeeping.
--
-- Run after 0001_finance_foundation.sql.

-- 1. Versioned platform fee policy.
--    fee_lines.rule_version references a row here by code, giving a stable
--    audit trail even if the rate changes.
create table if not exists platform_fee_policies (
  id              bigint generated always as identity primary key,
  version         text not null unique,          -- e.g. '1.0'
  rate_pct        numeric(6, 4) not null          -- e.g. 5.0000
    check (rate_pct >= 0 and rate_pct <= 100),
  description     text,
  effective_from  timestamptz not null,
  effective_until timestamptz,                   -- null = currently active
  created_at      timestamptz not null default now(),
  check (effective_until is null or effective_until > effective_from)
);

-- Ensure at most one policy has no effective_until (the active policy).
create unique index if not exists platform_fee_policies_one_active
  on platform_fee_policies (effective_until)
  where effective_until is null;

-- Seed the launch policy: 5 % from product inception.
insert into platform_fee_policies (version, rate_pct, description, effective_from)
values ('1.0', 5.0000, 'Launch rate: 5% of every tip', '2024-01-01T00:00:00Z')
on conflict (version) do nothing;

-- 2. Raw provider events for idempotent webhook ingestion.
--    Stored before processing so we can detect duplicates, replay failed
--    events and satisfy the reconciliation check "duplicate webhook/event".
--    Payload is stored encrypted-at-rest by Neon; never render it in the UI.
create table if not exists provider_events (
  id                  bigint generated always as identity primary key,
  provider            text not null check (provider in ('razorpay')),
  event_id            text not null,             -- provider's own event ID
  event_type          text not null,             -- e.g. 'payment.captured'
  payload             jsonb not null,            -- raw webhook body
  received_at         timestamptz not null default now(),
  processed_at        timestamptz,
  processing_status   text not null default 'pending'
    check (processing_status in ('pending', 'processed', 'failed', 'ignored', 'duplicate')),
  linked_entity_type  text,                      -- 'payment_attempt', 'refund', etc.
  linked_entity_id    bigint,
  error_message       text,
  unique (provider, event_id)                    -- idempotency gate
);

create index if not exists provider_events_status_received_at
  on provider_events (processing_status, received_at desc);

create index if not exists provider_events_type_received_at
  on provider_events (event_type, received_at desc);

-- Append-only: never allow updates or deletes on raw events.
drop trigger if exists provider_events_no_update on provider_events;
create trigger provider_events_no_update
  before update or delete on provider_events
  for each row execute procedure reject_finance_history_update();

-- 3. Settlement items: link payment_attempts to settlement batches.
--    Enables "settlement batch total not matching included payments" checks
--    and the "Number of included payments" column in the UI.
create table if not exists settlement_items (
  id                    bigint generated always as identity primary key,
  settlement_id         bigint not null references settlements(id),
  payment_attempt_id    bigint not null references payment_attempts(id),
  gross_amount_minor    bigint not null check (gross_amount_minor >= 0),
  provider_fee_minor    bigint not null default 0 check (provider_fee_minor >= 0),
  provider_tax_minor    bigint not null default 0 check (provider_tax_minor >= 0),
  net_amount_minor      bigint not null check (net_amount_minor >= 0),
  currency              char(3) not null default 'INR',
  created_at            timestamptz not null default now(),
  unique (settlement_id, payment_attempt_id)
);

create index if not exists settlement_items_settlement_id
  on settlement_items (settlement_id);

create index if not exists settlement_items_payment_attempt_id
  on settlement_items (payment_attempt_id);

-- 4. Anonymous tip flag on tip_orders.
--    Core product feature: fan can tip without revealing their name.
--    When true, fan_name is null or ignored in display and TTS.
alter table tip_orders
  add column if not exists anonymous boolean not null default false;

-- 5. Updated_at on mutable finance tables.
--    Ledger tables are append-only (trigger above) so they are excluded.
alter table tip_orders
  add column if not exists updated_at timestamptz not null default now();

alter table payment_attempts
  add column if not exists updated_at timestamptz not null default now();

alter table refunds
  add column if not exists updated_at timestamptz not null default now();

alter table disputes
  add column if not exists updated_at timestamptz not null default now();

alter table settlements
  add column if not exists updated_at timestamptz not null default now();

alter table creator_payouts
  add column if not exists updated_at timestamptz not null default now();

-- creator_payment_profiles already has updated_at from 0001 — no change needed.

-- Triggers for the mutable tables.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_trigger where tgname = 'tip_orders_updated_at'
  ) then
    create trigger tip_orders_updated_at
      before update on tip_orders
      for each row execute procedure set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'payment_attempts_updated_at'
  ) then
    create trigger payment_attempts_updated_at
      before update on payment_attempts
      for each row execute procedure set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'refunds_updated_at'
  ) then
    create trigger refunds_updated_at
      before update on refunds
      for each row execute procedure set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'disputes_updated_at'
  ) then
    create trigger disputes_updated_at
      before update on disputes
      for each row execute procedure set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'settlements_updated_at'
  ) then
    create trigger settlements_updated_at
      before update on settlements
      for each row execute procedure set_updated_at();
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'creator_payouts_updated_at'
  ) then
    create trigger creator_payouts_updated_at
      before update on creator_payouts
      for each row execute procedure set_updated_at();
  end if;
end $$;

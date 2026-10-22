-- Tipsite finance foundation.
--
-- This migration defines the internal records needed for owner reporting. It
-- does not connect to Razorpay, create orders, receive webhooks, issue
-- refunds, settle funds or pay creators. Provider references stay nullable
-- until the payment account model is approved.

create table if not exists creator_payment_profiles (
  id                    bigint generated always as identity primary key,
  creator_id            bigint not null references users(id),
  provider              text not null check (provider in ('razorpay')),
  provider_account_ref  text,
  status                text not null default 'not_configured'
    check (status in ('not_configured', 'pending', 'active', 'restricted', 'disabled')),
  payout_hold_reason    text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (creator_id, provider)
);

create table if not exists tip_orders (
  id                bigint generated always as identity primary key,
  creator_id        bigint not null references users(id),
  public_reference  text not null unique,
  gross_amount_minor bigint not null check (gross_amount_minor > 0),
  currency          char(3) not null default 'INR',
  fan_name          text,
  fan_message       text,
  status            text not null default 'created'
    check (status in ('created', 'payment_pending', 'captured', 'failed', 'cancelled', 'refunded', 'disputed', 'closed')),
  created_at        timestamptz not null default now(),
  captured_at       timestamptz,
  closed_at         timestamptz
);

create index if not exists tip_orders_creator_created_at
  on tip_orders (creator_id, created_at desc);

create table if not exists payment_attempts (
  id                    bigint generated always as identity primary key,
  tip_order_id          bigint not null references tip_orders(id),
  provider              text not null check (provider in ('razorpay')),
  provider_order_ref    text,
  provider_payment_ref  text unique,
  payment_method        text,
  provider_status       text,
  amount_minor          bigint not null check (amount_minor > 0),
  currency              char(3) not null default 'INR',
  idempotency_key       text not null unique,
  failure_code          text,
  failure_reason        text,
  created_at            timestamptz not null default now(),
  authorized_at         timestamptz,
  captured_at           timestamptz,
  failed_at             timestamptz
);

create index if not exists payment_attempts_order_created_at
  on payment_attempts (tip_order_id, created_at desc);

create table if not exists fee_lines (
  id                       bigint generated always as identity primary key,
  tip_order_id             bigint references tip_orders(id),
  payment_attempt_id       bigint references payment_attempts(id),
  creator_id               bigint not null references users(id),
  fee_type                 text not null
    check (fee_type in ('platform_fee', 'gateway_fee', 'gateway_tax', 'upi_mdr', 'chargeback_fee', 'other_adjustment')),
  amount_minor             bigint not null check (amount_minor >= 0),
  currency                 char(3) not null default 'INR',
  rate_basis               text,
  rate_value               numeric(12, 8),
  tax_component_minor      bigint not null default 0 check (tax_component_minor >= 0),
  rule_version             text,
  provider_report_ref      text,
  effective_at             timestamptz not null,
  created_at               timestamptz not null default now(),
  check (tip_order_id is not null or payment_attempt_id is not null)
);

create index if not exists fee_lines_creator_effective_at
  on fee_lines (creator_id, effective_at desc);

create table if not exists refunds (
  id                     bigint generated always as identity primary key,
  tip_order_id           bigint not null references tip_orders(id),
  payment_attempt_id     bigint references payment_attempts(id),
  provider_ref           text unique,
  refund_type            text not null check (refund_type in ('full', 'partial')),
  requested_amount_minor bigint not null check (requested_amount_minor > 0),
  processed_amount_minor bigint not null default 0 check (processed_amount_minor >= 0),
  currency               char(3) not null default 'INR',
  status                 text not null default 'requested'
    check (status in ('requested', 'approved', 'processing', 'processed', 'failed', 'cancelled')),
  reason                 text,
  requested_by           bigint references users(id),
  approved_by            bigint references users(id),
  requested_at           timestamptz not null default now(),
  processed_at           timestamptz,
  failure_reason         text
);

create index if not exists refunds_status_requested_at
  on refunds (status, requested_at desc);

create table if not exists disputes (
  id                    bigint generated always as identity primary key,
  tip_order_id          bigint not null references tip_orders(id),
  payment_attempt_id    bigint references payment_attempts(id),
  provider_ref          text unique,
  provider_reason_code  text,
  status                text not null default 'open'
    check (status in ('open', 'under_review', 'evidence_due', 'submitted', 'won', 'lost', 'closed')),
  disputed_amount_minor bigint not null check (disputed_amount_minor > 0),
  provider_debit_minor  bigint not null default 0 check (provider_debit_minor >= 0),
  fee_or_penalty_minor  bigint not null default 0 check (fee_or_penalty_minor >= 0),
  currency              char(3) not null default 'INR',
  reason                text,
  evidence_ref          text,
  assigned_to           bigint references users(id),
  opened_at             timestamptz not null default now(),
  response_deadline     timestamptz,
  submitted_at          timestamptz,
  resolved_at           timestamptz,
  outcome               text
);

create index if not exists disputes_status_deadline
  on disputes (status, response_deadline);

create table if not exists settlements (
  id                    bigint generated always as identity primary key,
  provider              text not null check (provider in ('razorpay')),
  provider_ref          text not null unique,
  account_scope         text,
  settlement_amount_minor bigint not null check (settlement_amount_minor >= 0),
  fees_minor            bigint not null default 0 check (fees_minor >= 0),
  taxes_minor           bigint not null default 0 check (taxes_minor >= 0),
  net_amount_minor      bigint not null check (net_amount_minor >= 0),
  currency              char(3) not null default 'INR',
  status                text not null default 'observed'
    check (status in ('observed', 'matched', 'partially_matched', 'exception', 'closed')),
  expected_at           timestamptz,
  settled_at            timestamptz,
  provider_report_ref   text,
  created_at            timestamptz not null default now()
);

create index if not exists settlements_status_settled_at
  on settlements (status, settled_at desc);

create table if not exists creator_payouts (
  id                    bigint generated always as identity primary key,
  creator_id            bigint not null references users(id),
  amount_minor          bigint not null check (amount_minor > 0),
  currency              char(3) not null default 'INR',
  status                text not null default 'scheduled'
    check (status in ('scheduled', 'held', 'initiated', 'in_transit', 'completed', 'failed', 'cancelled')),
  provider_transfer_ref text unique,
  scheduled_at          timestamptz,
  initiated_at          timestamptz,
  completed_at          timestamptz,
  failed_at             timestamptz,
  hold_reason           text,
  failure_reason        text,
  created_at            timestamptz not null default now()
);

create index if not exists creator_payouts_creator_status
  on creator_payouts (creator_id, status, scheduled_at desc);

create table if not exists ledger_accounts (
  id             bigint generated always as identity primary key,
  code           text not null unique,
  name           text not null,
  account_type   text not null
    check (account_type in ('asset', 'liability', 'revenue', 'expense', 'contra_revenue')),
  currency       char(3) not null default 'INR',
  is_system      boolean not null default true,
  created_at     timestamptz not null default now()
);

insert into ledger_accounts (code, name, account_type)
values
  ('processor_clearing', 'Processor clearing', 'asset'),
  ('settlement_clearing', 'Settlement clearing', 'asset'),
  ('creator_payable', 'Creator payable', 'liability'),
  ('platform_fee_revenue', 'Tipsite platform fee revenue', 'revenue'),
  ('gateway_fee_expense', 'Gateway fee expense', 'expense'),
  ('gateway_tax', 'Gateway tax', 'expense'),
  ('refunds_payable', 'Refunds payable', 'liability'),
  ('chargeback_loss', 'Chargeback loss', 'expense'),
  ('payouts_in_transit', 'Creator payouts in transit', 'asset')
on conflict (code) do nothing;

create table if not exists ledger_transactions (
  id                bigint generated always as identity primary key,
  event_type        text not null,
  source_type       text not null,
  source_ref        text not null,
  creator_id        bigint references users(id),
  currency          char(3) not null default 'INR',
  effective_at      timestamptz not null,
  idempotency_key   text not null unique,
  reversal_of       bigint references ledger_transactions(id),
  memo              text,
  created_at        timestamptz not null default now()
);

create index if not exists ledger_transactions_creator_effective_at
  on ledger_transactions (creator_id, effective_at desc);

create table if not exists ledger_entries (
  id                    bigint generated always as identity primary key,
  ledger_transaction_id bigint not null references ledger_transactions(id),
  account_id            bigint not null references ledger_accounts(id),
  creator_id            bigint references users(id),
  debit_minor           bigint not null default 0 check (debit_minor >= 0),
  credit_minor          bigint not null default 0 check (credit_minor >= 0),
  currency              char(3) not null default 'INR',
  memo                  text,
  created_at            timestamptz not null default now(),
  check ((debit_minor > 0 and credit_minor = 0) or (credit_minor > 0 and debit_minor = 0))
);

create index if not exists ledger_entries_transaction
  on ledger_entries (ledger_transaction_id);

create table if not exists reconciliation_runs (
  id                    bigint generated always as identity primary key,
  source_type           text not null,
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  status                text not null default 'started'
    check (status in ('started', 'completed', 'partial', 'exception', 'closed')),
  record_count          integer not null default 0 check (record_count >= 0),
  source_total_minor    bigint not null default 0 check (source_total_minor >= 0),
  internal_total_minor  bigint not null default 0 check (internal_total_minor >= 0),
  variance_minor        bigint not null default 0,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  reviewed_by           bigint references users(id),
  reviewed_at           timestamptz,
  check (period_end > period_start)
);

create table if not exists reconciliation_items (
  id                    bigint generated always as identity primary key,
  run_id                bigint not null references reconciliation_runs(id),
  internal_ref          text,
  provider_ref          text,
  expected_amount_minor bigint,
  observed_amount_minor bigint,
  currency              char(3) not null default 'INR',
  match_state           text not null default 'unmatched'
    check (match_state in ('matched', 'unmatched', 'partial', 'exception', 'resolved')),
  exception_reason      text,
  resolution            text,
  resolved_by           bigint references users(id),
  resolved_at           timestamptz
);

create index if not exists reconciliation_items_run_state
  on reconciliation_items (run_id, match_state);

create table if not exists audit_events (
  id             bigint generated always as identity primary key,
  actor_user_id  bigint references users(id),
  actor_role     text not null,
  action         text not null,
  entity_type    text not null,
  entity_ref     text,
  before_json    jsonb,
  after_json     jsonb,
  reason         text,
  request_id     text,
  ip_hash        text,
  created_at     timestamptz not null default now()
);

create index if not exists audit_events_entity_created_at
  on audit_events (entity_type, entity_ref, created_at desc);

create or replace function reject_finance_history_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Financial history is append-only';
end $$;

drop trigger if exists ledger_transactions_no_update on ledger_transactions;
create trigger ledger_transactions_no_update
  before update or delete on ledger_transactions
  for each row execute procedure reject_finance_history_update();

drop trigger if exists ledger_entries_no_update on ledger_entries;
create trigger ledger_entries_no_update
  before update or delete on ledger_entries
  for each row execute procedure reject_finance_history_update();

drop trigger if exists audit_events_no_update on audit_events;
create trigger audit_events_no_update
  before update or delete on audit_events
  for each row execute procedure reject_finance_history_update();

-- Books for creator earnings (payout engine step 1). Safe to re-run.
--
-- Run this BEFORE deploying the code that uses it. Until it has run, the code
-- keeps working: tips are captured as before, the new facts are simply not
-- saved and nothing is posted to the ledger.
--
-- What it adds:
--   * payment_attempts: which Razorpay mode the payment was made in (livemode,
--     set when the order is created; null or false means test money, which is
--     never put in the ledger), and what Razorpay says it captured (amount,
--     currency, fee, tax) so the posting can refuse a payment that does not
--     match the order.
--   * fee_lines: `source` (our own accrual vs. Razorpay's later report, so the
--     two are never added together) and a unique key so a retry cannot post the
--     same fee line twice.
--   * ledger: one reversal per posting, an index on source_ref, a check at commit
--     that every transaction balances (per currency) and has entries, and a
--     check that creator-owed entries name the creator.

alter table payment_attempts
  add column if not exists livemode boolean,
  add column if not exists captured_amount_minor bigint,
  add column if not exists captured_currency char(3),
  add column if not exists provider_fee_minor bigint,
  add column if not exists provider_tax_minor bigint;

alter table fee_lines
  add column if not exists source text not null default 'accrual';

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'fee_lines_source_check'
  ) then
    alter table fee_lines
      add constraint fee_lines_source_check check (source in ('accrual', 'provider'));
  end if;
end $$;

create unique index if not exists fee_lines_accrual_once
  on fee_lines (tip_order_id, fee_type, rule_version)
  where source = 'accrual' and tip_order_id is not null;

create unique index if not exists ledger_transactions_reversal_once
  on ledger_transactions (reversal_of)
  where reversal_of is not null;

create index if not exists ledger_transactions_source
  on ledger_transactions (source_type, source_ref);

-- A tip is posted as captured once, whatever payment id it arrives under.
create unique index if not exists ledger_one_capture_per_tip
  on ledger_transactions (source_type, source_ref)
  where event_type = 'tip_captured';

-- The webhook, the live-mode flag and the missed-payment check all look an
-- attempt up by its Razorpay order id.
create index if not exists payment_attempts_provider_order_ref
  on payment_attempts (provider_order_ref);

-- Every ledger transaction must balance, per currency, and must have entries.
-- The check is deferred to commit so entries can be inserted in any order inside
-- one database transaction. (The tables are append-only, so a committed
-- transaction cannot be unbalanced later.)
create or replace function check_ledger_transaction_balanced()
returns trigger language plpgsql as $$
declare
  tx_id bigint;
  bad record;
begin
  if tg_table_name = 'ledger_entries' then
    tx_id := new.ledger_transaction_id;
  else
    tx_id := new.id;
  end if;

  if not exists (select 1 from ledger_entries where ledger_transaction_id = tx_id) then
    raise exception 'Ledger transaction % has no entries', tx_id;
  end if;

  select currency, sum(debit_minor) as debit, sum(credit_minor) as credit
    into bad
    from ledger_entries
   where ledger_transaction_id = tx_id
   group by currency
  having sum(debit_minor) <> sum(credit_minor)
   limit 1;

  if found then
    raise exception 'Ledger transaction % does not balance in %: debit %, credit %',
      tx_id, bad.currency, bad.debit, bad.credit;
  end if;

  return null;
end $$;

drop trigger if exists ledger_entries_balanced on ledger_entries;
create constraint trigger ledger_entries_balanced
  after insert on ledger_entries
  deferrable initially deferred
  for each row execute procedure check_ledger_transaction_balanced();

drop trigger if exists ledger_transactions_have_entries on ledger_transactions;
create constraint trigger ledger_transactions_have_entries
  after insert on ledger_transactions
  deferrable initially deferred
  for each row execute procedure check_ledger_transaction_balanced();

-- An entry on the account that records what we owe a creator must say which
-- creator, or the balance would silently miss it.
create or replace function check_creator_entry_names_creator()
returns trigger language plpgsql as $$
begin
  if new.creator_id is null and exists (
    select 1 from ledger_accounts a
     where a.id = new.account_id and a.code = 'creator_payable'
  ) then
    raise exception 'A creator_payable ledger entry must name the creator';
  end if;
  return new;
end $$;

drop trigger if exists ledger_entries_creator_named on ledger_entries;
create trigger ledger_entries_creator_named
  before insert on ledger_entries
  for each row execute procedure check_creator_entry_names_creator();

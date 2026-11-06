-- Paid plans bought through Razorpay instead of PayU (owner's decision, 2026-11-06: PayU declined the
-- site; tips already use Razorpay, so plans use the same account and keys). Safe to re-run.
--
-- plan_orders.provider            — which gateway the order was made for: 'payu' (every order made
--                                   before this migration) or 'razorpay'. Each gateway's checks only
--                                   ever look at its own orders.
-- plan_orders.provider_order_ref  — Razorpay's own order id (order_...), saved right after the order is
--                                   made at Razorpay. The webhook and the checks find the plan order by
--                                   it. One Razorpay order belongs to one plan order.
-- The Razorpay payment id (pay_...) of a paid order is kept in the existing payu_ref column (the name
-- stays so nothing else has to change): it is the gateway's payment id, unique across all orders.
--
-- Run BEFORE deploying the matching code. Until it is run, pressing Pay says buying is not open and
-- nothing is charged; nothing else changes.

alter table plan_orders add column if not exists provider text not null default 'payu';
alter table plan_orders add column if not exists provider_order_ref text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'plan_orders_provider_check') then
    alter table plan_orders add constraint plan_orders_provider_check check (provider in ('payu', 'razorpay'));
  end if;
end $$;

create unique index if not exists plan_orders_provider_order_ref
  on plan_orders (provider_order_ref) where provider_order_ref is not null;

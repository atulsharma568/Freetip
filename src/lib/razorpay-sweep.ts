import type { LedgerDb } from "./accrual";

// Asks Razorpay for its recent captured payments and compares them with what the
// site recorded. A webhook that never arrived (or arrived while the site was down
// for longer than Razorpay keeps retrying) leaves a paid tip that was never
// captured here: no alert, no creator credit, nothing to show it is missing. This
// finds those. `findMissedPayments` only reports. `applyBackfill` fills in what the
// site failed to save for payments it did capture (the live-mode flag and
// Razorpay's captured amount, currency, fee and tax): a payment that a LIVE key
// lists is live money by evidence, and Razorpay's own figures are the facts the
// posting checks against the order. Live mode only: a test key lists test
// payments, which are not tracked this way.
//
// `fetchImpl` is a parameter so tests can run it without the network.

export type MissedPaymentKind = "unknown_order" | "not_marked_captured";

export interface MissedPayment {
  paymentId: string;
  orderId: string | null;
  amountPaise: number;
  method: string | null;
  createdAt: Date;
  kind: MissedPaymentKind;
}

// A payment the site did capture whose live-mode flag or captured facts are
// missing, with what Razorpay says about it.
export interface BackfillItem {
  paymentId: string;
  amountPaise: number;
  currency: string;
  feePaise: number | null;
  taxPaise: number | null;
}

export type SweepOutcome =
  | {
      ok: true;
      checked: number;
      problems: MissedPayment[];
      backfill: BackfillItem[];
      truncated: boolean;
    }
  | { ok: false; reason: "not_live_mode" | "no_keys" | "razorpay_error"; detail?: string };

interface RazorpayPayment {
  id: string;
  order_id?: string | null;
  amount: number;
  currency?: string;
  status: string;
  method?: string | null;
  fee?: number | null;
  tax?: number | null;
  created_at: number;
}

const PAGE = 100;
const MAX_PAGES = 20; // 2,000 payments a check is far beyond early volume
const TIMEOUT_MS = 10_000;

const wholeOrNull = (n: unknown) => (typeof n === "number" && Number.isSafeInteger(n) ? n : null);

export async function findMissedPayments(
  db: LedgerDb,
  opts: {
    keyId: string | undefined;
    keySecret: string | undefined;
    days?: number;
    now?: Date;
    fetchImpl?: typeof fetch;
  },
): Promise<SweepOutcome> {
  const { keyId, keySecret } = opts;
  if (!keyId || !keySecret) return { ok: false, reason: "no_keys" };
  if (!keyId.startsWith("rzp_live_")) return { ok: false, reason: "not_live_mode" };

  const doFetch = opts.fetchImpl ?? fetch;
  const to = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const from = to - (opts.days ?? 3) * 86400;
  const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;

  const captured: RazorpayPayment[] = [];
  let truncated = false;
  for (let page = 0; ; page += 1) {
    if (page >= MAX_PAGES) {
      truncated = true;
      break;
    }
    let body: { items?: RazorpayPayment[] };
    try {
      const res = await doFetch(
        `https://api.razorpay.com/v1/payments?from=${from}&to=${to}&count=${PAGE}&skip=${page * PAGE}`,
        { headers: { Authorization: auth }, signal: AbortSignal.timeout(TIMEOUT_MS) },
      );
      if (!res.ok) return { ok: false, reason: "razorpay_error", detail: `HTTP ${res.status}` };
      body = (await res.json()) as { items?: RazorpayPayment[] };
    } catch (err) {
      return { ok: false, reason: "razorpay_error", detail: (err as Error).message };
    }
    const items = body.items ?? [];
    captured.push(...items.filter((p) => p.status === "captured"));
    if (items.length < PAGE) break;
  }

  const problems: MissedPayment[] = [];
  const backfill: BackfillItem[] = [];
  for (const p of captured) {
    const [known] = await db<
      {
        attempt_status: string | null;
        payment_ref: string | null;
        livemode: boolean | null;
        has_amount: boolean;
      }[]
    >`
      select provider_status      as attempt_status,
             provider_payment_ref as payment_ref,
             livemode             as livemode,
             (captured_amount_minor is not null and captured_currency is not null) as has_amount
        from payment_attempts
       where provider_payment_ref = ${p.id} or provider_order_ref = ${p.order_id ?? ""}
       order by (provider_payment_ref = ${p.id}) desc
       limit 1
    `;
    const draft = {
      paymentId: p.id,
      orderId: p.order_id ?? null,
      amountPaise: p.amount,
      method: p.method ?? null,
      createdAt: new Date(p.created_at * 1000),
    };
    if (!known) {
      problems.push({ ...draft, kind: "unknown_order" });
    } else if (known.payment_ref !== p.id || known.attempt_status !== "captured") {
      problems.push({ ...draft, kind: "not_marked_captured" });
    } else if (known.livemode !== true || !known.has_amount) {
      backfill.push({
        paymentId: p.id,
        amountPaise: p.amount,
        currency: p.currency ?? "INR",
        feePaise: wholeOrNull(p.fee),
        taxPaise: wholeOrNull(p.tax),
      });
    }
  }
  return { ok: true, checked: captured.length, problems, backfill, truncated };
}

// Fills in what the site failed to save, only where it is still empty (a value
// already saved is never overwritten), and only for an attempt already captured
// under that payment id. Returns how many attempts changed.
export async function applyBackfill(db: LedgerDb, items: BackfillItem[]): Promise<number> {
  let changed = 0;
  for (const item of items) {
    const rows = await db<{ id: string }[]>`
      update payment_attempts
         set livemode              = true,
             captured_amount_minor = coalesce(captured_amount_minor, ${item.amountPaise}::bigint),
             captured_currency     = coalesce(captured_currency, ${item.currency}::text),
             provider_fee_minor    = coalesce(provider_fee_minor, ${item.feePaise}::bigint),
             provider_tax_minor    = coalesce(provider_tax_minor, ${item.taxPaise}::bigint)
       where provider_payment_ref = ${item.paymentId}
         and provider_status = 'captured'
         and (livemode is distinct from true
              or captured_amount_minor is null
              or captured_currency is null)
      returning id::text
    `;
    changed += rows.length;
  }
  return changed;
}

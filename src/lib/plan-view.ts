import type { LedgerDb } from "./accrual";
import { PLAN_NAMES, type PlanKey } from "./pricing";

// What the Paid features page shows about buying: the message after PayU sends the creator back,
// the creator's payments and the status of the running pass. No site imports and no `server-only`,
// so the tests run all of it (the reads against an in-memory Postgres).
//
// The `?payment=` word in the address is only a hint. Anyone can type it, so it never decides what
// is said: the creator's latest order in the database does.

export interface OrderSummary {
  id: number;
  status: "pending" | "paid" | "failed";
  plan: PlanKey;
  termMonths: number;
  amountMinor: number;
  livemode: boolean;
  createdAt: Date;
  paidAt: Date | null;
  passStartsAt: Date | null;
  passEndsAt: Date | null;
  payuRef: string | null;
  // Set when the owner ended the plan by hand (a refund): the money was given back.
  endedAt?: Date | null;
}

interface OrderRow extends Record<string, unknown> {
  id: string;
  status: string;
  plan: string;
  term_months: number;
  amount_minor: string;
  livemode: boolean;
  created_at: Date | string;
  paid_at: Date | string | null;
  pass_starts_at: Date | string | null;
  pass_ends_at: Date | string | null;
  payu_ref: string | null;
  ended_at?: Date | string | null;
}

const when = (v: Date | string | null): Date | null => (v === null ? null : new Date(v));

function toSummary(r: OrderRow): OrderSummary {
  return {
    id: Number(r.id),
    status: r.status === "paid" ? "paid" : r.status === "failed" ? "failed" : "pending",
    plan: r.plan === "starter" ? "starter" : "creator",
    termMonths: r.term_months,
    amountMinor: Number(r.amount_minor),
    livemode: r.livemode,
    createdAt: new Date(r.created_at),
    paidAt: when(r.paid_at),
    passStartsAt: when(r.pass_starts_at),
    passEndsAt: when(r.pass_ends_at),
    payuRef: r.payu_ref,
    endedAt: when(r.ended_at ?? null),
  };
}

// The creator's most recent order of any kind made in the last `withinDays` days, or null. "Most
// recent" counts the moment an order was paid, so an older checkout tab paid after a newer Buy was
// pressed is what the page reports, not the newer one still waiting.
export async function latestOrder(db: LedgerDb, creatorId: number, now: Date = new Date(), withinDays = 3): Promise<OrderSummary | null> {
  const [row] = await db<OrderRow[]>`
    select id::text, status, plan, term_months, amount_minor::text, livemode, created_at, paid_at, pass_starts_at, pass_ends_at, payu_ref, ended_at
      from plan_orders
     where creator_id = ${creatorId} and created_at > ${now.toISOString()}::timestamptz - make_interval(days => ${withinDays}::int)
     order by greatest(created_at, coalesce(paid_at, created_at)) desc, id desc limit 1
  `;
  return row ? toSummary(row) : null;
}

// The creator's paid orders, newest first.
export async function paidOrders(db: LedgerDb, creatorId: number, limit = 24): Promise<OrderSummary[]> {
  const rows = await db<OrderRow[]>`
    select id::text, status, plan, term_months, amount_minor::text, livemode, created_at, paid_at, pass_starts_at, pass_ends_at, payu_ref, ended_at
      from plan_orders where creator_id = ${creatorId} and status = 'paid'
     order by paid_at desc, id desc limit ${limit}
  `;
  return rows.map(toSummary);
}

// One paid order of this creator, for the receipt; null when it is not theirs or not paid.
export async function paidOrder(db: LedgerDb, creatorId: number, orderId: number): Promise<OrderSummary | null> {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return null;
  const [row] = await db<OrderRow[]>`
    select id::text, status, plan, term_months, amount_minor::text, livemode, created_at, paid_at, pass_starts_at, pass_ends_at, payu_ref, ended_at
      from plan_orders where id = ${orderId} and creator_id = ${creatorId} and status = 'paid'
  `;
  return row ? toSummary(row) : null;
}

// ---- Whether buying is open ---------------------------------------------------------------

// The one rule for "may this creator buy now", used by the plans page (to show the button) and by
// the Buy action (to refuse): with PayU's live key once the owner has opened sales, and always for the
// owner (so the first real payment can be tried alone while sales are closed to everyone else); with
// the test key only the owner. No PayU settings at all means closed.
export function buyingOpen(mode: "live" | "test" | null, liveSalesOpen: boolean, isOwner: boolean): boolean {
  if (mode === null) return false;
  return mode === "live" ? liveSalesOpen || isOwner : isOwner;
}

// ---- Words ------------------------------------------------------------------------------

export const rupees = (minor: number): string => {
  const whole = Math.floor(minor / 100);
  const paise = minor % 100;
  const text = new Intl.NumberFormat("en-IN").format(whole);
  return paise ? `₹${text}.${String(paise).padStart(2, "0")}` : `₹${text}`;
};

// A moment in Indian time, for people ("10 December 2026, 11:30 am IST"). A pass ends at an exact
// moment, so the time is shown rather than a bare date that could be read as the end of that day.
export function istMoment(d: Date): string {
  const text = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }).format(d);
  return `${text.replace(" at ", ", ")} IST`;
}

export const istDay = (d: Date): string =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);

export const termWords = (months: number): string => (months === 12 ? "12 months" : months === 1 ? "1 month" : `${months} months`);

// The number printed on a receipt: the order id, padded.
export const receiptNumber = (orderId: number): string => `FT-${String(orderId).padStart(6, "0")}`;

// ---- The message after PayU sends the creator back --------------------------------------

export interface PaymentNotice {
  kind: "ok" | "info" | "error";
  text: string;
}

const HINTS = new Set(["paid", "pending", "failed", "cancelled", "problem"]);

// What to say on the plans page. `hint` is the `?payment=` word (only used to decide whether to
// say anything at all, and to tell "cancelled" apart); `latest` is the creator's newest order.
export function paymentNotice(hint: string | undefined, latest: OrderSummary | null): PaymentNotice | null {
  if (!hint || !HINTS.has(hint)) return null;
  const cancelled: PaymentNotice = { kind: "info", text: "You cancelled the payment, so nothing was charged. You can pay again below whenever you like." };
  if (!latest) {
    if (hint === "cancelled") return cancelled;
    if (hint === "problem") {
      return {
        kind: "error",
        text: "We could not confirm that payment. If money left your account, write to us on the contact page with the payment ID from your bank or UPI app and we will put it right. If not, nothing was charged.",
      };
    }
    return null;
  }
  if (latest.status === "paid") {
    return {
      kind: "ok",
      text: `Payment received. Your ${PLAN_NAMES[latest.plan]} plan is on until ${istMoment(latest.passEndsAt ?? latest.createdAt)}. Your receipt is in Your payments below.`,
    };
  }
  if (hint === "cancelled") return cancelled;
  if (latest.status === "pending") {
    return {
      kind: "info",
      text: "We are waiting for PayU to confirm your payment. This normally takes a minute. This page checks again for a short while; if it stops, reload it. If money left your account and your features are not on after a few hours, write to us on the contact page with the payment ID.",
    };
  }
  return {
    kind: "error",
    text: "The payment did not go through. If money left your account, your bank or UPI app usually returns it within a few working days; if it does not, write to us on the contact page. You can try again below.",
  };
}

// ---- The running pass ---------------------------------------------------------------------

export const REMIND_DAYS = 5;

export type PassStatus =
  | { state: "none" }
  | { state: "running"; endsAt: Date; daysLeft: number }
  // Within the reminder window: say so, and say that paying again loses nothing.
  | { state: "ending"; endsAt: Date; daysLeft: number };

export function passStatus(passUntil: Date | string | null, now: Date = new Date()): PassStatus {
  if (!passUntil) return { state: "none" };
  const endsAt = new Date(passUntil);
  if (Number.isNaN(endsAt.getTime()) || endsAt.getTime() <= now.getTime()) return { state: "none" };
  const daysLeft = Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
  return { state: daysLeft <= REMIND_DAYS ? "ending" : "running", endsAt, daysLeft };
}

import { createHash, timingSafeEqual } from "node:crypto";

// PayU's hosted checkout, the parts we need, from PayU's own documentation (docs/payu-notes.md).
// Pure on purpose (no database, no `server-only`): the tests run it with made-up keys, and the
// one network call, to PayU's Verify Payment API, is passed in.
//
// The rules that matter:
//  - The request hash and the reply hash are SHA-512 over pipe-joined fields with the salt. The
//    salt never leaves the server and is never sent to PayU in a request.
//  - A reply is believed only when its hash matches (compared in constant time). Even then the
//    settle step asks PayU's Verify Payment API before anything is switched on.

export type PayuMode = "live" | "test";

export interface PayuConfig {
  key: string;
  salt: string;
  mode: PayuMode;
}

// Reads the three settings. Null when the key or salt is missing, so a page can say "not set up"
// instead of failing. PAYU_MODE is "live" or "test" and defaults to "test": a live key is never
// used by accident.
export function payuConfig(env: Record<string, string | undefined> = process.env): PayuConfig | null {
  const key = env.PAYU_KEY?.trim();
  const salt = env.PAYU_SALT?.trim();
  if (!key || !salt) return null;
  return { key, salt, mode: env.PAYU_MODE?.trim().toLowerCase() === "live" ? "live" : "test" };
}

export const PAYU_PAYMENT_URL: Record<PayuMode, string> = {
  live: "https://secure.payu.in/_payment",
  test: "https://test.payu.in/_payment",
};

export const PAYU_VERIFY_URL: Record<PayuMode, string> = {
  live: "https://info.payu.in/merchant/postservice.php?form=2",
  test: "https://test.payu.in/merchant/postservice.php?form=2",
};

const sha512 = (text: string) => createHash("sha512").update(text, "utf8").digest("hex");

// Constant-time string comparison; false for different lengths.
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---- Money --------------------------------------------------------------------------------

// Paise to the string PayU wants ("299.00"), by whole-number maths.
export function payuAmount(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor <= 0) throw new Error("The amount must be a positive whole number of paise.");
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

// PayU's amount string to paise: digits with at most two decimals, nothing else (no sign, no
// exponent, no thousands separator). Null for anything odd, so an odd value never matches an order.
export function parsePayuAmount(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0") || "0");
}

// ---- The request: what the creator's browser posts to PayU ----------------------------------

export interface CheckoutOrder {
  txnid: string;
  amountMinor: number;
  productinfo: string;
  // Our own order id, sent back to us in udf1 and covered by the hash.
  orderRef: string;
}

export interface CheckoutPayer {
  firstname: string;
  email: string;
  phone: string;
}

export interface CheckoutUrls {
  success: string;
  failure: string;
  cancel: string;
}

// key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
export function requestHash(
  f: { key: string; txnid: string; amount: string; productinfo: string; firstname: string; email: string; udf1?: string; udf2?: string; udf3?: string; udf4?: string; udf5?: string },
  salt: string,
): string {
  return sha512(
    [f.key, f.txnid, f.amount, f.productinfo, f.firstname, f.email, f.udf1 ?? "", f.udf2 ?? "", f.udf3 ?? "", f.udf4 ?? "", f.udf5 ?? "", "", "", "", "", "", salt].join("|"),
  );
}

// PayU rejects some characters in the name and product fields, so keep to letters, digits, spaces
// and a few marks, and never send an empty value (every one of these goes into the hash).
function clean(value: string, fallback: string, max: number): string {
  const text = value.replace(/[^A-Za-z0-9 .,'_-]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  return text || fallback;
}

// The form fields to post to PayU, and where. `action` depends on the mode. The phone is the
// creator's own mobile number, typed on our Buy form and passed straight on.
export function checkoutForm(
  config: PayuConfig,
  order: CheckoutOrder,
  payer: CheckoutPayer,
  urls: CheckoutUrls,
): { action: string; fields: Record<string, string> } {
  const amount = payuAmount(order.amountMinor);
  const firstname = clean(payer.firstname, "Creator", 60);
  const productinfo = clean(order.productinfo, "Freetip paid features", 100);
  const email = payer.email.trim();
  const phone = payer.phone.replace(/\D/g, "").slice(-10);
  const fields = {
    key: config.key,
    txnid: order.txnid,
    amount,
    productinfo,
    firstname,
    email,
    phone,
    surl: urls.success,
    furl: urls.failure,
    curl: urls.cancel,
    udf1: order.orderRef,
  };
  return {
    action: PAYU_PAYMENT_URL[config.mode],
    fields: { ...fields, hash: requestHash({ ...fields }, config.salt) },
  };
}

// ---- The reply: what PayU posts back (browser return and webhook) ---------------------------

// The fields we read from a reply, all as text. Anything missing is an empty string.
export interface PayuReply {
  key: string;
  txnid: string;
  status: string;
  unmappedstatus: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  mihpayid: string;
  udf1: string;
  udf2: string;
  udf3: string;
  udf4: string;
  udf5: string;
  additionalCharges: string;
  hash: string;
  error: string;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");

// Picks the fields we use out of a form body (string values only; anything else is ignored).
export function readReply(body: Record<string, unknown>): PayuReply {
  return {
    key: text(body.key),
    txnid: text(body.txnid),
    status: text(body.status).toLowerCase(),
    unmappedstatus: text(body.unmappedstatus).toLowerCase(),
    amount: text(body.amount),
    productinfo: text(body.productinfo),
    firstname: text(body.firstname),
    email: text(body.email),
    mihpayid: text(body.mihpayid),
    udf1: text(body.udf1),
    udf2: text(body.udf2),
    udf3: text(body.udf3),
    udf4: text(body.udf4),
    udf5: text(body.udf5),
    additionalCharges: text(body.additionalCharges) || text(body.additional_charges),
    hash: text(body.hash).toLowerCase(),
    error: (text(body.error_Message) || text(body.error)).slice(0, 300),
  };
}

// SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key,
// with additionalCharges in front when PayU sent one.
export function replyHash(r: PayuReply, salt: string): string {
  const core = [salt, r.status, "", "", "", "", "", r.udf5, r.udf4, r.udf3, r.udf2, r.udf1, r.email, r.firstname, r.productinfo, r.amount, r.txnid, r.key];
  return sha512((r.additionalCharges ? [r.additionalCharges, ...core] : core).join("|"));
}

// True only when the reply carries a hash and it matches. The hash is lowercase hex; PayU's
// comparison is case-sensitive, and we lowercase both sides so a harmless case difference is not
// a failure.
export function replyHashIsValid(r: PayuReply, config: PayuConfig): boolean {
  if (!r.hash || !r.txnid || !r.status || !r.key) return false;
  if (r.key !== config.key) return false;
  return safeEqual(r.hash.toLowerCase(), replyHash(r, config.salt));
}

// ---- Asking PayU: the Verify Payment API ----------------------------------------------------

export type PayuPayment =
  | { kind: "success"; amountMinor: number; payuRef: string }
  | { kind: "failure"; reason: string }
  | { kind: "pending" }
  | { kind: "not_found" }
  // Could not get an answer (network, timeout, an answer we cannot read): decide nothing.
  | { kind: "unavailable"; reason: string };

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// sha512(key|command|var1|salt)
export function verifyHash(config: PayuConfig, command: string, var1: string): string {
  return sha512([config.key, command, var1, config.salt].join("|"));
}

// Reads PayU's answer for one txnid. Only `success` with `captured` (when PayU says so) is a
// success; "Not Found" and unknown shapes never are.
export function readVerifyAnswer(answer: unknown, txnid: string): PayuPayment {
  if (!answer || typeof answer !== "object") return { kind: "unavailable", reason: "no readable answer" };
  const details = (answer as { transaction_details?: unknown }).transaction_details;
  if (!details || typeof details !== "object") return { kind: "unavailable", reason: "no transaction details" };
  const entry = (details as Record<string, unknown>)[txnid];
  if (!entry || typeof entry !== "object") return { kind: "not_found" };
  const e = entry as Record<string, unknown>;
  const status = text(e.status).toLowerCase();
  const unmapped = text(e.unmappedstatus).toLowerCase();
  if (status === "not found") return { kind: "not_found" };
  if (status === "success") {
    const amountMinor = parsePayuAmount(e.amt ?? e.transaction_amount);
    const payuRef = text(e.mihpayid);
    if (unmapped && unmapped !== "captured") return { kind: "pending" };
    if (amountMinor === null || !payuRef) return { kind: "unavailable", reason: "success without an amount or a payment id" };
    return { kind: "success", amountMinor, payuRef };
  }
  if (status === "failure" || status === "failed") return { kind: "failure", reason: (text(e.error_Message) || text(e.error_code) || "payment failed").slice(0, 300) };
  if (status === "pending" || status === "in progress" || status === "initiated" || status === "bounced" || status === "") return { kind: "pending" };
  return { kind: "pending" };
}

// Asks PayU for the state of one transaction. Never throws: a failure is `unavailable`.
export async function fetchPayment(
  config: PayuConfig,
  txnid: string,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
  timeoutMs = 8000,
): Promise<PayuPayment> {
  try {
    const body = new URLSearchParams({
      key: config.key,
      command: "verify_payment",
      var1: txnid,
      hash: verifyHash(config, "verify_payment", txnid),
    }).toString();
    const res = await fetchFn(PAYU_VERIFY_URL[config.mode], {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { kind: "unavailable", reason: `PayU answered ${res.status}` };
    return readVerifyAnswer(await res.json(), txnid);
  } catch (err) {
    return { kind: "unavailable", reason: err instanceof Error ? err.message.slice(0, 200) : "request failed" };
  }
}

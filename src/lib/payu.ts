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

// Thrown when something we are about to send PayU would be refused by PayU or cannot be signed
// safely. The Buy form shows `message` to the creator.
export class CheckoutInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutInputError";
  }
}

// PayU's documented limits: firstname 20 characters (the test environment's limit; live allows more),
// email 50, surl/furl/curl 50, a 10-digit mobile number.
const FIRSTNAME_MAX = 20;
const EMAIL_MAX = 50;
const URL_MAX = 50;

// Checks what the creator typed and what we are about to send, and returns the cleaned values.
// Split out so the Buy action can refuse a bad mobile number before any order exists. Throws
// CheckoutInputError for a value PayU would refuse.
export function checkPayer(payer: CheckoutPayer, urls: CheckoutUrls): CheckoutPayer {
  const firstname = clean(payer.firstname, "Creator", FIRSTNAME_MAX);
  const email = payer.email.trim();
  if (!email || email.length > EMAIL_MAX || /[|\s]/.test(email) || !email.includes("@")) {
    throw new CheckoutInputError("The email on your account cannot be used for this payment.");
  }
  const phone = payer.phone.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(phone)) throw new CheckoutInputError("Enter a 10-digit Indian mobile number.");
  for (const url of [urls.success, urls.failure, urls.cancel]) {
    if (!/^https:\/\//.test(url) || url.length > URL_MAX) throw new CheckoutInputError("A return address is too long or not https.");
  }
  return { firstname, email, phone };
}

// The form fields to post to PayU, and where. `action` depends on the mode. The phone is the
// creator's own mobile number, typed on our Buy form and passed straight on. Throws
// CheckoutInputError for a value PayU would refuse; every value that goes into the hash must be
// exactly what is posted, so nothing is silently changed here except cleaning the name and product.
export function checkoutForm(
  config: PayuConfig,
  order: CheckoutOrder,
  payer: CheckoutPayer,
  urls: CheckoutUrls,
): { action: string; fields: Record<string, string> } {
  const amount = payuAmount(order.amountMinor);
  const { firstname, email, phone } = checkPayer(payer, urls);
  const productinfo = clean(order.productinfo, "Freetip paid features", 100);
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
  splitInfo: string;
  hash: string;
  error: string;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
// An id PayU may send as text or as a number, trimmed (PayU's own samples carry stray spaces).
const idText = (v: unknown): string => (typeof v === "number" && Number.isFinite(v) ? String(v) : text(v).trim());

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
    mihpayid: idText(body.mihpayid),
    udf1: text(body.udf1),
    udf2: text(body.udf2),
    udf3: text(body.udf3),
    udf4: text(body.udf4),
    udf5: text(body.udf5),
    additionalCharges: text(body.additionalCharges) || text(body.additional_charges),
    splitInfo: text(body.splitInfo),
    hash: text(body.hash).toLowerCase(),
    error: (text(body.error_Message) || text(body.error)).slice(0, 300),
  };
}

// PayU documents four reverse-hash layouts (docs/payu-notes.md): the plain one, with
// additional_charges in front, with splitInfo after the status, and both. The plain one is
//   SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
// This is one layout, built from the fields as posted.
function hashOf(r: PayuReply, salt: string, withCharges: boolean, withSplit: boolean): string {
  const core = [
    salt,
    r.status,
    ...(withSplit ? [r.splitInfo] : []),
    "", "", "", "", "",
    r.udf5, r.udf4, r.udf3, r.udf2, r.udf1,
    r.email, r.firstname, r.productinfo, r.amount, r.txnid, r.key,
  ];
  return sha512((withCharges ? [r.additionalCharges, ...core] : core).join("|"));
}

// The plain layout (what a payment with nothing extra is signed with).
export function replyHash(r: PayuReply, salt: string): string {
  return hashOf(r, salt, false, false);
}

// True only when the reply carries a hash and it matches one of the documented layouts that the
// reply's own fields allow: a layout with additional_charges only when the reply carries that
// field, and likewise splitInfo. All of them need the salt, so offering a choice does not help a
// forger. The hash is lowercase hex; PayU's comparison is case-sensitive and we lowercase both
// sides so a harmless case difference is not a failure.
export function replyHashIsValid(r: PayuReply, config: PayuConfig): boolean {
  if (!r.hash || !r.txnid || !r.status || !r.key) return false;
  if (r.key !== config.key) return false;
  const got = r.hash.toLowerCase();
  const layouts: Array<[boolean, boolean]> = [[false, false]];
  if (r.additionalCharges) layouts.push([true, false]);
  if (r.splitInfo) layouts.push([false, true]);
  if (r.additionalCharges && r.splitInfo) layouts.push([true, true]);
  // Check every layout (no early exit) so the time taken does not say which one matched.
  let ok = false;
  for (const [charges, split] of layouts) if (safeEqual(got, hashOf(r, config.salt, charges, split))) ok = true;
  return ok;
}

// ---- Asking PayU: the Verify Payment API ----------------------------------------------------

export type PayuPayment =
  | { kind: "success"; amountMinor: number; payuRef: string }
  | { kind: "failure"; reason: string }
  | { kind: "pending" }
  | { kind: "not_found" }
  // PayU says paid, but not the plain amount we asked for (a discount or offer applied, or the
  // amounts it reports disagree). Never a success; the owner has to look.
  | { kind: "mismatch"; reason: string }
  // Could not get an answer (network, timeout, an answer we cannot read): decide nothing.
  | { kind: "unavailable"; reason: string };

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

// sha512(key|command|var1|salt)
export function verifyHash(config: PayuConfig, command: string, var1: string): string {
  return sha512([config.key, command, var1, config.salt].join("|"));
}

// One transaction entry from PayU's answer.
function readEntry(e: Record<string, unknown>): PayuPayment {
  const status = text(e.status).toLowerCase();
  const unmapped = text(e.unmappedstatus).toLowerCase();
  if (status === "not found") return { kind: "not_found" };
  if (status === "success") {
    // Only a captured payment is paid; anything else (auth, a missing value) is not yet.
    if (unmapped !== "captured") return { kind: "pending" };
    const amountMinor = parsePayuAmount(e.amt ?? e.transaction_amount);
    const payuRef = idText(e.mihpayid);
    if (amountMinor === null || !payuRef) return { kind: "unavailable", reason: "success without an amount or a payment id" };
    // The plain price only: no discount, and the amounts PayU reports must agree. (A PayU offer
    // lowers what is charged, and the request hash does not cover the offer fields.)
    const discount = e.disc ?? e.discount;
    if (discount !== undefined && discount !== null && discount !== "" && parsePayuAmount(discount) !== 0) {
      return { kind: "mismatch", reason: "a discount was applied" };
    }
    if (e.transaction_amount !== undefined && e.transaction_amount !== "" && parsePayuAmount(e.transaction_amount) !== amountMinor) {
      return { kind: "mismatch", reason: "the amounts PayU reports disagree" };
    }
    const net = e.net_amount_debit;
    if (net !== undefined && net !== null && net !== "") {
      const netMinor = parsePayuAmount(net);
      if (netMinor === null || netMinor < amountMinor) return { kind: "mismatch", reason: "PayU debited less than the price" };
    }
    return { kind: "success", amountMinor, payuRef };
  }
  if (status === "failure" || status === "failed") return { kind: "failure", reason: (text(e.error_Message) || text(e.error_code) || "payment failed").slice(0, 300) };
  // Pending, in progress, initiated, bounced, an empty or unknown status: not decided yet.
  return { kind: "pending" };
}

// Reads PayU's answer for one txnid. Only `success` with `captured` and the plain amount is a
// success; "Not Found" and unknown shapes never are. When PayU lists several attempts under one
// txnid (a creator retrying in its page), a captured one wins, then a pending one, then a failure.
export function readVerifyAnswer(answer: unknown, txnid: string): PayuPayment {
  if (!answer || typeof answer !== "object") return { kind: "unavailable", reason: "no readable answer" };
  const details = (answer as { transaction_details?: unknown }).transaction_details;
  if (!details || typeof details !== "object") return { kind: "unavailable", reason: "no transaction details" };
  const entry = (details as Record<string, unknown>)[txnid];
  const entries = (Array.isArray(entry) ? entry : [entry]).filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  if (entries.length === 0) return { kind: "not_found" };
  const reads = entries.map(readEntry);
  const rank = ["success", "mismatch", "pending", "unavailable", "failure", "not_found"] as const;
  return reads.sort((x, y) => rank.indexOf(x.kind) - rank.indexOf(y.kind))[0];
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

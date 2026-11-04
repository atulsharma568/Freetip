import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import {
  PAYU_PAYMENT_URL,
  PAYU_VERIFY_URL,
  checkoutForm,
  fetchPayment,
  parsePayuAmount,
  payuAmount,
  payuConfig,
  readReply,
  readVerifyAnswer,
  replyHash,
  replyHashIsValid,
  requestHash,
  verifyHash,
  type FetchLike,
  type PayuConfig,
} from "../src/lib/payu";

// PayU's hosted checkout rules, with made-up keys. The expected hash strings are built by filling
// PayU's own formula text (docs/payu-notes.md), not by repeating the code's join, so a wrong
// reading of the formula cannot hide on both sides.

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const fill = (formula: string, values: Record<string, string>) =>
  formula
    .split("|")
    .map((token) => (token in values ? values[token] : token))
    .join("|");

const REQUEST_FORMULA = "key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT";
const REPLY_FORMULA = "SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key";

const config: PayuConfig = { key: "testkey", salt: "testsalt", mode: "test" };
const values = {
  key: "testkey",
  txnid: "FT0123456789abcdef01",
  amount: "299.00",
  productinfo: "Freetip paid features",
  firstname: "Riya",
  email: "riya@example.com",
  udf1: "42",
  udf2: "",
  udf3: "",
  udf4: "",
  udf5: "",
  status: "success",
  SALT: "testsalt",
};

function reply(over: Record<string, string> = {}) {
  const base = { ...values, mihpayid: "403993715", unmappedstatus: "captured", ...over };
  const hash = over.hash ?? sha512(fill(REPLY_FORMULA, { ...values, ...over }));
  return readReply({ ...base, hash });
}

test.describe("the settings", () => {
  test("need a key and a salt, and default to test mode", () => {
    expect(payuConfig({})).toBeNull();
    expect(payuConfig({ PAYU_KEY: "k" })).toBeNull();
    expect(payuConfig({ PAYU_SALT: "s" })).toBeNull();
    expect(payuConfig({ PAYU_KEY: "k", PAYU_SALT: "s" })).toEqual({ key: "k", salt: "s", mode: "test" });
    expect(payuConfig({ PAYU_KEY: "k", PAYU_SALT: "s", PAYU_MODE: "LIVE" })?.mode).toBe("live");
    // Anything that is not exactly live is test: a typo never means live money.
    expect(payuConfig({ PAYU_KEY: "k", PAYU_SALT: "s", PAYU_MODE: "production" })?.mode).toBe("test");
  });

  test("the addresses are PayU's", () => {
    expect(PAYU_PAYMENT_URL.live).toBe("https://secure.payu.in/_payment");
    expect(PAYU_PAYMENT_URL.test).toBe("https://test.payu.in/_payment");
    expect(PAYU_VERIFY_URL.live).toBe("https://info.payu.in/merchant/postservice.php?form=2");
    expect(PAYU_VERIFY_URL.test).toBe("https://test.payu.in/merchant/postservice.php?form=2");
  });
});

test.describe("amounts", () => {
  test("paise become PayU's text by whole-number maths", () => {
    expect(payuAmount(29900)).toBe("299.00");
    expect(payuAmount(5)).toBe("0.05");
    expect(payuAmount(100)).toBe("1.00");
    expect(payuAmount(249900)).toBe("2499.00");
    expect(() => payuAmount(0)).toThrow();
    expect(() => payuAmount(-5)).toThrow();
    expect(() => payuAmount(1.5)).toThrow();
  });

  test("PayU's text becomes paise, and anything odd becomes null", () => {
    expect(parsePayuAmount("299.00")).toBe(29900);
    expect(parsePayuAmount("299")).toBe(29900);
    expect(parsePayuAmount("299.5")).toBe(29950);
    expect(parsePayuAmount("0.05")).toBe(5);
    expect(parsePayuAmount(" 12 ")).toBe(1200);
    expect(parsePayuAmount(299)).toBe(29900);
    for (const bad of ["", "-1", "1e3", "1,000", "299.001", "abc", "299.", ".5", "+5", null, undefined, {}]) {
      expect(parsePayuAmount(bad)).toBeNull();
    }
  });
});

test.describe("the request", () => {
  test("the hash is PayU's formula with this order's values", () => {
    const expected = sha512(fill(REQUEST_FORMULA, values));
    expect(requestHash({ ...values, amount: values.amount }, "testsalt")).toBe(expected);
    // Spelled out: udf1 is 42, then ten pipes (udf2 to udf5, five more empty slots, then the salt).
    expect(fill(REQUEST_FORMULA, values)).toBe("testkey|FT0123456789abcdef01|299.00|Freetip paid features|Riya|riya@example.com|42||||||||||testsalt");
  });

  test("the form carries the signed fields, never the salt, and the right address", () => {
    const f = checkoutForm(
      config,
      { txnid: values.txnid, amountMinor: 29900, productinfo: "Freetip paid features", orderRef: "42" },
      { firstname: "Riya", email: "riya@example.com", phone: "+91 98765 43210" },
      { success: "https://freetip.in/ok", failure: "https://freetip.in/no", cancel: "https://freetip.in/cancel" },
    );
    expect(f.action).toBe("https://test.payu.in/_payment");
    expect(f.fields).toMatchObject({
      key: "testkey",
      txnid: values.txnid,
      amount: "299.00",
      email: "riya@example.com",
      phone: "9876543210",
      surl: "https://freetip.in/ok",
      furl: "https://freetip.in/no",
      curl: "https://freetip.in/cancel",
      udf1: "42",
    });
    expect(f.fields.hash).toBe(sha512(fill(REQUEST_FORMULA, values)));
    expect(JSON.stringify(f)).not.toContain("testsalt");
    // Live mode posts to the live address.
    expect(checkoutForm({ ...config, mode: "live" }, { txnid: "FTabcdefgh", amountMinor: 100, productinfo: "x", orderRef: "1" }, { firstname: "A", email: "a@b.in", phone: "9999999999" }, { success: "https://a", failure: "https://b", cancel: "https://c" }).action).toBe("https://secure.payu.in/_payment");
  });

  test("odd characters in the name are cleaned and an empty name gets a fallback, so the hash still matches what is sent", () => {
    const f = checkoutForm(
      config,
      { txnid: values.txnid, amountMinor: 29900, productinfo: "Freetip <b>paid</b> features", orderRef: "42" },
      { firstname: "  Ria <script>  ", email: "riya@example.com", phone: "9876543210" },
      { success: "https://a", failure: "https://b", cancel: "https://c" },
    );
    const sent = f.fields;
    expect(sent.firstname).toBe("Ria script");
    expect(sent.productinfo).toBe("Freetip b paid b features");
    expect(sent.hash).toBe(requestHash({ key: sent.key, txnid: sent.txnid, amount: sent.amount, productinfo: sent.productinfo, firstname: sent.firstname, email: sent.email, udf1: sent.udf1 }, "testsalt"));
    const empty = checkoutForm(config, { txnid: values.txnid, amountMinor: 100, productinfo: "", orderRef: "1" }, { firstname: "???", email: "a@b.in", phone: "9999999999" }, { success: "https://a", failure: "https://b", cancel: "https://c" });
    expect(empty.fields.firstname).toBe("Creator");
    expect(empty.fields.productinfo).toBe("Freetip paid features");
  });
});

test.describe("the reply", () => {
  test("the hash is PayU's reverse formula with the reply's values", () => {
    expect(replyHash(reply(), "testsalt")).toBe(sha512(fill(REPLY_FORMULA, values)));
    expect(replyHashIsValid(reply(), config)).toBe(true);
  });

  test("a reply that carries additional charges is hashed with them in front", () => {
    const withCharges = readReply({ ...values, additionalCharges: "3.00", mihpayid: "1" });
    const expected = sha512("3.00|" + fill(REPLY_FORMULA, values));
    expect(replyHash(withCharges, "testsalt")).toBe(expected);
    expect(replyHashIsValid({ ...withCharges, hash: expected }, config)).toBe(true);
    // The same reply without the charges in its hash is not believed.
    expect(replyHashIsValid({ ...withCharges, hash: sha512(fill(REPLY_FORMULA, values)) }, config)).toBe(false);
  });

  test("the case of the hash does not matter, but nothing else may differ", () => {
    const r = reply();
    expect(replyHashIsValid({ ...r, hash: r.hash.toUpperCase() }, config)).toBe(true);
  });

  test("a changed field, the wrong key, a wrong salt or a missing piece is refused", () => {
    expect(replyHashIsValid({ ...reply(), amount: "1.00" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), status: "failure" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), txnid: "FTother000000000000" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), email: "evil@example.com" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), udf1: "43" }, config)).toBe(false);
    expect(replyHashIsValid(reply(), { ...config, salt: "othersalt" })).toBe(false);
    expect(replyHashIsValid(reply(), { ...config, key: "otherkey" })).toBe(false);
    expect(replyHashIsValid({ ...reply(), hash: "" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), hash: "abc" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), txnid: "" }, config)).toBe(false);
    expect(replyHashIsValid({ ...reply(), status: "" }, config)).toBe(false);
  });

  test("readReply keeps text only and lowercases the status", () => {
    const r = readReply({ status: "SUCCESS", txnid: 5, amount: ["1"], error_Message: "No Error", hash: "ABC" });
    expect(r.status).toBe("success");
    expect(r.txnid).toBe("");
    expect(r.amount).toBe("");
    expect(r.error).toBe("No Error");
    expect(r.hash).toBe("abc");
  });
});

test.describe("asking PayU", () => {
  const ok = (body: unknown): FetchLike => async () => ({ ok: true, status: 200, json: async () => body });

  test("reads PayU's answers", () => {
    const id = values.txnid;
    expect(readVerifyAnswer({ status: 1, transaction_details: { [id]: { status: "success", unmappedstatus: "captured", amt: "299.00", mihpayid: "403993715" } } }, id)).toEqual({ kind: "success", amountMinor: 29900, payuRef: "403993715" });
    expect(readVerifyAnswer({ status: 1, transaction_details: { [id]: { status: "failure", unmappedstatus: "failed", error_code: "E4936" } } }, id)).toEqual({ kind: "failure", reason: "E4936" });
    expect(readVerifyAnswer({ status: 0, transaction_details: { [id]: { mihpayid: "Not Found", status: "Not Found" } } }, id)).toEqual({ kind: "not_found" });
    expect(readVerifyAnswer({ status: 1, transaction_details: {} }, id)).toEqual({ kind: "not_found" });
    expect(readVerifyAnswer({ status: 1, transaction_details: { [id]: { status: "pending" } } }, id)).toEqual({ kind: "pending" });
    // Success that is not captured yet is not a success.
    expect(readVerifyAnswer({ status: 1, transaction_details: { [id]: { status: "success", unmappedstatus: "auth", amt: "299.00", mihpayid: "1" } } }, id)).toEqual({ kind: "pending" });
    // Success with no amount or no payment id cannot be used.
    expect(readVerifyAnswer({ status: 1, transaction_details: { [id]: { status: "success", unmappedstatus: "captured", mihpayid: "1" } } }, id).kind).toBe("unavailable");
    expect(readVerifyAnswer({ status: 1, transaction_details: { [id]: { status: "success", unmappedstatus: "captured", amt: "299.00" } } }, id).kind).toBe("unavailable");
    // An answer about another transaction says nothing about this one.
    expect(readVerifyAnswer({ status: 1, transaction_details: { other: { status: "success", unmappedstatus: "captured", amt: "299.00", mihpayid: "1" } } }, id)).toEqual({ kind: "not_found" });
    for (const junk of [null, "text", 5, {}, { transaction_details: "x" }]) {
      expect(readVerifyAnswer(junk, id).kind).toBe("unavailable");
    }
  });

  test("the call is signed with PayU's formula and goes to the right address", async () => {
    let seen: { url: string; body: URLSearchParams } | null = null;
    const fetchFn: FetchLike = async (url, init) => {
      seen = { url, body: new URLSearchParams(init.body) };
      expect(init.method).toBe("POST");
      expect(init.headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
      return { ok: true, status: 200, json: async () => ({ status: 1, transaction_details: { [values.txnid]: { status: "success", unmappedstatus: "captured", amt: "299.00", mihpayid: "9" } } }) };
    };
    const r = await fetchPayment(config, values.txnid, fetchFn);
    expect(r).toEqual({ kind: "success", amountMinor: 29900, payuRef: "9" });
    expect(seen!.url).toBe("https://test.payu.in/merchant/postservice.php?form=2");
    expect(seen!.body.get("key")).toBe("testkey");
    expect(seen!.body.get("command")).toBe("verify_payment");
    expect(seen!.body.get("var1")).toBe(values.txnid);
    expect(seen!.body.get("hash")).toBe(sha512("testkey|verify_payment|" + values.txnid + "|testsalt"));
    expect(seen!.body.get("hash")).toBe(verifyHash(config, "verify_payment", values.txnid));
    expect(seen!.body.toString()).not.toContain("testsalt");
  });

  test("a failed call decides nothing", async () => {
    expect((await fetchPayment(config, "x", async () => { throw new Error("offline"); })).kind).toBe("unavailable");
    expect((await fetchPayment(config, "x", async () => ({ ok: false, status: 503, json: async () => ({}) }))).kind).toBe("unavailable");
    expect((await fetchPayment(config, "x", async () => ({ ok: true, status: 200, json: async () => { throw new Error("not json"); } }))).kind).toBe("unavailable");
    expect((await fetchPayment(config, "x", ok("garbage"))).kind).toBe("unavailable");
  });
});

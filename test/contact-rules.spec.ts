import { expect, test } from "@playwright/test";
import { contactMessage, parseContact, ticketNumber } from "../src/lib/contact";

function makeForm(fields: Record<string, string | undefined>) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    if (value !== undefined) form.set(name, value);
  }
  return form;
}

const VALID = {
  name: "Asha Rao",
  email: "asha@example.com",
  topic: "general",
  message: "How do payouts work for a new creator?",
};

function parseWith(fields: Record<string, string | undefined>) {
  return parseContact(makeForm({ ...VALID, ...fields }));
}

test.describe("contact rules", () => {
  test("accepts a complete message and tidies it", () => {
    const result = parseWith({ name: "  Asha   Rao ", email: " ASHA@Example.COM ", payment_ref: " pay_123 " });
    expect(result).toEqual({
      ok: true,
      entry: {
        name: "Asha Rao",
        email: "asha@example.com",
        topic: "general",
        paymentRef: "pay_123",
        message: VALID.message,
      },
    });
  });

  test("a missing payment reference is null", () => {
    const result = parseWith({});
    expect(result.ok && result.entry.paymentRef).toBeNull();
  });

  test("rejects a missing or oversized name", () => {
    expect(parseWith({ name: "  " })).toEqual({ ok: false, field: "name" });
    expect(parseWith({ name: "a".repeat(101) })).toEqual({ ok: false, field: "name" });
  });

  test("rejects a bad email", () => {
    expect(parseWith({ email: "nope" })).toEqual({ ok: false, field: "email" });
    expect(parseWith({ email: `${"a".repeat(250)}@x.co` })).toEqual({ ok: false, field: "email" });
  });

  test("rejects an unknown topic", () => {
    expect(parseWith({ topic: "sales" })).toEqual({ ok: false, field: "topic" });
    expect(parseWith({ topic: undefined })).toEqual({ ok: false, field: "topic" });
  });

  test("message length is 10 to 2000 characters", () => {
    expect(parseWith({ message: "too short" })).toEqual({ ok: false, field: "message" });
    expect(parseWith({ message: "x".repeat(2001) })).toEqual({ ok: false, field: "message" });
    expect(parseWith({ message: "x".repeat(2000) }).ok).toBe(true);
  });

  test("rejects a payment reference over 60 characters", () => {
    expect(parseWith({ payment_ref: "p".repeat(61) })).toEqual({ ok: false, field: "payment_ref" });
  });

  test("drops control characters but keeps line breaks", () => {
    const result = parseWith({ message: "line one\r\nline two\u0000 is fine" });
    expect(result.ok && result.entry.message).toBe("line one\nline two is fine");
  });

  test("every state has a message for the form", () => {
    expect(contactMessage({ status: "invalid", field: "email" })).toMatch(/email/i);
    expect(contactMessage({ status: "ok", ticket: "FT-00001" })).toMatch(/sent/i);
    expect(contactMessage({ status: "rate_limited" })).not.toBe("");
    expect(contactMessage({ status: "idle" })).toBe("");
  });
});

test("ticket numbers are the id padded to five digits", () => {
  expect(ticketNumber(7)).toBe("FT-00007");
  expect(ticketNumber(12345)).toBe("FT-12345");
  expect(ticketNumber(123456)).toBe("FT-123456");
});

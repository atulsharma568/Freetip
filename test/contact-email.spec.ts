import { expect, test } from "@playwright/test";
import { buildNotification } from "../src/lib/contact-notification";

const entry = {
  name: "Asha Rao",
  email: "asha@example.com",
  topic: "payment" as const,
  paymentRef: "pay_123",
  message: "Subject: hijack\nBcc: x@y.z\nMy tip failed.",
};

test.describe("contact notification", () => {
  test("subject holds only our topic label, never visitor text", () => {
    const { subject } = buildNotification(entry);
    expect(subject).toBe("New contact message: A payment problem");
    expect(subject).not.toMatch(/hijack|asha/i);
  });

  test("body carries the sender, payment reference and message", () => {
    const { text } = buildNotification(entry);
    expect(text).toContain("From: Asha Rao <asha@example.com>");
    expect(text).toContain("Payment reference: pay_123");
    expect(text).toContain("My tip failed.");
  });

  test("no payment line when there is no reference", () => {
    const { text } = buildNotification({ ...entry, paymentRef: null, topic: "general" });
    expect(text).not.toContain("Payment reference");
  });
});

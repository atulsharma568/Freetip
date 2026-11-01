import { expect, test } from "@playwright/test";
import { buildNotification, buildReceipt } from "../src/lib/contact-notification";

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

test("the owner email carries the ticket, and the receipt repeats nothing the visitor typed", () => {
  const entry = {
    name: "Asha <script>",
    email: "asha@example.com",
    topic: "general" as const,
    paymentRef: null,
    message: "A secret question about my money",
  };
  const { subject, text } = buildNotification(entry, "FT-00042");
  expect(subject).toContain("FT-00042");
  expect(text).toContain("Ticket: FT-00042");

  const receipt = buildReceipt("FT-00042");
  expect(receipt.subject).toContain("FT-00042");
  expect(receipt.text).toContain("FT-00042");
  expect(receipt.text).not.toContain("secret");
  expect(receipt.text).not.toContain("Asha");
});

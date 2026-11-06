import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { TERMS_VERSION } from "../src/lib/legal";

// A paid-plan order stores TERMS_VERSION as the proof of which words the creator agreed to when they
// ticked the box. That proof is only true if the version changes whenever those words do, so this test
// pins a fingerprint of the files that carry them (the Terms, the Refund Policy, the pricing page and
// the tick box beside the Buy button) to the version. Edit any of them and the test fails until
// TERMS_VERSION in src/lib/legal.ts is changed and the new fingerprint is added below.
const FILES = ["src/app/terms/page.tsx", "src/app/refunds/page.tsx", "src/app/pricing/page.tsx", "src/app/dashboard/plans/BuyPass.tsx"];

const PINNED: Record<string, string> = {
  "4 November 2026, text 2": "da83cc9ae3ab51771365661c8c0c0f41fa5d4bcbd3923bda620401fa1ea738d8",
  // The Terms now say "our payment provider" instead of naming one (PayU declined the site).
  "4 November 2026, text 3": "a8e944a39d55082f6364c31db5434619fe164298ac06ef99c4d4414d659eb18c",
  // The Terms and pricing page now show the 3% payment processing fee next to the 5% fee.
  "4 November 2026, text 4": "622a8c5ec69c99fd08e6e74a369d9ce512d8a2a6b0c9e6ec5b25074e965370c5",
  // The payout wording in the Terms and the other public pages no longer promises a schedule or names a payment partner.
  "5 November 2026, text 5": "414824d032e58f09a4f6a03a53cc4f05fcc815f3f955838735e68879e205602b",
  // Payouts are started by us every morning once ₹500 is available; the creator no longer asks.
  "6 November 2026, text 6": "ba2c46f7a33ca4bfa63736976a278f2a1fb5a3082a9750ba2112b8eab178eaba",
};

function fingerprint(): string {
  const h = createHash("sha256");
  for (const file of FILES) {
    // Line endings are ignored so a checkout on another computer gives the same fingerprint.
    h.update(`${file}\n${readFileSync(join(process.cwd(), file), "utf8").replace(/\r\n/g, "\n")}\n`);
  }
  return h.digest("hex");
}

test("the terms version changes whenever the wording a creator agrees to changes", () => {
  const now = fingerprint();
  const pinned = PINNED[TERMS_VERSION];
  expect(
    pinned,
    `TERMS_VERSION "${TERMS_VERSION}" has no fingerprint here. Add it to PINNED in test/legal-version.spec.ts: "${TERMS_VERSION}": "${now}"`,
  ).toBeDefined();
  expect(
    now,
    `The Terms, Refund Policy, pricing page or the tick box in BuyPass.tsx changed. Change TERMS_VERSION in src/lib/legal.ts (it is saved on every paid order as the proof of what was agreed) and pin the new fingerprint "${now}" to it in PINNED.`,
  ).toBe(pinned);
});

test("the version fits the column and is never empty", () => {
  expect(TERMS_VERSION.trim()).toBe(TERMS_VERSION);
  expect(TERMS_VERSION.length).toBeGreaterThan(0);
  expect(TERMS_VERSION.length).toBeLessThanOrEqual(40);
});

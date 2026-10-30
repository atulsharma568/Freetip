import { timingSafeEqual } from "crypto";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { syncBooks } from "@/lib/books-sync";

// Daily, run by Vercel Cron (see vercel.json). The same three steps as the owner's
// Sync button: ask Razorpay what it captured recently and log any payment the site
// never recorded, fill in what the site failed to save for payments it did capture,
// then post every captured live tip that is not on the books yet. Vercel sends
// CRON_SECRET as a bearer token. Safe to run as often as wanted: every posting is
// keyed by the payment id.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Unauthorized", { status: 401 });

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const match =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) return new Response("Unauthorized", { status: 401 });

  const sql = getDb();
  if (!sql) return new Response("Not set up", { status: 503 });

  const r = await syncBooks(sql as unknown as LedgerDb, {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
  });

  let check = "not checked";
  if (r.check.ok) {
    check = `${r.check.problems.length} problems in ${r.check.checked} payments`;
    for (const p of r.check.problems) {
      console.error("Razorpay payment not recorded here", p.kind, p.paymentId, p.orderId, p.amountPaise);
    }
  } else {
    check = `not checked (${r.check.reason})`;
  }
  const posted = r.sweep
    ? `${r.sweep.posted} posted, ${r.sweep.failed} failed, ${r.sweep.looked} looked at`
    : "ledger not set up";
  return new Response(`OK (${check}; ${r.backfilled} backfilled; ${posted})`);
}

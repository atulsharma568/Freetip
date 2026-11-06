"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import type { LedgerDb } from "@/lib/accrual";
import type { AdminActionState } from "@/lib/admin/action-state";
import { cancelPayout, markPayoutPaid, reversePayout } from "@/lib/payouts";

// Payouts are started every morning by the daily run (/api/cron/payout-daily); the owner pays each by
// hand and records the UTR here (see payouts.ts for the rules). Every outcome comes back as plain data
// for useActionState; the database is the judge, the form only says what was asked.

const ok = (message: string): AdminActionState => ({ status: "ok", message });
const fail = (message: string): AdminActionState => ({ status: "error", message });
const NO_DB = "The database is not set up.";

const validId = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= 2147483647;

function refresh() {
  revalidatePath("/dashboard/earnings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/finance/balances");
  revalidatePath("/admin/audit");
}

// The owner has paid the transfer and records its UTR.
export async function markPayoutPaidAction(
  payoutId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(payoutId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const result = await markPayoutPaid(db as unknown as LedgerDb, payoutId, {
      utr: formData.get("utr"),
      nameMatched: formData.get("name_matched") === "on",
    });
    if (result.status === "refused") {
      return fail(
        {
          missing: "That payout was not found.",
          not_open: "That payout is no longer waiting (it was paid or cancelled).",
          bad_utr: "Enter the UTR as letters and digits only, 6 to 30 characters.",
          utr_used: "That UTR is already recorded against another payout.",
          name_not_checked: "Tick the box to confirm the name in your UPI app matched the creator.",
        }[result.reason],
      );
    }
    refresh();
    return ok(result.status === "already" ? "Already recorded as paid." : "Recorded as paid.");
  } catch (err) {
    console.error("Payout: could not record a payment", err);
    return fail("Could not save. The server log has the reason.");
  }
}

// The owner will not pay this request (a wrong UPI ID, a mistake): it goes back on the creator's balance.
export async function cancelPayoutAction(
  payoutId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(payoutId)) return fail("That request is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);
  const raw = formData.get("reason");
  const reason = typeof raw === "string" && raw.trim() ? raw.trim().slice(0, 300) : null;
  try {
    const result = await cancelPayout(db as unknown as LedgerDb, payoutId, reason);
    if (result.status === "refused") {
      return fail(result.reason === "missing" ? "That payout was not found." : "That payout is no longer waiting (it was paid or cancelled).");
    }
    refresh();
    return ok(result.status === "already" ? "Already cancelled." : "Cancelled. The money is back on the creator's balance.");
  } catch (err) {
    console.error("Payout: could not cancel a request", err);
    return fail("Could not save. The server log has the reason.");
  }
}

// A payout marked paid did not reach the creator (the bank sent it back, a wrong UTR, a wrong person):
// it goes back on the creator's balance and stays on record as reversed, with the reason.
export async function reversePayoutAction(
  payoutId: number,
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireOwner();
  if (!validId(payoutId)) return fail("That payout is not valid.");
  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const result = await reversePayout(db as unknown as LedgerDb, payoutId, formData.get("reason"));
    if (result.status === "refused") {
      return fail(
        {
          missing: "That payout was not found.",
          not_paid: "Only a payout marked as paid can be reversed.",
          no_reason: "Write a short reason (at least 3 letters). It is kept in the audit history.",
        }[result.reason],
      );
    }
    refresh();
    return ok(result.status === "already" ? "Already reversed." : "Reversed. The money is back on the creator's balance.");
  } catch (err) {
    console.error("Payout: could not reverse a payout", err);
    return fail("Could not save. The server log has the reason.");
  }
}

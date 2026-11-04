"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { requireOwner } from "@/lib/owner-auth";
import type { LedgerDb } from "@/lib/accrual";
import type { AdminActionState } from "@/lib/admin/action-state";
import { formatRupees } from "@/lib/earnings";
import { REFUSAL_WORDS, cancelPayout, markPayoutPaid, requestPayout } from "@/lib/payouts";
import { sendPayoutRequestEmail } from "@/lib/payout-email";

// A creator asks for a payout and the owner pays it by hand and records the UTR (see payouts.ts for the
// rules). Every outcome comes back as plain data for useActionState; the database is the judge, the
// form only says what was asked.

const ok = (message: string): AdminActionState => ({ status: "ok", message });
const fail = (message: string): AdminActionState => ({ status: "error", message });
const NO_DB = "The database is not set up.";
const SAVE_FAILED = "Could not save. Please try again in a minute.";

const validId = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= 2147483647;

function refresh() {
  revalidatePath("/dashboard/earnings");
  revalidatePath("/admin", "layout");
  revalidatePath("/admin/payouts");
  revalidatePath("/admin/finance/balances");
  revalidatePath("/admin/audit");
}

// The signed-in creator asks for their available money.
export async function requestMyPayout(): Promise<AdminActionState> {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  const db = getDb();
  if (!db) return fail(NO_DB);
  try {
    const [user] = await db<{ id: number; name: string | null; handle: string | null }[]>`
      select id, name, handle from users where google_id = ${googleId}
    `;
    if (!user) return fail(REFUSAL_WORDS.no_creator);

    const result = await requestPayout(db as unknown as LedgerDb, user.id);
    if (result.status === "refused") return fail(REFUSAL_WORDS[result.reason]);

    // Tell the owner. A failed email changes nothing: the request waits in /admin/payouts either way.
    await sendPayoutRequestEmail({
      creatorName: user.name,
      handle: user.handle,
      payoutId: result.payoutId,
      amountPaise: result.amountPaise,
      firstPayout: result.firstPayout,
    });
    refresh();
    return ok(`Requested ${formatRupees(result.amountPaise)}. It will be paid to your UPI ID and shown here as Paid.`);
  } catch (err) {
    console.error("Payout: could not save a request", err);
    return fail(SAVE_FAILED);
  }
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

"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { planFeatures } from "@/lib/plans";
import { realStreamlabsDeps } from "@/lib/streamlabs";
import { disconnectStreamlabs, sendStreamlabsTest } from "@/lib/streamlabs-outbox";

// Buttons on /dashboard/streamlabs. Only the signed-in creator's own connection is touched.

export type SlResult = { status: "ok"; message: string } | { status: "error"; message: string };

const FAILED: SlResult = { status: "error", message: "Could not do that. Try again shortly." };

async function creator() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) redirect("/signin");
  const db = getDb();
  if (!db) return null;
  const [row] = await db<{ id: string; paid_features: string[] | null }[]>`
    select id::text, paid_features from users where google_id = ${googleId}
  `;
  return row ? { db: db as unknown as LedgerDb, id: Number(row.id), features: planFeatures(row) } : null;
}

export async function sendStreamlabsTestAlert(): Promise<SlResult> {
  try {
    const who = await creator();
    if (!who) return FAILED;
    if (!who.features.streamlabs) return { status: "error", message: "This is not switched on for your account." };
    const result = await sendStreamlabsTest(who.db, who.id, realStreamlabsDeps());
    switch (result.status) {
      case "sent":
        return { status: "ok", message: "Sent. Look for the test alert in your Streamlabs alert box." };
      case "wait":
        return { status: "error", message: "Wait half a minute between alerts, then try again." };
      case "not_connected":
        return { status: "error", message: "Connect Streamlabs first." };
      case "reconnect_needed":
        revalidatePath("/dashboard/streamlabs");
        return { status: "error", message: "Streamlabs asked us to sign in again. Connect it again." };
      default:
        return { status: "error", message: "Streamlabs did not take the alert. Try again shortly." };
    }
  } catch (err) {
    unstable_rethrow(err);
    console.error("Streamlabs test alert failed (migration 0041 run?)", err);
    return FAILED;
  }
}

// Always allowed, even if the feature was switched off: a creator can always take their
// connection away. The tokens are deleted at once.
export async function disconnectStreamlabsAction(): Promise<SlResult> {
  try {
    const who = await creator();
    if (!who) return FAILED;
    await disconnectStreamlabs(who.db, who.id);
    revalidatePath("/dashboard/streamlabs");
    return { status: "ok", message: "Disconnected. Your Streamlabs sign-in was deleted from our side." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Streamlabs disconnect failed (migration 0041 run?)", err);
    return FAILED;
  }
}

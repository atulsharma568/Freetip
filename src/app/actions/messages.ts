"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { pinApprovedTip } from "@/lib/pinned-db";
import { realStreamlabsDeps } from "@/lib/streamlabs";
import { processOutbox } from "@/lib/streamlabs-outbox";

// Its own file: a "use server" file that a server component imports is
// evaluated on the server, and creator.ts exports plain constants.
// Approve or reject a fan message. Only the creator who received the tip can,
// and only while it is still undecided.
export async function decideMessage(orderId: number, decision: "approved" | "rejected") {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");
  if (!Number.isInteger(orderId) || (decision !== "approved" && decision !== "rejected")) return;

  const db = getDb();
  if (!db) return;

  const decided = await db<{ id: number; creator_id: number }[]>`
    update tip_orders t
    set message_status = ${decision}, message_decided_at = now()
    from users u
    where t.id = ${orderId}
      and t.creator_id = u.id
      and u.google_id = ${googleId}
      and t.message_status = 'pending'
      and t.status = 'captured'
    returning t.id::int as id, t.creator_id::int as creator_id
  `;
  // An approved message that the fan asked to have pinned starts its pinned time now.
  // Its own step with its own try, so a missing migration 0040 never undoes the approval.
  if (decision === "approved" && decided[0]) {
    await pinApprovedTip(db as unknown as LedgerDb, decided[0].creator_id, decided[0].id);
  }
  // A Streamlabs alert that was waiting for this decision goes out now, after the reply,
  // so the click is not slowed by it. The cron picks up anything this misses.
  if (decided[0]) {
    after(async () => {
      try {
        await processOutbox(db as unknown as LedgerDb, realStreamlabsDeps(), 5);
      } catch (err) {
        console.error("Could not send the waiting Streamlabs alert (migration 0041 run?)", err);
      }
    });
  }
  revalidatePath("/dashboard");
}

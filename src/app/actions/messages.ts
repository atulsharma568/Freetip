"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";

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

  await db`
    update tip_orders t
    set message_status = ${decision}, message_decided_at = now()
    from users u
    where t.id = ${orderId}
      and t.creator_id = u.id
      and u.google_id = ${googleId}
      and t.message_status = 'pending'
      and t.status = 'captured'
  `;
  revalidatePath("/dashboard");
}

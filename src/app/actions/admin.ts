"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/owner-auth";
import { getDb } from "@/lib/db";

type CreatorStatus = "pending" | "active" | "suspended";

export async function setCreatorStatus(
  creatorId: number,
  status: CreatorStatus,
): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return;
  if (!(["pending", "active", "suspended"] as const).includes(status)) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`
    update users set creator_status = ${status} where id = ${creatorId}
  `;

  revalidatePath("/admin/creators");
}

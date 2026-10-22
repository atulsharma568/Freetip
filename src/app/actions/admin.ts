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

  const db = getDb();
  if (!db) return;

  await db`
    update users set creator_status = ${status} where id = ${creatorId}
  `;

  revalidatePath("/admin/creators");
}

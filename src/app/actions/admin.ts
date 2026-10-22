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

  // Sync onboarding_state when changing creator_status:
  //   active   → onboarding_state = 'active'  (completed the gate)
  //   pending  → onboarding_state = 'not_started'  (reset the gate)
  //   suspended → leave onboarding_state unchanged
  if (status === "active") {
    await db`
      update users set creator_status = ${status}, onboarding_state = 'active'
      where id = ${creatorId}
    `;
  } else if (status === "pending") {
    await db`
      update users set creator_status = ${status}, onboarding_state = 'not_started'
      where id = ${creatorId}
    `;
  } else {
    await db`
      update users set creator_status = ${status} where id = ${creatorId}
    `;
  }

  revalidatePath("/admin/creators");
}

export async function rejectCreatorOnboarding(creatorId: number): Promise<void> {
  await requireOwner();

  if (!Number.isSafeInteger(creatorId) || creatorId < 1) return;

  const db = getDb();
  if (!db) throw new Error("Database unavailable");

  await db`
    update users set onboarding_state = 'rejected'
    where id = ${creatorId}
      and creator_status = 'pending'
  `;

  revalidatePath("/admin/creators");
}

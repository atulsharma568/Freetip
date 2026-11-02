"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import type { LedgerDb } from "@/lib/accrual";
import { parseAlertMotion, type AlertMotionInput } from "@/lib/alert-motion";

export type AlertMotionActionResult = { status: "ok" } | { status: "error"; message: string };

// Saves the creator's alert animations, length and pause. Checked here, not only in the page:
// the switch, and every field through the same rules the overlay applies (keys from short
// lists, whole seconds in a range). Saving the normal card stores null.
export async function saveAlertMotion(input: AlertMotionInput): Promise<AlertMotionActionResult> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return { status: "error", message: "Sign in again to change your alert motion." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable, try again shortly" };

  const [row] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  if (!row) return { status: "error", message: "Sign in again to change your alert motion." };
  if (!hasFeature(row, "alertMotion")) {
    return { status: "error", message: "Alert animations and timing are not switched on for your account." };
  }

  const parsed = parseAlertMotion(input);
  if (!parsed.ok) return { status: "error", message: parsed.message };

  // The driver writes an object as jsonb (the same as the audit rows elsewhere); null is the normal card.
  const value = parsed.value === null ? null : (parsed.value as unknown as Record<string, string>);
  try {
    // LedgerDb is the loosely typed query function the audit rows use for their jsonb values.
    await (db as unknown as LedgerDb)`update users set alert_motion = ${value}::jsonb where id = ${row.id}`;
  } catch (err) {
    console.error("Could not save the alert motion (migration 0045 run?)", err);
    return { status: "error", message: "Could not save your alert motion, try again shortly" };
  }
  revalidatePath("/dashboard/motion");
  return { status: "ok" };
}

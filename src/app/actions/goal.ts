"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { checkGoal } from "@/lib/goal";

// Dashboard actions for the goal bar. Only the signed-in creator's own goal is
// touched (migration 0018).

export type GoalResult = { status: "ok"; message: string } | { status: "error"; message: string };

const FAILED: GoalResult = { status: "error", message: "Could not save the goal. Try again shortly." };

async function googleIdOrRedirect(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");
  return googleId;
}

// Sets a goal. Progress counts from now, so a new goal starts at zero.
export async function saveGoal(_prev: GoalResult | null, form: FormData): Promise<GoalResult> {
  const googleId = await googleIdOrRedirect();
  const check = checkGoal(form.get("goal_title"), form.get("goal_rupees"));
  if (!check.ok) return { status: "error", message: check.message };
  const db = getDb();
  if (!db) return FAILED;
  try {
    await db`
      update users set goal_title = ${check.title}, goal_target_paise = ${check.targetPaise},
                       goal_started_at = now()
      where google_id = ${googleId}
    `;
  } catch (err) {
    console.error("Goal: save failed.", err);
    return FAILED;
  }
  revalidatePath("/dashboard");
  return { status: "ok", message: "Goal saved. The bar starts from zero." };
}

export async function clearGoal(): Promise<GoalResult> {
  const googleId = await googleIdOrRedirect();
  const db = getDb();
  if (!db) return FAILED;
  try {
    await db`
      update users set goal_title = null, goal_target_paise = null, goal_started_at = null
      where google_id = ${googleId}
    `;
  } catch (err) {
    console.error("Goal: clear failed.", err);
    return FAILED;
  }
  revalidatePath("/dashboard");
  return { status: "ok", message: "Goal removed." };
}

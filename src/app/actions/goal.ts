"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { checkGoal, MAX_GOALS, parseRepeat, parseTimezone } from "@/lib/goal";

// Dashboard actions for the goal bar. Only the signed-in creator's own goal is
// touched (migrations 0018, 0027 and 0028).

export type GoalResult = { status: "ok"; message: string } | { status: "error"; message: string };

const FAILED: GoalResult = { status: "error", message: "Could not save the goal. Try again shortly." };

async function googleIdOrRedirect(): Promise<string> {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");
  return googleId;
}

// Saves one goal bar: a new one (no goal_id) or an existing one of this creator's.
// A creator can have up to MAX_GOALS at once. Saving a goal that does not repeat
// restarts it from zero; a repeating goal keeps counting from its period.
export async function saveGoal(_prev: GoalResult | null, form: FormData): Promise<GoalResult> {
  const googleId = await googleIdOrRedirect();
  const check = checkGoal(form.get("goal_title"), form.get("goal_rupees"));
  if (!check.ok) return { status: "error", message: check.message };
  const repeat = parseRepeat(form.get("goal_repeat"));
  const timezone = parseTimezone(form.get("goal_timezone"));
  const carryOver = repeat !== "never" && form.get("goal_carry") === "on";
  const rawId = String(form.get("goal_id") ?? "").trim();
  const db = getDb();
  if (!db) return FAILED;
  try {
    if (rawId) {
      const id = Number(rawId);
      if (!Number.isInteger(id) || id <= 0) return FAILED;
      const rows = await db`
        update goals set title = ${check.title}, target_paise = ${check.targetPaise},
                         timezone = ${timezone}, carry_over = ${carryOver},
                         started_at = case when ${repeat} = 'never' or repeat <> ${repeat} then now() else started_at end,
                         repeat = ${repeat}
        where id = ${id} and creator_id = (select id from users where google_id = ${googleId})
        returning id
      `;
      if (rows.length === 0) return { status: "error", message: "That goal no longer exists." };
    } else {
      // The count is checked in the same statement as the insert, so two quick
      // clicks cannot go over the limit.
      const rows = await db`
        insert into goals (creator_id, title, target_paise, repeat, timezone, carry_over)
        select u.id, ${check.title}, ${check.targetPaise}, ${repeat}, ${timezone}, ${carryOver}
        from users u
        where u.google_id = ${googleId}
          and (select count(*) from goals g where g.creator_id = u.id) < ${MAX_GOALS}
        returning id
      `;
      if (rows.length === 0) {
        return { status: "error", message: `You can have up to ${MAX_GOALS} goal bars. Remove one to add another.` };
      }
    }
  } catch (err) {
    console.error("Goal: save failed (migration 0028 run?).", err);
    return FAILED;
  }
  revalidatePath("/dashboard");
  return {
    status: "ok",
    message:
      repeat === "never"
        ? "Goal saved. The bar starts from zero."
        : "Goal saved. It starts again from zero by itself at the start of each period.",
  };
}

export async function removeGoal(goalId: number): Promise<GoalResult> {
  const googleId = await googleIdOrRedirect();
  if (!Number.isInteger(goalId) || goalId <= 0) return FAILED;
  const db = getDb();
  if (!db) return FAILED;
  try {
    await db`
      delete from goals
      where id = ${goalId} and creator_id = (select id from users where google_id = ${googleId})
    `;
  } catch (err) {
    console.error("Goal: remove failed.", err);
    return FAILED;
  }
  revalidatePath("/dashboard");
  return { status: "ok", message: "Goal removed." };
}

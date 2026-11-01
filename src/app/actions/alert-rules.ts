"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { MAX_RULES_PER_CREATOR, parseRuleRupees, ruleHasEffect } from "@/lib/alert-rules";

export type RuleActionResult = { status: "ok" } | { status: "error"; message: string };

const DB_DOWN: RuleActionResult = { status: "error", message: "Database unavailable — try again shortly" };

async function currentCreator() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  return row ? { id: Number(row.id), row } : null;
}

const asId = (v: unknown): number | null => (v === null || v === undefined || v === "" ? null : Number(v));

// Adds a rule, or replaces the one already set for the same tip size. Checked here,
// not only in the page: the switch, that the files and sounds are the creator's own,
// and that the rule does something.
export async function saveRule(input: {
  minRupees: number | string;
  mediaId: number | null;
  soundId: number | null;
}): Promise<RuleActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change rules." };
  if (!hasFeature(creator.row, "alertRules")) {
    return { status: "error", message: "Alert rules are not switched on for your account." };
  }
  const db = getDb();
  if (!db) return DB_DOWN;

  const rupees = parseRuleRupees(input.minRupees);
  if (rupees === null) return { status: "error", message: "Enter the tip size in whole rupees." };
  const mediaId = asId(input.mediaId);
  const soundId = asId(input.soundId);
  if ((mediaId !== null && !Number.isSafeInteger(mediaId)) || (soundId !== null && !Number.isSafeInteger(soundId))) {
    return { status: "error", message: "Pick a file or sound from the lists." };
  }
  if (!ruleHasEffect(mediaId, soundId)) return { status: "error", message: "Pick a media file, a sound or both." };
  if (mediaId !== null && !hasFeature(creator.row, "customAlertMedia")) {
    return { status: "error", message: "Custom alert media is not switched on for your account." };
  }

  try {
    if (mediaId !== null) {
      const ok = await db`
        select 1 from creator_media where id = ${mediaId} and creator_id = ${creator.id} and review_state <> 'removed'
      `;
      if (!ok.length) return { status: "error", message: "That media file was not found." };
    }
    if (soundId !== null) {
      const ok = await db`select 1 from creator_sounds where id = ${soundId} and creator_id = ${creator.id}`;
      if (!ok.length) return { status: "error", message: "That sound was not found." };
    }

    const minPaise = rupees * 100;
    const [have] = await db<{ n: number; same: number }[]>`
      select count(*)::int as n, count(*) filter (where min_paise = ${minPaise})::int as same
      from alert_rules where creator_id = ${creator.id}
    `;
    if (!have.same && have.n >= MAX_RULES_PER_CREATOR) {
      return { status: "error", message: `You can keep up to ${MAX_RULES_PER_CREATOR} rules.` };
    }
    await db`
      insert into alert_rules (creator_id, min_paise, media_id, sound_id)
      values (${creator.id}, ${minPaise}, ${mediaId}, ${soundId})
      on conflict (creator_id, min_paise) do update set media_id = excluded.media_id, sound_id = excluded.sound_id
    `;
  } catch (err) {
    console.error("Could not save alert rule", err);
    return { status: "error", message: "Could not save the rule — try again shortly" };
  }
  revalidatePath("/dashboard/rules");
  return { status: "ok" };
}

// Always allowed, even with the switch off, so a creator can clear their rules.
export async function deleteRule(ruleId: number): Promise<RuleActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change rules." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (!Number.isSafeInteger(ruleId)) return { status: "error", message: "Rule not found." };
  try {
    const rows = await db`delete from alert_rules where id = ${ruleId} and creator_id = ${creator.id} returning id`;
    if (!rows.length) return { status: "error", message: "Rule not found." };
  } catch {
    return { status: "error", message: "Could not delete the rule — try again shortly" };
  }
  revalidatePath("/dashboard/rules");
  return { status: "ok" };
}

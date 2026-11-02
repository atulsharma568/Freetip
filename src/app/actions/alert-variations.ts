"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import type { LedgerDb } from "@/lib/accrual";
import { baseColours, resolveAlertText } from "@/lib/alert-text";
import { MAX_VARIATIONS_PER_CREATOR, parseVariation, type VariationInput } from "@/lib/alert-variations";

export type VariationActionResult = { status: "ok" } | { status: "error"; message: string };

const DB_DOWN: VariationActionResult = { status: "error", message: "Database unavailable, try again shortly" };

async function currentCreator() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return null;
  const db = getDb();
  if (!db) return null;
  const [row] = await db<{ id: number; paid_features: string[] | null; accent: string | null }[]>`
    select id, paid_features, accent from users where google_id = ${googleId} and handle is not null
  `;
  return row ? { id: Number(row.id), row } : null;
}

// Adds a variation, or replaces the one already set for the same tip size. Checked here, not
// only in the page: the switch (and the switches of the parts it uses), that the files and
// sounds are the creator's own, every field through the same rules the overlay applies, and
// that colours read on the card they will sit on, next to the creator's standard text.
export async function saveVariation(input: VariationInput): Promise<VariationActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change variations." };
  if (!hasFeature(creator.row, "alertVariations")) {
    return { status: "error", message: "Alert variations are not switched on for your account." };
  }
  const db = getDb();
  if (!db) return DB_DOWN;

  // The card colours and the creator's standard text, as the overlay will judge them (the
  // style and the text only count while their own switches are on).
  const textOn = hasFeature(creator.row, "alertText");
  let theme: string | null = null;
  if (hasFeature(creator.row, "overlayThemes")) {
    try {
      const [t] = await db<{ overlay_theme: string }[]>`select overlay_theme from users where id = ${creator.id}`;
      theme = t?.overlay_theme ?? null;
    } catch {
      theme = null;
    }
  }
  const base = baseColours(theme, creator.row.accent);
  let standard = null;
  if (textOn) {
    try {
      const [t] = await db<{ alert_text: unknown }[]>`select alert_text from users where id = ${creator.id}`;
      standard = resolveAlertText(t?.alert_text ?? null, base);
    } catch {
      standard = null;
    }
  }

  const parsed = parseVariation(input, { base, standard, textOn });
  if (!parsed.ok) return { status: "error", message: parsed.message };
  const v = parsed.value;
  if (v.mediaId !== null && !hasFeature(creator.row, "customAlertMedia")) {
    return { status: "error", message: "Custom alert media is not switched on for your account." };
  }

  try {
    if (v.mediaId !== null) {
      const ok = await db`
        select 1 from creator_media where id = ${v.mediaId} and creator_id = ${creator.id} and review_state <> 'removed'
      `;
      if (!ok.length) return { status: "error", message: "That media file was not found." };
    }
    if (v.soundId !== null) {
      const ok = await db`select 1 from creator_sounds where id = ${v.soundId} and creator_id = ${creator.id}`;
      if (!ok.length) return { status: "error", message: "That sound was not found." };
    }

    const [have] = await db<{ n: number; same: number }[]>`
      select count(*)::int as n, count(*) filter (where min_paise = ${v.minPaise})::int as same
      from alert_variations where creator_id = ${creator.id}
    `;
    if (!have.same && have.n >= MAX_VARIATIONS_PER_CREATOR) {
      return { status: "error", message: `You can keep up to ${MAX_VARIATIONS_PER_CREATOR} variations.` };
    }
    // The driver writes an object as jsonb; null is "the standard text". LedgerDb is the
    // loosely typed query function the audit rows use for their jsonb values.
    const text = v.text === null ? null : (v.text as unknown as Record<string, string>);
    await (db as unknown as LedgerDb)`
      insert into alert_variations (creator_id, min_paise, media_id, sound_id, text, stay_seconds)
      values (${creator.id}, ${v.minPaise}, ${v.mediaId}, ${v.soundId}, ${text}::jsonb, ${v.staySeconds})
      on conflict (creator_id, min_paise) do update
        set media_id = excluded.media_id, sound_id = excluded.sound_id, text = excluded.text,
            stay_seconds = excluded.stay_seconds
    `;
  } catch (err) {
    console.error("Could not save alert variation (migration 0046 run?)", err);
    return { status: "error", message: "Could not save the variation, try again shortly" };
  }
  revalidatePath("/dashboard/variations");
  return { status: "ok" };
}

// Always allowed, even with the switch off, so a creator can clear their variations.
export async function deleteVariation(id: number): Promise<VariationActionResult> {
  const creator = await currentCreator();
  if (!creator) return { status: "error", message: "Sign in again to change variations." };
  const db = getDb();
  if (!db) return DB_DOWN;
  if (!Number.isSafeInteger(id)) return { status: "error", message: "Variation not found." };
  try {
    const rows = await db`delete from alert_variations where id = ${id} and creator_id = ${creator.id} returning id`;
    if (!rows.length) return { status: "error", message: "Variation not found." };
  } catch {
    return { status: "error", message: "Could not delete the variation, try again shortly" };
  }
  revalidatePath("/dashboard/variations");
  return { status: "ok" };
}

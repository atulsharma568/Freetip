"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import type { LedgerDb } from "@/lib/accrual";
import { baseColours, parseAlertText, type AlertTextInput } from "@/lib/alert-text";

export type AlertTextActionResult = { status: "ok" } | { status: "error"; message: string };

// Saves the creator's alert headline, colours, text size and weight. Checked here, not only
// in the page: the switch, and every field through the same rules the overlay applies (plain
// text with two placeholders, #rrggbb colours, keys from short lists, colours that read well
// on the card they sit on). Saving the normal card stores null.
export async function saveAlertText(input: AlertTextInput): Promise<AlertTextActionResult> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return { status: "error", message: "Sign in again to change your alert text." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable, try again shortly" };

  const [row] = await db<{ id: number; paid_features: string[] | null; accent: string | null }[]>`
    select id, paid_features, accent from users where google_id = ${googleId} and handle is not null
  `;
  if (!row) return { status: "error", message: "Sign in again to change your alert text." };
  if (!hasFeature(row, "alertText")) {
    return { status: "error", message: "Alert text and colours are not switched on for your account." };
  }

  // The card colours the theme gives when nothing is chosen; the theme only counts while that
  // feature is on. The column is from migration 0037, so before it is run the plain card is used.
  let theme: string | null = null;
  if (hasFeature(row, "overlayThemes")) {
    try {
      const [t] = await db<{ overlay_theme: string }[]>`select overlay_theme from users where id = ${row.id}`;
      theme = t?.overlay_theme ?? null;
    } catch {
      theme = null;
    }
  }

  const parsed = parseAlertText(input, baseColours(theme, row.accent));
  if (!parsed.ok) return { status: "error", message: parsed.message };

  // The driver writes an object as jsonb (the same as the audit rows elsewhere); null is the normal card.
  const value = parsed.value === null ? null : (parsed.value as unknown as Record<string, string>);
  try {
    // LedgerDb is the loosely typed query function the audit rows use for their jsonb values.
    await (db as unknown as LedgerDb)`update users set alert_text = ${value}::jsonb where id = ${row.id}`;
  } catch (err) {
    console.error("Could not save the alert text (migration 0044 run?)", err);
    return { status: "error", message: "Could not save your alert text, try again shortly" };
  }
  revalidatePath("/dashboard/text");
  return { status: "ok" };
}

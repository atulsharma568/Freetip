"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { isFontKey, isThemeKey } from "@/lib/overlay-themes";

export type StyleActionResult = { status: "ok" } | { status: "error"; message: string };

// Saves the creator's card style and font. Checked here, not only in the page: the
// switch, and that both choices are keys from the fixed lists (nothing free-form).
export async function saveOverlayStyle(input: { theme: string; font: string }): Promise<StyleActionResult> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return { status: "error", message: "Sign in again to change your style." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable — try again shortly" };

  const [row] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  if (!row) return { status: "error", message: "Sign in again to change your style." };
  if (!hasFeature(row, "overlayThemes")) {
    return { status: "error", message: "Overlay themes are not switched on for your account." };
  }
  if (!isThemeKey(input.theme) || !isFontKey(input.font)) {
    return { status: "error", message: "Pick a style and a font from the lists." };
  }

  try {
    await db`update users set overlay_theme = ${input.theme}, overlay_font = ${input.font} where id = ${row.id}`;
  } catch (err) {
    console.error("Could not save the overlay style (migration 0037 run?)", err);
    return { status: "error", message: "Could not save your style — try again shortly" };
  }
  revalidatePath("/dashboard/style");
  return { status: "ok" };
}

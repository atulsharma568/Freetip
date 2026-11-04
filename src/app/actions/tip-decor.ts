"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { isOwnerTipPage } from "@/lib/owner-page";
import { parseTipDecor } from "@/lib/page-doc/decor";

export type TipDecorActionResult = { status: "ok" } | { status: "error"; message: string };

// Saves the pick of the frame over the photo and the effect over the banner. Checked here, not only
// in the page: only the owner's own page has it for now, and each choice must be one of the
// ready-made looks (anything else would be stored as "none", so it is refused instead).
export async function saveTipDecor(input: { frame: string; bannerFx: string }): Promise<TipDecorActionResult> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return { status: "error", message: "Sign in again to change your photo and banner effects." };
  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable, try again shortly" };

  const [row] = await db<{ id: number; handle: string }[]>`select id, handle from users where google_id = ${googleId} and handle is not null`;
  if (!row) return { status: "error", message: "Sign in again to change your photo and banner effects." };
  if (!isOwnerTipPage(row.handle, googleId)) return { status: "error", message: "Photo and banner effects are not switched on for your account." };

  const parsed = parseTipDecor(input);
  if (!parsed || parsed.frame !== input.frame || parsed.bannerFx !== input.bannerFx) {
    return { status: "error", message: "That is not one of the looks on offer." };
  }
  try {
    // The driver writes an object as jsonb (the same as the other settings columns).
    await (db as unknown as LedgerDb)`update users set tip_decor = ${parsed as unknown as Record<string, string>}::jsonb where id = ${row.id}`;
  } catch (err) {
    console.error("Could not save the photo frame and banner effect (migration 0058 run?)", err);
    return { status: "error", message: "Could not save your choice, try again shortly" };
  }
  revalidatePath("/dashboard/effects");
  revalidatePath(`/${row.handle}`);
  return { status: "ok" };
}

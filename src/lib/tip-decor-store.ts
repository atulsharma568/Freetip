import { getDb } from "@/lib/db";
import type { Query } from "@/lib/accrual";
import { resolveWornItems } from "@/lib/decor-library";
import { parseTipDecor, type TipDecor } from "@/lib/page-doc/decor";

// The creator's own pick of the frame over their photo and the effect over their banner, from the
// column added by migration 0058. Null when nothing was saved, the database is not set up or the
// column is not there yet, so the tip page and the dashboard never break over it.
export async function readTipDecor(creatorId: number): Promise<TipDecor | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const [row] = await db<{ tip_decor: unknown }[]>`select tip_decor from users where id = ${creatorId}`;
    const decor = parseTipDecor(row?.tip_decor);
    // A worn picture whose library item was taken down, deleted or whose grant was withdrawn is dropped here.
    return decor ? await resolveWornItems(db as unknown as Query, creatorId, decor) : null;
  } catch (err) {
    console.error("Could not read the photo frame and banner effect (migration 0058 run?).", err);
    return null;
  }
}

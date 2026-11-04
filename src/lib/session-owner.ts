import { cache } from "react";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isOwnerTipPage } from "@/lib/owner-page";

// Whether whoever is signed in is the owner's own creator account (the page with its own look).
// Read once per request. False when nobody is signed in or the database is not set up.
export const getSessionIsOwnerPage = cache(async (): Promise<boolean> => {
  try {
    const googleId = ((await auth())?.user as { googleId?: string } | undefined)?.googleId;
    const db = getDb();
    if (!db || !googleId) return false;
    const [row] = await db<{ handle: string | null }[]>`select handle from users where google_id = ${googleId}`;
    return Boolean(row?.handle) && isOwnerTipPage(row!.handle!, googleId);
  } catch {
    return false;
  }
});

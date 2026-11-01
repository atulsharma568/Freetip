import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { safeAccent } from "@/lib/accent";

// The accent colour behind an OBS link, for the alert and goal bar. Read apart
// from the overlay's own queries so an OBS source still works if it fails.
export async function getOverlayAccent(token: string): Promise<string> {
  try {
    const db = getDb();
    if (!db) return safeAccent(null);
    const hash = createHash("sha256").update(token).digest("hex");
    const rows = await db<{ accent: string | null }[]>`
      select accent from users where overlay_token_hash = ${hash}
    `;
    return safeAccent(rows[0]?.accent);
  } catch (err) {
    console.error("Overlay: could not read the accent colour.", err);
    return safeAccent(null);
  }
}

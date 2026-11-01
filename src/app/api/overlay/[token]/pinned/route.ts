import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import type { Query } from "@/lib/accrual";
import { parseBannedWords } from "@/lib/message-filter";
import { loadPinned } from "@/lib/pinned-db";

// Polled by the pinned message overlay. Same secret link as the alerts. It answers
// { pinned: null } while nothing is pinned or the feature is switched off for the creator,
// so the OBS source can stay in the scene. Only an approved message inside its pinned time
// is ever returned, and the creator's banned words are checked on every call.

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token)) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }
  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const hash = createHash("sha256").update(token).digest("hex");
  try {
    const [creator] = await db<{ id: string; banned_words: string | null }[]>`
      select id, banned_words from users
       where overlay_token_hash = ${hash} and creator_status = 'active'
    `;
    if (!creator) return new Response("Not found", { status: 404, headers: NO_STORE });

    const pinned = await loadPinned(db as unknown as Query, Number(creator.id), parseBannedWords(creator.banned_words));
    return Response.json({ pinned }, { headers: NO_STORE });
  } catch (err) {
    console.error("Pinned overlay: lookup failed (migration 0040 run?).", err);
    // Keep what is on screen through a blip; the overlay only clears on a real answer.
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

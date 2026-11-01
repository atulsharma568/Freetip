import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import type { Query } from "@/lib/accrual";
import { planFeatures } from "@/lib/plans";
import { loadSupporters } from "@/lib/supporters";

// Polled by the three supporter overlays (streak, top supporter, recent supporters).
// Same secret link as the alerts. Only what is switched on for this creator comes
// back; a switched-off overlay gets an empty answer and draws nothing, so the OBS
// source can stay in the scene.

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
    const [creator] = await db<{ id: string; banned_words: string | null; paid_features: string[] | null }[]>`
      select id, banned_words, paid_features from users
       where overlay_token_hash = ${hash} and creator_status = 'active'
    `;
    if (!creator) return new Response("Not found", { status: 404, headers: NO_STORE });

    const f = planFeatures(creator);
    const which = { streak: f.supportStreak, top: f.topSupporter, recent: f.recentSupporters };
    if (!which.streak && !which.top && !which.recent) return Response.json({}, { headers: NO_STORE });

    const data = await loadSupporters(db as unknown as Query, Number(creator.id), creator.banned_words, which);
    return Response.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error("Supporter overlay: lookup failed (migration 0035 run?).", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

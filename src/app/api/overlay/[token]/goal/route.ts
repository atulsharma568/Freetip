import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import type { Query } from "@/lib/accrual";
import { loadGoalProgress } from "@/lib/goal-progress";

// Polled by the goal bar browser source. Same secret link as the alerts, with
// /goal added. Read-only: every goal bar of the creator (up to three), each with its
// title, the target it is measured against (the set target plus any shortfall carried
// over) and what has been raised since the goal was started or, for a daily, weekly
// or monthly goal, since its period began in the goal's own timezone.

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
    const [creator] = await db<{ id: string }[]>`select id from users where overlay_token_hash = ${hash}`;
    if (!creator) return new Response("Not found", { status: 404, headers: NO_STORE });

    const progress = await loadGoalProgress(db as unknown as Query, Number(creator.id));
    const goals = progress.map((g) => ({
      title: g.title,
      targetPaise: g.effectiveTargetPaise,
      carryPaise: g.carryPaise,
      raisedPaise: g.raisedPaise,
      repeat: g.repeat,
    }));
    // `goal` (the first bar) is kept for a browser source still running the older page.
    return Response.json({ goals, goal: goals[0] ?? null }, { headers: NO_STORE });
  } catch (err) {
    // Most likely migration 0028 has not been run.
    console.error("Goal overlay: lookup failed.", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

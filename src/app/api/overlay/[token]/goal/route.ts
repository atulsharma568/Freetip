import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";

// Polled by the goal bar browser source. Same secret link as the alerts, with
// /goal added. Read-only: the title, the target and what has been raised since
// the goal was started.

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
    const [row] = await db<
      { goal_title: string | null; goal_target_paise: string | null; raised: string }[]
    >`
      select u.goal_title, u.goal_target_paise,
             coalesce((
               select sum(t.gross_amount_minor) from tip_orders t
               where t.creator_id = u.id and t.status = 'captured'
                 and t.captured_at >= coalesce(u.goal_started_at, u.created_at)
             ), 0) as raised
      from users u
      where u.overlay_token_hash = ${hash}
    `;
    if (!row) return new Response("Not found", { status: 404, headers: NO_STORE });
    if (!row.goal_title || !row.goal_target_paise) return Response.json({ goal: null }, { headers: NO_STORE });
    return Response.json(
      {
        goal: {
          title: row.goal_title,
          targetPaise: Number(row.goal_target_paise),
          raisedPaise: Number(row.raised),
        },
      },
      { headers: NO_STORE },
    );
  } catch (err) {
    // Most likely migration 0018 has not been run.
    console.error("Goal overlay: lookup failed.", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

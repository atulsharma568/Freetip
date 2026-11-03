import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import type { Query } from "@/lib/accrual";
import { goalBarBody } from "@/lib/overlay-doc/goal-api";

// Polled by the goal bar browser source. Same secret link as the alerts, with /goal added.
// Read-only; what it answers is built in src/lib/overlay-doc/goal-api.ts.

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

    return Response.json(await goalBarBody(db as unknown as Query, Number(creator.id)), { headers: NO_STORE });
  } catch (err) {
    // Most likely migration 0028 has not been run.
    console.error("Goal overlay: lookup failed.", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import type { Query } from "@/lib/accrual";
import { meterForToken, obsBody } from "@/lib/page-doc/pressure-api";

// Polled by the Pressure meter browser source in OBS. Same secret link as the alerts, with
// /pressure added. Read-only. 404 when the meter is off, hidden, or set for the tip page only, so
// the source stays in the scene and shows nothing.

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
    const found = await meterForToken(db as unknown as Query, hash);
    if (!found.found) return new Response("Not found", { status: 404, headers: NO_STORE });
    return Response.json(obsBody(found), { headers: NO_STORE });
  } catch (err) {
    console.error("Pressure overlay: lookup failed.", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

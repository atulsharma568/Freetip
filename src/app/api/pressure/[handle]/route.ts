import { getDb } from "@/lib/db";
import type { Query } from "@/lib/accrual";
import { meterForHandle, pageBody } from "@/lib/page-doc/pressure-api";
import { createWindowLimiter } from "@/lib/window-limit";

// Polled by the Pressure meter block on a creator's tip page, every 30 seconds while the tab is
// open. Public and read-only: only the goal's title, how full it is, its rank word and, when the
// owner allows rupees, the raised and target amounts. 404 unless both switches are on and the
// published page has a visible meter set to show on the page. Cached for ten seconds at the edge,
// so a busy page costs one lookup per ten seconds, not one per fan.

const CACHE = { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" };
const NO_STORE = { "Cache-Control": "no-store" };

// A fan's browser asks twice a minute; this only stops a script.
const allow = createWindowLimiter(60, 60_000);

export async function GET(request: Request, { params }: { params: Promise<{ handle: string }> }): Promise<Response> {
  const { handle } = await params;
  const forwarded = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!allow(forwarded)) return new Response("Too many requests", { status: 429, headers: { ...NO_STORE, "Retry-After": "30" } });

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });
  try {
    const found = await meterForHandle(db as unknown as Query, handle.toLowerCase());
    if (!found.found) return new Response("Not found", { status: 404, headers: CACHE });
    return Response.json(pageBody(found), { headers: CACHE });
  } catch (err) {
    console.error("Pressure meter: lookup failed.", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

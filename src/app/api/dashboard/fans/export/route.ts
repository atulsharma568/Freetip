import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import type { LedgerDb } from "@/lib/accrual";
import { fansCsv, loadFans, parseFansQuery } from "@/lib/fan-list";

// CSV download of the fan list. It follows the page's search and sort. Only the signed-in
// creator's own fans, and only while the fan list is switched on for them.

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const [user] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId}
  `;
  if (!user) return new Response("Not found", { status: 404, headers: NO_STORE });
  if (!hasFeature(user, "fanCrm")) return new Response("Not found", { status: 404, headers: NO_STORE });

  try {
    const query = parseFansQuery(Object.fromEntries(new URL(request.url).searchParams));
    const { fans } = await loadFans(db as unknown as LedgerDb, user.id, query);
    return new Response(fansCsv(fans), {
      headers: {
        ...NO_STORE,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="fans.csv"',
      },
    });
  } catch (err) {
    console.error("Fan export failed (migration 0038 run?)", err);
    return new Response("Unavailable", { status: 503, headers: NO_STORE });
  }
}

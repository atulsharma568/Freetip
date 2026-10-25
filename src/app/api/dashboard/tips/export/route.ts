import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { parseTipsQuery, tipsCsv } from "@/lib/earnings";
import { loadTipsForExport } from "@/app/dashboard/queries";

// CSV download for the tips page. It follows the page's filters (`range`,
// `msg`) and ignores paging. Only the signed-in creator's own tips are read.

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const [user] = await db<{ id: number }[]>`
    select id from users where google_id = ${googleId}
  `;
  if (!user) return new Response("Not found", { status: 404, headers: NO_STORE });

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const { tips, truncated } = await loadTipsForExport(user.id, parseTipsQuery(params));

  return new Response(tipsCsv(tips), {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="tips.csv"',
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}

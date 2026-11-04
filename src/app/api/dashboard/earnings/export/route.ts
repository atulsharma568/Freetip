import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { Query } from "@/lib/accrual";
import { STATEMENT_EXPORT_MAX_ROWS, loadStatement } from "@/lib/creator-earnings";
import { statementCsv } from "@/lib/earnings-statement";

// CSV download of the creator's statement (every live tip posted to the books, newest first), for
// their own records. Only the signed-in creator's own tips are read.

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const [user] = await db<{ id: number }[]>`
    select id from users where google_id = ${googleId}
  `;
  if (!user) return new Response("Not found", { status: 404, headers: NO_STORE });

  const rows = await loadStatement(db as unknown as Query, user.id, STATEMENT_EXPORT_MAX_ROWS + 1, 0);
  const truncated = rows.length > STATEMENT_EXPORT_MAX_ROWS;

  return new Response(statementCsv(rows.slice(0, STATEMENT_EXPORT_MAX_ROWS)), {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="earnings.csv"',
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}

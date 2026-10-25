import { auth } from "@/auth";
import { getDb } from "@/lib/db";

// Polled by the dashboard's tip island. Unlike the overlay route this only
// reads: it never marks anything shown, so the stream alert is unaffected.

const NO_STORE = { "Cache-Control": "no-store" };

interface TipRow {
  id: number;
  fan_name: string | null;
  fan_message: string | null;
  message_status: "pending" | "approved" | "rejected";
  gross_amount_minor: string;
}

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return new Response("Unauthorized", { status: 401, headers: NO_STORE });

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const afterParam = Number(new URL(request.url).searchParams.get("after"));
  const after = Number.isSafeInteger(afterParam) && afterParam >= 0 ? afterParam : 0;

  const rows = await db<TipRow[]>`
    select t.id::int as id, t.fan_name, t.fan_message, t.message_status,
           t.gross_amount_minor
    from tip_orders t
    join users u on u.id = t.creator_id
    where u.google_id = ${googleId}
      and t.status = 'captured'
      and t.id > ${after}
      and t.captured_at > now() - interval '1 day'
    order by t.id
    limit 10
  `;

  const tips = rows.map((r) => {
    const message = r.fan_message?.trim() ?? "";
    return {
      id: r.id,
      name: r.fan_name?.trim() || "Anonymous",
      amountPaise: Number(r.gross_amount_minor),
      // A message the creator rejected is never shown again.
      message: message && r.message_status !== "rejected" ? message : null,
    };
  });
  return Response.json({ tips }, { headers: NO_STORE });
}

import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";

// The overlay calls this once an alert's card is on screen. Only now is the
// alert marked shown; until then it is just leased (see ../route.ts), so an OBS
// reload before the card appeared gets the alert again. Confirming twice is
// harmless.

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token)) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400, headers: NO_STORE });
  }
  const { id, kind } = (body ?? {}) as { id?: unknown; kind?: unknown };
  if (
    typeof id !== "number" ||
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    (kind !== "alert" && kind !== "message")
  ) {
    return new Response("Bad request", { status: 400, headers: NO_STORE });
  }

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const hash = createHash("sha256").update(token).digest("hex");

  // The token must belong to the tip's creator, so one creator's overlay can't
  // confirm another's alerts. The alert card may have carried the message along
  // (that was leased with it); that is only settled on the first confirm.
  const rows =
    kind === "alert"
      ? await db`
          update tip_orders t
          set alert_shown_at   = coalesce(t.alert_shown_at, now()),
              message_shown_at = case
                when t.alert_shown_at is null and t.message_lease_until is not null
                  then coalesce(t.message_shown_at, now())
                else t.message_shown_at end
          from users u
          where t.id = ${id} and u.id = t.creator_id and u.overlay_token_hash = ${hash}
            and t.status = 'captured'
          returning t.id
        `
      : await db`
          update tip_orders t
          set message_shown_at = coalesce(t.message_shown_at, now())
          from users u
          where t.id = ${id} and u.id = t.creator_id and u.overlay_token_hash = ${hash}
            and t.status = 'captured' and t.alert_shown_at is not null
          returning t.id
        `;

  if (!rows.length) return new Response("Not found", { status: 404, headers: NO_STORE });
  return new Response(null, { status: 204, headers: NO_STORE });
}

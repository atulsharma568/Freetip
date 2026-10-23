import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import {
  OVERLAY_TOKEN_PATTERN,
  pickNext,
  type AlertMode,
  type TipRow,
} from "@/lib/alerts";

// Polled by the OBS browser source every few seconds. Each call hands out at
// most one alert and marks it shown in the same request, so an alert plays once
// even if two overlays are open. shortcut: if OBS reloads between the hand-out
// and the animation, that one alert is lost; an ack round trip would fix it.

const NO_STORE = { "Cache-Control": "no-store" };

interface CandidateRow extends Omit<TipRow, "id"> {
  creator_id: number;
  alert_mode: AlertMode;
  id: number | null;
}

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

  // One query: the creator behind the token plus their candidate tips. The
  // mode condition keeps tips that can't play yet (approve mode, undecided
  // message) from filling the candidate limit.
  const rows = await db<CandidateRow[]>`
    select u.id as creator_id, u.alert_mode,
           t.id::int as id, t.fan_name, t.fan_message, t.gross_amount_minor, t.message_status,
           t.captured_at, t.message_decided_at, t.alert_shown_at, t.message_shown_at
    from users u
    left join tip_orders t
      on t.creator_id = u.id
     and t.status = 'captured'
     and t.captured_at > now() - interval '1 day'
     and (t.alert_shown_at is null
          or (t.message_shown_at is null and t.message_status = 'approved'
              and t.fan_message is not null))
     and (u.alert_mode <> 'approve'
          or t.message_status <> 'pending'
          or t.fan_message is null
          or t.alert_shown_at is not null)
    where u.overlay_token_hash = ${hash}
    order by t.captured_at nulls last
    limit 20
  `;

  if (!rows.length) return new Response("Not found", { status: 404, headers: NO_STORE });

  const mode = rows[0].alert_mode;
  const tips = rows.filter((r): r is CandidateRow & { id: number } => r.id !== null);
  const next = pickNext(mode, tips, new Date());
  if (!next) return Response.json({ alert: null }, { headers: NO_STORE });

  const claimed =
    next.kind === "alert"
      ? await db`
          update tip_orders
          set alert_shown_at   = now(),
              message_shown_at = case when ${next.withMessage} then now() else message_shown_at end
          where id = ${next.id} and alert_shown_at is null and status = 'captured'
          returning id
        `
      : await db`
          update tip_orders
          set message_shown_at = now()
          where id = ${next.id} and message_shown_at is null
            and alert_shown_at is not null and status = 'captured'
          returning id
        `;

  // Someone else (another open overlay) took it first.
  if (!claimed.length) return Response.json({ alert: null }, { headers: NO_STORE });

  const row = tips.find((r) => r.id === next.id)!;
  return Response.json(
    {
      alert: {
        id: next.id,
        kind: next.kind,
        name: row.fan_name?.trim() || "Anonymous",
        amountPaise: Number(row.gross_amount_minor),
        message: next.withMessage ? row.fan_message!.trim() : null,
      },
    },
    { headers: NO_STORE },
  );
}

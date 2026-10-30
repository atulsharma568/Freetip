import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import {
  OVERLAY_TOKEN_PATTERN,
  pickNext,
  type AlertMode,
  type TipRow,
} from "@/lib/alerts";
import { shouldSpeak } from "@/lib/tts-rules";
import { ttsAvailable } from "@/lib/tts";

// Polled by the OBS browser source every few seconds. Each call hands out at
// most one alert and leases it for 60 seconds, so two open overlays don't
// both play it. The overlay confirms through ./ack once the card is on screen,
// and only that sets *_shown_at. If the confirm never comes (OBS reloaded, the
// network dropped) the lease runs out and the alert is handed out again: an
// alert may show twice, but is never lost.

const NO_STORE = { "Cache-Control": "no-store" };

// The lease is 60 seconds (written into the queries below): long enough to cover
// a card waiting behind the one on screen plus the speech download. The overlay
// doesn't ask for more while it holds one.

interface CandidateRow extends Omit<TipRow, "id"> {
  creator_id: number;
  alert_mode: AlertMode;
  message_max_chars: number;
  tts_enabled: boolean;
  approve_before_play: boolean;
  tts_min_paise: number;
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
           u.message_max_chars, u.tts_enabled, u.approve_before_play, u.tts_min_paise,
           t.id::int as id, t.fan_name, t.fan_message, t.gross_amount_minor, t.message_status,
           t.captured_at, t.message_decided_at, t.alert_shown_at, t.message_shown_at
    from users u
    left join tip_orders t
      on t.creator_id = u.id
     and t.status = 'captured'
     and t.captured_at > now() - interval '1 day'
     and ((t.alert_shown_at is null
           and (t.alert_lease_until is null or t.alert_lease_until <= now()))
          or (t.alert_shown_at is not null
              and t.message_shown_at is null and t.message_status = 'approved'
              and t.fan_message is not null
              and (t.message_lease_until is null or t.message_lease_until <= now())))
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
          set alert_lease_until   = now() + interval '60 seconds',
              message_lease_until = case when ${next.withMessage}
                                         then now() + interval '60 seconds'
                                         else null end
          where id = ${next.id} and alert_shown_at is null and status = 'captured'
            and (alert_lease_until is null or alert_lease_until <= now())
          returning id
        `
      : await db`
          update tip_orders
          set message_lease_until = now() + interval '60 seconds'
          where id = ${next.id} and message_shown_at is null
            and alert_shown_at is not null and status = 'captured'
            and (message_lease_until is null or message_lease_until <= now())
          returning id
        `;

  // Someone else (another open overlay) leased it first.
  if (!claimed.length) return Response.json({ alert: null }, { headers: NO_STORE });

  const row = tips.find((r) => r.id === next.id)!;

  // Whether the fan chose "read my message aloud" (migration 0014). A tip uses
  // either the voice or a sound, never both. A lookup failure (the column is
  // missing) means no voice.
  let requested = false;
  try {
    const [found] = await db<{ tts_requested: boolean }[]>`
      select tts_requested from tip_orders where id = ${next.id}
    `;
    requested = !!found?.tts_requested;
  } catch (err) {
    console.error("Overlay: could not look up the voice choice.", err);
  }

  // Whether the message will be read aloud. The overlay then fetches the audio
  // from the speech route, which checks the same rules again.
  const speak =
    requested &&
    ttsAvailable() &&
    next.withMessage &&
    shouldSpeak(
      {
        ttsEnabled: row.tts_enabled,
        approveBeforePlay: row.approve_before_play,
        ttsMinPaise: row.tts_min_paise,
      },
      {
        message: row.fan_message,
        messageStatus: row.message_status,
        amountPaise: Number(row.gross_amount_minor),
        requested,
      },
      row.message_max_chars,
    );

  // The alert's sound: the fan's pick (even if the creator hid or repriced it
  // afterwards), otherwise the creator's default. A voice tip has no sound at all,
  // not even the default. Only the alert card has one, not the follow-up message
  // card. A lookup failure (for example the sounds table from migration 0013 is
  // missing) just means a silent alert.
  let sound: { url: string; volume: number; ms: number } | null = null;
  if (next.kind === "alert" && !requested) {
    try {
      const [found] = await db<{ blob_url: string; volume: number; duration_ms: number }[]>`
        select s.blob_url, s.volume, s.duration_ms
        from tip_orders t
        join users u on u.id = t.creator_id
        join creator_sounds s on s.id = coalesce(t.sound_id, u.default_sound_id)
                             and s.creator_id = u.id
        where t.id = ${next.id}
      `;
      if (found) sound = { url: found.blob_url, volume: found.volume, ms: found.duration_ms };
    } catch (err) {
      console.error("Overlay: could not look up the alert sound.", err);
    }
  }

  return Response.json(
    {
      alert: {
        id: next.id,
        kind: next.kind,
        name: row.fan_name?.trim() || "Anonymous",
        amountPaise: Number(row.gross_amount_minor),
        message: next.withMessage ? row.fan_message!.trim() : null,
        speech: speak,
        sound,
      },
    },
    { headers: NO_STORE },
  );
}

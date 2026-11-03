import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { effectiveTtsMinPaise, getTtsFloorPaise } from "@/lib/site-settings";
import {
  OVERLAY_TOKEN_PATTERN,
  pickNext,
  type AlertMode,
  type TipRow,
} from "@/lib/alerts";
import { loadAlertExtras, type Sql } from "@/lib/alert-extras";
import { findBlockedWord } from "@/lib/message-filter";
import { shouldSpeak } from "@/lib/tts-rules";
import { ttsAvailable } from "@/lib/tts";
import { hasFeature } from "@/lib/plans";

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
  overlay_skip_at: Date | null;
  overlay_test_at: Date | null;
  paid_features: string[] | null;
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
           u.overlay_skip_at, u.overlay_test_at, u.paid_features,
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

  // Dashboard commands (test, skip) for the overlay to act on, sent with every
  // answer. An overlay only acts on a time newer than the first one it saw.
  const controls = {
    skipAt: rows[0].overlay_skip_at?.getTime() ?? 0,
    testAt: rows[0].overlay_test_at?.getTime() ?? 0,
  };

  const mode = rows[0].alert_mode;
  const tips = rows.filter((r): r is CandidateRow & { id: number } => r.id !== null);

  // Tips whose fan asked to pin the message (migration 0040), read only while the creator's
  // switch is on at play time. Those tips wait for approval even in instant mode.
  if (tips.length && hasFeature(rows[0], "highlightedMessages")) {
    try {
      const pinned = await db<{ id: number }[]>`
        select id::int as id from tip_orders
        where creator_id = ${rows[0].creator_id} and highlight and status = 'captured'
          and captured_at > now() - interval '1 day'
      `;
      const pinnedIds = new Set(pinned.map((p) => p.id));
      for (const t of tips) t.highlight = pinnedIds.has(t.id);
    } catch (err) {
      console.error("Overlay: could not look up pinned messages (migration 0040 run?).", err);
    }
  }

  const next = pickNext(mode, tips, new Date());
  if (!next) return Response.json({ alert: null, controls }, { headers: NO_STORE });

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
  if (!claimed.length) return Response.json({ alert: null, controls }, { headers: NO_STORE });

  const row = tips.find((r) => r.id === next.id)!;

  // The sound, the media, the card style, the voice choice and the banned words (src/lib/alert-extras.ts). A banned
  // word added after the tip was paid still holds it back here: its message is dropped
  // from the alert and a blocked name shows as Anonymous.
  const extras = await loadAlertExtras(db as unknown as Sql, {
    tipId: next.id,
    creatorId: row.creator_id,
    kind: next.kind,
  });
  const requested = extras.voiceRequested;
  const bannedWords = extras.bannedWords;
  const messageBlocked = findBlockedWord(row.fan_message, bannedWords) !== null;
  const nameBlocked = findBlockedWord(row.fan_name, bannedWords) !== null;

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
        ttsMinPaise: effectiveTtsMinPaise(row.tts_min_paise, await getTtsFloorPaise(db)),
        bannedWords,
      },
      {
        message: row.fan_message,
        messageStatus: row.message_status,
        amountPaise: Number(row.gross_amount_minor),
        requested,
      },
      row.message_max_chars,
    );

  return Response.json(
    {
      alert: {
        id: next.id,
        kind: next.kind,
        name: (!nameBlocked && row.fan_name?.trim()) || "Anonymous",
        amountPaise: Number(row.gross_amount_minor),
        message: next.withMessage && !messageBlocked ? row.fan_message!.trim() : null,
        speech: speak,
        sound: extras.sound,
        media: extras.media,
        stayMs: extras.stayMs,
        theme: extras.theme,
        text: extras.text,
        motion: extras.motion,
        layout: extras.layout,
        // A name the creator has since banned shows as Anonymous, so it gets no level either.
        level: nameBlocked ? null : extras.level,
      },
      controls,
    },
    { headers: NO_STORE },
  );
}

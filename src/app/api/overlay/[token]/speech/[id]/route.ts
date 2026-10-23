import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import { OVERLAY_TOKEN_PATTERN } from "@/lib/alerts";
import { shouldSpeak, speechText, type SpeechTip } from "@/lib/tts-rules";
import { synthesize } from "@/lib/tts";

// The spoken version of one alert's message, as MP3. The overlay asks for it
// after the alert is handed out. Nothing from the request is spoken: the text
// comes from the database and every rule is checked again here, so a guessed id
// or an edited URL can't make the voice say anything the creator didn't allow.

const NO_STORE = { "Cache-Control": "no-store" };

// Only a message that was just shown can be spoken.
const SPEAK_WINDOW = "10 minutes";

interface Row {
  fan_message: string | null;
  gross_amount_minor: string | number;
  message_status: SpeechTip["messageStatus"];
  message_max_chars: number;
  tts_enabled: boolean;
  approve_before_play: boolean;
  tts_min_paise: number;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; id: string }> },
): Promise<Response> {
  const { token, id } = await params;
  if (!OVERLAY_TOKEN_PATTERN.test(token) || !/^\d{1,12}$/.test(id)) {
    return new Response("Not found", { status: 404, headers: NO_STORE });
  }

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: NO_STORE });

  const hash = createHash("sha256").update(token).digest("hex");
  const rows = await db<Row[]>`
    select t.fan_message, t.gross_amount_minor, t.message_status,
           u.message_max_chars, u.tts_enabled, u.approve_before_play, u.tts_min_paise
    from users u
    join tip_orders t on t.creator_id = u.id
    where u.overlay_token_hash = ${hash}
      and t.id = ${Number(id)}
      and t.status = 'captured'
      and t.message_shown_at > now() - ${SPEAK_WINDOW}::interval
  `;
  const row = rows[0];
  if (!row) return new Response("Not found", { status: 404, headers: NO_STORE });

  const allowed = shouldSpeak(
    {
      ttsEnabled: row.tts_enabled,
      approveBeforePlay: row.approve_before_play,
      ttsMinPaise: row.tts_min_paise,
    },
    {
      message: row.fan_message,
      messageStatus: row.message_status,
      amountPaise: Number(row.gross_amount_minor),
    },
    row.message_max_chars,
  );
  const text = allowed ? speechText(row.fan_message, row.message_max_chars) : null;
  if (!text) return new Response(null, { status: 204, headers: NO_STORE });

  const audio = await synthesize(text);
  if (!audio) return new Response(null, { status: 204, headers: NO_STORE });

  return new Response(Buffer.from(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.byteLength),
      ...NO_STORE,
    },
  });
}

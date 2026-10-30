import "server-only";
import { getDb } from "@/lib/db";
import { azureConfigured, azureSynthesize } from "@/lib/tts-azure";
import { pollyConfigured, pollySynthesize } from "@/lib/tts-polly";
import { azureVoice, cacheKey, limitsFromEnv, prepareSpeech, withinLimits } from "@/lib/tts-pure";

// Text-to-speech engine layer. Azure Speech is the main engine (free tier), Amazon
// Polly the fallback if Azure is not set up or fails. A clip is cached by voice and
// text, so a replay or a repeated message costs nothing, and characters sent to an
// engine are counted per creator and per month against caps (migration 0019). With
// no engine configured, or the owner's switch off, alerts simply play silently.

export function ttsConfigured(): boolean {
  return azureConfigured() || pollyConfigured();
}

// The owner's switch for voice on the whole site: TTS_ENABLED=true in Vercel.
// Off until the owner has chosen and set up an engine, whatever the creators'
// own settings say. When it is off, nobody is offered a voice and none is played.
export function ttsAvailable(): boolean {
  return process.env.TTS_ENABLED === "true" && ttsConfigured();
}

type Db = NonNullable<ReturnType<typeof getDb>>;

async function readCache(db: Db, hash: string): Promise<Uint8Array | null> {
  try {
    const [row] = await db<{ audio: Buffer }[]>`
      update tts_cache set last_used_at = now() where hash = ${hash} returning audio
    `;
    return row ? new Uint8Array(row.audio) : null;
  } catch (err) {
    console.error("TTS: cache read failed (migration 0019 run?).", err);
    return null;
  }
}

async function writeCache(db: Db, hash: string, audio: Uint8Array): Promise<void> {
  try {
    await db`insert into tts_cache (hash, audio) values (${hash}, ${Buffer.from(audio)}) on conflict do nothing`;
  } catch (err) {
    console.error("TTS: cache write failed.", err);
  }
}

// Characters already sent for this creator today and for the whole site this month.
// A failed lookup (table missing) counts as zero, so voice still works before the
// migration, without caps.
async function usedChars(db: Db, creatorId: number): Promise<{ creatorToday: number; siteMonth: number }> {
  try {
    const [row] = await db<{ today: string; month: string }[]>`
      select coalesce(sum(chars) filter (where creator_id = ${creatorId} and day = current_date), 0) as today,
             coalesce(sum(chars) filter (where engine = 'azure'), 0) as month
      from tts_usage
      where day >= date_trunc('month', current_date)
    `;
    return { creatorToday: Number(row?.today ?? 0), siteMonth: Number(row?.month ?? 0) };
  } catch (err) {
    console.error("TTS: usage lookup failed (migration 0019 run?).", err);
    return { creatorToday: 0, siteMonth: 0 };
  }
}

async function addUsage(db: Db, creatorId: number, engine: string, chars: number): Promise<void> {
  try {
    await db`
      insert into tts_usage (day, creator_id, engine, chars) values (current_date, ${creatorId}, ${engine}, ${chars})
      on conflict (day, creator_id, engine) do update set chars = tts_usage.chars + excluded.chars
    `;
  } catch (err) {
    console.error("TTS: could not record usage.", err);
  }
}

// MP3 bytes for the message, or null if speech is off, over a cap, or every engine
// failed. `creatorId` is whose alert it is, for the daily cap.
export async function synthesize(message: string, creatorId: number): Promise<Uint8Array | null> {
  if (!ttsAvailable()) return null;
  const { text, language } = prepareSpeech(message);
  const db = getDb();

  // Cache first: the key includes the voice, so a changed voice setting is not
  // served an old clip. (A clip that fell back to Polly is cached under Azure's key
  // too; it is still a fine clip for that text.)
  const azure = azureConfigured();
  const hash = azure ? cacheKey("azure", azureVoice(language), text) : cacheKey("polly", "kajal", text);
  if (db) {
    const cached = await readCache(db, hash);
    if (cached) return cached;
  }

  if (db && !withinLimits(await usedChars(db, creatorId), text.length, limitsFromEnv())) {
    console.error(`TTS: cap reached for creator ${creatorId} or for the month; playing silently.`);
    return null;
  }

  let audio: Uint8Array | null = null;
  let engine = "";
  if (azure) {
    const out = await azureSynthesize(text, language);
    if (out) {
      audio = out.audio;
      engine = "azure";
    }
  }
  if (!audio && pollyConfigured()) {
    audio = await pollySynthesize(text, language);
    engine = "polly";
  }
  if (!audio || !audio.byteLength) return null;

  if (db) {
    await Promise.all([writeCache(db, hash, audio), addUsage(db, creatorId, engine, text.length)]);
  }
  return audio;
}

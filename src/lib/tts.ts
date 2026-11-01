import "server-only";
import { getDb } from "@/lib/db";
import { loadLearnedWords, recordUnknownWords } from "@/lib/tts-words";
import { azureConfigured, azureSynthesize } from "@/lib/tts-azure";
import { pollyConfigured, pollySynthesize } from "@/lib/tts-polly";
import {
  azureVoice,
  cacheKey,
  limitsFromEnv,
  prepareSpeech,
  testLimits,
  type VoiceGender,
  withinLimits,
  type Prepared,
} from "@/lib/tts-pure";

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
// The creator's chosen voice (migration 0029). A failed lookup means female, so
// voice still works before the migration.
async function creatorGender(db: Db, creatorId: number): Promise<VoiceGender> {
  try {
    const [row] = await db<{ tts_voice: string }[]>`select tts_voice from users where id = ${creatorId}`;
    return row?.tts_voice === "male" ? "male" : "female";
  } catch (err) {
    console.error("TTS: could not read the voice choice (migration 0029 run?).", err);
    return "female";
  }
}

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
  const result = await synthesizeDetailed(message, creatorId);
  return result.ok ? result.audio : null;
}

// What happened, for the dashboard's "Test voice" button: the clip plus the text the
// engine was given, the voice, which engine made it and whether it came from the
// cache; or why there is no clip.
export type SynthesisResult =
  | {
      ok: true;
      audio: Uint8Array;
      spoken: string;
      language: Prepared["language"];
      voice: string;
      engine: "azure" | "polly";
      cached: boolean;
    }
  | { ok: false; reason: "off" | "cap" | "failed" };

// `testRun` holds a creator's own tests to half their daily characters, so trying
// the voice never leaves their real alerts silent. `gender` lets the test button
// play either voice without changing the creator's saved choice.
export async function synthesizeDetailed(
  message: string,
  creatorId: number,
  options: { testRun?: boolean; gender?: VoiceGender } = {},
): Promise<SynthesisResult> {
  if (!ttsAvailable()) return { ok: false, reason: "off" };
  await loadLearnedWords();
  const { text, language } = prepareSpeech(message);
  const db = getDb();
  if (!options.testRun) await recordUnknownWords(message);

  // Cache first: the key includes the voice, so a changed voice setting is not
  // served an old clip. (A clip that fell back to Polly is cached under Azure's key
  // too; it is still a fine clip for that text.)
  const azure = azureConfigured();
  const gender = options.gender ?? (db ? await creatorGender(db, creatorId) : "female");
  const voice = azure ? azureVoice(language, process.env, gender) : "Kajal";
  const hash = azure ? cacheKey("azure", voice, text) : cacheKey("polly", "kajal", text);
  if (db) {
    const cached = await readCache(db, hash);
    if (cached) {
      return { ok: true, audio: cached, spoken: text, language, voice, engine: azure ? "azure" : "polly", cached: true };
    }
  }

  const limits = options.testRun ? testLimits(limitsFromEnv()) : limitsFromEnv();
  if (db && !withinLimits(await usedChars(db, creatorId), text.length, limits)) {
    console.error(`TTS: cap reached for creator ${creatorId} or for the month; playing silently.`);
    return { ok: false, reason: "cap" };
  }

  let audio: Uint8Array | null = null;
  let engine: "azure" | "polly" = "azure";
  let usedVoice = voice;
  if (azure) {
    const out = await azureSynthesize(text, language, gender);
    if (out) {
      audio = out.audio;
      usedVoice = out.voice;
    }
  }
  if (!audio && pollyConfigured()) {
    audio = await pollySynthesize(text, language);
    engine = "polly";
    usedVoice = "Kajal";
  }
  if (!audio || !audio.byteLength) return { ok: false, reason: "failed" };

  if (db) {
    // Polly has one voice (Kajal, female), so its clip is cached under Polly's own
    // key and never served to someone who chose Azure's male voice.
    const writeHash = engine === "polly" ? cacheKey("polly", "kajal", text) : hash;
    await Promise.all([writeCache(db, writeHash, audio), addUsage(db, creatorId, engine, text.length)]);
  }
  return { ok: true, audio, spoken: text, language, voice: usedVoice, engine, cached: false };
}

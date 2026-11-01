"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { parseBannedWords } from "@/lib/message-filter";
import { configuredOwnerGoogleIds, isOwnerGoogleId } from "@/lib/owner-auth";
import { synthesizeDetailed, ttsAvailable } from "@/lib/tts";
import { prepareTestText, TEST_COOLDOWN_SECONDS } from "@/lib/voice-test";

// The dashboard's "Test voice" button: speaks a typed message through the real
// engine with no payment. Only a signed-in creator can use it, the text goes through
// the same cleanup and word filter as a fan's message, repeats come from the cache
// for free, a short cooldown keeps one creator from hogging the engine, and tests
// share only half of the creator's daily characters with real alerts.

export type VoiceTestResult =
  | {
      status: "ok";
      // MP3 as base64, played in the browser.
      audio: string;
      // The text the voice was given (Roman Hindi already turned into Devanagari).
      spoken: string;
      language: "hi-IN" | "en-IN";
      voice: string;
      engine: "azure" | "polly";
      cached: boolean;
    }
  | { status: "error"; message: string };

export async function testVoice(input: string): Promise<VoiceTestResult> {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  if (!ttsAvailable()) {
    return { status: "error", message: "Voice is switched off for the whole site right now." };
  }
  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable. Try again shortly." };

  let user: { id: number; message_max_chars: number; creator_status: string } | undefined;
  try {
    [user] = await db<{ id: number; message_max_chars: number; creator_status: string }[]>`
      select id, message_max_chars, creator_status from users where google_id = ${googleId}
    `;
  } catch (err) {
    console.error("Voice test: could not look up the creator.", err);
    return { status: "error", message: "Could not do that. Try again shortly." };
  }
  if (!user) return { status: "error", message: "Finish setting up your account first." };
  if (user.creator_status === "suspended") return { status: "error", message: "Your account is suspended." };

  // The creator's banned words (migration 0016), read apart so this works before it.
  let banned: string[] = [];
  try {
    const [row] = await db<{ banned_words: string | null }[]>`select banned_words from users where id = ${user.id}`;
    banned = parseBannedWords(row?.banned_words);
  } catch (err) {
    console.error("Voice test: could not read the banned words.", err);
  }

  const prepared = prepareTestText(input, user.message_max_chars, banned);
  if (!prepared.ok) return { status: "error", message: prepared.message };

  // Cooldown (migration 0020). If the column is missing the button still works,
  // without it; the daily character cap still holds.
  try {
    const done = await db`
      update users set tts_test_at = now()
      where id = ${user.id}
        and (tts_test_at is null or tts_test_at < now() - ${`${TEST_COOLDOWN_SECONDS} seconds`}::interval)
      returning id
    `;
    if (!done.length) return { status: "error", message: "Wait a few seconds and try again." };
  } catch (err) {
    console.error("Voice test: cooldown failed (migration 0020 run?).", err);
  }

  let result: Awaited<ReturnType<typeof synthesizeDetailed>>;
  try {
    result = await synthesizeDetailed(prepared.text, user.id, { testRun: true });
  } catch (err) {
    console.error("Voice test: synthesis threw.", err);
    return { status: "error", message: "The voice did not answer. Try again shortly." };
  }
  if (!result.ok) {
    const message =
      result.reason === "cap"
        ? "You have used today's voice-test allowance. Your real tip alerts keep theirs. Try again tomorrow."
        : result.reason === "off"
          ? "Voice is switched off for the whole site right now."
          : isOwnerGoogleId(googleId, configuredOwnerGoogleIds())
            ? "The voice engine did not answer. Check AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in Vercel (and the function log line that starts with TTS:), then try again."
            : "The voice did not answer. Try again shortly.";
    return { status: "error", message };
  }
  return {
    status: "ok",
    audio: Buffer.from(result.audio).toString("base64"),
    spoken: result.spoken,
    language: result.language,
    voice: result.voice,
    engine: result.engine,
    cached: result.cached,
  };
}

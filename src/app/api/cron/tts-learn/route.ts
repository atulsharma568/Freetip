import { timingSafeEqual } from "crypto";
import { learnWords } from "@/lib/tts-learn-run";

// Daily, run by Vercel Cron (see vercel.json): the voice learns new Hindi words from
// the unknown-word log. Does nothing unless TTS_AUTOLEARN=true. Vercel sends
// CRON_SECRET as a bearer token.
export const maxDuration = 120;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Unauthorized", { status: 401 });

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const match =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) return new Response("Unauthorized", { status: 401 });

  try {
    return new Response(`OK (${await learnWords()})`);
  } catch (err) {
    console.error("TTS learning failed", err);
    return new Response("Failed", { status: 500 });
  }
}

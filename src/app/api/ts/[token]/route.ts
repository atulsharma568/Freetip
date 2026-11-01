import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { realDeps, recordMoment } from "@/lib/stream-timestamps";
import { createYouTubeClient } from "@/lib/youtube";

// The chat command. A bot in the creator's YouTube chat (Nightbot, StreamElements,
// Fossabot) fetches this address whenever someone types !ts, and sends the plain text
// we answer into chat. The secret in the path says whose stream it is. Always answers
// 200 with a sentence: an error page would be printed in the stream's chat.

const TEXT = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };
const say = (text: string) => new Response(text, { status: 200, headers: TEXT });

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const q = new URL(request.url).searchParams;
  // Bots that did not fill in their placeholders send the placeholder text itself.
  const clean = (v: string | null, max: number) => {
    const text = (v ?? "").slice(0, max);
    return /^\$\(.*\)$/.test(text) ? "" : text;
  };

  const db = getDb();
  if (!db) return say("Timestamps are not working right now. Try again soon.");

  const text = await recordMoment(db as unknown as LedgerDb, realDeps(createYouTubeClient()), {
    token,
    user: clean(q.get("user"), 80),
    message: clean(q.get("msg"), 300),
    chatId: clean(q.get("chatId"), 200),
  });
  return say(text);
}

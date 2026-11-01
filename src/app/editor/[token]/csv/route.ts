import { createHash } from "crypto";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { loadStreamHighlights } from "@/lib/highlights";
import { momentsCsv, isVideoId } from "@/lib/timestamps";
import { TOKEN_PATTERN } from "@/lib/stream-timestamps";

// The editor link's CSV download for one stream: time, seconds, label, source, how many
// people marked it, and a link that opens the stream there. No viewer names.
const HEADERS = { "Cache-Control": "no-store" };

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const video = new URL(request.url).searchParams.get("video");
  if (!TOKEN_PATTERN.test(token) || !isVideoId(video)) return new Response("Not found", { status: 404, headers: HEADERS });

  const db = getDb();
  if (!db) return new Response("Unavailable", { status: 503, headers: HEADERS });
  const hash = createHash("sha256").update(token).digest("hex");
  try {
    const [creator] = await db<{ id: string }[]>`select id::text from users where ts_editor_token_hash = ${hash}`;
    if (!creator) return new Response("Not found", { status: 404, headers: HEADERS });
    const stream = await loadStreamHighlights(db as unknown as LedgerDb, Number(creator.id), video);
    if (!stream) return new Response("Not found", { status: 404, headers: HEADERS });
    return new Response(momentsCsv(video, stream.groups), {
      status: 200,
      headers: {
        ...HEADERS,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="timestamps-${video}.csv"`,
      },
    });
  } catch (err) {
    console.error("Editor CSV failed (migration 0033 run?).", err);
    return new Response("Unavailable", { status: 503, headers: HEADERS });
  }
}

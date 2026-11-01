import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import {
  findHelperCreator,
  latestEventId,
  loadHelperEvents,
  parseSince,
  POLL_STEP_MS,
  POLL_WAIT_MS,
  replayBufferNeeded,
  touchHelper,
} from "@/lib/ts-helper";

// The OBS clip helper's feed. The helper (a program on the creator's own PC) calls this
// over and over: `?since=<id>` waits up to 20 seconds for moments saved after that id,
// and answers at once with whatever is there. With no `since` it answers at once with
// the newest id and no events, so a helper that has just started begins from now. The
// secret in the path says whose moments these are; it is the helper's own token, not the
// chat command's or the editor link's.
export const maxDuration = 30;

const HEADERS = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: HEADERS });
const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  const rawSince = new URL(request.url).searchParams.get("since");
  const since = parseSince(rawSince);
  if (rawSince !== null && rawSince !== "" && since === null) return json({ error: "bad_since" }, 400);

  const sql = getDb();
  if (!sql) return json({ error: "unavailable" }, 503);
  const db = sql as unknown as LedgerDb;

  try {
    const found = await findHelperCreator(db, token);
    if (!found.ok) return json({ error: "not_found" }, 404);
    const { creator } = found;
    await touchHelper(db, creator.id);

    const base = { delaySeconds: creator.delaySeconds, replayBufferSeconds: replayBufferNeeded(creator.delaySeconds) };
    if (since === null) return json({ ...base, cursor: await latestEventId(db, creator.id), events: [] });

    const deadline = Date.now() + POLL_WAIT_MS;
    for (;;) {
      const events = await loadHelperEvents(db, creator.id, since);
      if (events.length) return json({ ...base, cursor: events[events.length - 1].id, events });
      if (Date.now() + POLL_STEP_MS > deadline || request.signal.aborted) return json({ ...base, cursor: since, events: [] });
      await sleep(POLL_STEP_MS, request.signal);
    }
  } catch (err) {
    console.error("Clip helper feed failed (migration 0034 run?).", err);
    return json({ error: "unavailable" }, 503);
  }
}

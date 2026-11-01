// Asking Freetip which moments were saved.

export class FatalFeedError extends Error {}

const SOURCES = new Set(["chat", "tip", "goal"]);

// Checks the answer so a changed or broken server never feeds garbage into the cutter.
export function parseFeed(body) {
  if (!body || typeof body !== "object" || !Number.isInteger(body.cursor) || !Array.isArray(body.events)) {
    throw new Error("Freetip sent an answer this helper does not understand. Is the helper up to date?");
  }
  const events = body.events
    .filter(
      (e) =>
        e &&
        Number.isInteger(e.id) &&
        SOURCES.has(e.source) &&
        typeof e.videoId === "string" &&
        typeof e.ageSeconds === "number" &&
        Number.isFinite(e.ageSeconds),
    )
    .map((e) => ({
      id: e.id,
      source: e.source,
      videoId: e.videoId,
      label: typeof e.label === "string" ? e.label : "",
      seconds: Number.isFinite(e.seconds) ? e.seconds : null,
      ageSeconds: Math.max(0, e.ageSeconds),
    }));
  return {
    cursor: body.cursor,
    events,
    delaySeconds: Number.isFinite(body.delaySeconds) ? body.delaySeconds : null,
    replayBufferSeconds: Number.isFinite(body.replayBufferSeconds) ? body.replayBufferSeconds : null,
  };
}

// One poll. `since` null means "I just started: tell me where to begin". The server
// holds the request for up to 20 seconds when there is nothing new.
export async function fetchFeed({ baseUrl, token, since, signal, fetchImpl = fetch }) {
  const url = `${baseUrl}/api/ts-helper/${encodeURIComponent(token)}/events${since === null ? "" : `?since=${since}`}`;
  const res = await fetchImpl(url, { signal, headers: { Accept: "application/json" } });
  if (res.status === 404) throw new FatalFeedError("Freetip does not recognise this helper token. Make a new one on the Timestamps page and update config.json.");
  if (!res.ok) throw new Error(`Freetip answered ${res.status}.`);
  return parseFeed(await res.json());
}

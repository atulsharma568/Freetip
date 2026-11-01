import { readFile } from "node:fs/promises";
import { basename } from "node:path";

// Uploading a clip to the creator's own Discord channel, from this PC. The webhook
// address never goes to Freetip.

const clip = (text, max) => (Array.from(text).length > max ? `${Array.from(text).slice(0, max - 1).join("")}…` : text);

// "Clip for 12:34: Nice shot", with a link that opens the stream at that second when we
// know it. Mentions are switched off so what a viewer typed cannot ping anyone.
export function clipMessage({ time, label, videoId, seconds }) {
  const link = seconds === null || seconds === undefined ? null : `https://youtu.be/${videoId}?t=${Math.floor(seconds)}`;
  const head = time ? `Clip for ${time}` : "Clip";
  const text = `${head}${label ? `: ${label}` : ""}${link ? `\n${link}` : ""}`;
  return { content: clip(text, 1800), allowed_mentions: { parse: [] }, username: "Freetip clips" };
}

// Returns "sent", "too_big", "rate_limited" or "failed". One retry when Discord says to
// wait a moment (under 5 seconds).
export async function uploadClip({ webhook, filePath, message, fetchImpl = fetch }) {
  const bytes = await readFile(filePath);
  for (let attempt = 0; attempt < 2; attempt++) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify(message));
    form.append("files[0]", new Blob([bytes], { type: "video/mp4" }), basename(filePath));
    let res;
    try {
      res = await fetchImpl(webhook, { method: "POST", body: form, signal: AbortSignal.timeout(120_000) });
    } catch {
      return "failed";
    }
    if (res.ok) return "sent";
    if (res.status === 413) return "too_big";
    if (res.status === 429 && attempt === 0) {
      let wait = 1;
      try {
        wait = Number((await res.json()).retry_after) || 1;
      } catch {
        /* no body: wait a second */
      }
      if (wait > 5) return "rate_limited";
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    // Discord also answers 400 (code 40005 or 50045) for a file over the server's limit.
    if (res.status === 400) {
      try {
        const body = await res.json();
        if (body.code === 40005 || body.code === 50045) return "too_big";
      } catch {
        /* fall through */
      }
    }
    return res.status === 429 ? "rate_limited" : "failed";
  }
  return "failed";
}

import { formatOffset, youtubeMomentLink } from "./timestamps";

// Sends a saved moment to the creator's Discord channel through a webhook URL they
// paste (Channel settings, Integrations, Webhooks). No bot and no approval step. The
// URL is a secret, so it is stored encrypted (secret-box.ts) and is only ever used
// from the server.

// Only Discord's own webhook address. Anything else is refused, so a pasted URL can
// never make our server call some other host.
const WEBHOOK_URL = /^https:\/\/(?:(?:www|canary|ptb)\.)?(?:discord|discordapp)\.com\/api\/(?:v\d+\/)?webhooks\/\d{15,25}\/[A-Za-z0-9_-]{20,120}$/;

export const isDiscordWebhookUrl = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 300 && WEBHOOK_URL.test(value);

export type DiscordPayload = {
  username: string;
  allowed_mentions: { parse: never[] };
  embeds: { title: string; url?: string; description: string; color: number; footer?: { text: string } }[];
};

const clip = (text: string, max: number) => (Array.from(text).length > max ? `${Array.from(text).slice(0, max - 1).join("")}…` : text);

// The message for one moment: the stream's title, the time and what was written, with
// a link that opens the stream at that second. `allowed_mentions` is empty so nothing a
// viewer wrote can ping anyone.
export function momentPayload(input: {
  videoId: string;
  streamTitle: string | null;
  seconds: number;
  title: string;
  user: string;
}): DiscordPayload {
  const link = youtubeMomentLink(input.videoId, input.seconds);
  return {
    username: "Freetip timestamps",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: clip(input.streamTitle || "Live stream", 200),
        url: link,
        description: `**${formatOffset(input.seconds)}**${input.title ? `  ${input.title}` : ""}\n[Open at this moment](${link})`,
        color: 0xc6ff3d,
        footer: { text: `Saved by ${input.user}` },
      },
    ],
  };
}

export const testPayload = (): DiscordPayload => ({
  username: "Freetip timestamps",
  allowed_mentions: { parse: [] },
  embeds: [
    {
      title: "Freetip is connected",
      description: "Each !ts in your live chat will show up here with the time and a link to that moment.",
      color: 0xc6ff3d,
    },
  ],
});

export type DiscordResult = "sent" | "failed" | "bad_url";

// One try, plus one retry when Discord says to wait two seconds or less. Fails quietly:
// a Discord problem must never break the chat reply or the saved moment. Short timeout,
// no redirects.
export async function sendToDiscord(
  url: string,
  payload: DiscordPayload,
  doFetch: typeof fetch = fetch,
): Promise<DiscordResult> {
  if (!isDiscordWebhookUrl(url)) return "bad_url";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await doFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "error",
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return "sent";
      if (res.status === 429 && attempt === 0) {
        const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
        const wait = typeof body.retry_after === "number" ? body.retry_after : 1;
        if (wait > 2) return "failed";
        await new Promise((r) => setTimeout(r, wait * 1000));
        continue;
      }
      return "failed";
    } catch {
      return "failed";
    }
  }
  return "failed";
}

"use server";

import { randomBytes } from "crypto";
import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isDiscordWebhookUrl, sendToDiscord, testPayload } from "@/lib/discord-webhook";
import { open, seal, secretBoxAvailable } from "@/lib/secret-box";
import { hashToken } from "@/lib/stream-timestamps";
import { MIN_TIP_PAISE } from "@/lib/money";
import { planFeatures, type FeatureKey } from "@/lib/plans";
import { parseDelay } from "@/lib/timestamps";
import { SITE_URL } from "@/lib/url";
import { createYouTubeClient } from "@/lib/youtube";

// Buttons on /dashboard/timestamps. Only the signed-in creator's own row is touched.

export type TsResult =
  | { status: "ok"; message: string; command?: string }
  | { status: "error"; message: string };

const FAILED: TsResult = { status: "error", message: "Could not do that. Try again shortly." };

// `feature` is the paid feature the button belongs to; null for the buttons that remove
// something (a creator can always clean up after a feature is switched off).
async function creator(feature: FeatureKey | null = "timestamps") {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");
  const db = getDb();
  if (!db) return { ok: false as const, error: { status: "error", message: "Database unavailable. Try again shortly." } as TsResult };
  const [row] = await db<
    { id: string; handle: string | null; yt_refresh_token_enc: string | null; discord_webhook_enc: string | null; paid_features: string[] | null }[]
  >`
    select id::text, handle, yt_refresh_token_enc, discord_webhook_enc, paid_features from users where google_id = ${googleId}
  `;
  if (!row?.handle) return { ok: false as const, error: { status: "error", message: "Claim your handle first." } as TsResult };
  if (feature && !planFeatures(row)[feature]) {
    return { ok: false as const, error: { status: "error", message: "This is not switched on for your account." } as TsResult };
  }
  return { ok: true as const, db, row };
}

// The command to paste into Nightbot. Shown once: only the hash is kept.
const nightbotCommand = (token: string) =>
  `!addcom !ts $(urlfetch ${SITE_URL}/api/ts/${token}?user=$(user)&chatId=$(chatid)&msg=$(querystring))`;

// Makes (or replaces) the secret address. Replacing kills the old command at once.
export async function generateTimestampLink(): Promise<TsResult> {
  try {
    const who = await creator();
    if (!who.ok) return who.error;
    const token = randomBytes(32).toString("base64url");
    await who.db`update users set ts_token_hash = ${hashToken(token)} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Your command is ready. Copy it now: it is not shown again.", command: nightbotCommand(token) };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not make the link (migration 0032 run?).", err);
    return FAILED;
  }
}

export async function saveTimestampDelay(delay: number): Promise<TsResult> {
  try {
    const who = await creator();
    if (!who.ok) return who.error;
    const seconds = parseDelay(delay, -1);
    if (seconds < 0) return { status: "error", message: "Pick a delay between 0 and 120 seconds." };
    await who.db`update users set ts_delay_seconds = ${seconds} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: `Saved. Moments are taken ${seconds} seconds back.` };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not save the delay.", err);
    return FAILED;
  }
}

export async function saveDiscordWebhook(rawUrl: string): Promise<TsResult> {
  try {
    const who = await creator();
    if (!who.ok) return who.error;
    const url = (rawUrl ?? "").trim();
    if (!isDiscordWebhookUrl(url)) {
      return { status: "error", message: "That is not a Discord webhook address. It starts with https://discord.com/api/webhooks/" };
    }
    if (!secretBoxAvailable()) return { status: "error", message: "Not switched on for the site yet." };
    const sent = await sendToDiscord(url, testPayload());
    if (sent !== "sent") return { status: "error", message: "Discord did not accept that address. Check you copied the whole webhook URL." };
    await who.db`update users set discord_webhook_enc = ${seal(url)} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Connected. A test message was sent to your Discord channel." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not save the Discord webhook.", err);
    return FAILED;
  }
}

export async function sendDiscordTest(): Promise<TsResult> {
  try {
    const who = await creator();
    if (!who.ok) return who.error;
    const url = open(who.row.discord_webhook_enc);
    if (!url) return { status: "error", message: "Discord is not connected." };
    const sent = await sendToDiscord(url, testPayload());
    return sent === "sent"
      ? { status: "ok", message: "Test message sent." }
      : { status: "error", message: "Discord did not accept it. The webhook may have been deleted: replace it." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: Discord test failed.", err);
    return FAILED;
  }
}

export async function removeDiscordWebhook(): Promise<TsResult> {
  try {
    const who = await creator(null);
    if (!who.ok) return who.error;
    await who.db`update users set discord_webhook_enc = null where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Discord disconnected." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not remove the Discord webhook.", err);
    return FAILED;
  }
}

// Takes our copy of the YouTube permission away and tells Google to cancel it.
export async function disconnectYouTube(): Promise<TsResult> {
  try {
    const who = await creator(null);
    if (!who.ok) return who.error;
    const token = open(who.row.yt_refresh_token_enc);
    await who.db`
      update users set yt_refresh_token_enc = null, yt_connected_at = null, yt_reconnect_needed = false where id = ${who.row.id}
    `;
    if (token) await createYouTubeClient().revoke(token);
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "YouTube disconnected. Timestamps stop being posted as comments." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not disconnect YouTube.", err);
    return FAILED;
  }
}

// Automatic moments: a tip at or above this many rupees, and every completed goal, add a
// moment by themselves. Null turns them off. Never below the minimum tip.
export async function saveTipMarks(minRupees: number | null): Promise<TsResult> {
  try {
    const who = await creator("tipMarks");
    if (!who.ok) return who.error;
    let paise: number | null = null;
    if (minRupees !== null) {
      if (!Number.isInteger(minRupees) || minRupees * 100 < MIN_TIP_PAISE || minRupees > 1_000_000) {
        return { status: "error", message: `Enter a whole number of rupees, ${MIN_TIP_PAISE / 100} or more.` };
      }
      paise = minRupees * 100;
    }
    await who.db`update users set ts_tip_min_paise = ${paise} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return {
      status: "ok",
      message: paise === null ? "Automatic moments are off." : `On. Tips of ₹${minRupees} or more, and completed goals, add a moment.`,
    };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not save the automatic moments setting (migration 0033 run?).", err);
    return FAILED;
  }
}

export async function saveHighlightsPublic(on: boolean): Promise<TsResult> {
  try {
    const who = await creator("highlightsPage");
    if (!who.ok) return who.error;
    await who.db`update users set ts_public = ${on === true} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: on ? "Public highlights pages are on." : "Public highlights pages are off. Their links stop working." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not save the public pages setting (migration 0033 run?).", err);
    return FAILED;
  }
}

// The private link for the creator's video editor. Shown once; making a new one cancels
// the old one at once.
export async function generateEditorLink(): Promise<TsResult> {
  try {
    const who = await creator("editorLink");
    if (!who.ok) return who.error;
    const token = randomBytes(32).toString("base64url");
    await who.db`update users set ts_editor_token_hash = ${hashToken(token)} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Your editor link is ready. Copy it now: it is not shown again.", command: `${SITE_URL}/editor/${token}` };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not make the editor link (migration 0033 run?).", err);
    return FAILED;
  }
}

// The helper's own secret, for the program on the creator's PC. Shown once; making a new
// one stops the old helper at once. The result's `command` holds the token to paste into
// the helper's config file.
export async function generateHelperToken(): Promise<TsResult> {
  try {
    const who = await creator("clipHelper");
    if (!who.ok) return who.error;
    const token = randomBytes(32).toString("base64url");
    await who.db`update users set ts_helper_token_hash = ${hashToken(token)} where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Your helper token is ready. Copy it now: it is not shown again.", command: token };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not make the helper token (migration 0034 run?).", err);
    return FAILED;
  }
}

export async function removeHelperToken(): Promise<TsResult> {
  try {
    const who = await creator(null);
    if (!who.ok) return who.error;
    await who.db`update users set ts_helper_token_hash = null, ts_helper_seen_at = null where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Helper token removed. The helper stops working." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not remove the helper token.", err);
    return FAILED;
  }
}

export async function removeEditorLink(): Promise<TsResult> {
  try {
    const who = await creator(null);
    if (!who.ok) return who.error;
    await who.db`update users set ts_editor_token_hash = null where id = ${who.row.id}`;
    revalidatePath("/dashboard/timestamps");
    return { status: "ok", message: "Editor link removed. It no longer works." };
  } catch (err) {
    unstable_rethrow(err);
    console.error("Timestamps: could not remove the editor link.", err);
    return FAILED;
  }
}

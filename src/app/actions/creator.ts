"use server";

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { HANDLE_PATTERN } from "@/lib/waitlist";

// Handles that map to existing app routes or would cause confusion.
// Next.js static routes already take precedence over /[handle], but we block
// these at claim time so the handle is never silently unreachable.
const RESERVED = new Set([
  "admin", "dashboard", "signin", "signup", "about", "contact",
  "terms", "privacy", "refunds", "delivery", "pricing", "api",
  "sitemap", "robots", "favicon", "icon", "opengraph",
  "tipsite", "www", "support", "help", "me", "creator", "creators",
  "null", "undefined", "anonymous", "system", "user", "users",
  "settings", "login", "logout", "payments", "billing", "webhook",
  "faq", "static", "security", "official", "staff",
]);

export type HandleState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; handle: string };

export const HANDLE_IDLE: HandleState = { status: "idle" };

export async function setHandle(
  _prev: HandleState,
  form: FormData,
): Promise<HandleState> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const handle = String(form.get("handle") ?? "").toLowerCase().trim();

  if (!HANDLE_PATTERN.test(handle)) {
    return { status: "error", message: "3 to 20 letters, numbers or _" };
  }

  if (RESERVED.has(handle)) {
    return { status: "error", message: "That handle is reserved — try another" };
  }

  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable — try again shortly" };

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  let rows: { handle: string }[];
  try {
    rows = await db<{ handle: string }[]>`
      update users set handle = ${handle}
      where google_id = ${googleId} and handle is null
      returning handle
    `;
  } catch (err: unknown) {
    if (err instanceof Error && err.message.toLowerCase().includes("unique")) {
      return { status: "error", message: "That handle is taken — try another" };
    }
    return { status: "error", message: "Something went wrong — try again shortly" };
  }

  if (!rows.length) return { status: "error", message: "Your handle is already set" };
  redirect("/dashboard");
}

// ── Settings ────────────────────────────────────────────────────────────────

export type SettingsState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok" };

export const SETTINGS_IDLE: SettingsState = { status: "idle" };

export async function saveSettings(
  _prev: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const displayName = String(form.get("display_name") ?? "").trim().slice(0, 50) || null;
  const minTipRupees = parseInt(String(form.get("min_tip") ?? "49"), 10);
  const maxChars = parseInt(String(form.get("message_max_chars") ?? "150"), 10);
  const ttsEnabled = form.get("tts_enabled") === "on";
  const approveBeforePlay = form.get("approve_before_play") === "on";
  const bio = String(form.get("bio") ?? "").trim().slice(0, 160) || null;

  if (!Number.isInteger(minTipRupees) || minTipRupees < 1 || minTipRupees > 1000) {
    return { status: "error", message: "Min tip must be between ₹1 and ₹1,000" };
  }
  if (!Number.isInteger(maxChars) || maxChars < 10 || maxChars > 500) {
    return { status: "error", message: "Message limit must be between 10 and 500 characters" };
  }

  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable — try again shortly" };

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  try {
    await db`
      update users set
        display_name        = ${displayName},
        min_tip_paise       = ${minTipRupees * 100},
        message_max_chars   = ${maxChars},
        tts_enabled         = ${ttsEnabled},
        approve_before_play = ${approveBeforePlay},
        bio                 = ${bio}
      where google_id = ${googleId}
    `;
  } catch {
    return { status: "error", message: "Could not save settings — try again shortly" };
  }

  return { status: "ok" };
}

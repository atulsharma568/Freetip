"use server";

import { createHash, randomBytes } from "crypto";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { HANDLE_PATTERN } from "@/lib/waitlist";
import { ALERT_MODES, type AlertMode } from "@/lib/alerts";
import { SITE_HOST } from "@/lib/site";

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

// ── Payout onboarding ────────────────────────────────────────────────────────

// UPI VPA format: 3+ chars, @, 3+ alpha bank handle. e.g. 9876543210@paytm
const UPI_VPA_PATTERN = /^[a-zA-Z0-9._-]{3,}@[a-zA-Z]{3,}$/;

export type PayoutState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok" };

export const PAYOUT_IDLE: PayoutState = { status: "idle" };

export async function submitPayoutDetails(
  _prev: PayoutState,
  form: FormData,
): Promise<PayoutState> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const legalName = String(form.get("legal_name") ?? "").trim().slice(0, 100);
  const upiVpa = String(form.get("upi_vpa") ?? "").trim().toLowerCase();

  if (!legalName) {
    return { status: "error", message: "Legal name is required" };
  }
  if (!UPI_VPA_PATTERN.test(upiVpa)) {
    return { status: "error", message: "Enter a valid UPI ID, e.g. name@upi" };
  }

  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable — try again shortly" };

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  try {
    await db`
      update users set
        legal_name        = ${legalName},
        upi_vpa           = ${upiVpa},
        onboarding_state  = 'submitted'
      where google_id = ${googleId}
        and onboarding_state in ('not_started', 'rejected')
    `;
  } catch {
    return { status: "error", message: "Could not save details — try again shortly" };
  }

  return { status: "ok" };
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
  const ttsMinRupees = parseInt(String(form.get("tts_min") ?? "49"), 10);
  const approveBeforePlay = form.get("approve_before_play") === "on";
  const bio = String(form.get("bio") ?? "").trim().slice(0, 160) || null;
  const alertMode = String(form.get("alert_mode") ?? "split") as AlertMode;

  if (!ALERT_MODES.includes(alertMode)) {
    return { status: "error", message: "Choose how alerts should play" };
  }
  if (!Number.isInteger(minTipRupees) || minTipRupees < 1 || minTipRupees > 1000) {
    return { status: "error", message: "Min tip must be between ₹1 and ₹1,000" };
  }
  if (!Number.isInteger(ttsMinRupees) || ttsMinRupees < 1 || ttsMinRupees > 1000) {
    return { status: "error", message: "Read-aloud amount must be between ₹1 and ₹1,000" };
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
        tts_min_paise       = ${ttsMinRupees * 100},
        approve_before_play = ${approveBeforePlay},
        alert_mode          = ${alertMode},
        bio                 = ${bio}
      where google_id = ${googleId}
    `;
  } catch {
    return { status: "error", message: "Could not save settings — try again shortly" };
  }

  return { status: "ok" };
}

// ── OBS alerts ──────────────────────────────────────────────────────────────

export type OverlayLinkState =
  | { status: "error"; message: string }
  | { status: "ok"; url: string };

// Makes a new secret link and stores only its hash. The link is shown once; a
// lost or leaked link is replaced by running this again, which kills the old one.
export async function generateOverlayLink(): Promise<OverlayLinkState> {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const googleId = (session.user as { googleId?: string }).googleId;
  if (!googleId) redirect("/signin");

  const db = getDb();
  if (!db) return { status: "error", message: "Database unavailable — try again shortly" };

  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");

  try {
    const rows = await db`
      update users set overlay_token_hash = ${hash}
      where google_id = ${googleId} and handle is not null
      returning id
    `;
    if (!rows.length) return { status: "error", message: "Claim your handle first" };
  } catch {
    return { status: "error", message: "Could not create the link — try again shortly" };
  }

  return { status: "ok", url: `https://${SITE_HOST}/overlay/${token}` };
}

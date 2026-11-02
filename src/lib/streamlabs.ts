import { findBlockedWord } from "./message-filter";
import { ALERT_WINDOW_MS, type AlertMode, type MessageStatus } from "./alerts";
import { SITE_URL } from "./url";
import { secretBoxAvailable } from "./secret-box";

// The Streamlabs bridge: a creator who connects their own Streamlabs account gets each
// paid tip as an alert in their Streamlabs alert box. This file holds the rules (pure,
// unit-tested) and a small client for Streamlabs' API; the database side is in
// streamlabs-outbox.ts. Research and the open questions: docs/streamlabs-bridge-research.md.

export const STREAMLABS_STATE_COOKIE = "streamlabs_connect_state";
export const streamlabsRedirectUri = () => `${SITE_URL}/api/streamlabs/callback`;

const API = "https://streamlabs.com/api/v2.0";
export const STREAMLABS_AUTHORIZE_URL = `${API}/authorize`;
const TOKEN_URL = `${API}/token`;
const ALERTS_URL = `${API}/alerts`;
const USER_URL = `${API}/user`;

// The one permission we ask for: showing an alert. (donations.create is not needed.)
export const STREAMLABS_SCOPE = "alerts.create";

export const streamlabsConfigured = () =>
  Boolean(process.env.STREAMLABS_CLIENT_ID && process.env.STREAMLABS_CLIENT_SECRET) && secretBoxAvailable();

// ---------------------------------------------------------------------------------------
// What is sent
// ---------------------------------------------------------------------------------------

// Streamlabs wants a name of 2 to 25 characters and a message under 255.
export const NAME_MAX = 25;
export const MESSAGE_MAX = 250;

const CONTROLS = new RegExp("[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2066-\\u2069]", "g");
const stripControls = (s: string) => s.replace(CONTROLS, " ");
const squash = (s: string) => stripControls(s).replace(/\s+/g, " ").trim();
// Asterisks mark a "special" coloured token in Streamlabs text; a fan must not be able to
// use them to restyle the alert.
const noStars = (s: string) => s.replace(/\*/g, "");
const cut = (s: string, max: number) => Array.from(s).slice(0, max).join("").trim();

export function alertName(raw: string | null | undefined, anonymous: boolean): string {
  const name = anonymous ? "" : cut(noStars(squash(raw ?? "")), NAME_MAX);
  return Array.from(name).length >= 2 ? name : "Anonymous";
}

// The fan's message, or null when there is none or it has a word the creator banned. Never
// the raw text: control characters out, one line, at most MESSAGE_MAX characters.
export function alertMessage(raw: string | null | undefined, banned: readonly string[]): string | null {
  const text = cut(noStars(squash(raw ?? "")), MESSAGE_MAX);
  if (!text) return null;
  if (findBlockedWord(text, banned)) return null;
  return text;
}

// ₹250 or ₹250.50: whole rupees without the trailing .00.
export function alertAmount(paise: number): string {
  const rupees = paise / 100;
  const text = Number.isInteger(rupees)
    ? rupees.toLocaleString("en-IN")
    : rupees.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `₹${text}`;
}

export interface AlertPayload {
  type: "donation";
  message: string;
  user_message?: string;
  duration: string;
}

// `*name*` and `*amount*` are Streamlabs "special" tokens (they take the alert's accent
// colour); the fan's message goes under it as the second heading.
export function buildAlert(name: string, paise: number, message: string | null): AlertPayload {
  const payload: AlertPayload = {
    type: "donation",
    message: `*${name}* tipped *${alertAmount(paise)}*`,
    duration: "8000",
  };
  if (message) payload.user_message = message;
  return payload;
}

export const TEST_ALERT: AlertPayload = {
  type: "donation",
  message: "*Freetip* test alert",
  user_message: "This is a test. No one tipped you.",
  duration: "6000",
};

// ---------------------------------------------------------------------------------------
// When it is sent
// ---------------------------------------------------------------------------------------

export type SendDecision = "with_message" | "without_message" | "wait" | "too_late";

// Streamlabs takes one alert once, so the message is decided at send time, by the same
// rule the OBS alert uses for the creator's mode:
//   instant        the message plays unless the creator rejected it;
//   split, approve the message plays only once approved; a pending one is waited for.
// A paid pinned message always waits for the creator's yes, even in instant mode. An alert
// older than ALERT_WINDOW_MS (measured from the tip, or from the decision if later) is
// dropped, so a late approval never fires a stale alert in the middle of another stream.
export function sendDecision(input: {
  mode: AlertMode;
  hasMessage: boolean;
  status: MessageStatus;
  pinned: boolean;
  capturedAt: Date;
  decidedAt: Date | null;
  now: Date;
}): SendDecision {
  const reference = input.decidedAt && input.decidedAt > input.capturedAt ? input.decidedAt : input.capturedAt;
  if (input.now.getTime() - reference.getTime() > ALERT_WINDOW_MS) return "too_late";
  if (!input.hasMessage || input.status === "rejected") return "without_message";
  const mode: AlertMode = input.mode === "instant" && input.pinned ? "split" : input.mode;
  if (mode === "instant") return "with_message";
  return input.status === "approved" ? "with_message" : "wait";
}

// Streamlabs advises at most 2 alerts a minute for one creator; keep a little over 30s apart.
export const MIN_GAP_MS = 31_000;
export const MAX_ATTEMPTS = 5;
const BACKOFF_MS = [30_000, 60_000, 120_000, 300_000, 600_000];

// How long to wait before the next try, after `attempts` failures so far (1 or more).
export const retryDelayMs = (attempts: number) =>
  BACKOFF_MS[Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1];

// Refresh a minute early. Unknown expiry (null) is not refreshed up front: a refused token
// is refreshed once and the send tried again.
export function needsRefresh(expiresAt: Date | null, now: Date): boolean {
  return expiresAt !== null && expiresAt.getTime() - now.getTime() < 60_000;
}

// ---------------------------------------------------------------------------------------
// The client
// ---------------------------------------------------------------------------------------

export interface StreamlabsDeps {
  fetch: typeof fetch;
  now: () => Date;
}

export const realStreamlabsDeps = (): StreamlabsDeps => ({
  fetch: (input, init) => fetch(input, init),
  now: () => new Date(),
});

export interface Tokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

function parseTokens(body: unknown, now: Date): Tokens | null {
  const b = (body ?? {}) as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (typeof b.access_token !== "string" || !b.access_token) return null;
  const expiresIn = typeof b.expires_in === "number" && b.expires_in > 0 ? b.expires_in : null;
  return {
    accessToken: b.access_token,
    refreshToken: typeof b.refresh_token === "string" && b.refresh_token ? b.refresh_token : null,
    expiresAt: expiresIn ? new Date(now.getTime() + expiresIn * 1000) : null,
  };
}

async function tokenRequest(
  params: Record<string, string>,
  deps: StreamlabsDeps,
): Promise<{ status: "ok"; tokens: Tokens } | { status: "invalid" } | { status: "error" }> {
  try {
    const res = await deps.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.STREAMLABS_CLIENT_ID ?? "",
        client_secret: process.env.STREAMLABS_CLIENT_SECRET ?? "",
        redirect_uri: streamlabsRedirectUri(),
        ...params,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 400 || res.status === 401) return { status: "invalid" };
    if (!res.ok) return { status: "error" };
    const tokens = parseTokens(await res.json().catch(() => null), deps.now());
    return tokens ? { status: "ok", tokens } : { status: "error" };
  } catch {
    return { status: "error" };
  }
}

export const exchangeCode = (code: string, deps: StreamlabsDeps = realStreamlabsDeps()) =>
  tokenRequest({ grant_type: "authorization_code", code }, deps);

export const refreshTokens = (refreshToken: string, deps: StreamlabsDeps = realStreamlabsDeps()) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, deps);

// The name of the connected account, to show "Connected as ...". Null if Streamlabs will
// not say; the connection still works.
export async function fetchDisplayName(accessToken: string, deps: StreamlabsDeps = realStreamlabsDeps()) {
  try {
    const res = await deps.fetch(USER_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as {
      streamlabs?: { display_name?: unknown };
      twitch?: { display_name?: unknown };
      youtube?: { title?: unknown };
    } | null;
    const name = [body?.streamlabs?.display_name, body?.youtube?.title, body?.twitch?.display_name].find(
      (n): n is string => typeof n === "string" && n.trim() !== "",
    );
    return name ? cut(squash(name), 60) : null;
  } catch {
    return null;
  }
}

export type PostResult =
  | { ok: true }
  // auth: the token was refused. rejected: Streamlabs refused the alert itself (retrying
  // will not help). rate and retry: try again later.
  | { ok: false; kind: "auth" | "rejected" | "rate" | "retry"; status: number | null };

export async function postAlert(
  accessToken: string,
  payload: AlertPayload,
  deps: StreamlabsDeps = realStreamlabsDeps(),
): Promise<PostResult> {
  try {
    const body = new URLSearchParams(payload as unknown as Record<string, string>);
    const res = await deps.fetch(ALERTS_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) return { ok: true };
    if (res.status === 401 || res.status === 403) return { ok: false, kind: "auth", status: res.status };
    if (res.status === 429) return { ok: false, kind: "rate", status: res.status };
    if (res.status >= 400 && res.status < 500) return { ok: false, kind: "rejected", status: res.status };
    return { ok: false, kind: "retry", status: res.status };
  } catch {
    return { ok: false, kind: "retry", status: null };
  }
}

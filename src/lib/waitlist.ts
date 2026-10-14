// Waitlist rules, shared by the forms (for their messages) and the server
// action, which checks every field again before saving anything.

export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type WaitlistField = "email" | "handle" | "channel";

export type WaitlistState =
  | { status: "idle" }
  | { status: "ok" }
  | { status: "invalid"; field: WaitlistField }
  | { status: "rate_limited" }
  | { status: "unavailable" };

export const WAITLIST_IDLE: WaitlistState = { status: "idle" };

const MESSAGES: Record<WaitlistState["status"] | WaitlistField, string> = {
  idle: "",
  ok: "You're on the list. We'll email you when sign-up opens.",
  email: "Enter a valid email address.",
  handle: "Handles use 3 to 20 letters, numbers or underscores.",
  channel: "Use your YouTube channel link, like youtube.com/@yourchannel.",
  invalid: "",
  rate_limited: "Too many tries from this network. Please try again in an hour.",
  unavailable: "The waitlist isn't working right now. Please try again later.",
};

export function waitlistMessage(state: WaitlistState) {
  return MESSAGES[state.status === "invalid" ? state.field : state.status];
}

export type WaitlistEntry = {
  email: string;
  handle: string | null;
  channel: string | null;
  source: "home" | "signup";
};

// Channel links are stored in one form, https://www.youtube.com/@name (or
// /channel/…, /c/…, /user/…), whether someone pastes a full link, leaves
// off https:// or types just their @handle.
const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const CHANNEL_PATH = /^\/(@[\w.%-]{3,}|channel\/[\w-]+|c\/[\w.%-]+|user\/[\w.%-]+)/;

function parseChannel(raw: string): string | null | undefined {
  if (!raw) return null;
  if (raw.length > 200) return undefined;
  const link = raw.startsWith("@") ? `youtube.com/${raw}` : raw;
  try {
    const url = new URL(/^https?:\/\//i.test(link) ? link : `https://${link}`);
    const path = YOUTUBE_HOSTS.has(url.hostname) && url.pathname.match(CHANNEL_PATH);
    return path ? `https://www.youtube.com/${path[1]}` : undefined;
  } catch {
    return undefined;
  }
}

function text(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function parseWaitlist(
  form: FormData,
): { ok: true; entry: WaitlistEntry } | { ok: false; field: WaitlistField } {
  const handle = text(form, "handle").toLowerCase();
  if (handle && !HANDLE_PATTERN.test(handle)) return { ok: false, field: "handle" };

  const email = text(form, "email").toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) return { ok: false, field: "email" };

  const channel = parseChannel(text(form, "channel"));
  if (channel === undefined) return { ok: false, field: "channel" };

  return {
    ok: true,
    entry: {
      email,
      handle: handle || null,
      channel,
      source: text(form, "source") === "signup" ? "signup" : "home",
    },
  };
}

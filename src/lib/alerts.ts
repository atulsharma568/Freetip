// OBS alert rules. Pure, so they can be tested without a database.
//
// Modes (the creator's choice, users.alert_mode):
//   instant: the whole alert plays as soon as the tip is captured.
//   split:   name and amount play at once; the message follows as its own card
//            once the creator approves it.
//   approve: nothing plays until the creator decides on the message.
// A rejected message is never shown. In approve mode the tipper is still thanked.

export type AlertMode = "instant" | "split" | "approve";
export type MessageStatus = "pending" | "approved" | "rejected";

export const ALERT_MODES: readonly AlertMode[] = ["instant", "split", "approve"];
export const DEFAULT_ALERT_MODE: AlertMode = "split";

// An alert older than this is dropped, so opening the overlay late doesn't
// replay an hour of tips.
export const ALERT_WINDOW_MS = 60 * 60 * 1000;

// 32 random bytes, base64url.
export const OVERLAY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export interface TipRow {
  id: number;
  fan_name: string | null;
  fan_message: string | null;
  gross_amount_minor: string | number; // bigint comes back from postgres as a string
  message_status: MessageStatus;
  captured_at: Date;
  message_decided_at: Date | null;
  alert_shown_at: Date | null;
  message_shown_at: Date | null;
  // The fan asked for this message to be pinned (paid highlighted messages). Only set by
  // the overlay route while the creator's switch is on at play time.
  highlight?: boolean;
}

export interface Pick {
  id: number;
  kind: "alert" | "message";
  withMessage: boolean;
}

export function pickNext(mode: AlertMode, rows: TipRow[], now: Date): Pick | null {
  const fresh = (t: Date) => now.getTime() - t.getTime() <= ALERT_WINDOW_MS;
  const ordered = [...rows].sort((a, b) => a.captured_at.getTime() - b.captured_at.getTime());

  for (const r of ordered) {
    const hasMessage = !!r.fan_message?.trim();
    const approved = r.message_status === "approved";
    const decided = r.message_status !== "pending";
    // A pinned message always waits for the creator's yes, even in instant mode: that tip
    // plays like split mode (name and amount now, the message once approved).
    const rowMode: AlertMode = mode === "instant" && r.highlight ? "split" : mode;

    if (!r.alert_shown_at) {
      if (rowMode === "instant") {
        if (fresh(r.captured_at)) {
          return { id: r.id, kind: "alert", withMessage: hasMessage && r.message_status !== "rejected" };
        }
      } else if (rowMode === "split") {
        if (fresh(r.captured_at)) {
          return { id: r.id, kind: "alert", withMessage: hasMessage && approved };
        }
      } else if (!hasMessage || decided) {
        if (fresh(r.message_decided_at ?? r.captured_at)) {
          return { id: r.id, kind: "alert", withMessage: hasMessage && approved };
        }
      }
    } else if (!r.message_shown_at && hasMessage && approved && r.message_decided_at) {
      if (fresh(r.message_decided_at)) {
        return { id: r.id, kind: "message", withMessage: true };
      }
    }
  }
  return null;
}

// What the tip page's success screen may promise the fan. With no message the
// tip plays at once in every mode; with one, the creator's mode decides when it
// shows. Keep this in step with the rules above.
export function tipThanksLine(anonymous: boolean, message: string, mode: AlertMode, pinned = false): string {
  const hasMessage = message.trim().length > 0;
  // A pinned message always waits for the creator's yes, whatever their mode.
  if (hasMessage && pinned) {
    return mode === "approve"
      ? "They'll see your tip and message once they approve it."
      : "Your tip shows on stream now. Your message is pinned once they approve it.";
  }
  if (!hasMessage) return anonymous ? "Your tip is on its way." : "They'll see your tip on stream.";
  if (mode === "approve") return "They'll see your tip and message once they approve it.";
  if (mode === "split") return "Your tip shows on stream now. Your message shows once they approve it.";
  return anonymous ? "Your tip is on its way." : "They'll see your message on stream.";
}

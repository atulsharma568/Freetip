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

    if (!r.alert_shown_at) {
      if (mode === "instant") {
        if (fresh(r.captured_at)) {
          return { id: r.id, kind: "alert", withMessage: hasMessage && r.message_status !== "rejected" };
        }
      } else if (mode === "split") {
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

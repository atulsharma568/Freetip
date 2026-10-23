import { expect, test } from "@playwright/test";
import {
  ALERT_WINDOW_MS,
  OVERLAY_TOKEN_PATTERN,
  pickNext,
  type TipRow,
} from "../src/lib/alerts";

const now = new Date("2026-10-23T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

function tip(over: Partial<TipRow> = {}): TipRow {
  return {
    id: 1,
    fan_name: "Rahul",
    fan_message: "great stream",
    gross_amount_minor: "10000",
    message_status: "pending",
    captured_at: ago(5_000),
    message_decided_at: null,
    alert_shown_at: null,
    message_shown_at: null,
    ...over,
  };
}

test.describe("overlay alert rules", () => {
  test("instant: shows the whole alert straight away, message included", () => {
    expect(pickNext("instant", [tip()], now)).toEqual({
      id: 1,
      kind: "alert",
      withMessage: true,
    });
  });

  test("instant: a rejected message is never shown", () => {
    const row = tip({ message_status: "rejected" });
    expect(pickNext("instant", [row], now)?.withMessage).toBe(false);
  });

  test("split: shows name and amount first, message held until approved", () => {
    expect(pickNext("split", [tip()], now)).toEqual({
      id: 1,
      kind: "alert",
      withMessage: false,
    });
  });

  test("split: message follows as its own card once approved", () => {
    const row = tip({
      alert_shown_at: ago(60_000),
      message_status: "approved",
      message_decided_at: ago(1_000),
    });
    expect(pickNext("split", [row], now)).toEqual({
      id: 1,
      kind: "message",
      withMessage: true,
    });
  });

  test("split: approved before the alert plays means one alert with the message", () => {
    const row = tip({ message_status: "approved", message_decided_at: ago(1_000) });
    expect(pickNext("split", [row], now)?.withMessage).toBe(true);
  });

  test("split: a rejected message produces no follow-up", () => {
    const row = tip({
      alert_shown_at: ago(60_000),
      message_status: "rejected",
      message_decided_at: ago(1_000),
    });
    expect(pickNext("split", [row], now)).toBeNull();
  });

  test("approve: whole alert waits while the message is pending", () => {
    expect(pickNext("approve", [tip()], now)).toBeNull();
  });

  test("approve: plays with the message once approved", () => {
    const row = tip({ message_status: "approved", message_decided_at: ago(1_000) });
    expect(pickNext("approve", [row], now)).toEqual({
      id: 1,
      kind: "alert",
      withMessage: true,
    });
  });

  test("approve: a rejected message still thanks the tipper, without the message", () => {
    const row = tip({ message_status: "rejected", message_decided_at: ago(1_000) });
    expect(pickNext("approve", [row], now)).toEqual({
      id: 1,
      kind: "alert",
      withMessage: false,
    });
  });

  test("approve: a tip with no message needs no approval", () => {
    const row = tip({ fan_message: null });
    expect(pickNext("approve", [row], now)).toEqual({
      id: 1,
      kind: "alert",
      withMessage: false,
    });
  });

  test("a blank message counts as no message", () => {
    const row = tip({ fan_message: "   " });
    expect(pickNext("instant", [row], now)?.withMessage).toBe(false);
  });

  test("old tips are not replayed when the overlay is opened late", () => {
    const row = tip({ captured_at: ago(ALERT_WINDOW_MS + 1_000) });
    expect(pickNext("instant", [row], now)).toBeNull();
  });

  test("approve: the window runs from the approval, not from the tip", () => {
    const row = tip({
      captured_at: ago(ALERT_WINDOW_MS * 3),
      message_status: "approved",
      message_decided_at: ago(1_000),
    });
    expect(pickNext("approve", [row], now)?.kind).toBe("alert");
  });

  test("already shown alerts are skipped and the oldest ready one goes first", () => {
    const rows = [
      tip({ id: 3, captured_at: ago(1_000) }),
      tip({ id: 1, alert_shown_at: ago(30_000), message_shown_at: ago(30_000) }),
      tip({ id: 2, captured_at: ago(2_000) }),
    ];
    expect(pickNext("instant", rows, now)?.id).toBe(2);
  });

  test("overlay token must be 43 url-safe characters", () => {
    expect(OVERLAY_TOKEN_PATTERN.test("a".repeat(43))).toBe(true);
    expect(OVERLAY_TOKEN_PATTERN.test("a".repeat(42))).toBe(false);
    expect(OVERLAY_TOKEN_PATTERN.test(`${"a".repeat(42)}/`)).toBe(false);
    expect(OVERLAY_TOKEN_PATTERN.test("preview")).toBe(false);
  });
});

import { expect, test } from "@playwright/test";
import { STREAM_GAP_MS, groupStreams, recapSummaryText, type RecapTip } from "../src/lib/stream-recap";

const T0 = Date.UTC(2026, 10, 1, 14, 0, 0);
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function tip(minutes: number, name: string | null, rupees: number): RecapTip {
  return { capturedAt: new Date(T0 + minutes * MIN), name, amountPaise: rupees * 100 };
}

// A "now" far after every tip, so nothing is ongoing unless a test says so.
const LATER = new Date(T0 + 48 * HOUR);

test.describe("stream recap grouping", () => {
  test("no tips, no streams", () => {
    expect(groupStreams([], LATER)).toEqual([]);
  });

  test("tips close together are one stream; a long gap starts a new one, newest first", () => {
    const streams = groupStreams(
      [tip(0, "Riya", 100), tip(30, "Aman", 50), tip(30 + 4 * 60, "Riya", 200), tip(30 + 4 * 60 + 10, "Zoya", 20)],
      LATER,
    );
    expect(streams.map((s) => s.tips)).toEqual([2, 2]);
    expect(streams[0].grossPaise).toBe(22000);
    expect(streams[1].grossPaise).toBe(15000);
  });

  test("a gap of exactly the limit stays in the stream, one minute over splits it", () => {
    const atLimit = groupStreams([tip(0, "A", 10), tip(STREAM_GAP_MS / MIN, "B", 10)], LATER);
    expect(atLimit).toHaveLength(1);
    const over = groupStreams([tip(0, "A", 10), tip(STREAM_GAP_MS / MIN + 1, "B", 10)], LATER);
    expect(over).toHaveLength(2);
  });

  test("the order the tips arrive in does not matter", () => {
    const a = groupStreams([tip(0, "A", 10), tip(10, "B", 20), tip(600, "C", 30)], LATER);
    const b = groupStreams([tip(600, "C", 30), tip(10, "B", 20), tip(0, "A", 10)], LATER);
    expect(b).toEqual(a);
  });

  test("totals, biggest tip and the creator's share use the tips list's rounding", () => {
    const [s] = groupStreams([tip(0, "A", 100), tip(5, "B", 12.5)], LATER);
    expect(s.grossPaise).toBe(11250);
    expect(s.biggest).toEqual({ name: "A", amountPaise: 10000 });
    // 10000 -> 9200 and 1250 -> 1149, as in the earnings tests.
    expect(s.sharePaise).toBe(9200 + 1149);
  });

  test("the same name in a different case or spacing is one supporter", () => {
    const [s] = groupStreams([tip(0, "Riya", 100), tip(5, "  riya ", 50), tip(10, "Aman", 10)], LATER);
    expect(s.supporters).toBe(2);
    expect(s.topSupporters[0]).toMatchObject({ tips: 2, totalPaise: 15000 });
  });

  test("anonymous and blank names are counted apart and never a supporter", () => {
    const [s] = groupStreams([tip(0, null, 500), tip(5, "   ", 20), tip(10, "Aman", 10)], LATER);
    expect(s.anonymousTips).toBe(2);
    expect(s.supporters).toBe(1);
    expect(s.biggest).toEqual({ name: "Anonymous", amountPaise: 50000 });
    expect(s.topSupporters.map((x) => x.name)).toEqual(["Aman"]);
  });

  test("top supporters are the three biggest by total", () => {
    const [s] = groupStreams(
      [tip(0, "A", 10), tip(1, "B", 40), tip(2, "C", 30), tip(3, "D", 20), tip(4, "A", 15)],
      LATER,
    );
    expect(s.topSupporters.map((x) => x.name)).toEqual(["B", "C", "A"]);
  });

  test("ongoing only while the last tip is under the gap old", () => {
    const tips = [tip(0, "A", 10)];
    expect(groupStreams(tips, new Date(T0 + 2 * HOUR))[0].ongoing).toBe(true);
    expect(groupStreams(tips, new Date(T0 + 3 * HOUR))[0].ongoing).toBe(false);
  });
});

test.describe("recap summary text", () => {
  test("has numbers only, never a fan name", () => {
    const [s] = groupStreams([tip(0, "Riya", 100), tip(5, null, 250)], LATER);
    const text = recapSummaryText(s, "Sun 1 Nov");
    expect(text).toContain("Stream recap, Sun 1 Nov");
    expect(text).toContain("2 tips from 1 supporter");
    expect(text).toContain("Biggest tip: ₹250.00");
    expect(text).toContain("1 tip was anonymous");
    expect(text).not.toContain("Riya");
  });

  test("uses singular words for one tip", () => {
    const [s] = groupStreams([tip(0, "Riya", 100)], LATER);
    expect(recapSummaryText(s, "Sun 1 Nov")).toContain("1 tip from 1 supporter");
  });
});

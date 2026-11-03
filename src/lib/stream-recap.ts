import { estimateShare, formatRupees } from "./earnings";
import type { FeeRates } from "./money";

// Post-stream recap. We never learn when a creator goes live, only when tips
// arrive, so a "stream" here is a run of paid tips with no gap longer than
// STREAM_GAP_MS between one tip and the next. Nothing is stored: the recap is
// worked out from the captured tips each time the page opens.
export const STREAM_GAP_MS = 3 * 60 * 60 * 1000;

// How far back the recap page reads, and how many streams it lists.
export const RECAP_DAYS = 30;
export const RECAP_MAX_STREAMS = 5;
export const RECAP_MAX_TIPS = 5000;

export interface RecapTip {
  capturedAt: Date;
  // The fan's name as typed; null or blank is an anonymous tip.
  name: string | null;
  amountPaise: number;
  // The rates the tip was charged at; the standard pair when not given.
  rates?: FeeRates;
}

export interface RecapSupporter {
  name: string;
  tips: number;
  totalPaise: number;
}

export interface StreamRecap {
  start: Date;
  end: Date;
  tips: number;
  grossPaise: number;
  // Sum of the per-tip estimate, the same rounding as the tips list.
  sharePaise: number;
  // Distinct named fans (same name, ignoring case and spacing, counts once).
  supporters: number;
  anonymousTips: number;
  biggest: { name: string; amountPaise: number };
  topSupporters: RecapSupporter[];
  // The last tip was under STREAM_GAP_MS ago, so more tips may still join it.
  ongoing: boolean;
}

function fanKey(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

function summarise(tips: RecapTip[], now: Date): StreamRecap {
  let grossPaise = 0;
  let sharePaise = 0;
  let anonymousTips = 0;
  let biggest = { name: "Anonymous", amountPaise: -1 };
  const fans = new Map<string, RecapSupporter>();

  for (const t of tips) {
    const shown = t.name?.trim() || "";
    grossPaise += t.amountPaise;
    sharePaise += estimateShare(t.amountPaise, t.rates);
    if (t.amountPaise > biggest.amountPaise) {
      biggest = { name: shown || "Anonymous", amountPaise: t.amountPaise };
    }
    if (!shown) {
      anonymousTips += 1;
      continue;
    }
    const key = fanKey(shown);
    const fan = fans.get(key);
    if (fan) {
      fan.tips += 1;
      fan.totalPaise += t.amountPaise;
    } else {
      fans.set(key, { name: shown, tips: 1, totalPaise: t.amountPaise });
    }
  }

  const first = tips[0].capturedAt;
  const last = tips[tips.length - 1].capturedAt;
  return {
    start: first,
    end: last,
    tips: tips.length,
    grossPaise,
    sharePaise,
    supporters: fans.size,
    anonymousTips,
    biggest,
    topSupporters: [...fans.values()]
      .sort((a, b) => b.totalPaise - a.totalPaise || b.tips - a.tips || a.name.localeCompare(b.name))
      .slice(0, 3),
    ongoing: now.getTime() - last.getTime() < STREAM_GAP_MS,
  };
}

// Splits tips (any order) into streams, newest stream first.
export function groupStreams(tips: RecapTip[], now: Date = new Date()): StreamRecap[] {
  const sorted = [...tips].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
  const runs: RecapTip[][] = [];
  for (const tip of sorted) {
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    if (run && prev && tip.capturedAt.getTime() - prev.capturedAt.getTime() <= STREAM_GAP_MS) run.push(tip);
    else runs.push([tip]);
  }
  return runs.map((run) => summarise(run, now)).reverse();
}

// The text behind the "Copy summary" button. Numbers only: no fan name or
// message leaves the dashboard unless the creator types it themselves, because
// fans agreed to be named on the stream alert, not in a post.
export function recapSummaryText(r: StreamRecap, dayLabel: string): string {
  const lines = [
    `Stream recap, ${dayLabel}`,
    `${r.tips} ${r.tips === 1 ? "tip" : "tips"} from ${r.supporters} ${r.supporters === 1 ? "supporter" : "supporters"}, ${formatRupees(r.grossPaise)} in all.`,
    `Biggest tip: ${formatRupees(r.biggest.amountPaise)}.`,
  ];
  if (r.anonymousTips > 0) {
    lines.push(`${r.anonymousTips} ${r.anonymousTips === 1 ? "tip was" : "tips were"} anonymous.`);
  }
  return lines.join("\n");
}

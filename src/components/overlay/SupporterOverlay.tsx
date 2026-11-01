"use client";

import { useEffect, useState } from "react";
import type { RecentSupporter, Streak, TopSupporter } from "@/lib/supporters";

export type SupporterKind = "streak" | "top" | "recent";

type Data = { streak?: Streak; top?: TopSupporter | null; recent?: RecentSupporter[] };

const POLL_MS = 5000;

const rupees = (paise: number) => Math.floor(paise / 100).toLocaleString("en-IN");

const CARD: React.CSSProperties = {
  position: "absolute",
  left: "3%",
  top: "4%",
  maxWidth: "min(92%, 560px)",
  padding: "16px 22px",
  borderRadius: 18,
  background: "rgba(10,10,10,0.82)",
  color: "#fff",
  fontFamily: "system-ui, sans-serif",
};
const LABEL: React.CSSProperties = { fontSize: 18, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.7 };
const ACCENT = "var(--ov-accent, #bfe84a)";

// One of the three supporter overlays. Polls /api/overlay/<token>/supporters and draws
// nothing while there is nothing to show (or while the feature is switched off for the
// creator), so an OBS source can stay in the scene.
export function SupporterOverlay({ token, kind }: { token: string; kind: SupporterKind }) {
  const [data, setData] = useState<Data>({});
  // The streak countdown ticks here every second; the server only sends the seconds left.
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const res = await fetch(`/api/overlay/${token}/supporters`, { cache: "no-store" });
        if (!stop && res.ok) {
          const next = (await res.json()) as Data;
          setData(next);
          setLeft(next.streak?.remainingSeconds ?? 0);
        }
      } catch {
        // Keep what is on screen through a network blip.
      }
      if (!stop) timer = setTimeout(poll, POLL_MS);
    }
    poll();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [token]);

  useEffect(() => {
    if (kind !== "streak") return;
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(tick);
  }, [kind]);

  if (kind === "streak") {
    const streak = data.streak;
    if (!streak || streak.count === 0 || left <= 0) return null;
    const pct = Math.min(100, (left / streak.windowSeconds) * 100);
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, "0");
    return (
      <div data-testid="support-streak" style={CARD}>
        <div style={LABEL}>Support streak</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 4 }}>
          <span style={{ fontSize: 56, fontWeight: 700, color: ACCENT, lineHeight: 1 }}>{streak.count}</span>
          <span style={{ fontSize: 26, fontWeight: 600 }}>
            {streak.count === 1 ? "tip" : "tips"} · {mm}:{ss} left
          </span>
        </div>
        <div style={{ marginTop: 12, height: 10, borderRadius: 6, background: "rgba(255,255,255,0.18)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: ACCENT, transition: "width 1s linear" }} />
        </div>
      </div>
    );
  }

  if (kind === "top") {
    if (!data.top) return null;
    return (
      <div data-testid="top-supporter" style={CARD}>
        <div style={LABEL}>Top supporter</div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, marginTop: 4, fontSize: 30, fontWeight: 700 }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.top.name}</span>
          <span style={{ color: ACCENT, whiteSpace: "nowrap" }}>₹{rupees(data.top.totalPaise)}</span>
        </div>
      </div>
    );
  }

  const recent = data.recent ?? [];
  if (recent.length === 0) return null;
  return (
    <div data-testid="recent-supporters" style={{ ...CARD, minWidth: 320 }}>
      <div style={LABEL}>Recent supporters</div>
      <ol style={{ listStyle: "none", margin: "8px 0 0", padding: 0, display: "grid", gap: 6 }}>
        {recent.map((r, i) => (
          <li key={i} style={{ display: "flex", justifyContent: "space-between", gap: 24, fontSize: 24, fontWeight: 600 }}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
            <span style={{ color: ACCENT, whiteSpace: "nowrap" }}>₹{rupees(r.amountPaise)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

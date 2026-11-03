"use client";

import { useState } from "react";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { validateLadder } from "@/lib/page-doc/edit";
import { LIMITS } from "@/lib/page-doc/blocks";
import { ONE_PIECE_LADDER } from "@/lib/page-doc/ladder";
import type { Ladder } from "@/lib/page-doc/types";

interface Row {
  name: string;
  // Whole percent the rank runs up to (the last one is always 100).
  pct: string;
}

const toRows = (ladder: Ladder): Row[] => ladder.levels.map((l) => ({ name: l.name, pct: String(Math.round(l.upTo * 100)) }));

function toLadder(top: string, rows: Row[]): Ladder {
  return {
    topRupees: top.trim() === "" ? Number.NaN : Number(top),
    levels: rows.map((r, i) => ({ name: r.name, upTo: i === rows.length - 1 ? 1 : r.pct.trim() === "" ? Number.NaN : Number(r.pct) / 100 })),
  };
}

// The words under the amount bar: where the bar is full, and each rank with the share of the bar
// it runs up to. A ladder is applied to the draft only when it is valid; until then the page keeps
// the last good one and the reasons are shown here.
// The Pressure meter has its own words (variant "meter"): always on, no rupee top, measured in
// percent of the goal. It is given a ladder whose top is a stand-in (100) that is never shown.
export function LadderEditor({
  ladder,
  onChange,
  variant = "amount",
}: {
  ladder: Ladder | null;
  onChange: (ladder: Ladder | null) => void;
  variant?: "amount" | "meter";
}) {
  const meter = variant === "meter";
  const [top, setTop] = useState(String(ladder?.topRupees ?? ONE_PIECE_LADDER.topRupees));
  const [rows, setRows] = useState<Row[]>(toRows(ladder ?? ONE_PIECE_LADDER));
  const [problems, setProblems] = useState<string[]>([]);
  // What this editor last put in the draft. When the ladder in the draft is something else (a
  // reset, a revert), the fields are reset to it, during the render rather than in an effect.
  const [applied, setApplied] = useState(JSON.stringify(ladder));
  if (JSON.stringify(ladder) !== applied) {
    setApplied(JSON.stringify(ladder));
    if (ladder) {
      setTop(String(ladder.topRupees));
      setRows(toRows(ladder));
    }
    setProblems([]);
  }

  function apply(nextTop: string, nextRows: Row[]) {
    setTop(nextTop);
    setRows(nextRows);
    const candidate = toLadder(nextTop, nextRows);
    const found = validateLadder(candidate);
    setProblems(found);
    if (found.length === 0) {
      setApplied(JSON.stringify(candidate));
      onChange(candidate);
    }
  }

  function setBar(on: boolean) {
    if (!on) {
      setApplied(JSON.stringify(null));
      setProblems([]);
      onChange(null);
    } else apply(top, rows);
  }

  function useStandard() {
    setTop(String(ONE_PIECE_LADDER.topRupees));
    setRows(toRows(ONE_PIECE_LADDER));
    setProblems([]);
    setApplied(JSON.stringify(ONE_PIECE_LADDER));
    onChange(structuredClone(ONE_PIECE_LADDER));
  }

  function addRank() {
    const before = Number(rows[rows.length - 2]?.pct ?? 0);
    if (rows.length >= LIMITS.levels.max || !(before < 99)) return;
    const next = rows.slice();
    next.splice(rows.length - 1, 0, { name: "New rank", pct: String(Math.min(99, Math.round((before + 100) / 2))) });
    apply(top, next);
  }

  function removeRank(i: number) {
    if (rows.length <= LIMITS.levels.min) return;
    apply(top, rows.filter((_, at) => at !== i));
  }

  return (
    <fieldset className="space-y-3 rounded-surface border border-control p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">{meter ? "Rank words" : "Rank bar"}</legend>
      {!meter && (
        <label className="flex items-center gap-3 text-sm text-text">
          <input type="checkbox" checked={ladder !== null} onChange={(e) => setBar(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
          Show the rank bar under the amount
        </label>
      )}
      {ladder !== null && (
        <>
          {!meter && (
            <label className="block space-y-1 text-xs text-muted">
              The bar is full at (₹)
              <input
                inputMode="numeric"
                value={top}
                onChange={(e) => apply(e.target.value.replace(/[^0-9]/g, ""), rows)}
                className={`${FIELD_CLASS} numeric block w-full`}
              />
            </label>
          )}
          <ol className="space-y-2">
            {rows.map((row, i) => {
              const last = i === rows.length - 1;
              return (
                <li key={i} className="flex items-end gap-2">
                  <label className="min-w-0 flex-1 space-y-1 text-xs text-muted">
                    Rank {i + 1}
                    <input
                      value={row.name}
                      maxLength={LIMITS.levelName}
                      onChange={(e) => apply(top, rows.map((r, at) => (at === i ? { ...r, name: e.target.value } : r)))}
                      className={`${FIELD_CLASS} block w-full`}
                    />
                  </label>
                  <label className="w-20 space-y-1 text-xs text-muted">
                    Up to %
                    <input
                      inputMode="numeric"
                      value={last ? "100" : row.pct}
                      disabled={last}
                      onChange={(e) => apply(top, rows.map((r, at) => (at === i ? { ...r, pct: e.target.value.replace(/[^0-9]/g, "") } : r)))}
                      className={`${FIELD_CLASS} numeric block w-full disabled:opacity-60`}
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove rank ${i + 1}`}
                    disabled={rows.length <= LIMITS.levels.min}
                    onClick={() => removeRank(i)}
                    className={buttonClass("quiet", "sm")}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={addRank} disabled={rows.length >= LIMITS.levels.max} className={buttonClass("quiet", "sm")}>
              Add a rank
            </button>
            <button type="button" onClick={useStandard} className={buttonClass("quiet", "sm")}>
              Use the standard words
            </button>
          </div>
        </>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-warn">
          {problems.map((p) => (
            <li key={p}>
              <span aria-hidden="true">● </span>
              {p}
            </li>
          ))}
          <li className="text-muted">The page keeps the last good version until this is fixed.</li>
        </ul>
      )}
    </fieldset>
  );
}

"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { RateFields, useRateFields } from "@/components/admin/RateFields";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { TickLoader } from "@/components/ui/TickLoader";
import { ADMIN_IDLE, type AdminAction } from "@/lib/admin/action-state";
import { describeRates, keepOfHundred } from "@/lib/fee-rates";
import type { FeeRates } from "@/lib/money";

export interface FeeHistoryLine {
  at: string;
  from: string;
  to: string;
  reason: string | null;
}

// One creator's rates: follow the site rates, or have their own pair. Takes effect on tips made
// after saving; earlier tips keep the rate they were made under (said on the box, because it is the
// first question anyone asks).
export function FeeRatesBox({
  action,
  site,
  override,
  history,
}: {
  action: AdminAction;
  site: FeeRates;
  override: FeeRates | null;
  history: FeeHistoryLine[];
}) {
  const [state, formAction, pending] = useActionState(action, ADMIN_IDLE);
  const [mode, setMode] = useState<"site" | "own">(override ? "own" : "site");
  const fields = useRateFields(override ?? site);
  const current = override ?? site;
  const radio = "h-4 w-4 accent-[var(--color-accent)]";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Pays now: <span className="numeric text-text">{describeRates(current)}</span>
        {override ? " (own rates)" : " (the site rates)"}; keeps{" "}
        <span className="numeric text-text">{keepOfHundred(current)}</span> of a ₹100 tip.
      </p>

      <form action={formAction} className="space-y-4 rounded-surface border border-control bg-surface p-4">
        <fieldset className="space-y-3">
          <legend className="sr-only">Which rates this creator pays</legend>
          <label className="flex items-start gap-3 text-sm text-text">
            <input type="radio" name="mode" value="site" checked={mode === "site"} onChange={() => setMode("site")} className={`mt-1 ${radio}`} />
            <span>
              Follow the site rates
              <span className="block text-xs text-muted">
                Now {describeRates(site)}. If you change the site rates later, this creator moves with them.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-text">
            <input type="radio" name="mode" value="own" checked={mode === "own"} onChange={() => setMode("own")} className={`mt-1 ${radio}`} />
            <span>
              Their own rates
              <span className="block text-xs text-muted">Stays as typed, whatever the site rates become. 0 and 0 means no fees.</span>
            </span>
          </label>
        </fieldset>

        <RateFields state={fields} idPrefix="creator" disabled={mode !== "own"} />

        <label className="block space-y-1 text-xs text-muted">
          Reason (optional, kept in the audit history)
          <input name="reason" maxLength={300} className={`${FIELD_CLASS} block w-full max-w-md`} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending || (mode === "own" && !fields.parsed.ok)}
            className={buttonClass("primary", "md")}
          >
            {pending ? (
              <>
                <TickLoader count={6} duration={0.6} />
                Saving…
              </>
            ) : (
              "Save rates"
            )}
          </button>
          <p className="text-xs text-muted">Reaches tips made after you save. Tips already made keep the rate they were made under.</p>
        </div>
        <ActionStatus state={state} />
      </form>

      {history.length > 0 && (
        <ul className="space-y-1 text-xs text-muted">
          {history.map((h, i) => (
            <li key={i}>
              {h.at}: {h.from} → {h.to}
              {h.reason ? ` (${h.reason})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { RateFields, useRateFields } from "@/components/admin/RateFields";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { TONE_BADGE } from "@/components/admin/tones";
import { applyFeeRates } from "@/app/actions/fees";
import { BULK_MAX } from "@/lib/fee-admin";
import { describeRates, effectiveRates, keepOfHundred } from "@/lib/fee-rates";
import type { FeeRow } from "@/lib/admin/fee-queries";
import type { FeeRates } from "@/lib/money";

// The creators on this page, each with the rates they pay now, and a bar for changing the ticked
// ones together. The ticks live here (not in the address), so they are for this page only: moving
// to another page of the list clears them.
export function CreatorFeeTable({ rows, site }: { rows: FeeRow[]; site: FeeRates }) {
  const [picked, setPicked] = useState<Set<number>>(() => new Set());
  const fields = useRateFields({ platformBps: 0, processingBps: 0 });
  const ids = rows.filter((r) => picked.has(r.id)).map((r) => r.id);
  const all = rows.length > 0 && ids.length === rows.length;

  const toggle = (id: number, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const hiddenIds = ids.join(",");
  const tooMany = ids.length > BULK_MAX;

  return (
    <div className="space-y-4">
      <section
        aria-label="Change the ticked creators"
        className="space-y-4 rounded-surface border border-control bg-surface p-4"
      >
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text">
            {ids.length === 0 ? "Change several creators at once" : `Change ${ids.length} ticked creator${ids.length === 1 ? "" : "s"}`}
          </h3>
          <p className="text-xs text-muted">
            Tick creators in the list below, then give them all the same rates, or put them back on the site rates. Only tips made
            afterwards are affected.
          </p>
        </div>
        <RateFields state={fields} idPrefix="bulk" />
        <div className="flex flex-wrap items-start gap-3">
          <ConfirmAction
            action={applyFeeRates}
            label={`Apply these rates to ${ids.length} creator${ids.length === 1 ? "" : "s"}`}
            tone="primary"
            size="md"
            disabled={ids.length === 0 || tooMany || !fields.parsed.ok}
            description={
              fields.parsed.ok
                ? `${ids.length} creator${ids.length === 1 ? "" : "s"} will pay ${describeRates(fields.parsed.rates)} on tips made from now on, replacing whatever they pay now.`
                : "Fix the rates first."
            }
            confirmLabel="Yes, apply"
            pendingLabel="Saving…"
            askReason
            hidden={{ mode: "own", ids: hiddenIds, platform: fields.platform, processing: fields.processing }}
          />
          <ConfirmAction
            action={applyFeeRates}
            label={`Put ${ids.length} back on the site rates`}
            tone="quiet"
            size="md"
            disabled={ids.length === 0 || tooMany}
            description={`${ids.length} creator${ids.length === 1 ? "" : "s"} will pay the site rates (${describeRates(site)} now) on tips made from now on.`}
            confirmLabel="Yes, use the site rates"
            pendingLabel="Saving…"
            askReason
            hidden={{ mode: "site", ids: hiddenIds }}
          />
        </div>
        {tooMany && <p className="text-xs text-bad">Tick at most {BULK_MAX} creators at a time.</p>}
      </section>

      <div data-lenis-prevent className="max-h-[70vh] overflow-auto rounded-surface border border-control">
        <table className="w-full text-sm">
          <caption className="sr-only">Creators with the rates they pay on tips made from now on</caption>
          <thead className="sticky top-0 z-10 bg-raised">
            <tr className="border-b border-control">
              <th scope="col" className="w-10 px-4 py-3 text-left">
                <input
                  type="checkbox"
                  aria-label="Tick every creator on this page"
                  checked={all}
                  onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  className="h-4 w-4 accent-[var(--color-accent)]"
                />
              </th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Pays</th>
              <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Keeps of a ₹100 tip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-control bg-surface">
            {rows.map((r) => {
              const rates = effectiveRates(site, r.override);
              const free = rates.platformBps === 0 && rates.processingBps === 0;
              return (
                <tr key={r.id} className="align-top transition-colors hover:bg-raised">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Tick ${r.name ?? r.email}`}
                      checked={picked.has(r.id)}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                      className="h-4 w-4 accent-[var(--color-accent)]"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/creators/${r.id}`} className="font-medium text-text hover:underline">
                      {r.name ?? r.email}
                    </Link>
                    <p className="numeric text-xs text-muted">{r.handle ?? "no link yet"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.creatorStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="numeric text-text">{describeRates(rates)}</span>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${r.override ? (free ? TONE_BADGE.good : TONE_BADGE.warn) : TONE_BADGE.neutral}`}
                    >
                      {r.override ? (free ? "✓ No fees" : "● Own rates") : "Site rates"}
                    </span>
                  </td>
                  <td className="numeric px-4 py-3 text-text">{keepOfHundred(rates)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { TONE_MARK, TONE_TEXT, FIELD_CLASS } from "@/components/admin/tones";
import { formatPercent, keepOfHundred, parseRates, type ParsedRates } from "@/lib/fee-rates";
import { MAX_PLATFORM_BPS, MAX_PROCESSING_BPS, splitTip, type FeeRates } from "@/lib/money";

// The two boxes the owner types a pair of rates into, kept as text so a half-typed "2." is not
// rewritten under the cursor, with the pair read live (`parsed`). Used by the site-wide card, a
// creator's page and the bulk bar, so all three read the numbers the same way as the server.
export function useRateFields(initial: FeeRates) {
  const [platform, setPlatform] = useState(formatPercent(initial.platformBps));
  const [processing, setProcessing] = useState(formatPercent(initial.processingBps));
  const parsed: ParsedRates = parseRates(platform, processing);
  return { platform, setPlatform, processing, setProcessing, parsed };
}

export type RateFieldState = ReturnType<typeof useRateFields>;

export function RateFields({ state, idPrefix, disabled = false }: { state: RateFieldState; idPrefix: string; disabled?: boolean }) {
  const box = `${FIELD_CLASS} numeric w-28 disabled:opacity-50`;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
      <label htmlFor={`${idPrefix}-platform`} className="space-y-1 text-xs text-muted">
        <span className="block">Platform fee (%)</span>
        <input
          id={`${idPrefix}-platform`}
          name="platform"
          inputMode="decimal"
          autoComplete="off"
          value={state.platform}
          onChange={(e) => state.setPlatform(e.target.value)}
          disabled={disabled}
          aria-describedby={`${idPrefix}-hint`}
          className={box}
        />
      </label>
      <label htmlFor={`${idPrefix}-processing`} className="space-y-1 text-xs text-muted">
        <span className="block">Processing charge (%)</span>
        <input
          id={`${idPrefix}-processing`}
          name="processing"
          inputMode="decimal"
          autoComplete="off"
          value={state.processing}
          onChange={(e) => state.setProcessing(e.target.value)}
          disabled={disabled}
          aria-describedby={`${idPrefix}-hint`}
          className={box}
        />
      </label>
      <RatePreview id={`${idPrefix}-hint`} parsed={state.parsed} />
    </div>
  );
}

// "On a ₹100 tip: ₹92.25 to the creator, ₹5.00 fee, ₹2.75 processing." or what is wrong with the boxes.
export function RatePreview({ parsed, id }: { parsed: ParsedRates; id?: string }) {
  if (!parsed.ok) {
    return (
      <p id={id} role="status" className={`max-w-sm text-xs ${TONE_TEXT.warn}`}>
        <span aria-hidden="true">{TONE_MARK.warn} </span>
        {parsed.error}
      </p>
    );
  }
  const s = splitTip(10000, parsed.rates);
  const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;
  return (
    <p id={id} className="max-w-sm text-xs text-muted">
      On a ₹100 tip the creator keeps <span className="numeric text-text">{keepOfHundred(parsed.rates)}</span> (
      <span className="numeric">{rupees(s.platformFeePaise)}</span> fee, <span className="numeric">{rupees(s.processingPaise)}</span>{" "}
      processing). Allowed: up to {MAX_PLATFORM_BPS / 100}% and {MAX_PROCESSING_BPS / 100}%.
    </p>
  );
}

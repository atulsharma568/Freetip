"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "@phosphor-icons/react";
import { perMonthOfYear, yearSaving, type PlanKey, type TierPrices } from "@/lib/pricing";
import { BuyPass, type BuyOption } from "./BuyPass";
import { pillOutline, pillPrimary } from "../parts/styles";
import { TermSwitch } from "./TermSwitch";

// What the Buy button of a plan can do right now, worked out on the server:
//  - open: the creator can buy it (`options` is what each term costs this creator now);
//  - soon: not for sale yet (no PayU keys, prices not confirmed, or test mode for someone else).
export type BuyState =
  | { kind: "open"; options: Record<1 | 12, BuyOption>; renewing: boolean }
  | { kind: "soon" };

export interface PlanCard {
  plan: PlanKey;
  name: string;
  tagline: string;
  prices: TierPrices;
  buy: BuyState;
  // Plain words about this creator's running pass of the plan, or null.
  status: string | null;
  // A line under the price that is only about this plan (Creator covering Starter), or null.
  note: string | null;
  // Whether an early seat is still on offer: null while nothing can be bought (the line is then
  // shown as the plan's standing offer).
  earlyOpen: boolean | null;
}

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

const cardBox = "flex flex-col gap-5 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5";

// Both prices are always on the card; the 1 month / 12 months switch only picks which one is bought
// (the picked one is the big line).
function Price({ prices, term, earlyOpen }: { prices: TierPrices; term: 1 | 12; earlyOpen: boolean | null }) {
  const saving = yearSaving(prices.monthly, prices.yearly);
  const big = "text-3xl font-semibold tabular-nums text-text";
  const small = "text-lg font-medium tabular-nums text-muted";
  return (
    <div className="space-y-2">
      <p>
        <span className={term === 1 ? big : small}>{rupees(prices.monthly)}</span>
        <span className="text-sm text-muted"> a month</span>
      </p>
      <div>
        <p>
          <span className={term === 12 ? big : small}>{rupees(prices.yearly)}</span>
          <span className="text-sm text-muted"> a year</span>
        </p>
        <p className="text-xs text-muted">
          {rupees(perMonthOfYear(prices.yearly))} a month{saving > 0 ? `, save ${saving}%` : ""}
        </p>
      </div>
      {earlyOpen !== false && (
        <p className="text-xs text-text">
          Early price for the first {prices.early.seats} creators:{" "}
          <span className="numeric font-medium">{rupees(prices.early.monthly)}</span> a month or{" "}
          <span className="numeric font-medium">{rupees(prices.early.yearly)}</span> a year
        </p>
      )}
    </div>
  );
}

export function PlanCards({
  starter,
  creator,
  testMode = false,
  liveOwnerTest = false,
  showPrices = true,
}: {
  starter: PlanCard;
  creator: PlanCard;
  testMode?: boolean;
  // Sales are closed to creators and the owner is shown the Buy button with live keys: real money.
  liveOwnerTest?: boolean;
  // False while the prices are still placeholders for this viewer (buying is closed to them): the
  // cards then say the price will be announced instead of showing a number that may change.
  showPrices?: boolean;
}) {
  const [term, setTerm] = useState<1 | 12>(1);
  const [selected, setSelected] = useState<PlanKey | null>(null);
  // While a payment is being started the choices hold still, so what is posted to PayU is what is on screen.
  const [busy, setBusy] = useState(false);
  const onBusyChange = useCallback((b: boolean) => setBusy(b), []);

  const picked = [starter, creator].find((p) => p.plan === selected);
  const pickedBuy = picked?.buy.kind === "open" ? picked.buy : null;

  // Choosing a plan opens the pay step under the cards; bring it into view on a phone and put the
  // keyboard and screen reader there (it sits after both cards).
  useEffect(() => {
    if (!selected) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("buy-step")?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest" });
    document.getElementById("buy-step-title")?.focus({ preventScroll: true });
  }, [selected]);

  return (
    <section aria-labelledby="plan-cards-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plan-cards-title" className="text-2xl font-semibold text-text">
          Choose a plan
        </h2>
        <TermSwitch term={term} onChange={setTerm} disabled={busy} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[starter, creator].map((p) => (
          <article key={p.name} className={cardBox}>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-text">{p.name}</h3>
              <p className="text-sm text-muted">{p.tagline}</p>
            </div>
            {showPrices ? (
              <Price prices={p.prices} term={term} earlyOpen={p.earlyOpen} />
            ) : (
              <p className="text-sm text-text">The price will be announced soon.</p>
            )}
            {(p.status || p.note) && (
              <div className="space-y-1 text-sm text-text">
                {p.status && <p>{p.status}</p>}
                {p.note && <p className="text-muted">{p.note}</p>}
              </div>
            )}
            <div className="mt-auto flex flex-col items-start gap-2">
              <a href="#compare" className="inline-block text-sm text-text underline decoration-line hover:decoration-accent">
                See every feature
              </a>
              {p.buy.kind === "open" ? (
                <button
                  type="button"
                  aria-pressed={selected === p.plan}
                  aria-controls="buy-step"
                  disabled={busy}
                  onClick={() => setSelected(p.plan)}
                  className={selected === p.plan ? pillPrimary : pillOutline}
                >
                  {selected === p.plan && <Check size={14} weight="bold" aria-hidden="true" />}
                  {p.buy.renewing ? `Add a term of ${p.name}` : `Choose ${p.name}`}
                </button>
              ) : (
                <>
                  <button type="button" disabled aria-describedby={`buy-note-${p.plan}`} className={pillOutline}>
                    Buying opens soon
                  </button>
                  <p id={`buy-note-${p.plan}`} className="text-xs text-muted">
                    A one-off payment, not a subscription. It does not renew by itself.
                  </p>
                </>
              )}
            </div>
          </article>
        ))}
      </div>

      {picked && pickedBuy && (
        <div id="buy-step" className="rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5">
          {/* The amount follows either term switch; the mobile number and the tick stay while the plan or term is changed. */}
          <BuyPass
            plan={picked.plan}
            option={pickedBuy.options[term]}
            renewing={pickedBuy.renewing}
            testMode={testMode}
            liveOwnerTest={liveOwnerTest}
            onTermChange={setTerm}
            onBusyChange={onBusyChange}
          />
        </div>
      )}

    </section>
  );
}

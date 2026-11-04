"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "@phosphor-icons/react";
import { perMonthOfYear, yearSaving, type TierPrices } from "@/lib/pricing";
import { pillOutline } from "../parts/styles";

export interface PlanCard {
  name: string;
  tagline: string;
  // "Everything in Starter, plus" or similar, shown above the list.
  lead: string | null;
  // The first few features, then how many more the table below shows.
  highlights: string[];
  more: number;
  prices: TierPrices;
}

export interface CustomCard {
  name: string;
  tagline: string;
  highlights: string[];
  from: number;
}

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

const cardBox = "flex flex-col gap-5 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5";

function Highlights({ lead, items, more }: { lead: string | null; items: string[]; more: number }) {
  return (
    <div className="space-y-2">
      {lead && <p className="text-sm font-medium text-text">{lead}</p>}
      <ul className="space-y-1.5">
        {items.map((t) => (
          <li key={t} className="flex items-start gap-2 text-sm text-muted">
            <Check size={14} weight="bold" aria-hidden="true" className="mt-0.5 shrink-0 text-accent" />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="text-xs text-muted">and {more} more, listed below</p>}
    </div>
  );
}

function Price({ prices, term }: { prices: TierPrices; term: 1 | 12 }) {
  const year = term === 12;
  const saving = yearSaving(prices.monthly, prices.yearly);
  return (
    <div className="space-y-1">
      <p>
        <span className="numeric text-3xl font-semibold text-text">{rupees(year ? prices.yearly : prices.monthly)}</span>
        <span className="text-sm text-muted">{year ? " a year" : " a month"}</span>
      </p>
      <p className="text-xs text-muted">
        {year
          ? `${rupees(perMonthOfYear(prices.yearly))} a month${saving > 0 ? `, save ${saving}%` : ""}`
          : "Pay month by month"}
      </p>
      <p className="text-xs text-text">
        Early price for the first {prices.early.seats} creators:{" "}
        <span className="numeric font-medium">{rupees(year ? prices.early.yearly : prices.early.monthly)}</span>
      </p>
    </div>
  );
}

export function PlanCards({ starter, creator, custom }: { starter: PlanCard; creator: PlanCard; custom: CustomCard }) {
  const [term, setTerm] = useState<1 | 12>(1);
  const seg = (on: boolean) =>
    `h-10 rounded-full px-4 text-sm transition-colors duration-200 ${
      on ? "bg-accent font-semibold text-ink" : "text-muted hover:text-text"
    }`;

  return (
    <section aria-labelledby="plan-cards-title" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="plan-cards-title" className="text-sm font-medium uppercase tracking-widest text-muted">
          Choose a plan
        </h2>
        <div role="group" aria-label="Price shown for" className="inline-flex rounded-full border border-control p-0.5">
          <button type="button" aria-pressed={term === 1} onClick={() => setTerm(1)} className={seg(term === 1)}>
            1 month
          </button>
          <button type="button" aria-pressed={term === 12} onClick={() => setTerm(12)} className={seg(term === 12)}>
            12 months
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {[starter, creator].map((p) => (
          <article key={p.name} className={cardBox}>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-text">{p.name}</h3>
              <p className="text-sm text-muted">{p.tagline}</p>
            </div>
            <Price prices={p.prices} term={term} />
            <Highlights lead={p.lead} items={p.highlights} more={p.more} />
            <div className="mt-auto space-y-2">
              <button type="button" disabled aria-describedby={`buy-note-${p.name}`} className={pillOutline}>
                Buying opens soon
              </button>
              <p id={`buy-note-${p.name}`} className="text-xs text-muted">
                A one-off payment, not a subscription. It does not renew by itself.
              </p>
            </div>
          </article>
        ))}
      </div>

      <article className={cardBox}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-x-6">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="text-xl font-semibold text-text">{custom.name}</h3>
            <p className="text-sm text-muted">{custom.tagline}</p>
          </div>
          <p>
            <span className="text-sm text-muted">From </span>
            <span className="numeric text-3xl font-semibold text-text">{rupees(custom.from)}</span>
            <span className="text-sm text-muted"> once</span>
          </p>
        </div>
        <Highlights lead={null} items={custom.highlights} more={0} />
        <div className="space-y-2">
          <Link href="/contact#message" className={pillOutline}>
            Ask about it
          </Link>
          <p className="text-xs text-muted">
            On request. We build it for you and agree the price first. Tell us it is about the custom page.
          </p>
        </div>
      </article>
    </section>
  );
}

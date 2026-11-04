import Link from "next/link";
import { ONE_TIME_EXTRAS } from "@/lib/pricing";
import { pillOutline } from "../parts/styles";

const rupees = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;

// Work done by hand for a creator on request, paid once. Not part of either plan: no plan is needed
// to ask. The price is shown only when plan prices are shown (while they are placeholders the page
// says the price is agreed first, the same as the plan cards).
export function OneTimeExtras({ showPrices }: { showPrices: boolean }) {
  return (
    <section aria-labelledby="extras-title" className="space-y-4">
      <div className="space-y-1">
        <h2 id="extras-title" className="text-2xl font-semibold text-text">
          One-time extras
        </h2>
        <p className="text-sm text-muted">
          Done for you by us, paid once, no plan needed. We agree the price with you before we start.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {ONE_TIME_EXTRAS.map((x) => (
          <li
            key={x.key}
            className="flex flex-col gap-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
          >
            <h3 className="text-xl font-semibold text-text">{x.name}</h3>
            <p className="text-sm text-muted">{x.blurb}</p>
            <p className="mt-auto text-sm text-text">
              {showPrices ? (
                <>
                  <span className="text-muted">From </span>
                  <span className="text-xl font-semibold tabular-nums">{rupees(x.from)}</span>
                  <span className="text-muted"> once</span>
                </>
              ) : (
                "Price agreed with you first."
              )}
            </p>
          </li>
        ))}
      </ul>
      <Link href="/contact#message" className={pillOutline}>
        Ask about an extra
      </Link>
    </section>
  );
}

import StatsCounter from "@/components/vui/stats-counter";
import { getPublicTotals } from "@/lib/public-stats";

// Real totals only. Every number that is zero is left out, and with nothing to show the whole
// section is left out, so a new site never advertises "0 tips".
export async function Totals() {
  const t = await getPublicTotals();
  const items = [
    { value: t.creators, label: t.creators === 1 ? "creator" : "creators", prefix: "" },
    { value: t.tips, label: t.tips === 1 ? "tip sent" : "tips sent", prefix: "" },
    { value: t.rupees, label: "tipped to creators", prefix: "₹" },
  ].filter((i) => i.value > 0);
  if (items.length === 0) return null;
  return (
    <section aria-label="Freetip so far" className="mx-auto max-w-5xl px-6 py-16">
      <dl className="grid gap-8 text-center sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]">
        {items.map((i) => (
          <div key={i.label} className="flex flex-col gap-1">
            <dt className="order-2 text-sm text-muted">{i.label}</dt>
            <dd className="display text-5xl text-text">
              <StatsCounter value={i.value} prefix={i.prefix} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

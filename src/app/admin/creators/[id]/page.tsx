import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getCreatorDetail } from "@/lib/admin/creator-detail";
import { formatINR } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, FinanceNotSetUp } from "../../_components/Notices";

export const dynamic = "force-dynamic";

const when = (d: Date) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export default async function CreatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireOwner();
  const { id } = await params;
  if (!/^\d{1,12}$/.test(id)) notFound();
  const db = adminDb();
  if (!db) return <FinanceNotSetUp />;
  const result = await getCreatorDetail(db, Number(id));
  if (!result.ok) return <CouldNotRead detail={result.error} />;
  const c = result.data;
  if (!c) notFound();

  const rows: [string, string][] = [
    ["Email", c.email],
    ["Handle", c.handle ?? "not set"],
    ["Previous handle", c.previousHandle ? `${c.previousHandle} (changed once, stays reserved)` : "—"],
    ["Status", c.creatorStatus],
    ["Payout setup", c.onboardingState.replace("_", " ")],
    ["Legal name", c.legalName ?? "—"],
    ["UPI ID", c.upiVpa ?? "—"],
    ["YouTube channel", c.ytChannelName ?? "—"],
    ["Joined", when(c.createdAt)],
    ["Captured tips", `${c.capturedCount} (${formatINR(c.capturedMinor)} gross)`],
  ];

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <Link href="/admin/creators" className="text-sm text-muted hover:text-text">
          ← Creators
        </Link>
        <h1 className="text-xl font-semibold text-text">{c.name ?? c.email}</h1>
        <p className="text-xs text-muted">
          Gross is what fans paid, from the tips table. What the creator is owed is on{" "}
          <Link href="/admin/finance/balances" className="underline">
            Balances
          </Link>
          . Actions (approve, suspend, close) stay on the creators list.
        </p>
      </div>

      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-text break-all">{v}</dd>
          </div>
        ))}
      </dl>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Latest tips</h2>
        {c.recentTips.length === 0 ? (
          <AdminEmptyState title="No tips yet" description="Tips to this creator appear here." />
        ) : (
          <ul className="divide-y divide-control rounded-2xl border border-control text-sm">
            {c.recentTips.map((t) => (
              <li key={t.reference} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="numeric text-muted">{t.reference}</span>
                <span className="text-text">{t.fanName ?? "Anonymous"}</span>
                <span className="numeric text-text">{formatINR(t.grossMinor)}</span>
                <span className="text-muted">{t.status}</span>
                <span className="text-muted">{when(t.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-text">Payouts</h2>
        {c.payouts.length === 0 ? (
          <p className="text-sm text-muted">None. The site does not send payouts yet.</p>
        ) : (
          <ul className="divide-y divide-control rounded-2xl border border-control text-sm">
            {c.payouts.map((p) => (
              <li key={p.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span className="numeric text-text">{formatINR(p.amountMinor)}</span>
                <span className="text-muted">{p.status}</span>
                <span className="text-muted">{when(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

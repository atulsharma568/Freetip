import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { OPERATOR } from "@/lib/legal";
import { gatewayOf, istMoment, paidOrder, receiptNumber, rupees, termWords } from "@/lib/plan-view";
import { PLAN_NAMES } from "@/lib/pricing";
import { SITE_NAME } from "@/lib/site";
import { DashboardShell } from "../../../parts/DashboardShell";
import { PrintButton } from "../PrintButton";

export const metadata: Metadata = {
  title: `Receipt: ${SITE_NAME}`,
  robots: { index: false },
};

// A plain receipt for one paid pass. Freetip is not registered for GST (docs/rules-check.md), so
// this is a receipt, not a tax invoice, and says nothing about tax. Only the creator who paid can
// open it; anyone else gets the not-found page.
export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/signin");
  const googleId = (session.user as { googleId?: string }).googleId;
  const db = getDb();
  if (!db || !googleId) redirect("/dashboard");

  const [user] = await db<
    { id: string; handle: string | null; creator_status: string; name: string | null; email: string }[]
  >`select id::text, handle, creator_status, name, email from users where google_id = ${googleId}`;
  if (!user?.handle) redirect("/dashboard");

  const orderId = /^\d{1,12}$/.test(id) ? Number(id) : 0;
  let order = null;
  try {
    order = await paidOrder(db as unknown as LedgerDb, Number(user.id), orderId);
  } catch (err) {
    console.error("Receipt: could not read the order (migrations 0055 and 0056 run?)", err instanceof Error ? err.message : err);
  }
  if (!order) notFound();

  const rows: [string, string][] = [
    ["Receipt number", receiptNumber(order.id)],
    ["Date paid", istMoment(order.paidAt ?? order.createdAt)],
    ["Paid by", [user.name, user.email].filter(Boolean).join(", ")],
    ["Creator page", `${SITE_NAME} /${user.handle}`],
    ["For", `${SITE_NAME} ${PLAN_NAMES[order.plan]} plan, ${termWords(order.termMonths)}`],
    ["Covers", `${istMoment(order.passStartsAt ?? order.createdAt)} to ${istMoment(order.passEndsAt ?? order.createdAt)}`],
    ["Amount paid", rupees(order.amountMinor)],
    ["Paid with", `${gatewayOf(order.payuRef)}, payment ID ${order.payuRef ?? "not recorded"}`],
    ...(order.endedAt ? ([["Status", `Plan ended early on ${istMoment(order.endedAt)}`]] as [string, string][]) : []),
  ];

  return (
    <DashboardShell handle={user.handle} live={user.creator_status === "active"}>
      {/* The site is dark, so a printed receipt would be pale text on white paper. When printing, only the
          receipt is laid out, in black on white, whatever the theme. */}
      <style>{`@media print {
        html, body { background: #fff !important; color: #000 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; }
        /* Everything that is not the receipt (or a box holding it) is removed, so nothing keeps taking up paper (a blank first page). */
        body *:not(.receipt-sheet):not(.receipt-sheet *):not(:has(.receipt-sheet)) { display: none !important; }
        *:has(.receipt-sheet) { display: block !important; position: static !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; }
        .receipt-sheet, .receipt-sheet * { color: #000 !important; background: transparent !important; border-color: #999 !important; box-shadow: none !important; backdrop-filter: none !important; }
        .receipt-sheet { width: 100% !important; max-width: none !important; margin: 0 !important; padding: 24px !important; }
        .receipt-sheet a { text-decoration: none !important; }
      }`}</style>
      <div className="receipt-sheet mx-auto w-full max-w-2xl space-y-6 px-6 pb-24 pt-4">
        <p className="print:hidden">
          <Link href="/dashboard/plans" className="text-sm text-muted transition-colors duration-200 hover:text-text">
            ← Paid features
          </Link>
        </p>
        <h1 className="display text-[clamp(2rem,7vw,3rem)]">Receipt</h1>
        {!order.livemode && (
          <p className="rounded-[var(--radius-surface)] border border-control p-4 text-sm text-text">
            This was a test payment. No real money was paid, and this is not a receipt for any purchase.
          </p>
        )}
        <dl className="divide-y divide-line/60 rounded-[var(--radius-surface)] border border-line/60 bg-surface">
          {rows.map(([term, value]) => (
            <div key={term} className="grid gap-1 px-5 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
              <dt className="text-sm text-muted">{term}</dt>
              <dd className="min-w-0 break-words text-sm text-text">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-1 text-sm text-muted">
          <p>Issued by {OPERATOR.legalName}, {OPERATOR.businessType}. {OPERATOR.registeredAddress}.</p>
          {OPERATOR.supportEmail && <p>Questions: {OPERATOR.supportEmail}</p>}
          <p>
            A pass does not renew by itself. Refunds are covered in our{" "}
            <Link href="/refunds" className="text-text underline decoration-line hover:decoration-accent">
              refund policy
            </Link>
            .
          </p>
        </div>
        <PrintButton />
      </div>
    </DashboardShell>
  );
}

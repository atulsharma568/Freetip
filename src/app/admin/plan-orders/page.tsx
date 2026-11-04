import { AdminEmptyState } from "@/components/admin/EmptyState";
import { getPlanOrders } from "@/lib/admin/plan-order-queries";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp, DefinitionNote } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";
import { OrderTable } from "./OrderTable";

export const dynamic = "force-dynamic";

export default async function PlanOrdersPage() {
  await requireOwner();
  const db = adminDb();
  if (!db) return <DatabaseNotSetUp />;
  const [look, recent] = await Promise.all([
    load("the plan payments to look at", () => getPlanOrders(db, { needsLookOnly: true, limit: 50 })),
    load("the recent plan orders", () => getPlanOrders(db, { limit: 60 })),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Money · Plan payments"
        title="Plan payments"
        note="Every attempt to buy Starter or Creator through PayU, newest first, with the proof of what the creator agreed to."
      />

      <section aria-labelledby="look-heading" className="space-y-3">
        <h2 id="look-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          To look at
        </h2>
        <DefinitionNote>
          PayU says these orders are paid, but not at the plain price (an offer or discount was applied, or its amounts
          disagree). Nothing was switched on. Open the payment in PayU&apos;s dashboard, then either refund it there or
          give the creator the features yourself in their page.
        </DefinitionNote>
        {!look.ok ? (
          <CouldNotRead message="Could not read these orders. Is migration 0057 run?" detail={look.error} />
        ) : look.data.length === 0 ? (
          <AdminEmptyState title="Nothing to look at" description="No payment is waiting for your decision." />
        ) : (
          <OrderTable rows={look.data} />
        )}
      </section>

      <section aria-labelledby="recent-heading" className="space-y-3">
        <h2 id="recent-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-muted">
          Recent orders
        </h2>
        {!recent.ok ? (
          <CouldNotRead message="Could not read the orders. Is migration 0057 run?" detail={recent.error} />
        ) : recent.data.length === 0 ? (
          <AdminEmptyState title="No orders yet" description="An order appears here when a creator presses Pay on the Paid features page." />
        ) : (
          <OrderTable rows={recent.data} />
        )}
      </section>
    </div>
  );
}

import type { LedgerDb } from "../accrual";
import { CLOSED_EMAIL_DOMAIN } from "../account-close";
import { readNotPosted } from "./finance-queries";
import { countNeedsLook } from "./plan-order-queries";
import { load, toWhole, type Loaded } from "./result";

// What is waiting for the owner. Each count is read on its own, so a table that
// does not exist yet (a migration not run) shows as "could not read" for that one
// line and never as zero.

export type QueueKey = "pendingCreators" | "submittedSetups" | "newMessages" | "handleRequests" | "awaitingCreators" | "planPaymentsToLook" | "payoutsToPay" | "mediaToReview" | "unpostedTips";

export interface QueueItem {
  key: QueueKey;
  label: string;
  href: string;
  count: Loaded<number>;
}

const closed = `%${CLOSED_EMAIL_DOMAIN}`;

async function count(db: LedgerDb, which: QueueKey): Promise<number> {
  switch (which) {
    case "pendingCreators": {
      const [r] = await db<{ n: string }[]>`
        select count(*)::text as n from users
         where creator_status = 'pending' and email not like ${closed}
      `;
      return toWhole(r.n);
    }
    case "awaitingCreators": {
      const [r] = await db<{ n: string }[]>`
        select count(*)::text as n from users
         where (creator_status = 'pending' or onboarding_state = 'submitted') and email not like ${closed}
      `;
      return toWhole(r.n);
    }
    case "submittedSetups": {
      const [r] = await db<{ n: string }[]>`
        select count(*)::text as n from users
         where onboarding_state = 'submitted' and email not like ${closed}
      `;
      return toWhole(r.n);
    }
    case "newMessages": {
      const [r] = await db<{ n: string }[]>`select count(*)::text as n from contact_messages where status = 'new'`;
      return toWhole(r.n);
    }
    case "planPaymentsToLook":
      // PayU says paid at another price; nothing was switched on (migration 0055 and the daily check).
      return countNeedsLook(db);
    case "payoutsToPay": {
      // A creator asked for a payout and the owner has not yet paid or cancelled it.
      const [r] = await db<{ n: string }[]>`
        select count(*)::text as n from creator_payouts where status in ('initiated', 'in_transit')
      `;
      return toWhole(r.n);
    }
    case "mediaToReview": {
      // Uploaded alert files nobody has approved or taken down yet.
      const [r] = await db<{ n: string }[]>`select count(*)::text as n from creator_media where review_state = 'new'`;
      return toWhole(r.n);
    }
    case "unpostedTips":
      // Live paid tips the books have not recorded yet (the Sync button in reconciliation posts them).
      return (await readNotPosted(db)).count;
    case "handleRequests": {
      const [r] = await db<{ n: string }[]>`select count(*)::text as n from handle_requests where status = 'pending'`;
      return toWhole(r.n);
    }
  }
}

const ITEMS: { key: QueueKey; label: string; href: string }[] = [
  { key: "pendingCreators", label: "Creators waiting for approval", href: "/admin/creators?tab=pending" },
  { key: "submittedSetups", label: "Payout setups submitted", href: "/admin/creators?tab=submitted" },
  { key: "newMessages", label: "New contact messages", href: "/admin/messages?status=new" },
  { key: "handleRequests", label: "Handle change requests", href: "/admin/handle-requests" },
  { key: "planPaymentsToLook", label: "Plan payments to look at", href: "/admin/plan-orders" },
  { key: "payoutsToPay", label: "Payout requests to pay", href: "/admin/payouts" },
  { key: "mediaToReview", label: "Alert media to review", href: "/admin/media" },
  { key: "unpostedTips", label: "Tips not yet posted to the books", href: "/admin/reconciliation" },
];

export interface Queue {
  items: QueueItem[];
  // Creators who need approval or a payout-setup decision (each counted once).
  awaitingCreators: Loaded<number>;
}

export async function getQueue(db: LedgerDb): Promise<Queue> {
  const [items, awaitingCreators] = await Promise.all([
    Promise.all(ITEMS.map(async (item) => ({ ...item, count: await load(item.label, () => count(db, item.key)) }))),
    load("creators awaiting action", () => count(db, "awaitingCreators")),
  ]);
  return { items, awaitingCreators };
}

// The sidebar badges: nav href -> how many are waiting. A count that could not be
// read gets no badge.
export function badgesFrom(queue: Queue): Record<string, number> {
  const n = (key: QueueKey) => {
    const q = queue.items.find((i) => i.key === key);
    return q && q.count.ok ? q.count.data : 0;
  };
  return {
    "/admin/creators": queue.awaitingCreators.ok ? queue.awaitingCreators.data : 0,
    "/admin/messages": n("newMessages"),
    "/admin/handle-requests": n("handleRequests"),
    "/admin/plan-orders": n("planPaymentsToLook"),
    "/admin/payouts": n("payoutsToPay"),
    "/admin/media": n("mediaToReview"),
    "/admin/reconciliation": n("unpostedTips"),
  };
}

import { cache } from "react";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import type { LedgerDb } from "@/lib/accrual";
import { expireOne } from "@/lib/plan-orders";
import { NO_FEATURES, planFeatures, type PlanFeatures } from "@/lib/plans";

// The server-side gates live in plans.ts (pure, so tests can import them without
// the sign-in code); re-exported here because this is where callers look for them.
export { FeatureOffError, hasFeature, requireFeature } from "@/lib/plans";

// The paid features of whoever is signed in, for pages that only need to know what to
// show. Everything is off when nobody is signed in or the column is not there yet
// (migration 0035 not run), so a page never breaks over it.
// Read once per request: the nav, the sub nav and the page all ask.
export const getSessionFeatures = cache(async (): Promise<PlanFeatures> => {
  try {
    const session = await auth();
    const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
    const db = getDb();
    if (!db || !googleId) return NO_FEATURES;
    let [row] = await db<{ id: string; paid_features: string[] | null }[]>`
      select id::text, paid_features from users where google_id = ${googleId}
    `;
    // A plan that ended since the daily job last ran is switched off now, so the dashboard does not keep
    // showing (and the gates keep allowing) features the creator no longer has. Read apart, so the
    // nav still works before migration 0056.
    if (row) {
      try {
        const [e] = await db<{ ended: boolean }[]>`
          select ((starter_until is not null and starter_until <= now()) or (creator_until is not null and creator_until <= now())) as ended
            from users where id = ${Number(row.id)}
        `;
        if (e?.ended && (await expireOne(db as unknown as LedgerDb, Number(row.id)))) {
          [row] = await db<{ id: string; paid_features: string[] | null }[]>`select id::text, paid_features from users where id = ${Number(row.id)}`;
        }
      } catch {
        // No plan columns yet, or the switch-off failed: the daily job handles it.
      }
    }
    return planFeatures(row);
  } catch (err) {
    console.error("Could not read the creator's features (migration 0035 run?).", err);
    return NO_FEATURES;
  }
});

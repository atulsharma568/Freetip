import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { NO_FEATURES, planFeatures, type PlanFeatures } from "@/lib/plans";

// The server-side gates live in plans.ts (pure, so tests can import them without
// the sign-in code); re-exported here because this is where callers look for them.
export { FeatureOffError, hasFeature, requireFeature } from "@/lib/plans";

// The paid features of whoever is signed in, for pages that only need to know what to
// show. Everything is off when nobody is signed in or the column is not there yet
// (migration 0035 not run), so a page never breaks over it.
export async function getSessionFeatures(): Promise<PlanFeatures> {
  try {
    const session = await auth();
    const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
    const db = getDb();
    if (!db || !googleId) return NO_FEATURES;
    const [row] = await db<{ paid_features: string[] | null }[]>`
      select paid_features from users where google_id = ${googleId}
    `;
    return planFeatures(row);
  } catch (err) {
    console.error("Could not read the creator's features (migration 0035 run?).", err);
    return NO_FEATURES;
  }
}

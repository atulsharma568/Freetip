import type { LedgerDb } from "../accrual";
import { CLOSED_EMAIL_DOMAIN } from "../account-close";
import { FEATURES, planFeatures, type FeatureKey, type PlanFeatures } from "../plans";
import { load, toWhole, type Loaded } from "./result";

// Who has which paid feature (users.paid_features, migration 0035). "Effective"
// means what the site actually shows them: a timestamp extra is off while the base
// switch is off, exactly as planFeatures decides.

export const FEATURES_PAGE_SIZE = 100;

export interface FeatureMatrixRow {
  id: number;
  name: string | null;
  handle: string | null;
  email: string;
  effective: PlanFeatures;
  anyOn: boolean;
}

export interface FeatureMatrix {
  rows: FeatureMatrixRow[];
  // Creators with each built feature effectively on, over all (not only listed) creators.
  counts: Record<FeatureKey, number>;
  // Creators with at least one feature on, and all open creators.
  withAny: number;
  creators: number;
  // Rows that match the filter (so "showing N of M" can be honest).
  matching: number;
}

export function getFeatureMatrix(
  db: LedgerDb,
  opts: { onlyOn: boolean },
  pageSize = FEATURES_PAGE_SIZE,
): Promise<Loaded<FeatureMatrix>> {
  return load("the paid features", async () => {
    // paid_features is small (a handful of keys per creator), so the counts are done
    // here with planFeatures instead of repeating its rules in SQL.
    const all = await db<{ id: string; name: string | null; handle: string | null; email: string; paid_features: string[] | null }[]>`
      select id::text, name, handle, email, paid_features
        from users
       where email not like ${`%${CLOSED_EMAIL_DOMAIN}`}
       order by (coalesce(array_length(paid_features, 1), 0) > 0) desc, created_at desc, id desc
    `;
    const counts = {} as Record<FeatureKey, number>;
    for (const f of FEATURES) counts[f.key] = 0;
    const rows: FeatureMatrixRow[] = all.map((u) => {
      const effective = planFeatures(u);
      for (const f of FEATURES) if (effective[f.key]) counts[f.key] += 1;
      return {
        id: toWhole(u.id),
        name: u.name,
        handle: u.handle,
        email: u.email,
        effective,
        anyOn: FEATURES.some((f) => effective[f.key]),
      };
    });
    const listed = opts.onlyOn ? rows.filter((r) => r.anyOn) : rows;
    return {
      rows: listed.slice(0, pageSize),
      counts,
      withAny: rows.filter((r) => r.anyOn).length,
      creators: rows.length,
      matching: listed.length,
    };
  });
}

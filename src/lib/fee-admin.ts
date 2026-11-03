import type { LedgerDb } from "./accrual";
import { CLOSED_EMAIL_DOMAIN } from "./account-close";
import {
  FEE_PLATFORM_KEY,
  FEE_PROCESSING_KEY,
  getSiteRates,
  sameRates,
  type RateOverride,
} from "./fee-rates";
import { checkRates, type FeeRates } from "./money";

// What the owner's fee screens write: the site-wide pair and creators' own pairs. Plain functions on
// a database handle (the actions in app/actions/fees.ts only check the owner and refresh pages), so
// the tests run them against the real schema in memory. Every change writes its audit rows in the
// same transaction. None of it reaches a tip already made: each order keeps the pair it was made at.

// Most creators one bulk change may touch, so one request stays small.
export const BULK_MAX = 500;

type Json = { mode: "site" } | { mode: "own"; platformBps: number; processingBps: number };
const asJson = (o: RateOverride): Json =>
  o === null ? { mode: "site" } : { mode: "own", platformBps: o.platformBps, processingBps: o.processingBps };

export interface SiteSave {
  before: FeeRates;
  after: FeeRates;
  changed: boolean;
  // Creators with no pair of their own, who follow the site rates (closed accounts not counted).
  following: number;
}

export async function saveSiteRates(db: LedgerDb, rates: FeeRates, reason: string | null): Promise<SiteSave> {
  checkRates(rates);
  return db.begin(async (tx) => {
    // Locks the two rows so two owners saving at once cannot interleave their halves.
    await tx`select 1 from site_settings where key in (${FEE_PLATFORM_KEY}, ${FEE_PROCESSING_KEY}) for update`;
    const before = await getSiteRates(tx);
    const changed = !sameRates(before, rates);
    if (changed) {
      for (const [key, value] of [
        [FEE_PLATFORM_KEY, rates.platformBps],
        [FEE_PROCESSING_KEY, rates.processingBps],
      ] as const) {
        await tx`
          insert into site_settings (key, value, updated_at) values (${key}, ${String(value)}, now())
          on conflict (key) do update set value = excluded.value, updated_at = now()
        `;
      }
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        values (null, 'owner', 'site.fee_rates_changed', 'site_setting', 'fee_rates',
                ${{ ...before }}::jsonb, ${{ ...rates }}::jsonb, ${reason}::text)
      `;
    }
    const [n] = await tx<{ n: string }[]>`
      select count(*)::text as n from users
       where platform_bps_override is null and email not like ${`%${CLOSED_EMAIL_DOMAIN}`}
    `;
    return { before, after: rates, changed, following: Number(n.n) };
  });
}

export interface CreatorSave {
  changed: number;
  unchanged: number;
  missing: number;
}

// Sets one pair on every listed creator (override = their own pair), or hands them back to the site
// rates (override = null). Creators already on exactly that setting are left alone and get no audit row.
export async function saveCreatorRates(
  db: LedgerDb,
  ids: number[],
  override: RateOverride,
  reason: string | null,
): Promise<CreatorSave> {
  if (override) checkRates(override);
  const unique = [...new Set(ids)];
  if (unique.length === 0 || unique.length > BULK_MAX || unique.some((n) => !Number.isSafeInteger(n) || n < 1)) {
    throw new RangeError(`Choose between 1 and ${BULK_MAX} creators.`);
  }
  return db.begin(async (tx) => {
    const rows = await tx<{ id: string; p: number | null; q: number | null }[]>`
      select id::text as id, platform_bps_override as p, processing_bps_override as q
        from users where id = any(${unique}::bigint[]) order by id for update
    `;
    const same = (r: { p: number | null; q: number | null }) =>
      override ? r.p === override.platformBps && r.q === override.processingBps : r.p === null && r.q === null;
    const changing = rows.filter((r) => !same(r));
    if (changing.length > 0) {
      await tx`
        update users
           set platform_bps_override = ${override?.platformBps ?? null}::int,
               processing_bps_override = ${override?.processingBps ?? null}::int
         where id = any(${changing.map((r) => Number(r.id))}::bigint[])
      `;
      await tx`
        insert into audit_events (actor_user_id, actor_role, action, entity_type, entity_ref, before_json, after_json, reason)
        select null, 'owner', 'creator.fee_rates_changed', 'user', x.id, x.before, ${asJson(override)}::jsonb, ${reason}::text
          from jsonb_to_recordset(${{
            rows: changing.map((r) => ({
              id: r.id,
              before: asJson(r.p === null || r.q === null ? null : { platformBps: r.p, processingBps: r.q }),
            })),
          }}::jsonb -> 'rows') as x(id text, before jsonb)
      `;
    }
    return { changed: changing.length, unchanged: rows.length - changing.length, missing: unique.length - rows.length };
  });
}

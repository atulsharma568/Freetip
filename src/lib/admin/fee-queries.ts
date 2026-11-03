import type { LedgerDb } from "../accrual";
import { CLOSED_EMAIL_DOMAIN } from "../account-close";
import { getSiteRates, overrideFromRow, type RateOverride } from "../fee-rates";
import type { FeeRates } from "../money";
import { load, toWhole, type Loaded } from "./result";

// What the owner's Fees page reads: the site rates, and the creators with the pair each one is on.

export type FeeTab = "all" | "site" | "own" | "free";

export const FEE_TABS: { key: FeeTab; label: string }[] = [
  { key: "all", label: "Everyone" },
  { key: "site", label: "On the site rates" },
  { key: "own", label: "Own rates" },
  { key: "free", label: "No fees" },
];

export const FEES_PAGE_SIZE = 50;

export function parseFeeTab(value: string | undefined): FeeTab {
  return FEE_TABS.find((t) => t.key === value)?.key ?? "all";
}

export interface FeeRow {
  id: number;
  name: string | null;
  email: string;
  handle: string | null;
  creatorStatus: "pending" | "active" | "suspended";
  override: RateOverride;
}

export interface FeeOverview {
  site: FeeRates;
  rows: FeeRow[];
  counts: Record<FeeTab, number>;
  total: number;
  page: number;
  pageSize: number;
}

const likeOf = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const closedLike = `%${CLOSED_EMAIL_DOMAIN}`;

// Closed accounts are never listed (their rates cannot matter). The search looks at name, email
// and handle, across every tab, as the creators page does.
export function getFeeOverview(
  db: LedgerDb,
  opts: { q: string; tab: FeeTab; page: number },
  pageSize = FEES_PAGE_SIZE,
): Promise<Loaded<FeeOverview>> {
  return load("the fee rates", async () => {
    const q = opts.q.trim().slice(0, 100);
    const like = likeOf(q);
    const page = Math.max(1, Math.floor(opts.page));
    const site = await getSiteRates(db);

    const [c] = await db<{ everyone: string; site: string; own: string; free: string }[]>`
      select count(*)::text as everyone,
             count(*) filter (where platform_bps_override is null)::text as site,
             count(*) filter (where platform_bps_override is not null)::text as own,
             count(*) filter (where platform_bps_override = 0 and processing_bps_override = 0)::text as free
        from users
       where email not like ${closedLike}
         and (${q === ""}::boolean or name ilike ${like} or email ilike ${like} or handle ilike ${like})
    `;
    const counts: Record<FeeTab, number> = {
      all: toWhole(c.everyone),
      site: toWhole(c.site),
      own: toWhole(c.own),
      free: toWhole(c.free),
    };

    const found = await db<{
      id: string;
      name: string | null;
      email: string;
      handle: string | null;
      creator_status: FeeRow["creatorStatus"];
      platform_bps_override: number | null;
      processing_bps_override: number | null;
    }[]>`
      select id::text, name, email, handle, creator_status, platform_bps_override, processing_bps_override
        from users
       where email not like ${closedLike}
         and (${q === ""}::boolean or name ilike ${like} or email ilike ${like} or handle ilike ${like})
         and (${opts.tab} = 'all'
              or (${opts.tab} = 'site' and platform_bps_override is null)
              or (${opts.tab} = 'own' and platform_bps_override is not null)
              or (${opts.tab} = 'free' and platform_bps_override = 0 and processing_bps_override = 0))
       order by created_at desc, id desc
       limit ${pageSize} offset ${(page - 1) * pageSize}
    `;
    return {
      site,
      counts,
      total: counts[opts.tab],
      page,
      pageSize,
      rows: found.map((r) => ({
        id: toWhole(r.id),
        name: r.name,
        email: r.email,
        handle: r.handle,
        creatorStatus: r.creator_status,
        override: overrideFromRow(r),
      })),
    };
  });
}

// The newest fee changes for one creator, for their page.
export function getFeeHistory(
  db: LedgerDb,
  creatorId: number,
  limit = 3,
): Promise<Loaded<{ at: Date; reason: string | null; before: unknown; after: unknown }[]>> {
  return load("the fee history", async () => {
    const rows = await db<{ created_at: Date; reason: string | null; before_json: unknown; after_json: unknown }[]>`
      select created_at, reason, before_json, after_json from audit_events
       where action = 'creator.fee_rates_changed' and entity_type = 'user' and entity_ref = ${String(creatorId)}
       order by created_at desc, id desc limit ${limit}
    `;
    return rows.map((r) => ({ at: r.created_at, reason: r.reason, before: r.before_json, after: r.after_json }));
  });
}

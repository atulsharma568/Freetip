import type { LedgerDb } from "../accrual";
import { CLOSED_EMAIL_DOMAIN } from "../account-close";
import { load, toWhole, type Loaded } from "./result";

// The owner's creators list: one tab per thing that needs a decision, each with a
// count, plus search and paging. A closed account (emptied in place, kept for the
// records) only shows under "All".

export type CreatorTab = "awaiting" | "pending" | "submitted" | "active" | "suspended" | "all";

export const CREATOR_TABS: { key: CreatorTab; label: string }[] = [
  { key: "awaiting", label: "Awaiting action" },
  { key: "pending", label: "Pending approval" },
  { key: "submitted", label: "Submitted payout setup" },
  { key: "active", label: "Active creators" },
  { key: "suspended", label: "Suspended" },
  { key: "all", label: "All" },
];

export const CREATORS_PAGE_SIZE = 50;

// The tab to show: the one asked for, else "Awaiting action", or "All" when the
// owner is searching (a search should look everywhere).
export function parseCreatorTab(value: string | undefined, searching: boolean): CreatorTab {
  const found = CREATOR_TABS.find((t) => t.key === value);
  if (found) return found.key;
  return searching ? "all" : "awaiting";
}

export interface CreatorListRow {
  id: number;
  name: string | null;
  email: string;
  handle: string | null;
  creatorStatus: "pending" | "active" | "suspended";
  onboardingState: "not_started" | "submitted" | "active" | "rejected";
  upiVpa: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  createdAt: Date;
  closed: boolean;
}

export interface CreatorList {
  rows: CreatorListRow[];
  // How many match the search in each tab (not only the shown one).
  counts: Record<CreatorTab, number>;
  // How many match the search and the shown tab.
  total: number;
  page: number;
  pageSize: number;
}

const likeOf = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
const closedLike = `%${CLOSED_EMAIL_DOMAIN}`;

export function getCreatorList(
  db: LedgerDb,
  opts: { q: string; tab: CreatorTab; page: number },
  pageSize = CREATORS_PAGE_SIZE,
): Promise<Loaded<CreatorList>> {
  return load("the creators list", async () => {
    const q = opts.q.trim().slice(0, 100);
    const like = likeOf(q);
    const page = Math.max(1, Math.floor(opts.page));
    const offset = (page - 1) * pageSize;

    const [c] = await db<{ awaiting: string; pending: string; submitted: string; active: string; suspended: string; all: string }[]>`
      select count(*) filter (where email not like ${closedLike}
                                and (creator_status = 'pending' or onboarding_state = 'submitted'))::text as awaiting,
             count(*) filter (where email not like ${closedLike} and creator_status = 'pending')::text as pending,
             count(*) filter (where email not like ${closedLike} and onboarding_state = 'submitted')::text as submitted,
             count(*) filter (where email not like ${closedLike} and creator_status = 'active')::text as active,
             count(*) filter (where email not like ${closedLike} and creator_status = 'suspended')::text as suspended,
             count(*)::text as "all"
        from users
       where ${q === ""}::boolean or name ilike ${like} or email ilike ${like} or handle ilike ${like}
             or yt_channel_name ilike ${like} or upi_vpa ilike ${like}
    `;
    const counts: Record<CreatorTab, number> = {
      awaiting: toWhole(c.awaiting),
      pending: toWhole(c.pending),
      submitted: toWhole(c.submitted),
      active: toWhole(c.active),
      suspended: toWhole(c.suspended),
      all: toWhole(c.all),
    };

    const found = await db<{
      id: string;
      name: string | null;
      email: string;
      handle: string | null;
      creator_status: CreatorListRow["creatorStatus"];
      onboarding_state: CreatorListRow["onboardingState"];
      upi_vpa: string | null;
      yt_channel_name: string | null;
      yt_channel_url: string | null;
      created_at: Date;
    }[]>`
      select id::text, name, email, handle, creator_status, onboarding_state, upi_vpa,
             yt_channel_name, yt_channel_url, created_at
        from users
       where (${q === ""}::boolean or name ilike ${like} or email ilike ${like} or handle ilike ${like}
              or yt_channel_name ilike ${like} or upi_vpa ilike ${like})
         and (${opts.tab} = 'all'
              or (email not like ${closedLike}
                  and ((${opts.tab} = 'awaiting' and (creator_status = 'pending' or onboarding_state = 'submitted'))
                    or (${opts.tab} = 'pending' and creator_status = 'pending')
                    or (${opts.tab} = 'submitted' and onboarding_state = 'submitted')
                    or (${opts.tab} = 'active' and creator_status = 'active')
                    or (${opts.tab} = 'suspended' and creator_status = 'suspended'))))
       order by created_at desc, id desc
       limit ${pageSize} offset ${offset}
    `;

    return {
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
        onboardingState: r.onboarding_state,
        upiVpa: r.upi_vpa,
        ytChannelName: r.yt_channel_name,
        ytChannelUrl: r.yt_channel_url,
        createdAt: r.created_at,
        closed: r.email.endsWith(CLOSED_EMAIL_DOMAIN),
      })),
    };
  });
}

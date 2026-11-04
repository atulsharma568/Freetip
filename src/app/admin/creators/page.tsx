import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { resetCreatorAccent } from "@/app/actions/admin";
import { DEFAULT_ACCENT, safeAccent } from "@/lib/accent";
import {
  CREATOR_TABS,
  getCreatorList,
  parseCreatorTab,
  type CreatorTab,
} from "@/lib/admin/creator-list";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireAdminViewer } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { CreatorActions } from "../_components/CreatorActions";
import { PageHeader, Pager } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type Params = { q?: string; tab?: string; page?: string };

export default async function AdminCreatorsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const viewer = (await requireAdminViewer()) === "viewer";
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const tab = parseCreatorTab(params.tab, q !== "");
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const header = (
    <PageHeader
      eyebrow="Creators"
      title="Who is on Freetip"
      note="Approve new creators, decide payout setups, suspend or close accounts. Open a creator for their paid features, tips, messages and history."
    />
  );

  const db = adminDb();
  if (!db) {
    return (
      <div className="space-y-8">
        {header}
        <DatabaseNotSetUp />
      </div>
    );
  }

  const result = await getCreatorList(db, { q, tab, page, viewer });
  if (!result.ok) {
    return (
      <div className="space-y-8">
        {header}
        <CouldNotRead message="Could not read the creators list." detail={result.error} />
      </div>
    );
  }
  const list = result.data;

  // Page colours (migration 0026), read apart so this page still loads before it is run.
  const accentsRead = list.rows.length
    ? await load("the page colours", async () => {
        const rows = await db<{ id: string; accent: string | null }[]>`
          select id::text, accent from users where accent is not null and id = any(${list.rows.map((r) => r.id)}::bigint[])
        `;
        return new Map(rows.map((r) => [Number(r.id), safeAccent(r.accent)] as const));
      })
    : null;
  const accents = accentsRead?.ok ? accentsRead.data : new Map<number, string>();

  const hrefFor = (next: { tab?: CreatorTab; page?: number }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    sp.set("tab", next.tab ?? tab);
    if ((next.page ?? 1) > 1) sp.set("page", String(next.page));
    return `/admin/creators?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      {header}

      <nav aria-label="Creator lists" className="flex flex-wrap gap-2">
        {CREATOR_TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={hrefFor({ tab: t.key })}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${
                active ? "bg-accent text-ink" : "border border-control text-muted hover:border-text/40 hover:text-text"
              }`}
            >
              {t.label}
              <span className="numeric text-xs">{list.counts[t.key]}</span>
            </Link>
          );
        })}
      </nav>

      <form action="/admin/creators" className="flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder={viewer ? "Search name, handle or channel" : "Search name, email, handle, channel or UPI ID"}
          aria-label="Search creators"
          className={`${FIELD_CLASS} w-full max-w-md`}
        />
        <button type="submit" className={buttonClass("quiet", "md")}>
          Search
        </button>
        {q && (
          <Link href="/admin/creators" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
            Clear
          </Link>
        )}
      </form>

      {!accentsRead?.ok && accentsRead && (
        <CouldNotRead message="Could not read the page colours, so Reset colour is not shown. Has migration 0026 been run?" detail={accentsRead.error} />
      )}

      {list.total === 0 ? (
        q || list.counts.all > 0 ? (
          <p className="text-sm text-muted">
            {q ? `No creator in this list matches “${q}”.` : "Nobody is in this list. That is the good outcome for Awaiting action."}
          </p>
        ) : (
          <AdminEmptyState
            title="No creators yet"
            description="Creators appear here once they sign in with Google. You can approve or suspend them from this page."
          />
        )
      ) : (
        <div className="space-y-3">
          <Pager
            page={list.page}
            pageSize={list.pageSize}
            total={list.total}
            shown={list.rows.length}
            noun="creator"
            hrefFor={(p) => hrefFor({ page: p })}
          />
          <div data-lenis-prevent className="max-h-[75vh] overflow-auto rounded-surface border border-control">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Creators, newest first: account, handle, status, payout setup and actions
              </caption>
              <thead className="sticky top-0 z-10 bg-raised">
                <tr className="border-b border-control">
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Creator</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Handle</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Status</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Payout setup</th>
                  <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-control bg-surface">
                {list.rows.map((c) => (
                  <tr key={c.id} className="align-top transition-colors hover:bg-raised">
                    <td className="px-4 py-3">
                      <Link href={`/admin/creators/${c.id}`} className="font-medium text-text hover:underline">
                        {c.name ?? "—"}
                      </Link>
                      {!viewer && (
                        <p title={c.email} className="max-w-[200px] truncate text-xs text-muted">
                          {c.email}
                        </p>
                      )}
                      {c.ytChannelName &&
                        (c.ytChannelUrl ? (
                          <a
                            href={c.ytChannelUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={c.ytChannelName}
                            className="block max-w-[200px] truncate text-xs text-muted transition-colors hover:text-text"
                          >
                            {c.ytChannelName}
                          </a>
                        ) : (
                          <p title={c.ytChannelName} className="max-w-[200px] truncate text-xs text-muted">
                            {c.ytChannelName}
                          </p>
                        ))}
                      <p className="mt-1 text-xs text-muted">Joined {fmtIST(c.createdAt, "date")}</p>
                    </td>

                    <td className="numeric px-4 py-3 text-text">
                      {c.handle ?? <span className="text-muted">not set</span>}
                      {!viewer && accents.has(c.id) && accents.get(c.id) !== DEFAULT_ACCENT && (
                        <div className="mt-2 flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="inline-block size-3 shrink-0 rounded-full border border-control"
                            style={{ backgroundColor: accents.get(c.id) }}
                          />
                          <ActionForm
                            action={resetCreatorAccent.bind(null, c.id)}
                            label="Reset colour"
                            pendingLabel="Resetting…"
                          />
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={c.closed ? "closed" : c.creatorStatus} />
                    </td>

                    <td className="px-4 py-3">
                      <StatusBadge status={c.onboardingState} />
                      {!viewer && c.upiVpa && (
                        <p title={c.upiVpa} className="numeric mt-1 max-w-[160px] truncate text-xs text-muted">
                          {c.upiVpa}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {viewer ? (
                        <span className="text-xs text-muted">View only</span>
                      ) : (
                        <CreatorActions
                          id={c.id}
                          handle={c.handle}
                          creatorStatus={c.creatorStatus}
                          onboardingState={c.onboardingState}
                          closed={c.closed}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

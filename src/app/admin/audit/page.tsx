import Link from "next/link";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { fmtIST } from "@/lib/admin/format";
import { getAuditActions, getAuditPage, type AuditRow } from "@/lib/admin/audit-queries";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader, Pager } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type Params = { creator?: string; action?: string; page?: string };

const pretty = (v: unknown) => {
  const text = JSON.stringify(v, null, 2) ?? "";
  return text.length > 2000 ? `${text.slice(0, 2000)}…` : text;
};

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const params = await searchParams;
  const creator = (params.creator ?? "").trim().slice(0, 100);
  const action = (params.action ?? "").slice(0, 100);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const filtered = Boolean(creator || action);

  const header = (
    <PageHeader
      eyebrow="Audit history"
      title="Who changed what"
      note="Every owner action on a creator, handle, sound or feature switch, and every account closing, newest first. It is append-only: a row is never edited or deleted, a mistake is corrected by a new row."
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

  const [result, actions] = await Promise.all([getAuditPage(db, { creator, action, page }), getAuditActions(db)]);

  const hrefFor = (p: number) => {
    const q = new URLSearchParams();
    if (creator) q.set("creator", creator);
    if (action) q.set("action", action);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `/admin/audit?${s}` : "/admin/audit";
  };

  return (
    <div className="space-y-8">
      {header}

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted">
          Creator
          <input
            name="creator"
            defaultValue={creator}
            placeholder="Handle, email, name or id"
            className={`${FIELD_CLASS} block w-64 max-w-full`}
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          Action
          <select name="action" defaultValue={action} className={`${FIELD_CLASS} block`}>
            <option value="">All</option>
            {actions.ok &&
              actions.data.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("quiet", "md")}>
          Apply
        </button>
        {filtered && (
          <Link href="/admin/audit" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
            Clear
          </Link>
        )}
      </form>
      {!actions.ok && <CouldNotRead message="Could not read the list of actions for the filter." detail={actions.error} />}

      {!result.ok ? (
        <CouldNotRead
          message="Could not read the audit history. Has migration 0001 been run?"
          detail={result.error}
        />
      ) : result.data.total === 0 ? (
        filtered ? (
          <p className="text-sm text-muted">No audit events match.</p>
        ) : (
          <AdminEmptyState
            title="No audit events yet"
            description="The first owner action or account closing will appear here."
          />
        )
      ) : (
        <div className="space-y-4">
          <Pager
            page={result.data.page}
            pageSize={result.data.pageSize}
            total={result.data.total}
            shown={result.data.rows.length}
            noun="event"
            hrefFor={hrefFor}
          />
          <ul className="divide-y divide-control rounded-surface border border-control bg-surface">
            {result.data.rows.map((row) => (
              <AuditItem key={row.id} row={row} />
            ))}
          </ul>
          <Pager
            page={result.data.page}
            pageSize={result.data.pageSize}
            total={result.data.total}
            shown={result.data.rows.length}
            noun="event"
            hrefFor={hrefFor}
          />
        </div>
      )}
    </div>
  );
}

function AuditItem({ row }: { row: AuditRow }) {
  const hasChange = row.before != null || row.after != null;
  return (
    <li className="space-y-2 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="numeric text-text">{row.action}</p>
        <p className="text-xs text-muted">{fmtIST(row.at)}</p>
      </div>
      <p className="text-xs text-muted">
        By {row.actorRole}
        {row.actorUserId !== null ? ` (user ${row.actorUserId})` : ""} · About{" "}
        {row.creatorId !== null ? (
          <Link href={`/admin/creators/${row.creatorId}`} className="text-text underline underline-offset-2">
            {row.creatorLabel ?? `user ${row.creatorId}`}
          </Link>
        ) : (
          <span className="text-text">
            {row.entityType}
            {row.entityRef ? ` ${row.entityRef}` : ""}
          </span>
        )}
        {row.reason ? ` · “${row.reason}”` : ""}
      </p>
      {hasChange && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted hover:text-text">Before and after</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-muted">Before</p>
              <pre className="numeric overflow-x-auto rounded-field bg-ground p-3 text-text">{pretty(row.before)}</pre>
            </div>
            <div>
              <p className="mb-1 text-muted">After</p>
              <pre className="numeric overflow-x-auto rounded-field bg-ground p-3 text-text">{pretty(row.after)}</pre>
            </div>
          </div>
        </details>
      )}
    </li>
  );
}

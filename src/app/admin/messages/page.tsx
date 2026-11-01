import Link from "next/link";
import { ActionForm } from "@/components/admin/ActionForm";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { setMessageHandled } from "@/app/actions/admin";
import { CONTACT_TOPICS, ticketNumber } from "@/lib/contact";
import { fmtIST } from "@/lib/admin/format";
import { load } from "@/lib/admin/result";
import { adminDb } from "@/lib/admin/server-db";
import { requireOwner } from "@/lib/owner-auth";
import { CouldNotRead, DatabaseNotSetUp } from "../_components/Notices";
import { PageHeader } from "../_components/PageHeader";

export const dynamic = "force-dynamic";

type MessageRow = {
  id: string;
  name: string;
  email: string;
  topic: string;
  payment_ref: string | null;
  message: string;
  status: "new" | "handled";
  created_at: Date;
};

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_TOPICS.map((t) => [t.value, t.label]),
);

const LIMIT = 200;

type Params = { q?: string; topic?: string; status?: string };

export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireOwner();
  const db = adminDb();
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const topic = CONTACT_TOPICS.some((t) => t.value === params.topic) ? params.topic! : "";
  const status = params.status === "new" || params.status === "handled" ? params.status : "";
  const filtered = Boolean(q || topic || status);
  // A ticket number (FT-00012 or just 12) finds that message; any other text matches
  // the name, email, payment reference or message.
  const ticketId = /^(?:ft-?)?0*(\d{1,9})$/i.exec(q)?.[1] ?? null;
  const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  // The table comes from migration 0011.
  const result = db
    ? await load("the contact messages", async () => {
        const rows = await db<MessageRow[]>`
          select id::text, name, email, topic, payment_ref, message, status, created_at
          from contact_messages
          where (${topic} = '' or topic = ${topic})
            and (${status} = '' or status = ${status})
            and (${q} = ''
                 or id = ${ticketId ? Number(ticketId) : -1}
                 or name ilike ${like} or email ilike ${like}
                 or coalesce(payment_ref, '') ilike ${like} or message ilike ${like})
          order by (status = 'new') desc, created_at desc
          limit ${LIMIT}
        `;
        const [c] = await db<{ matching: string; open: string }[]>`
          select count(*)::text as matching, count(*) filter (where status = 'new')::text as open
          from contact_messages
          where (${topic} = '' or topic = ${topic})
            and (${status} = '' or status = ${status})
            and (${q} = ''
                 or id = ${ticketId ? Number(ticketId) : -1}
                 or name ilike ${like} or email ilike ${like}
                 or coalesce(payment_ref, '') ilike ${like} or message ilike ${like})
        `;
        return { rows, matching: Number(c.matching), open: Number(c.open) };
      })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Messages"
        title="Contact messages"
        note={
          result?.ok
            ? `${result.data.open} new, ${result.data.matching - result.data.open} handled${filtered ? " (filtered)" : ""}. Reply by email from your own inbox, then mark it handled.`
            : "Reply by email from your own inbox, then mark each message handled."
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-xs text-muted">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Ticket, name, email, text"
            className={`${FIELD_CLASS} block w-64 max-w-full`}
          />
        </label>
        <label className="space-y-1 text-xs text-muted">
          Topic
          <select name="topic" defaultValue={topic} className={`${FIELD_CLASS} block`}>
            <option value="">All</option>
            {CONTACT_TOPICS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-muted">
          Status
          <select name="status" defaultValue={status} className={`${FIELD_CLASS} block`}>
            <option value="">All</option>
            <option value="new">New</option>
            <option value="handled">Handled</option>
          </select>
        </label>
        <button type="submit" className={buttonClass("quiet", "md")}>
          Apply
        </button>
        {filtered && (
          <Link href="/admin/messages" className="inline-flex min-h-11 items-center px-2 text-sm text-muted hover:text-text">
            Clear
          </Link>
        )}
      </form>

      {!result ? (
        <DatabaseNotSetUp />
      ) : !result.ok ? (
        <CouldNotRead
          message="Could not read the messages. Has migration 0011 been run in Neon?"
          detail={result.error}
        />
      ) : result.data.rows.length === 0 ? (
        filtered ? (
          <p className="text-sm text-muted">No messages match.</p>
        ) : (
          <AdminEmptyState
            title="No messages yet"
            description="Messages sent from the contact page appear here."
          />
        )
      ) : (
        <>
          {result.data.matching > result.data.rows.length && (
            <p className="text-sm text-muted">
              Showing {result.data.rows.length} of {result.data.matching} messages (new first, then newest). Narrow the
              search to see the rest.
            </p>
          )}
          <ul className="space-y-4">
            {result.data.rows.map((m) => {
              const id = Number(m.id);
              return (
                <li key={m.id} className="rounded-surface border border-control bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-text">
                        {m.name} <span className="numeric ml-2 text-xs text-muted">{ticketNumber(id)}</span>
                      </p>
                      <a
                        href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(`Re: your message to Freetip (${ticketNumber(id)})`)}`}
                        title={m.email}
                        className="block max-w-full truncate text-sm text-muted transition-colors hover:text-text"
                      >
                        {m.email}
                      </a>
                    </div>
                    <div className="space-y-1 text-right text-xs text-muted">
                      <StatusBadge status={m.status} />
                      <p>{TOPIC_LABELS[m.topic] ?? m.topic}</p>
                      <p>{fmtIST(m.created_at)}</p>
                    </div>
                  </div>
                  {m.payment_ref && (
                    <p className="mt-3 text-sm text-muted">
                      Payment reference: <span className="numeric text-text">{m.payment_ref}</span>
                    </p>
                  )}
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text">{m.message}</p>
                  <div className="mt-4">
                    <ActionForm
                      action={setMessageHandled.bind(null, id, m.status === "new")}
                      label={m.status === "new" ? "Mark handled" : "Mark as new"}
                      pendingLabel="Saving…"
                      size="md"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

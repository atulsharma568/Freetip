import { getDb } from "@/lib/db";
import { setMessageHandled } from "@/app/actions/admin";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { CONTACT_TOPICS } from "@/lib/contact";
import { requireOwner } from "@/lib/owner-auth";

interface MessageRow {
  id: number;
  name: string;
  email: string;
  topic: string;
  payment_ref: string | null;
  message: string;
  status: "new" | "handled";
  created_at: string;
}

const TOPIC_LABELS: Record<string, string> = Object.fromEntries(
  CONTACT_TOPICS.map((t) => [t.value, t.label]),
);

const when = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});

export default async function AdminMessagesPage() {
  await requireOwner();
  const db = getDb();

  // The table comes from migration 0011; show an empty state where it hasn't been run.
  const messages: MessageRow[] = db
    ? await db<MessageRow[]>`
        select id, name, email, topic, payment_ref, message, status, created_at
        from contact_messages
        order by (status = 'new') desc, created_at desc
        limit 200
      `.catch(() => [])
    : [];

  if (!messages.length) {
    return (
      <AdminEmptyState
        title="No messages yet"
        description="Messages sent from the contact page appear here. If you expect some, check that migration 0011 has been run in Neon."
      />
    );
  }

  const open = messages.filter((m) => m.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold text-text">Messages</h1>
        <p className="text-sm text-muted">
          {open} new, {messages.length - open} handled. Reply by email from your own inbox, then mark it handled.
        </p>
      </div>

      <ul className="space-y-4">
        {messages.map((m) => (
          <li key={m.id} className="rounded-2xl border border-control bg-surface/30 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-text">{m.name}</p>
                <a
                  href={`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Re: your message to Freetip")}`}
                  className="text-sm text-muted transition-colors hover:text-text"
                >
                  {m.email}
                </a>
              </div>
              <div className="text-right text-xs text-muted">
                <p>{TOPIC_LABELS[m.topic] ?? m.topic}</p>
                <p>{when.format(new Date(m.created_at))}</p>
              </div>
            </div>
            {m.payment_ref && (
              <p className="mt-3 text-sm text-muted">
                Payment reference: <span className="numeric text-text">{m.payment_ref}</span>
              </p>
            )}
            <p className="mt-3 whitespace-pre-wrap break-words text-sm text-text">{m.message}</p>
            <form action={setMessageHandled.bind(null, m.id, m.status === "new")} className="mt-4">
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-full border border-control px-4 text-sm text-muted transition-colors hover:border-text/30 hover:text-text"
              >
                {m.status === "new" ? "Mark handled" : "Mark as new"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}

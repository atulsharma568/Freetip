import { decideMessage } from "@/app/actions/messages";

export interface PendingMessage {
  id: number;
  fan_name: string | null;
  fan_message: string;
  gross_amount_minor: string;
}

// Messages waiting for the creator's decision. Only shown in split and approve
// modes. Plain server-action forms, so it needs no client JavaScript.
export function MessageQueue({ items }: { items: PendingMessage[] }) {
  if (!items.length) {
    return <p className="text-sm text-muted">No messages waiting.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((m) => (
        <li key={m.id} className="space-y-3 rounded-[var(--radius-field)] border border-line/60 p-4">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium text-text">{m.fan_name ?? "Anonymous"}</span>
            <span className="numeric text-accent">₹{Number(m.gross_amount_minor) / 100}</span>
          </p>
          <p className="break-words text-base text-text">{m.fan_message}</p>
          <div className="flex gap-2">
            <form action={decideMessage.bind(null, m.id, "approved")}>
              <button
                type="submit"
                className="h-10 rounded-full bg-accent px-5 text-sm font-semibold text-ink"
              >
                Approve
              </button>
            </form>
            <form action={decideMessage.bind(null, m.id, "rejected")}>
              <button
                type="submit"
                className="h-10 rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
              >
                Reject
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}

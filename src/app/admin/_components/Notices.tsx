import type { ReactNode } from "react";
import { AdminEmptyState } from "@/components/admin/EmptyState";
import { TONE_MARK, TONE_TEXT } from "@/components/admin/tones";
import { COULD_NOT_READ } from "@/lib/admin/result";

// The state every finance page shows when there is no database to read.
export function FinanceNotSetUp() {
  return (
    <AdminEmptyState
      title="Finance data is not set up"
      description="DATABASE_URL is not set, so there is nothing to read. Once the database is connected and migration 0023 has been run, live tips, the ledger and the reconciliation checks appear here."
    />
  );
}

// A page that needs the database, when there is none.
export function DatabaseNotSetUp() {
  return (
    <AdminEmptyState
      title="The database is not set up"
      description="DATABASE_URL is not set on this server, so there is nothing to read."
    />
  );
}

// A read that failed, which is not the same as "no data": nothing is guessed or
// shown as zero in its place. `message` says what to check (default: migration
// 0023, for the money pages); `detail` is the database's own error.
export function CouldNotRead({ detail, message }: { detail?: string; message?: string }) {
  return (
    <div role="alert" className="rounded-surface border border-bad/50 bg-surface p-5">
      <p className={`text-sm font-semibold uppercase tracking-[0.18em] ${TONE_TEXT.bad}`}>
        <span aria-hidden="true">{TONE_MARK.bad} </span>Could not read
      </p>
      <p className="mt-2 text-sm text-text">{message ?? COULD_NOT_READ}</p>
      {detail && <p className="mt-2 break-words font-mono text-xs text-muted">{detail}</p>}
    </div>
  );
}

// The one-sentence definition that sits under each page title.
export function DefinitionNote({ children }: { children: ReactNode }) {
  return <p className="max-w-2xl text-sm text-muted">{children}</p>;
}

// "N test-mode tips are not counted", only when there are some.
export function TestModeLine({ count, noun = "tip" }: { count: number; noun?: string }) {
  if (count <= 0) return null;
  const one = count === 1;
  return (
    <p className="text-xs text-muted">
      {count} test-mode {one ? noun : `${noun}s`} {one ? "exists and is" : "exist and are"} not counted in
      any money figure.
    </p>
  );
}

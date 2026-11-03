import Link from "next/link";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import type { AdminAction } from "@/lib/admin/action-state";
import { fmtIST } from "@/lib/admin/format";
import type { PageSummary } from "@/lib/page-doc/store";

// The owner's view of a creator's custom tip page: whether the paid switch is on, whether a custom
// page is published, a link to the editor, and the two ways back (swap with the previous version,
// normal page).
export function TipPageBox({
  summary,
  editHref,
  restoreAction,
  resetAction,
}: {
  summary: PageSummary;
  editHref: string;
  restoreAction: AdminAction;
  resetAction: AdminAction;
}) {
  const rows: [string, string][] = [
    ["Custom tip page", summary.switchOn ? "On" : "Off"],
    [
      "Published page",
      summary.publishedUnreadable ? "Unreadable (fans see the normal page)" : summary.hasPublished ? "Custom" : "Normal",
    ],
    ["Last change", summary.lastChange ? fmtIST(summary.lastChange) : "None yet"],
  ];
  // A published page is only shown while the switch is on; say so when they disagree.
  const hidden = summary.hasPublished && !summary.switchOn;
  // Reset empties the draft, the published page and the previous version, so it is offered
  // whenever any of them holds something.
  const anythingSaved = summary.hasDraft || summary.hasPublished || summary.hasPrevious;
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="text-text">{v}</dd>
          </div>
        ))}
      </dl>
      {summary.switchOn && (
        <Link
          href={editHref}
          className="inline-block rounded-full border border-control px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-accent"
        >
          Edit tip page
        </Link>
      )}
      {!summary.switchOn && (
        <p className="max-w-2xl text-xs text-muted">
          The switch is off, so fans see the normal page. Tick &ldquo;Custom tip page&rdquo; under Paid features above to
          let a custom page show.
          {hidden && " A custom page is saved and will show as soon as the switch is on."}
        </p>
      )}
      {anythingSaved && (
        <div className="flex flex-wrap items-start gap-4">
          {summary.hasPrevious && summary.switchOn && (
            <ConfirmAction
              action={restoreAction}
              label="Swap with previous version"
              description="Swap the published page with the version before it. Doing it again swaps back. Fans see the change at once."
              confirmLabel="Swap"
              pendingLabel="Swapping…"
              tone="quiet"
            />
          )}
          <ConfirmAction
            action={resetAction}
            label="Reset to normal page"
            description="Remove the custom page and its saved versions. Fans see the normal page at once. This cannot be undone."
            confirmLabel="Reset to normal"
            pendingLabel="Resetting…"
          />
        </div>
      )}
    </div>
  );
}

import { ActionForm } from "@/components/admin/ActionForm";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import {
  adminCloseCreator,
  rejectCreatorOnboarding,
  setCreatorStatus,
} from "@/app/actions/admin";

// The owner's actions on one creator, the same on the list and the detail page.
// Approving is one press (it can be undone by suspending); suspending, rejecting a
// payout setup and closing an account are two-step, and the first two take an
// optional reason that goes into the audit history.
export function CreatorActions({
  id,
  handle,
  creatorStatus,
  onboardingState,
  closed,
}: {
  id: number;
  handle: string | null;
  creatorStatus: "pending" | "active" | "suspended";
  onboardingState: string;
  closed: boolean;
}) {
  if (closed) return <span className="text-xs text-muted">Closed, kept for the records</span>;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {creatorStatus !== "active" && (
        <ActionForm
          action={setCreatorStatus.bind(null, id, "active")}
          label="Approve"
          pendingLabel="Approving…"
          tone="primary"
        />
      )}
      {creatorStatus === "active" && (
        <ConfirmAction
          action={setCreatorStatus.bind(null, id, "suspended")}
          label="Suspend"
          confirmLabel="Suspend creator"
          pendingLabel="Suspending…"
          description="Their tip page stops taking tips until you approve them again."
          askReason
        />
      )}
      {creatorStatus === "suspended" && (
        <ConfirmAction
          action={setCreatorStatus.bind(null, id, "pending")}
          label="Reset to pending"
          confirmLabel="Reset to pending"
          pendingLabel="Resetting…"
          description="Their payout setup is reset and they have to start it again."
          askReason
        />
      )}
      {creatorStatus === "pending" && onboardingState === "submitted" && (
        <ConfirmAction
          action={rejectCreatorOnboarding.bind(null, id)}
          label="Reject setup"
          confirmLabel="Reject payout setup"
          pendingLabel="Rejecting…"
          description="Their submitted payout setup is rejected and they have to start it again."
          askReason
        />
      )}
      <ConfirmAction
        action={adminCloseCreator.bind(null, id)}
        label="Close account"
        confirmLabel="Close account for good"
        pendingLabel="Closing…"
        description="Permanent. Removes their profile and sounds; money records stay. Money owed or a payout in progress stops it."
        typeToConfirm={handle ?? "close"}
      />
    </div>
  );
}

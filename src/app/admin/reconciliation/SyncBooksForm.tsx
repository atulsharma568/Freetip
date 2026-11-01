"use client";

import { useActionState } from "react";
import { TONE_MARK, TONE_TEXT, buttonClass } from "@/components/admin/tones";
import { TickLoader } from "@/components/ui/TickLoader";
import { syncBooksNow, type SyncReport, type SyncState } from "@/app/actions/admin";
import { fmtIST } from "@/lib/admin/format";
import { formatINR } from "@/lib/admin/result";

const IDLE: SyncState = { status: "idle" };

const SKIPPED: Record<string, string> = {
  no_such_payment: "payment not found",
  not_captured: "no longer captured (refunded, disputed or closed)",
  test_mode: "test-mode payment",
  no_captured_facts: "Razorpay's captured amount was never saved",
  amount_mismatch: "amount or currency differs from the order",
};

const CANNOT_RUN: Record<string, string> = {
  no_keys: "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not both set on this server.",
  not_live_mode:
    "The Razorpay key is not a live key (it does not start with rzp_live_). The Razorpay check only works with live keys.",
  razorpay_error: "Razorpay did not give a usable answer.",
  check_failed: "The check hit an unexpected error (the server log has it).",
};

const PROBLEM_WORDS = {
  unknown_order: "Razorpay captured this payment but the site never saved the order.",
  not_marked_captured: "The site saved the order but never marked it captured under this payment.",
} as const;


export function SyncBooksForm() {
  const [state, action, pending] = useActionState(syncBooksNow, IDLE);

  return (
    <form action={action} className="space-y-4">
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "md")}
      >
        {pending ? (
          <>
            <TickLoader count={8} duration={0.8} />
            Syncing…
          </>
        ) : (
          "Sync with Razorpay and post missing"
        )}
      </button>

      <div aria-live="polite">
        {state.status === "error" && (
          <p className={`text-sm ${TONE_TEXT.bad}`}>
            <span aria-hidden="true">{TONE_MARK.bad} </span>
            <span className="sr-only">Error: </span>
            {state.message}
          </p>
        )}
        {state.status === "done" && <Report report={state.report} />}
      </div>
    </form>
  );
}

function Report({ report }: { report: SyncReport }) {
  const { check, sweep } = report;
  const skipped = sweep ? Object.entries(sweep.skipped) : [];
  return (
    <div className="space-y-4 rounded-surface border border-control bg-ground p-4 text-sm text-text">
      <div className="space-y-1">
        <p className="font-semibold">Razorpay check</p>
        {check.ran ? (
          <>
            <p>
              Checked {check.checked} captured payment{check.checked === 1 ? "" : "s"} from the last 3
              days:{" "}
              {check.problems.length === 0
                ? "none are missing from the site."
                : `${check.problems.length} problem${check.problems.length === 1 ? "" : "s"} found.`}
              {report.backfilled > 0
                ? ` Filled in the live-mode flag or captured amount on ${report.backfilled} payment${report.backfilled === 1 ? "" : "s"} the site had not saved.`
                : ""}
            </p>
            {check.truncated && (
              <p className={`text-xs ${TONE_TEXT.warn}`}>
                <span aria-hidden="true">{TONE_MARK.warn} </span>
                There were more payments than one check reads, so only the most recent were checked.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted">
            Did not run: {CANNOT_RUN[check.reason] ?? check.reason}
            {check.detail ? ` (${check.detail})` : ""}
          </p>
        )}
      </div>

      {check.ran && check.problems.length > 0 && (
        <div className="overflow-x-auto rounded-surface border border-control">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-control bg-raised">
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Payment</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Order</th>
                <th scope="col" className="px-4 py-3 text-right font-medium text-muted">Amount</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Method</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Paid</th>
                <th scope="col" className="px-4 py-3 text-left font-medium text-muted">Problem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-control bg-surface">
              {check.problems.map((p) => (
                <tr key={p.paymentId}>
                  <td className="px-4 py-3 font-mono text-xs text-text">{p.paymentId}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{p.orderId ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-accent">
                    {formatINR(p.amountPaise)}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.method ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{fmtIST(p.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-text">{PROBLEM_WORDS[p.kind]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1">
        <p className="font-semibold">Posting to the books</p>
        {sweep ? (
          <>
            <p>
              Looked at {sweep.looked} tip{sweep.looked === 1 ? "" : "s"}: posted {sweep.posted}
              {sweep.already > 0 ? `, ${sweep.already} already posted` : ""}
              {sweep.failed > 0 ? `, ${sweep.failed} failed` : ""}
              {skipped.length > 0 ? `, ${skipped.reduce((n, [, c]) => n + c, 0)} skipped` : ""}.
            </p>
            {skipped.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
                {skipped.map(([reason, n]) => (
                  <li key={reason}>
                    {n} skipped: {SKIPPED[reason] ?? reason}
                  </li>
                ))}
              </ul>
            )}
            {sweep.failed > 0 && (
              <p className={`text-xs ${TONE_TEXT.bad}`}>
                <span aria-hidden="true">{TONE_MARK.bad} </span>
                {sweep.failed} could not be posted. The server log says why; press the button again once
                it is fixed.
              </p>
            )}
            {sweep.looked >= 200 && (
              <p className="text-xs text-muted">
                200 is the most it posts at once. Press the button again if the count on this page is
                still not zero.
              </p>
            )}
          </>
        ) : (
          <p className={TONE_TEXT.bad}>
            <span aria-hidden="true">{TONE_MARK.bad} </span>Could not post. Has migration 0023 been run?
          </p>
        )}
      </div>
    </div>
  );
}

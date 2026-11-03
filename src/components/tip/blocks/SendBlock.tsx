"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { FieldNote } from "@/components/tip/FieldNote";
import { StepHeading } from "@/components/tip/StepHeading";
import { blockAttrs, useTipForm } from "@/components/tip/TipFormContext";
import type { Block } from "@/lib/page-doc/types";
import { Magnetic } from "@/components/motion/Magnetic";
import { RollText } from "@/components/motion/RollText";
import { TickLoader } from "@/components/ui/TickLoader";

// Step 3: the Pay button. What the button does, when it is blocked and its states are the form's.
export function SendBlock({ block, n }: { block: Block<"send">; n: number }) {
  const {
    message,
    closed,
    phase,
    errorMsg,
    displayName,
    previewMode,
    amountPaise,
    amountRupees,
    minTipPaise,
    minRupees,
    extraBlocked,
    handlePay,
    editing,
  } = useTipForm();

  return (
    <div className="space-y-4" {...blockAttrs(editing, block.id)}>
      <StepHeading n={n} title={block.settings.heading || "Send"} />
      <p className="text-sm text-muted">
        Pay with UPI or a card. You pay exactly the tip, and no account or email is needed.
      </p>
      {message.trim() && <p className="text-sm text-muted">Your message may appear on stream.</p>}

      {closed && phase === "idle" && (
        <p role="status" className="text-sm text-muted">
          Payment window closed. If it went through, your tip still reaches {displayName}; otherwise you
          weren&apos;t charged.
        </p>
      )}

      {phase === "error" && <FieldNote>{errorMsg}</FieldNote>}

      <div>
        <Magnetic className="w-full" strength={0.1}>
          <button
            type="button"
            onClick={handlePay}
            disabled={previewMode || amountPaise < minTipPaise || extraBlocked || phase === "creating" || phase === "checkout"}
            aria-busy={phase === "creating"}
            className="beam inline-flex h-14 w-full items-center justify-center gap-3 rounded-full bg-accent text-base font-semibold text-ink transition-[opacity,transform] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "creating" ? (
              <>
                <TickLoader count={10} duration={0.8} className="text-ink" />
                Opening payment…
              </>
            ) : phase === "checkout" ? (
              "Complete payment in the popup"
            ) : previewMode ? (
              "Tip (preview only)"
            ) : (
              <>
                <RollText>{`${block.settings.buttonLabel || "Tip"} ₹${amountRupees || "—"}`}</RollText>
                <ArrowRight weight="bold" aria-hidden="true" />
              </>
            )}
          </button>
        </Magnetic>
        {!previewMode && amountPaise > 0 && amountPaise < minTipPaise && (
          <p className="mt-2 text-center text-xs text-muted">Minimum tip is ₹{minRupees}</p>
        )}
        {previewMode && (
          <p className="mt-2 text-center text-xs text-muted">
            Payments are disabled in preview.{" "}
            <Link href="/dashboard" className="underline decoration-line hover:decoration-accent">
              Back to dashboard
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

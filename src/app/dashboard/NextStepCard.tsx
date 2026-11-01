import type { ReactNode } from "react";
import Link from "next/link";
import type { NextStep } from "@/lib/next-step";
import { SITE_HOST } from "@/lib/site";
import { RollText } from "@/components/motion/RollText";
import { CopyButton } from "./parts/CopyButton";

// The ink dot on a lime field: the live dot, in Field Ink, still under reduced motion.
function InkDot() {
  return (
    <span aria-hidden="true" className="relative inline-block size-2 shrink-0">
      <span className="absolute inset-0 rounded-full bg-ink" />
      <span className="absolute inset-0 rounded-full border-[1.5px] border-ink motion-safe:animate-ping" />
    </span>
  );
}

const inkPill =
  "inline-flex h-14 shrink-0 items-center justify-center rounded-full bg-ink px-8 text-base font-semibold text-accent transition-transform duration-200 ease-out-expo active:scale-[0.97]";

function Frame({
  id,
  label,
  title,
  body,
  action,
  dot,
}: {
  id: string;
  label: string;
  title: string;
  body: ReactNode;
  action: ReactNode;
  dot?: boolean;
}) {
  return (
    <section
      data-tile
      aria-labelledby={id}
      className="on-accent flex flex-col gap-8 rounded-surface bg-accent p-8 text-ink md:flex-row md:items-end md:justify-between md:p-10"
    >
      <div className="min-w-0 space-y-3">
        <p className="flex items-center gap-2.5 text-sm font-semibold uppercase tracking-widest">
          {dot && <InkDot />}
          {label}
        </p>
        <h3 id={id} className="display max-w-[16ch] text-[clamp(2.25rem,5vw,3.75rem)]">
          {title}
        </h3>
        <div className="max-w-[46ch] text-pretty text-lg text-ink/85">{body}</div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div>
    </section>
  );
}

// The one tile on the lime field: the next thing to do, or, once there is
// nothing left to set up, the tip link with a copy button. A suspended account
// gets a plain tile instead, so bad news is never on the celebration colour.
export function NextStepCard({ step, handle, suspended }: { step: NextStep | null; handle: string; suspended?: boolean }) {
  if (suspended) {
    return (
      <section
        data-tile
        aria-labelledby="hero-title"
        className="space-y-4 rounded-surface border border-line bg-raised p-8 md:p-10"
      >
        <h3 id="hero-title" className="display text-[clamp(2.25rem,5vw,3.75rem)]">
          Your account is suspended.
        </h3>
        <p className="max-w-[46ch] text-pretty text-lg text-muted">
          Your tip page is switched off. Contact support to find out why.
        </p>
        <Link
          href="/contact"
          className="inline-flex h-12 items-center rounded-full border border-control px-6 text-sm font-medium text-text transition-colors hover:border-muted"
        >
          Contact support
        </Link>
      </section>
    );
  }
  if (step) {
    return (
      <Frame
        id="hero-title"
        label="Next step"
        title={step.title}
        body={step.body}
        action={
          <a href={step.href} className={inkPill}>
            <RollText>{step.action}</RollText>
          </a>
        }
      />
    );
  }
  const url = `https://${SITE_HOST}/${handle}`;
  return (
    <Frame
      id="hero-title"
      label="Tips are open"
      dot
      title="Your tip page is live."
      body={
        <>
          Share <span className="numeric font-medium text-ink">{SITE_HOST}/{handle}</span> with your community.
        </>
      }
      action={<CopyButton onLime value={url} label="Copy my link" className={inkPill} />}
    />
  );
}

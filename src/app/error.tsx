"use client";

import { useEffect } from "react";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";

// Anything that breaks on a page without its own error screen lands here, in
// the same voice as the 404: one Display line and a lime pill.
export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-7xl px-6 pb-28 pt-16 md:pt-28">
        <p className="numeric text-sm text-muted">Error</p>
        <h1 className="display mt-4 max-w-[14ch] text-[clamp(2.75rem,9vw,5.5rem)]">Something broke on our side.</h1>
        <p className="mt-6 max-w-[46ch] text-pretty text-lg text-muted">
          Try again in a moment. If it keeps happening, tell us on the contact page.
        </p>
        {error.digest && (
          <p className="mt-4 text-sm text-muted">
            Reference <span className="numeric text-text">{error.digest}</span>
          </p>
        )}
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex h-14 items-center rounded-full bg-accent px-8 text-base font-semibold text-ink transition-transform duration-150 ease-out-expo active:scale-[0.97]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-base font-medium text-text underline decoration-line underline-offset-4 transition-colors duration-200 hover:decoration-accent"
          >
            Back to home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { DashboardShell } from "./parts/DashboardShell";

// A dashboard page that fails to load (most often the database) keeps the
// dashboard frame and offers a retry, instead of a blank screen.
export default function DashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-7xl px-6 pb-24 pt-12 md:pt-20">
        <h1 className="display max-w-[14ch] text-[clamp(2.5rem,8vw,5rem)]">Your dashboard did not load.</h1>
        <p className="mt-6 max-w-[46ch] text-pretty text-lg text-muted">
          That was on our side. Try again in a moment.
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
            href="/contact"
            className="text-base font-medium text-text underline decoration-line underline-offset-4 transition-colors duration-200 hover:decoration-accent"
          >
            Contact support
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}

"use client";

import { useEffect } from "react";
import { buttonClass } from "@/components/admin/tones";

// A page that threw while rendering. The owner sees that it failed (never an empty
// page that looks like "no data") and can try again; the digest ties it to the log.
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="space-y-4 rounded-surface border border-red-400/50 bg-surface p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-red-300">
        <span aria-hidden="true">▲ </span>This page broke
      </p>
      <p className="max-w-2xl text-sm text-text">
        Something went wrong while loading it. Nothing was changed. Try again; if it keeps happening, the server log has
        the reason.
      </p>
      {error.digest && <p className="numeric text-xs text-muted">Reference {error.digest}</p>}
      <button type="button" onClick={() => retry()} className={buttonClass("primary", "md")}>
        Try again
      </button>
    </div>
  );
}

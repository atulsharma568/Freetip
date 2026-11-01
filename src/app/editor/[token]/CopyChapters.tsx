"use client";

import { useState } from "react";

// Copies a stream's moments in the form YouTube turns into chapters when pasted into the
// video's description. The text is built on the server (and tested); this only copies it.
export function CopyChapters({ text, reason }: { text: string | null; reason: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!text) return <span className="text-xs text-muted">{reason}</span>;
  return (
    <button
      type="button"
      className="h-11 rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? "Copied" : "Copy as YouTube chapters"}
    </button>
  );
}

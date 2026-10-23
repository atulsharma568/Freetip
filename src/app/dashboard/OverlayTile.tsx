"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { generateOverlayLink } from "@/app/actions/creator";

const SIZES = [
  { label: "1080p", w: 1920, h: 1080 },
  { label: "2K", w: 2560, h: 1440 },
  { label: "Vertical", w: 1080, h: 1920 },
];

export function OverlayTile({ hasLink }: { hasLink: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  function create() {
    if (hasLink && !url && !window.confirm("Your current link will stop working. Create a new one?")) {
      return;
    }
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await generateOverlayLink();
      if (res.status === "ok") setUrl(res.url);
      else setError(res.message);
    });
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="space-y-4">
      {url ? (
        <div className="space-y-2">
          <label htmlFor="overlay-url" className="text-xs text-muted">
            Your alert link. It is shown once, so copy it now. Anyone with it can see your alerts,
            so keep it off screen.
          </label>
          <div className="flex gap-2">
            <input
              id="overlay-url"
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="numeric h-12 min-w-0 flex-1 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-sm text-text focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="h-12 shrink-0 rounded-full border border-control px-5 text-sm text-text transition-colors hover:border-accent"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {hasLink
            ? "You have an alert link. For safety it can't be shown again; create a new one if you lost it."
            : "Create a private link, then add it to OBS as a Browser source."}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={create}
        disabled={pending}
        className="inline-flex h-12 items-center rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-opacity duration-200 disabled:opacity-40"
      >
        {pending ? "Creating…" : hasLink || url ? "Create a new link" : "Create link"}
      </button>

      <div className="space-y-2 border-t border-line/60 pt-4 text-sm text-muted">
        <p>In OBS: Sources, add Browser, paste the link, then set the size for your scene:</p>
        <ul className="space-y-1">
          {SIZES.map((s) => (
            <li key={s.label} className="flex justify-between gap-4">
              <span className="text-text">{s.label}</span>
              <span className="numeric">
                {s.w} × {s.h}
              </span>
            </li>
          ))}
        </ul>
        <p>
          <Link
            href="/overlay/preview"
            target="_blank"
            className="text-text underline decoration-line underline-offset-4 hover:decoration-accent"
          >
            Preview the alerts
          </Link>{" "}
          (samples only).
        </p>
      </div>
    </div>
  );
}

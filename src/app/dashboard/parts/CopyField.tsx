"use client";

import type { ReactNode } from "react";
import { CopyButton } from "./CopyButton";
import { pillOutline } from "./styles";

// A read-only value (a link, a command, a token) with its label, an optional
// warning line and a Copy button. Stacks on a phone so the button never
// squeezes the value.
export function CopyField({
  id,
  value,
  label,
  note,
}: {
  id: string;
  value: string;
  label: string;
  note?: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm text-text">
        {label}
      </label>
      <div className="flex flex-col gap-2 min-[420px]:flex-row">
        <input
          id={id}
          readOnly
          value={value}
          aria-describedby={note ? `${id}-note` : undefined}
          onFocus={(e) => e.currentTarget.select()}
          className="numeric h-12 min-w-0 flex-1 rounded-[var(--radius-field)] border border-control bg-ground px-4 text-sm text-text focus:border-accent"
        />
        <CopyButton
          value={value}
          label="Copy"
          className={`${pillOutline} h-12 w-full`}
          wrap="flex w-full min-[420px]:w-auto min-[420px]:shrink-0"
        />
      </div>
      {note && (
        <p id={`${id}-note`} className="text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  );
}

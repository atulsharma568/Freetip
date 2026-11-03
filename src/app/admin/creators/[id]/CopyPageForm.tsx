"use client";

import { useState } from "react";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { FIELD_CLASS } from "@/components/admin/tones";
import type { AdminAction } from "@/lib/admin/action-state";

// A creator whose page can be copied, as the picker lists it.
export interface CopySource {
  id: number;
  handle: string;
  // The creator has a published custom page (otherwise the normal page is what would be copied).
  custom: boolean;
}

// Copy another creator's tip page into this creator's draft. The button appears once a creator is
// picked, and asks twice, because it replaces the draft this creator has now.
export function CopyPageForm({ sources, copyAction, hasDraft }: { sources: CopySource[]; copyAction: AdminAction; hasDraft: boolean }) {
  const [source, setSource] = useState("");
  const picked = sources.find((s) => String(s.id) === source);
  return (
    <div className="max-w-xs space-y-3">
      <label className="block space-y-1 text-xs text-muted">
        Copy another creator&apos;s page as a template
        <select value={source} onChange={(e) => setSource(e.target.value)} className={`${FIELD_CLASS} block w-full`}>
          <option value="">Pick a creator</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.handle}
              {s.custom ? " (custom page)" : ""}
            </option>
          ))}
        </select>
      </label>
      {picked && (
        <ConfirmAction
          key={picked.id}
          action={copyAction}
          hidden={{ source: String(picked.id) }}
          label="Copy into the draft"
          description={`Put ${picked.handle}'s page into this creator's draft. Their pictures and goal pick are not copied. ${
            hasDraft ? "This replaces the draft they have now. " : ""
          }Nothing changes for fans until you publish.`}
          confirmLabel="Copy"
          pendingLabel="Copying…"
          tone="quiet"
        />
      )}
    </div>
  );
}

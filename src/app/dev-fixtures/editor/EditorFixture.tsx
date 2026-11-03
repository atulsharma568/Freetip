"use client";

import { useEffect, useMemo } from "react";
import { PageEditor, type EditorStart } from "@/app/admin/creators/[id]/page/PageEditor";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { parsePageDoc, validateForPublish } from "@/lib/page-doc/parse";
import type { PageDoc } from "@/lib/page-doc/types";

// What the browser tests read and steer: every save and publish the editor made, and switches to
// make the next save fail as a conflict, or slow every call down.
export interface EditorFixtureControl {
  saves: { base: unknown; next: unknown }[];
  publishes: number;
  discards: number;
  conflictNext: boolean;
  delayMs: number;
  draft: PageDoc | null;
  published: PageDoc | null;
}

declare global {
  interface Window {
    __editorFixture?: EditorFixtureControl;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The editor with its three server calls replaced by an in-memory copy of the store's rules, so
// the browser can test the whole editor without a database.
export function EditorFixture({ owner }: { owner: boolean }) {
  const { start, control, save, publish, discard } = useMemo(() => {
    const doc = owner ? ownerPageDoc() : defaultPageDoc();
    const start: EditorStart = { doc, base: null, published: null, source: "default", fallback: doc };
    const control: EditorFixtureControl = { saves: [], publishes: 0, discards: 0, conflictNext: false, delayMs: 0, draft: null, published: null };
    return {
      start,
      control,
      save: async (base: unknown, next: PageDoc) => {
        await wait(control.delayMs);
        control.saves.push({ base, next });
        if (control.conflictNext) {
          control.conflictNext = false;
          return { ok: false as const, message: "This page was changed somewhere else.", conflict: true };
        }
        if (JSON.stringify(base) !== JSON.stringify(control.draft)) return { ok: false as const, message: "This page was changed somewhere else.", conflict: true };
        const parsed = parsePageDoc(next);
        if (!parsed) return { ok: false as const, message: "This draft is not a page.", conflict: false };
        control.draft = parsed.doc;
        return { ok: true as const, doc: parsed.doc, notes: parsed.notes };
      },
      publish: async () => {
        await wait(control.delayMs);
        const checked = validateForPublish(control.draft);
        if (!checked.ok) return { ok: false as const, message: checked.message };
        if (JSON.stringify(control.published) === JSON.stringify(checked.doc)) return { ok: false as const, message: "The published page is already this draft." };
        control.published = checked.doc;
        control.publishes += 1;
        return { ok: true as const, message: "Published." };
      },
      discard: async () => {
        await wait(control.delayMs);
        control.draft = null;
        control.discards += 1;
        return { ok: true as const, message: "The draft is gone." };
      },
    };
  }, [owner]);
  // The tests wait for this to exist before they steer or read the fixture.
  useEffect(() => {
    window.__editorFixture = control;
  }, [control]);
  return (
    <div className="min-h-dvh bg-ground p-6 text-text">
      <div className="mx-auto max-w-7xl">
        <PageEditor start={start} previewSrc={`/dev-fixtures/preview?page=${owner ? "owner" : "default"}`} creatorName="Sample Creator" save={save} publish={publish} discard={discard} />
      </div>
    </div>
  );
}

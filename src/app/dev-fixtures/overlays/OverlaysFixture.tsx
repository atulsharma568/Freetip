"use client";

import { useEffect, useMemo } from "react";
import { OverlayEditor, type OverlayStart } from "@/app/admin/creators/[id]/overlays/OverlayEditor";
import { checkDraft, draftFromLive, overlayParts, parseOverlayDraft, sameValues, type OverlayDraft } from "@/lib/overlay-doc/draft";

// What the browser tests read and steer: every save, publish, swap and discard the editor made, and
// switches to make the next save fail as a conflict, or slow every call down.
export interface OverlaysFixtureControl {
  saves: { base: unknown; next: unknown }[];
  publishes: number;
  swaps: number;
  discards: number;
  conflictNext: boolean;
  delayMs: number;
  draft: OverlayDraft | null;
  live: OverlayDraft;
}

declare global {
  interface Window {
    __overlaysFixture?: OverlaysFixtureControl;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ALL = ["pageBuilder", "alertText", "alertMotion", "alertLayout", "overlayThemes"];

// The editor with its four server calls replaced by an in-memory copy of the store's rules (the
// same pure checks), so the browser can test the whole editor without a database.
export function OverlaysFixture({ motionOnly, fontClasses }: { motionOnly: boolean; fontClasses: string }) {
  const features = motionOnly ? ["pageBuilder", "alertMotion"] : ALL;
  const { start, control, save, publish, swap, discard } = useMemo(() => {
    const row = { paid_features: features, accent: null };
    const empty = { alertText: null, alertMotion: null, alertLayout: null, theme: "classic", font: "default", goalBar: null };
    const live = draftFromLive(empty, null, overlayParts(row));
    const start: OverlayStart = { doc: live, base: null, live, source: "live", hasPrevious: false };
    const control: OverlaysFixtureControl = { saves: [], publishes: 0, swaps: 0, discards: 0, conflictNext: false, delayMs: 0, draft: null, live };
    return {
      start,
      control,
      save: async (base: unknown, next: OverlayDraft) => {
        await wait(control.delayMs);
        control.saves.push({ base, next });
        if (control.conflictNext) {
          control.conflictNext = false;
          return { ok: false as const, message: "The overlays were changed somewhere else.", conflict: true };
        }
        if (JSON.stringify(base) !== JSON.stringify(control.draft)) return { ok: false as const, message: "The overlays were changed somewhere else.", conflict: true };
        const doc = parseOverlayDraft(next);
        if (!doc) return { ok: false as const, message: "This draft is not an overlay draft.", conflict: false };
        control.draft = doc;
        return { ok: true as const, doc };
      },
      publish: async () => {
        await wait(control.delayMs);
        const draft = parseOverlayDraft(control.draft);
        if (!draft) return { ok: false as const, message: "There is no draft to publish." };
        const checked = checkDraft(draft, row);
        if (!checked.ok) return { ok: false as const, message: checked.message };
        const now = checkDraft(control.live, row);
        if (now.ok && sameValues(checked.values, now.values)) return { ok: false as const, message: "The live overlays are already this draft." };
        control.live = draft;
        control.publishes += 1;
        return { ok: true as const, message: "Published. The next alert and the goal bar use this now." };
      },
      swap: async () => {
        await wait(control.delayMs);
        control.swaps += 1;
        return { ok: false as const, message: "There is no earlier version to swap with." };
      },
      discard: async () => {
        await wait(control.delayMs);
        control.discards += 1;
        control.draft = null;
        return { ok: true as const, message: "The draft is gone." };
      },
    };
    // The made-up creator never changes while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    window.__overlaysFixture = control;
    return () => {
      delete window.__overlaysFixture;
    };
  }, [control]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-6">
      <h1 className="text-lg font-semibold text-text">Overlay editor (fixture)</h1>
      <OverlayEditor start={start} creatorName="Fixture creator" features={features} accent={null} fontClasses={fontClasses} save={save} publish={publish} swap={swap} discard={discard} />
    </div>
  );
}

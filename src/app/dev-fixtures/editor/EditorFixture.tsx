"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { PageEditor, type EditorStart } from "@/app/admin/creators/[id]/page/PageEditor";
import { FIXTURE_GOALS } from "../tip/fixture-data";
import { usedAssetIds } from "@/lib/page-doc/assets";
import type { AssetListItem } from "@/lib/page-doc/asset-store";
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
  // The ids of the made-up library files removed so far.
  removed: number[];
}

declare global {
  interface Window {
    __editorFixture?: EditorFixtureControl;
  }
}

// The made-up library: the same three files as FIXTURE_ASSETS in the tip page fixture.
const LIBRARY: AssetListItem[] = [
  { id: 1, kind: "image", name: "Kitsune", url: "/owner/kitsune.svg", posterUrl: null, sizeBytes: 40_000, durationMs: null, createdAt: "2026-11-03T00:00:00.000Z", usedBy: [] },
  { id: 2, kind: "gif", name: "Embers", url: "/example-alert.gif", posterUrl: "/owner/kitsune.svg", sizeBytes: 900_000, durationMs: null, createdAt: "2026-11-03T00:00:00.000Z", usedBy: [] },
  { id: 3, kind: "webm", name: "Loop", url: "/fixture/loop.webm", posterUrl: "/owner/kitsune.svg", sizeBytes: 4_000_000, durationMs: 8000, createdAt: "2026-11-03T00:00:00.000Z", usedBy: [] },
];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// The editor with its three server calls replaced by an in-memory copy of the store's rules, so
// the browser can test the whole editor without a database.
export function EditorFixture({ owner, meterSwitchOn = true }: { owner: boolean; meterSwitchOn?: boolean }) {
  const { start, control, save, publish, discard, remove, add } = useMemo(() => {
    const doc = owner ? ownerPageDoc() : defaultPageDoc();
    const start: EditorStart = { doc, base: null, published: null, source: "default", fallback: doc };
    const control: EditorFixtureControl = { saves: [], publishes: 0, discards: 0, conflictNext: false, delayMs: 0, draft: null, published: null, removed: [] };
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
      // Uploads need a real Blob store; the fixture only has what is already in the library.
      add: async () => ({ ok: false as const, message: "Uploads are not part of the fixture." }),
      // The same rule as the store: a file in the draft or the published page cannot be removed.
      remove: async (assetId: number) => {
        await wait(control.delayMs);
        const used = [
          ...(control.draft && usedAssetIds(control.draft).includes(assetId) ? ["the draft"] : []),
          ...(control.published && usedAssetIds(control.published).includes(assetId) ? ["the published page"] : []),
        ];
        if (used.length) return { ok: false as const, message: `Still used by ${used.join(" and ")}.` };
        control.removed.push(assetId);
        return { ok: true as const, assets: LIBRARY.filter((a) => !control.removed.includes(a.id)) };
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
        {/* A way out by a client-side navigation, as the admin links are, for the tests. */}
        <Link href="/dev-fixtures/tip?page=default" className="mb-4 inline-block text-sm text-muted underline">
          Leave the editor (test)
        </Link>
        <PageEditor start={start} previewSrc={`/dev-fixtures/preview?page=${owner ? "owner" : "default"}`} creatorName="Sample Creator" save={save} publish={publish} discard={discard} creatorId={1} library={{ items: LIBRARY, error: null }} addAsset={add} removeAsset={remove} goals={FIXTURE_GOALS.map((g) => ({ id: g.id, title: g.title, repeat: g.repeat }))} meterSwitchOn={meterSwitchOn} />
      </div>
    </div>
  );
}

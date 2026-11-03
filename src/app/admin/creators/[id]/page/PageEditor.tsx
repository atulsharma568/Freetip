"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/admin/tones";
import { BLOCK_LABELS } from "@/lib/page-doc/blocks";
import { addBlock, moveBlock, moveBlockTo, setVisible, type EditResult } from "@/lib/page-doc/edit";
import type { PageResult, SaveResult } from "@/lib/page-doc/store";
import type { BlockType, PageDoc } from "@/lib/page-doc/types";
import type { PageAssetResult } from "@/app/actions/page-assets";
import type { AssetListItem } from "@/lib/page-doc/asset-store";
import { usedAssetIds } from "@/lib/page-doc/assets";
import { BlockList, type Selection } from "./BlockList";
import { BlockSettings } from "./BlockSettings";
import type { EditorGoal } from "./MeterSettings";
import type { AssetLibrary } from "./AssetPicker";
import { PreviewFrame, type PreviewView } from "./PreviewFrame";

// What the editor opens with (see loadDraft in the store).
export interface EditorStart {
  // The page to edit: the saved draft, else the published page, else the creator's normal page.
  doc: PageDoc;
  // The draft exactly as stored (null when there is none); sent back with every save.
  base: unknown;
  published: PageDoc | null;
  source: "draft" | "published" | "default";
  // The creator's normal page, for "Revert to published" when nothing is published.
  fallback: PageDoc;
}

// The creator's pictures as the page opened with them. `error` is set when they cannot be read.
export interface LibraryStart {
  items: AssetListItem[];
  error: string | null;
}

export type SaveDraft = (base: unknown, next: PageDoc) => Promise<SaveResult>;
export type PageAction = () => Promise<PageResult>;

const AUTOSAVE_MS = 1500;
const same = (a: PageDoc | null, b: PageDoc | null) => JSON.stringify(a) === JSON.stringify(b);

// The owner's editor for a creator's tip page. The working draft lives here; it is saved on its
// own a moment after the last change (the store only accepts a save made from the draft it last
// handed out, so a second tab cannot overwrite this one), and Publish is allowed only for a draft
// that is saved and different from the published page. The preview is the real page, drawn from
// the working draft.
export function PageEditor({
  start,
  previewSrc,
  creatorName,
  save,
  publish,
  discard,
  creatorId,
  library: libraryStart,
  addAsset,
  removeAsset,
  goals,
  meterSwitchOn,
}: {
  start: EditorStart;
  previewSrc: string;
  creatorName: string;
  save: SaveDraft;
  publish: PageAction;
  discard: PageAction;
  creatorId: number;
  library: LibraryStart;
  addAsset: AssetLibrary["add"];
  removeAsset: (assetId: number) => Promise<PageAssetResult>;
  // The creator's goals (for the Pressure meter's goal picker) and whether the meter switch is on.
  goals: EditorGoal[];
  meterSwitchOn: boolean;
}) {
  const [doc, setDoc] = useState(start.doc);
  const docRef = useRef(start.doc);
  const baseRef = useRef<unknown>(start.base);
  // The document last accepted by the store (as the owner typed it), to tell what is unsaved.
  const [sentJson, setSentJson] = useState(() => JSON.stringify(start.doc));
  // The same value and the save state, for the moment the editor is left (see below).
  const sentRef = useRef(sentJson);
  const busyRef = useRef(false);
  // The saved draft as the store cleaned it. Null until there is one.
  const [savedDoc, setSavedDoc] = useState<PageDoc | null>(start.source === "draft" ? start.doc : null);
  const [published, setPublished] = useState(start.published);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [selected, setSelected] = useState<Selection>("amount");
  const [view, setView] = useState<PreviewView>("phone");
  const [announce, setAnnounce] = useState("");
  const [asking, setAsking] = useState<"publish" | "revert" | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = JSON.stringify(doc) !== sentJson;

  // The pictures. When the list changes the preview frame loads again, because it reads the files
  // when it loads.
  const [items, setItems] = useState(libraryStart.items);
  const [reloadKey, setReloadKey] = useState(0);
  const library: AssetLibrary = {
    creatorId,
    items,
    draftIds: usedAssetIds(doc),
    error: libraryStart.error,
    add: addAsset,
    remove: removeAsset,
    onItems: (next) => {
      setItems(next);
      setReloadKey((n) => n + 1);
    },
  };

  // Every change goes through here: it works on the latest document, keeps it, and hands the
  // result back so the caller can show why a change was refused.
  const run = useCallback(<R extends EditResult>(change: (d: PageDoc) => R): R => {
    const result = change(docRef.current);
    if (result.changed) {
      docRef.current = result.doc;
      setDoc(result.doc);
      setSaveError(null);
      setNotice(null);
      // A question about publishing or reverting was about the draft as it was; ask again.
      setAsking(null);
    }
    return result;
  }, []);

  // Saves a moment after the last change. Stops on a conflict or an error until the owner acts.
  useEffect(() => {
    if (!dirty || saving || conflict || saveError) return;
    const timer = setTimeout(async () => {
      const sent = docRef.current;
      const json = JSON.stringify(sent);
      setSaving(true);
      busyRef.current = true;
      try {
        const result = await save(baseRef.current, sent);
        if (result.ok) {
          baseRef.current = result.doc;
          sentRef.current = json;
          setSentJson(json);
          setSavedDoc(result.doc);
          setNotes(result.notes);
        } else if (result.conflict) setConflict(true);
        else setSaveError(result.message);
      } catch {
        setSaveError("Could not reach the server. Check the connection and try again.");
      } finally {
        busyRef.current = false;
        setSaving(false);
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, doc, saving, conflict, saveError, save]);

  // Leaving the editor by a link inside the site (the tab is not closed, so no warning can ask):
  // send the change that was still waiting. Best effort; a save already on its way is left alone.
  useEffect(
    () => () => {
      if (busyRef.current || JSON.stringify(docRef.current) === sentRef.current) return;
      save(baseRef.current, docRef.current).catch(() => {});
    },
    [save],
  );

  // A warning if the tab is closed with a change that is not saved yet.
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  function move(type: BlockType, direction: "up" | "down") {
    const r = run((d) => moveBlock(d, type, direction));
    if (r.changed) {
      const section = r.doc.blocks.filter((b) => b.slot === r.doc.blocks.find((x) => x.type === type)!.slot);
      setAnnounce(`Moved ${BLOCK_LABELS[type]} ${direction}. Now ${section.findIndex((b) => b.type === type) + 1} of ${section.length}.`);
    }
  }

  function drop(type: BlockType, target: BlockType) {
    const r = run((d) => moveBlockTo(d, type, target));
    if (r.changed) setAnnounce(`Moved ${BLOCK_LABELS[type]}.`);
  }

  function visible(type: BlockType, on: boolean) {
    const r = run((d) => setVisible(d, type, on));
    if (r.changed) setAnnounce(`${BLOCK_LABELS[type]} is now ${on ? "shown" : "hidden"}.`);
    else if (r.problems[0]) setAnnounce(r.problems[0]);
  }

  function add(type: "backdrop" | "pressureMeter") {
    const r = run((d) => addBlock(d, type));
    if (r.changed) {
      setSelected(type);
      setAnnounce(type === "backdrop" ? "Added a picture backdrop behind the page." : "Added a Pressure meter under the header.");
    } else if (r.problems[0]) setAnnounce(r.problems[0]);
  }

  async function doPublish() {
    setWorking(true);
    try {
      const r = await publish();
      setAsking(null);
      if (r.ok) setPublished(savedDoc);
      setNotice({ ok: r.ok, text: r.ok ? "Published. Fans see this page now." : r.message });
    } catch {
      setNotice({ ok: false, text: "Could not reach the server. Nothing was published." });
    } finally {
      setWorking(false);
    }
  }

  async function doRevert() {
    setWorking(true);
    try {
      const r = await discard();
      setAsking(null);
      if (r.ok) {
        const back = published ?? start.fallback;
        docRef.current = back;
        baseRef.current = null;
        setDoc(back);
        sentRef.current = JSON.stringify(back);
        setSentJson(sentRef.current);
        setSavedDoc(null);
        setNotes([]);
        setConflict(false);
        setSaveError(null);
      }
      setNotice({ ok: r.ok, text: r.ok ? "Back to the published page. The draft is gone." : r.message });
    } catch {
      setNotice({ ok: false, text: "Could not reach the server. The draft is still there." });
    } finally {
      setWorking(false);
    }
  }

  const status = conflict
    ? "Changed somewhere else"
    : saveError
      ? "Not saved"
      : saving
        ? "Saving…"
        : dirty
          ? "Changes not saved yet"
          : savedDoc
            ? "Draft saved"
            : "Nothing changed yet";
  const unpublished = savedDoc !== null && !same(savedDoc, published);
  const canPublish = !dirty && !saving && !conflict && !saveError && unpublished && !working;
  const canRevert = (savedDoc !== null || dirty) && !working && !saving;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p role="status" className="text-sm font-medium text-text">
            {status}
          </p>
          <p className="text-xs text-muted">
            {savedDoc === null ? "Nothing saved yet." : unpublished ? "The saved draft is not published." : "The saved draft is the published page."}{" "}
            Fans see {published ? "the published page" : `${creatorName}'s normal page`} until you publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {saveError && (
            <button type="button" onClick={() => setSaveError(null)} className={buttonClass("quiet", "md")}>
              Try saving again
            </button>
          )}
          {conflict && (
            <button type="button" onClick={() => window.location.reload()} className={buttonClass("primary", "md")}>
              Reload the latest draft
            </button>
          )}
          <button type="button" disabled={!canRevert} onClick={() => setAsking(asking === "revert" ? null : "revert")} aria-expanded={asking === "revert"} className={buttonClass("quiet", "md")}>
            Revert to published
          </button>
          <button type="button" disabled={!canPublish} onClick={() => setAsking(asking === "publish" ? null : "publish")} aria-expanded={asking === "publish"} className={buttonClass("primary", "md")}>
            Publish
          </button>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-warn">
          <span aria-hidden="true">● </span>
          {saveError}
        </p>
      )}
      {conflict && (
        <p role="alert" className="text-sm text-warn">
          <span aria-hidden="true">● </span>
          This page was changed somewhere else (another tab, or an earlier visit). Saving has stopped so nothing is overwritten.
          Reload to see the latest draft; your changes on this screen are not saved.
        </p>
      )}
      {notes.length > 0 && (
        <div className="rounded-surface border border-control bg-surface p-3 text-xs text-muted">
          <p className="font-medium text-text">The draft was tidied when it was saved:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}
      {asking && (
        <div className="max-w-md space-y-3 rounded-surface border border-control bg-raised p-4">
          <p className="text-sm text-text">
            {asking === "publish"
              ? `Publish this draft? Fans of ${creatorName} see it at once. The page they have now is kept as the previous version.`
              : "Throw the draft away and go back to the published page? The changes in the draft are lost."}
          </p>
          <div className="flex gap-2">
            <button type="button" autoFocus disabled={working} onClick={asking === "publish" ? doPublish : doRevert} className={buttonClass(asking === "publish" ? "primary" : "danger", "md")}>
              {working ? "Working…" : asking === "publish" ? "Publish now" : "Revert"}
            </button>
            <button type="button" disabled={working} onClick={() => setAsking(null)} className={buttonClass("quiet", "md")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className={`text-sm ${notice.ok ? "text-text" : "text-warn"}`}>
          <span aria-hidden="true">{notice.ok ? "✓ " : "● "}</span>
          {notice.text}
        </p>
      )}
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>

      <p className="rounded-surface border border-control bg-surface p-4 text-sm text-muted lg:hidden">
        Open this page on a laptop to edit the tip page. The editor needs a wide screen.
      </p>

      <div className="hidden items-start gap-6 lg:grid lg:grid-cols-[21rem_minmax(0,1fr)]">
        <div className="max-h-[calc(100dvh-2rem)] space-y-6 overflow-y-auto pr-1 lg:sticky lg:top-4">
          <BlockList doc={doc} selected={selected} onSelect={setSelected} onMove={move} onDrop={drop} onVisible={visible} onAdd={add} meterSwitchOn={meterSwitchOn} />
          <hr className="border-control" />
          <BlockSettings doc={doc} selected={selected} run={run} library={library} goals={goals} meterSwitchOn={meterSwitchOn} />
        </div>
        <PreviewFrame
          src={previewSrc}
          doc={doc}
          selected={selected === "theme" ? null : selected}
          view={view}
          onView={setView}
          onPick={setSelected}
          reloadKey={reloadKey}
        />
      </div>
    </div>
  );
}

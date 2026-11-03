"use client";

import { useId, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { buttonClass } from "@/components/admin/tones";
import type { PageAssetResult } from "@/app/actions/page-assets";
import { ASSET_LIMITS, kindsFor, pageAssetPrefix, type AssetUse } from "@/lib/page-doc/assets";
import type { AssetListItem } from "@/lib/page-doc/asset-store";
import { cleanMediaName, mediaFileName, ALL_MEDIA_CONTENT_TYPES } from "@/lib/media";
import { prepareFile } from "./prepare-file";

// The creator's library of pictures, as the editor sees it: what is there, how to change it (the
// two actions are bound to this creator) and where the editor is told the list changed.
export interface AssetLibrary {
  creatorId: number;
  items: AssetListItem[];
  // The files the working draft on screen uses right now (newer than the saved draft the list was
  // read with), so "used by" is right the moment a picture is taken off a block.
  draftIds: readonly number[];
  // Set when the library cannot be read (migration 0052 not run); the picker then says so.
  error: string | null;
  add: (input: { url: string; posterUrl: string | null; name: string; durationMs: number | null; width: number | null; height: number | null }) => Promise<PageAssetResult>;
  remove: (assetId: number) => Promise<PageAssetResult>;
  onItems: (items: AssetListItem[]) => void;
}

// Where a file is used: the working draft as it is on screen, then the stored published and
// previous pages.
function usedBy(a: AssetListItem, draftIds: readonly number[]): string[] {
  return [...(draftIds.includes(a.id) ? ["the draft"] : []), ...a.usedBy.filter((label) => label !== "the draft")];
}

const KIND_LABEL = { image: "Picture", gif: "GIF", webm: "Video" } as const;

function size(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Picks the picture of a block from the library, uploads a new one, replaces one everywhere it is
// used, or removes one that is no longer used. Nothing here is live until Publish: picking and
// replacing only change the draft, and an upload only adds a file to the library.
export function AssetPicker({
  use,
  value,
  library,
  onPick,
  onSwap,
}: {
  use: AssetUse;
  value: number | null;
  library: AssetLibrary;
  onPick: (id: number | null) => void;
  onSwap: (from: number, to: number, kind: AssetListItem["kind"]) => void;
}) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const mode = useRef<"add" | "replace">("add");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState<number | null>(null);

  const kinds = kindsFor(use);
  const items = library.items.filter((a) => kinds.includes(a.kind));
  const current = value === null ? null : (library.items.find((a) => a.id === value) ?? null);

  function choose(next: "add" | "replace") {
    mode.current = next;
    input.current?.click();
  }

  async function send(file: File) {
    setMessage(null);
    const fail = (text: string) => setMessage({ ok: false, text });
    try {
      setBusy("Checking the file…");
      const prepared = await prepareFile(file);
      if (!prepared.ok) return fail(prepared.reason);
      const { file: info } = prepared;
      if (!kinds.includes(info.kind)) return fail(`${use === "meter" ? "The meter picture" : "A banner"} can be a picture or a GIF, not a video.`);

      const name = cleanMediaName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")) || "New file";
      const prefix = pageAssetPrefix(library.creatorId);
      setBusy("Uploading…");
      const main = await upload(`${prefix}${mediaFileName(name, info.mime)}`, file, {
        access: "public",
        handleUploadUrl: "/api/page-assets/upload",
        contentType: info.mime,
      });
      let posterUrl: string | null = null;
      if (info.poster) {
        const still = await upload(`${prefix}${mediaFileName(`still ${name}`, info.poster.type)}`, info.poster, {
          access: "public",
          handleUploadUrl: "/api/page-assets/upload",
          contentType: info.poster.type,
        });
        posterUrl = still.url;
      }
      setBusy("Saving…");
      const saved = await library.add({ url: main.url, posterUrl, name, durationMs: info.durationMs, width: info.width, height: info.height });
      if (!saved.ok) return fail(saved.message);
      library.onItems(saved.assets);
      if (saved.id !== undefined) {
        const added = saved.assets.find((a) => a.id === saved.id);
        if (mode.current === "replace" && value !== null && added) onSwap(value, saved.id, added.kind);
        else onPick(saved.id);
      }
      setMessage({
        ok: true,
        text: mode.current === "replace" && value !== null ? "Replaced in the draft. Fans see it after you publish." : "Added and picked. Fans see it after you publish.",
      });
    } catch (err) {
      console.error("Page asset upload failed", err);
      fail("The upload did not work. Check the connection and try again.");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: number) {
    setMessage(null);
    setBusy("Removing…");
    try {
      const result = await library.remove(id);
      if (result.ok) {
        library.onItems(result.assets);
        setMessage({ ok: true, text: "Removed. The file is deleted." });
      } else setMessage({ ok: false, text: result.message });
    } catch {
      setMessage({ ok: false, text: "Could not reach the server. Nothing was removed." });
    } finally {
      setConfirming(null);
      setBusy(null);
    }
  }

  if (library.error) {
    return (
      <p role="alert" className="text-xs text-warn">
        <span aria-hidden="true">● </span>
        {library.error}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold text-text">{use === "banner" ? "Banner picture" : use === "meter" ? "Meter picture" : "Picture"}</h3>
        <span className="numeric text-xs text-muted">
          {library.items.length}/{ASSET_LIMITS.files} files
        </span>
      </div>

      <ul className="grid grid-cols-2 gap-2">
        <li>
          <button
            type="button"
            aria-pressed={value === null}
            onClick={() => onPick(null)}
            className={`flex aspect-video w-full items-center justify-center rounded-field border text-xs transition-colors ${
              value === null ? "border-accent text-text" : "border-control text-muted hover:text-text"
            }`}
          >
            {use === "banner" ? "The creator's own banner" : use === "meter" ? "No picture" : "None"}
          </button>
        </li>
        {items.map((a) => (
          <li key={a.id} className="space-y-1">
            <button
              type="button"
              aria-pressed={value === a.id}
              aria-label={`${a.name}, ${KIND_LABEL[a.kind]}, ${size(a.sizeBytes)}${usedBy(a, library.draftIds).length ? `, used by ${usedBy(a, library.draftIds).join(" and ")}` : ""}`}
              onClick={() => onPick(a.id)}
              className={`relative block aspect-video w-full overflow-hidden rounded-field border bg-raised transition-colors ${
                value === a.id ? "border-accent" : "border-control hover:border-muted"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- the owner's own upload, a small thumbnail */}
              <img src={a.posterUrl ?? a.url} alt="" className="size-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded-full bg-ground/80 px-2 py-0.5 text-[0.65rem] font-medium text-text">{KIND_LABEL[a.kind]}</span>
            </button>
            <p className="flex items-center justify-between gap-1 text-[0.7rem] text-muted">
              <span className="min-w-0 truncate">
                {a.name} · {size(a.sizeBytes)}
                {a.durationMs ? ` · ${Math.round(a.durationMs / 1000)}s` : ""}
              </span>
              {confirming === a.id ? (
                <span className="flex shrink-0 gap-1">
                  <button type="button" disabled={busy !== null} onClick={() => remove(a.id)} className="font-semibold text-warn underline">
                    Delete
                  </button>
                  <button type="button" onClick={() => setConfirming(null)} className="underline">
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busy !== null || usedBy(a, library.draftIds).length > 0}
                  title={usedBy(a, library.draftIds).length > 0 ? "Take it off the page first" : undefined}
                  onClick={() => setConfirming(a.id)}
                  aria-label={`Remove ${a.name}`}
                  className="shrink-0 underline hover:text-text disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                >
                  Remove
                </button>
              )}
            </p>
            {usedBy(a, library.draftIds).length > 0 && <p className="text-[0.65rem] text-muted">Used by {usedBy(a, library.draftIds).join(" and ")}.</p>}
          </li>
        ))}
      </ul>

      <input
        id={inputId}
        ref={input}
        type="file"
        accept={ALL_MEDIA_CONTENT_TYPES.filter((t) => use === "backdrop" || t !== "video/webm").join(",")}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void send(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null || library.items.length >= ASSET_LIMITS.files} onClick={() => choose("add")} className={buttonClass("quiet", "sm")}>
          Upload a new file
        </button>
        {current && (
          <button type="button" disabled={busy !== null || library.items.length >= ASSET_LIMITS.files} onClick={() => choose("replace")} className={buttonClass("quiet", "sm")}>
            Replace &ldquo;{current.name}&rdquo;
          </button>
        )}
      </div>
      <p className="text-xs text-muted">
        {use !== "backdrop"
          ? "A picture or GIF up to 3 MB."
          : "A picture or GIF up to 3 MB, or a WebM video up to 8 MB and 15 seconds."}{" "}
        Clips made with AI tools are usually bigger: compress them first. Replace changes the draft only, and the old file stays in the
        library until you remove it.
      </p>
      <p role="status" aria-live="polite" className={`text-xs ${message ? (message.ok ? "text-text" : "text-warn") : "text-muted"}`}>
        {busy ?? (message ? `${message.ok ? "✓ " : "● "}${message.text}` : "")}
      </p>
    </div>
  );
}

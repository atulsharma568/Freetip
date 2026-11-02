"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  MEDIA_NAME_MAX,
  MEDIA_PLACEMENTS,
  MEDIA_WEBM_MAX_MS,
  checkMediaFile,
  cleanMediaName,
  mediaFileName,
  mediaPathPrefix,
  type MediaKind,
  type MediaPlacement,
  type ReviewState,
} from "@/lib/media";
import { addMedia, deleteMedia, updateMedia } from "@/app/actions/media";
import { RollText } from "@/components/motion/RollText";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { ConfirmAction } from "../parts/ConfirmAction";
import { SelectField, Toggle } from "../parts/Controls";
import { EmptyState } from "../parts/EmptyState";
import { peerRing, pillOutline, pillPrimary } from "../parts/styles";

export interface MediaRow {
  id: number;
  kind: MediaKind;
  name: string;
  url: string;
  sizeBytes: number;
  durationMs: number | null;
  placement: MediaPlacement;
  enabled: boolean;
  state: ReviewState;
}

interface Props {
  creatorId: number;
  files: MediaRow[];
  usedBytes: number;
  maxBytes: number;
  maxFiles: number;
  fileCount: number;
  uploadsReady: boolean;
}

interface Progress {
  key: number;
  file: string;
  state: "working" | "done" | "failed";
  text: string;
}

const PLACEMENT_LABEL: Record<MediaPlacement, string> = {
  above: "Above the card",
  behind: "Behind the card's text",
  fullscreen: "Across the whole screen",
};

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

const field =
  "h-11 rounded-[var(--radius-field)] border border-control bg-ground px-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent";

// What the browser can tell before uploading: the size of a picture, the length and
// size of a WebM. The server checks the file's bytes again; this only spares the
// creator a wasted upload and gives the overlay a length to wait for.
function measure(file: File, kind: MediaKind): Promise<{ width: number | null; height: number | null; durationMs: number | null }> {
  const url = URL.createObjectURL(file);
  const done = (v: { width: number | null; height: number | null; durationMs: number | null }) => {
    URL.revokeObjectURL(url);
    return v;
  };
  const none = { width: null, height: null, durationMs: null };
  if (kind === "webm") {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const timer = setTimeout(() => resolve(done(none)), 8000);
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        clearTimeout(timer);
        // A recording without a length reports Infinity: leave it unmeasured, the overlay still caps it.
        const ms = Number.isFinite(video.duration) ? Math.ceil(video.duration * 1000) : null;
        resolve(done({ width: video.videoWidth || null, height: video.videoHeight || null, durationMs: ms }));
      };
      video.onerror = () => {
        clearTimeout(timer);
        resolve(done(none));
      };
      video.src = url;
    });
  }
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(done(none)), 8000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(done({ width: img.naturalWidth || null, height: img.naturalHeight || null, durationMs: null }));
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(done(none));
    };
    img.src = url;
  });
}

export function MediaManager({ creatorId, files, usedBytes, maxBytes, maxFiles, fileCount, uploadsReady }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [busy, setBusy] = useState(false);

  const full = fileCount >= maxFiles;
  const waiting = files.some((f) => f.state === "new");

  async function handleFiles(chosen: FileList | null) {
    if (!chosen?.length || busy) return;
    setBusy(true);
    const list = Array.from(chosen);
    setProgress(list.map((f, i) => ({ key: i, file: f.name, state: "working", text: "Waiting…" })));
    const set = (key: number, state: Progress["state"], text: string) =>
      setProgress((prev) => prev.map((p) => (p.key === key ? { ...p, state, text } : p)));

    let room = maxFiles - fileCount;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      if (room <= 0) {
        set(i, "failed", `You can keep up to ${maxFiles} files.`);
        continue;
      }
      set(i, "working", "Checking…");
      // The file's first bytes decide what it is, not its name or the type the browser guessed.
      const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
      const checked = checkMediaFile(head, file.size);
      if (!checked.ok) {
        set(i, "failed", checked.reason);
        continue;
      }
      const { sniffed } = checked;
      const size = await measure(file, sniffed.kind);
      if (sniffed.kind === "webm" && size.durationMs !== null && size.durationMs > MEDIA_WEBM_MAX_MS) {
        set(i, "failed", "A WebM can be at most 10 seconds.");
        continue;
      }

      const name = cleanMediaName(file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ")) || "New file";
      try {
        set(i, "working", "Uploading…");
        const blob = await upload(`${mediaPathPrefix(creatorId)}${mediaFileName(name, sniffed.mime)}`, file, {
          access: "public",
          handleUploadUrl: "/api/media/upload",
          contentType: sniffed.mime,
        });
        set(i, "working", "Saving…");
        const saved = await addMedia({
          url: blob.url,
          name,
          placement: "above",
          durationMs: size.durationMs,
          width: size.width,
          height: size.height,
        });
        if (saved.status === "error") {
          set(i, "failed", saved.message);
          continue;
        }
        room -= 1;
        set(i, "done", "Added.");
      } catch {
        set(i, "failed", "The upload failed. Check your connection and try again.");
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {!uploadsReady && (
        <p role="alert" className="rounded-surface border border-line/60 bg-surface p-5 text-sm text-muted">
          Uploads are not switched on yet. They need a storage setting that the site owner adds.
        </p>
      )}

      <Tile id="add-media" level={2} title="Add files">
        <p className="text-sm text-muted">
          GIF, PNG, JPG or WebP up to 3 MB, or a WebM clip up to 8 MB and {MEDIA_WEBM_MAX_MS / 1000} seconds.
          You can pick several at once. Your first file waits for Freetip to look at it; after that, new
          files play as soon as they are added. Only upload what you made or have the right to use.
        </p>
        <input
          ref={input}
          id="media-files"
          type="file"
          multiple
          accept="image/gif,image/png,image/jpeg,image/webp,video/webm,.gif,.png,.jpg,.jpeg,.webp,.webm"
          disabled={!uploadsReady || busy || full}
          onChange={(e) => handleFiles(e.target.files)}
          className="peer sr-only"
        />
        <label
          htmlFor="media-files"
          className={`${pillPrimary} cursor-pointer ${peerRing} ${
            !uploadsReady || busy || full ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <RollText>{busy ? "Working…" : "Choose files"}</RollText>
        </label>
        <p className="numeric text-xs text-muted">
          {fileCount} of {maxFiles} files · {mb(usedBytes)} of {mb(maxBytes)} MB used
        </p>
        <div aria-live="polite" className="empty:hidden">
          {progress.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {progress.map((p) => (
                <li key={p.key} className="flex min-w-0 flex-wrap items-center gap-2 text-text">
                  {p.state === "failed" && (
                    <span className="shrink-0 rounded-full bg-text px-2 py-0.5 text-xs font-semibold text-ground">Problem</span>
                  )}
                  {p.state === "done" && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-accent" />}
                  <span className="min-w-0 break-words">
                    <span className="font-medium">{p.file}</span>
                    <span className={p.state === "working" ? "text-muted" : ""}>: {p.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Tile>

      {waiting && (
        <p role="status" className="rounded-surface border border-line/60 bg-surface p-5 text-sm text-muted">
          A file is waiting for Freetip to look at it. It plays on your alerts once it is approved.
        </p>
      )}

      {files.length === 0 ? (
        <Tile id="your-media" level={2} title="Your files">
          <EmptyState
            sample={
              <div className="flex items-center gap-3 rounded-field border border-line/60 bg-ground px-4 py-3 text-sm">
                <span className="text-xl">🎞️</span>
                <span className="min-w-0 flex-1 truncate font-medium text-text">Confetti.gif</span>
                <span className="shrink-0 text-muted">Above the card</span>
              </div>
            }
            title="No files yet."
            body="A file you add plays with your alerts. The one above is a sample."
            cta={
              <button
                type="button"
                disabled={!uploadsReady || busy}
                onClick={() => input.current?.click()}
                className={pillOutline}
              >
                Add your first file
              </button>
            }
          />
        </Tile>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Your files</h2>
          <ul className="space-y-3">
            {files.map((f) => (
              <MediaItem key={`${f.id}-${f.name}-${f.placement}-${f.enabled}-${f.state}`} file={f} onChanged={() => router.refresh()} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StateBadge({ file }: { file: MediaRow }) {
  if (file.state === "new") return <span className="rounded-full border border-control px-3 py-1 text-xs text-muted">Waiting for approval</span>;
  if (file.state === "removed") return <span className="rounded-full bg-text px-3 py-1 text-xs font-semibold text-ground">Taken down by Freetip</span>;
  if (!file.enabled) return <span className="rounded-full border border-control px-3 py-1 text-xs text-muted">Switched off</span>;
  return <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-ink">Playing</span>;
}

function MediaItem({ file, onChanged }: { file: MediaRow; onChanged: () => void }) {
  const [name, setName] = useState(file.name);
  const [placement, setPlacement] = useState<MediaPlacement>(file.placement);
  const [enabled, setEnabled] = useState(file.enabled);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const gone = file.state === "removed";
  const dirty = name !== file.name || placement !== file.placement || enabled !== file.enabled;

  async function save() {
    setWorking(true);
    setMessage("");
    const res = await updateMedia(file.id, { name, placement, enabled });
    setWorking(false);
    if (res.status === "error") setMessage(res.message);
    else onChanged();
  }

  async function remove() {
    setWorking(true);
    const res = await deleteMedia(file.id);
    setWorking(false);
    if (res.status === "error") setMessage(res.message);
    else onChanged();
  }

  return (
    <li className="space-y-4 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5">
      <div className="flex items-start gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-field border border-line/60 bg-ground">
          {gone ? (
            <span aria-hidden="true" className="text-2xl">🚫</span>
          ) : file.kind === "webm" ? (
            <video src={file.url} muted loop autoPlay playsInline aria-label={`Preview of ${file.name}`} className="size-full object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- a small preview of the creator's own upload
            <img src={file.url} alt={`Preview of ${file.name}`} className="size-full object-contain" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <input
            aria-label="File name"
            value={name}
            maxLength={MEDIA_NAME_MAX}
            disabled={gone}
            onChange={(e) => setName(e.target.value)}
            className={`${field} w-full`}
          />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <StateBadge file={file} />
            <span className="numeric text-xs text-muted">
              {file.kind.toUpperCase()} · {(file.sizeBytes / 1024).toFixed(0)} KB
              {file.durationMs ? ` · ${(file.durationMs / 1000).toFixed(1)} s` : ""}
            </span>
          </div>
        </div>
      </div>

      {!gone && (
        <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
          <label className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-muted">Where it shows</span>
            <SelectField value={placement} onChange={(e) => setPlacement(e.target.value as MediaPlacement)} className="w-full">
              {MEDIA_PLACEMENTS.map((p) => (
                <option key={p} value={p}>
                  {PLACEMENT_LABEL[p]}
                </option>
              ))}
            </SelectField>
          </label>
          <Toggle id={`media-enabled-${file.id}`} checked={enabled} onChange={setEnabled}>
            Play it on my alerts
          </Toggle>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty && !gone && (
          <button type="button" disabled={working} onClick={save} className={`${pillOutline} border-accent`}>
            Save
          </button>
        )}
        <ConfirmAction
          prompt={`Delete "${file.name}"? It stops playing and the file is erased.`}
          confirmLabel="Yes, delete it"
          keepLabel="Keep it"
          onConfirm={remove}
          disabled={working}
          className={pillOutline}
        >
          Delete
        </ConfirmAction>
      </div>
      <Msg kind={message ? "error" : undefined} text={message} />
    </li>
  );
}

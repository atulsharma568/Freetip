"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { removePageMusic, savePageMusic } from "@/app/actions/page-music";
import { MUSIC_MAX_BYTES, MUSIC_TITLE_MAX, MUSIC_TYPES, musicFileName, musicPathPrefix, type PageMusic } from "@/lib/page-music";

// The owner's tip-page music: pick one audio file (MP3, M4A, OGG or WAV, up to 12 MB), give it a
// title, and a small player shows on the owner's page. The browser sends the file straight to the
// Blob store; the server then saves the link (and deletes the track it replaces).
export function MusicUpload({ creatorId, music, uploadsReady }: { creatorId: number; music: PageMusic | null; uploadsReady: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(music?.title ?? "");
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function onFile(file: File) {
    setMsg(null);
    const mime = file.type || "";
    if (!(MUSIC_TYPES as readonly string[]).includes(mime)) return setMsg({ kind: "error", text: "Choose an MP3, M4A, OGG or WAV file." });
    if (file.size > MUSIC_MAX_BYTES) return setMsg({ kind: "error", text: `That file is over ${MUSIC_MAX_BYTES / 1024 / 1024} MB.` });
    setBusy("upload");
    try {
      const blob = await upload(`${musicPathPrefix(creatorId)}${musicFileName(mime)}`, file, {
        access: "public",
        handleUploadUrl: "/api/page-music/upload",
        contentType: mime,
      });
      const name = title.trim() || file.name.replace(/\.[^.]+$/, "");
      const res = await savePageMusic({ url: blob.url, title: name });
      if (res.status === "error") setMsg({ kind: "error", text: res.message });
      else {
        setTitle(name);
        setMsg({ kind: "ok", text: "Done. The player now shows on your tip page." });
        router.refresh();
      }
    } catch {
      setMsg({ kind: "error", text: "The upload did not finish. Try again." });
    } finally {
      setBusy(null);
    }
  }

  async function onRemove() {
    setMsg(null);
    setBusy("remove");
    const res = await removePageMusic();
    setBusy(null);
    if (res.status === "error") return setMsg({ kind: "error", text: res.message });
    setTitle("");
    setMsg({ kind: "ok", text: "Music removed." });
    router.refresh();
  }

  return (
    <section aria-labelledby="music-h" className="space-y-4 rounded-[var(--radius-surface)] border border-line/60 p-5">
      <div className="space-y-1">
        <h2 id="music-h" className="text-lg font-semibold">
          Page music
        </h2>
        <p className="text-sm text-muted">
          One track plays from a small player on your tip page. Visitors press play themselves; it never starts on its own. MP3, M4A, OGG or WAV, up to 12 MB.
        </p>
      </div>
      {music && (
        <div className="space-y-2">
          <p className="text-sm text-muted">Now on your page: {music.title}</p>
          <audio controls preload="none" src={music.url} className="w-full max-w-md">
            <track kind="captions" />
          </audio>
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1 text-sm">
          <span className="block text-muted">Title shown in the player</span>
          <input
            value={title}
            maxLength={MUSIC_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            className="min-h-11 w-64 max-w-full rounded-[var(--radius-field)] border border-control bg-transparent px-3 text-text focus:border-accent"
          />
        </label>
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
            !uploadsReady || busy ? "pointer-events-none opacity-50" : ""
          }`}
        >
          {busy === "upload" ? "Uploading…" : music ? "Replace track" : "Upload track"}
          <input
            ref={input}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,audio/webm,.mp3,.m4a,.ogg,.wav"
            disabled={!uploadsReady || busy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              if (input.current) input.current.value = "";
            }}
            className="sr-only"
          />
        </label>
        {music && (
          <button
            type="button"
            onClick={onRemove}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted disabled:opacity-50"
          >
            {busy === "remove" ? "Removing…" : "Remove"}
          </button>
        )}
      </div>
      {!uploadsReady && <p className="text-sm text-muted">Uploads are not set up on this server yet.</p>}
      {msg && (
        <p role={msg.kind === "error" ? "alert" : "status"} className={`text-sm ${msg.kind === "error" ? "text-bad" : "text-text"}`}>
          {msg.text}
        </p>
      )}
    </section>
  );
}

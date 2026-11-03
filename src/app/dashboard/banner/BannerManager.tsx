"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { removeTipBanner, copyYouTubeBanner, saveUploadedBanner, copyYouTubePhoto, removeTipPhoto } from "@/app/actions/tip-banner";
import { checkMediaFile, mediaFileName } from "@/lib/media";
import { BANNER_MAX_BYTES, BANNER_UPLOAD_KINDS, bannerPathPrefix } from "@/lib/tip-banner";
import { CreatorPanel } from "@/components/tip/CreatorPanel";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { pillPrimary } from "../parts/styles";

export function BannerManager({
  saved,
  handle,
  style,
  displayName,
  pictureUrl,
  usingYouTubePhoto,
  ytChannelName,
  ytChannelUrl,
  bio,
  creatorId,
  uploadsReady,
}: {
  saved: string | null;
  handle: string;
  style: CSSProperties | Record<string, string> | undefined;
  displayName: string;
  pictureUrl: string | null;
  usingYouTubePhoto: boolean;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  bio: string | null;
  creatorId: number;
  uploadsReady: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"copy" | "remove" | "upload" | "photo" | "photo-reset" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  // The photo buttons answer in their own tile, not in the banner's.
  const [photoMessage, setPhotoMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function run(which: "copy" | "remove") {
    setBusy(which);
    setMessage(null);
    const res = which === "copy" ? await copyYouTubeBanner() : await removeTipBanner();
    setBusy(null);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({
      kind: "ok",
      text: which === "copy" ? "Done. Your YouTube banner now shows on your tip page." : "Removed. Your tip page has no banner.",
    });
    router.refresh();
  }

  async function runPhoto(which: "photo" | "photo-reset") {
    setBusy(which);
    setPhotoMessage(null);
    const res = which === "photo" ? await copyYouTubePhoto() : await removeTipPhoto();
    setBusy(null);
    if (res.status === "error") {
      setPhotoMessage({ kind: "error", text: res.message });
      return;
    }
    setPhotoMessage({
      kind: "ok",
      text:
        which === "photo"
          ? "Done. Your YouTube channel photo now shows on your tip page."
          : "Done. Your tip page uses your Google account photo again.",
    });
    router.refresh();
  }

  // The file's first bytes decide what it is (not its name or the type the browser guessed); the
  // server checks it again after the upload.
  async function uploadFile(file: File | undefined) {
    if (!file) return;
    setMessage(null);
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const checked = checkMediaFile(head, file.size, BANNER_MAX_BYTES);
    if (!checked.ok) {
      setMessage({ kind: "error", text: checked.reason });
    } else if (!BANNER_UPLOAD_KINDS.includes(checked.sniffed.kind)) {
      setMessage({ kind: "error", text: "A banner must be a picture or a GIF, not a video." });
    } else if (file.size > BANNER_MAX_BYTES) {
      setMessage({ kind: "error", text: "The picture is over 6 MB." });
    } else {
      setBusy("upload");
      try {
        const blob = await upload(`${bannerPathPrefix(creatorId)}${mediaFileName("banner", checked.sniffed.mime)}`, file, {
          access: "public",
          handleUploadUrl: "/api/banner/upload",
          contentType: checked.sniffed.mime,
        });
        const res = await saveUploadedBanner({ url: blob.url });
        if (res.status === "error") setMessage({ kind: "error", text: res.message });
        else {
          setMessage({ kind: "ok", text: "Done. Your banner now shows on your tip page." });
          router.refresh();
        }
      } catch {
        setMessage({ kind: "error", text: "The upload failed. Check your connection and try again." });
      }
      setBusy(null);
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <div className="space-y-6">
      <Tile id="preview" level={2} title="Preview">
        <div className="space-y-4">
          <div data-testid="banner-preview" style={style as CSSProperties} className="rounded-surface border border-line bg-ground p-5">
            <CreatorPanel
              displayName={displayName}
              pictureUrl={pictureUrl}
              bannerUrl={saved}
              ytChannelName={ytChannelName}
              ytChannelUrl={ytChannelUrl}
              bio={bio}
              previewMode
              headingAs="h3"
            />
          </div>
          <p className="text-xs text-muted">
            The top of your tip page at <span className="numeric">/{handle}</span>.{" "}
            {saved ? "This is the banner fans see." : "You have no banner yet, so fans see your photo on its own."}
          </p>
        </div>
      </Tile>

      <Tile id="banner" level={2} title="Your banner">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Copy the public banner of your YouTube channel (we keep a link to it and never change anything
            on your channel), or upload your own picture from your computer. YouTube banners are wide, so
            the middle of the picture is what fits behind your photo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                !uploadsReady || busy !== null ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {busy === "upload" ? "Uploading…" : "Upload from my computer"}
              <input
                ref={fileInput}
                type="file"
                accept="image/gif,image/png,image/jpeg,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                disabled={!uploadsReady || busy !== null}
                onChange={(e) => uploadFile(e.target.files?.[0])}
                className="sr-only"
              />
            </label>
            <button type="button" onClick={() => run("copy")} disabled={busy !== null} className={pillPrimary}>
              {busy === "copy" ? "Reading YouTube…" : "Use my YouTube banner"}
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => run("remove")}
                disabled={busy !== null}
                className="inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted disabled:opacity-50"
              >
                {busy === "remove" ? "Removing…" : "Remove the banner"}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Or use any picture you like, including an animated GIF or WebP: PNG, JPG, GIF or WebP, up to
            6 MB. A wide picture works best (about 1600 by 500 pixels; the middle is what fits). For an animated banner, an animated WebP is usually much smaller than a GIF. Only
            upload what you made or have the right to use.
            {!uploadsReady && " Uploads are not set up on this site yet."}
          </p>
          <Msg kind={message?.kind} text={message?.text} />
        </div>
      </Tile>

      <Tile id="photo" level={2} title="Your photo">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            The round photo on your tip page is your Google account photo. If your YouTube channel has a
            different one, copy it here (we keep a link to it and never change anything on your channel).
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => runPhoto("photo")} disabled={busy !== null} className={pillPrimary}>
              {busy === "photo" ? "Reading YouTube…" : "Use my YouTube photo"}
            </button>
            {usingYouTubePhoto && (
              <button
                type="button"
                onClick={() => runPhoto("photo-reset")}
                disabled={busy !== null}
                className="inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted disabled:opacity-50"
              >
                {busy === "photo-reset" ? "Changing…" : "Use my Google photo again"}
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            {usingYouTubePhoto ? "Your YouTube channel photo is showing." : "Your Google account photo is showing."} Press
            the button again after you change your photo on YouTube.
          </p>
          <Msg kind={photoMessage?.kind} text={photoMessage?.text} />
        </div>
      </Tile>
    </div>
  );
}

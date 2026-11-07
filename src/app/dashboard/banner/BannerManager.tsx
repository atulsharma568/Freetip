"use client";

import { useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { removeTipBanner, copyYouTubeBanner, saveUploadedBanner, wearBannerItem, deleteBannerItem, copyYouTubePhoto, removeTipPhoto } from "@/app/actions/tip-banner";
import { mediaFileName } from "@/lib/media";
import { checkOrFitPicture } from "@/lib/fit-picture";
import { UploadRules } from "@/components/UploadRules";
import type { DecorItem } from "@/lib/decor-library";
import { bannerPathPrefix } from "@/lib/tip-banner";
import { CreatorPanel } from "@/components/tip/CreatorPanel";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { pillPrimary } from "../parts/styles";

export function BannerManager({
  saved,
  library,
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
  readOnly = false,
}: {
  saved: string | null;
  library: { mine: DecorItem<"banner">[]; shared: DecorItem<"banner">[] };
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
  // Switched off for this account: nothing shows on the tip page, so only removing is offered.
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"copy" | "remove" | "upload" | "photo" | "photo-reset" | "library" | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Delete is for good (and takes the banner off every page it was shared with), so it asks twice.
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
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

  async function wearItem(itemId: number) {
    setBusy("library");
    setMessage(null);
    const res = await wearBannerItem({ itemId });
    setBusy(null);
    if (res.status === "error") return setMessage({ kind: "error", text: res.message });
    setMessage({ kind: "ok", text: "Done. That banner now shows on your tip page." });
    router.refresh();
  }

  async function deleteItem(itemId: number) {
    setBusy("library");
    setMessage(null);
    const res = await deleteBannerItem({ itemId });
    setBusy(null);
    setConfirmDelete(null);
    if (res.status === "error") return setMessage({ kind: "error", text: res.message });
    setMessage({ kind: "ok", text: "Deleted. It no longer shows on any page." });
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
    const checked = await checkOrFitPicture("banner", file);
    if (!checked.ok) {
      setMessage({ kind: "error", text: checked.reason });
    } else {
      setBusy("upload");
      try {
        const blob = await upload(`${bannerPathPrefix(creatorId)}${mediaFileName("banner", checked.picture.mime)}`, checked.file, {
          access: "public",
          handleUploadUrl: "/api/banner/upload",
          contentType: checked.picture.mime,
        });
        const res = await saveUploadedBanner({ url: blob.url });
        if (res.status === "error") setMessage({ kind: "error", text: res.message });
        else {
          setMessage({ kind: "ok", text: `Done. Your banner now shows on your tip page.${checked.note ? ` ${checked.note}` : ""}` });
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
      {!readOnly && (
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
      )}

      {(!readOnly || saved) && (
      <Tile id="banner" level={2} title="Your banner">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {readOnly
              ? "A banner is still saved for you, but it is not shown on your tip page. Remove it to delete our saved link."
              : "Copy the public banner of your YouTube channel (we keep a link to it and never change anything on your channel), or upload your own picture from your computer. YouTube banners are wide, so the middle of the picture is what fits behind your photo."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!readOnly && (<>
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
            </>)}
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
          {!readOnly && (
          <div className="space-y-2">
            <UploadRules kind="banner" id="banner-rules" />
            {!uploadsReady && <p className="text-xs text-muted">Uploads are not set up on this site yet.</p>}
          </div>
          )}
          <Msg kind={message?.kind} text={message?.text} />
          {!readOnly && (library.mine.length > 0 || library.shared.length > 0) && (
            <div className="space-y-4" data-testid="banner-library">
              {([["My uploads", library.mine, true], ["Shared with you", library.shared, false]] as const).map(
                ([title, items, own]) =>
                  items.length > 0 && (
                    <div key={title} className="space-y-2">
                      <h3 className="text-sm font-semibold text-text">{title}</h3>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {items.map((item) => (
                          <li key={item.id} className="space-y-2 rounded-field border border-line/60 p-3">
                            {/* eslint-disable-next-line @next/next/no-img-element -- the creator's own saved upload */}
                            <img src={item.url} alt={`Banner `} loading="lazy" decoding="async" className="h-20 w-full rounded-field object-cover" />
                            <p className="text-xs text-muted">
                              {item.width}×{item.height}{item.animated ? " · animated" : ""}{item.ownerHandle ? ` · from @${item.ownerHandle}` : ""}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button type="button" disabled={busy !== null || saved === item.url} onClick={() => wearItem(item.id)} className={pillPrimary}>
                                {saved === item.url ? "On your page" : "Use this banner"}
                              </button>
                              {own && (
                                <button type="button" disabled={busy !== null} onClick={() => (confirmDelete === item.id ? deleteItem(item.id) : setConfirmDelete(item.id))} onBlur={() => setConfirmDelete((c) => (c === item.id ? null : c))} className="inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted disabled:opacity-50">
                                  {confirmDelete === item.id ? "Delete for good?" : "Delete"}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>
      </Tile>
      )}

      {(!readOnly || usingYouTubePhoto) && (
      <Tile id="photo" level={2} title="Your photo">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {readOnly
              ? "A YouTube photo is still saved for you, but your tip page shows your Google account photo. Remove it to delete our saved link."
              : "The round photo on your tip page is your Google account photo. If your YouTube channel has a different one, copy it here (we keep a link to it and never change anything on your channel)."}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {!readOnly && (
            <button type="button" onClick={() => runPhoto("photo")} disabled={busy !== null} className={pillPrimary}>
              {busy === "photo" ? "Reading YouTube…" : "Use my YouTube photo"}
            </button>
            )}
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
          {!readOnly && (
          <p className="text-xs text-muted">
            {usingYouTubePhoto ? "Your YouTube channel photo is showing." : "Your Google account photo is showing."} Press
            the button again after you change your photo on YouTube.
          </p>
          )}
          <Msg kind={photoMessage?.kind} text={photoMessage?.text} />
        </div>
      </Tile>
      )}
    </div>
  );
}

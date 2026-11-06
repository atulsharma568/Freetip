"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { removeDecorUpload, saveDecorUpload, saveTipDecor } from "@/app/actions/tip-decor";
import { removeTipBanner, saveUploadedBanner } from "@/app/actions/tip-banner";
import { type DecorRender } from "@/components/tip/Decor";
import { CreatorPanel } from "@/components/tip/CreatorPanel";
import { warmBannerTints } from "@/components/tip/use-banner-tint";
import { looksAnimated, makePoster } from "@/lib/decor-poster";
import { checkMediaFile, mediaFileName } from "@/lib/media";
import { BANNER_MAX_BYTES, BANNER_UPLOAD_KINDS, bannerPathPrefix } from "@/lib/tip-banner";
import {
  AVATAR_PICS,
  AVATAR_PIC_IDS,
  AVATAR_PIC_INFO,
  BANNER_PICS,
  DECOR_UPLOAD_MAX_BYTES,
  FILE_FRAMES,
  FILE_FX,
  FILE_FX_INFO,
  FRAME_SCALE,
  PRESET_EFFECTS,
  PRESET_FRAMES,
  decorPathPrefix,
  isAvatarPic,
  isFileFrame,
  isFileFx,
  type AvatarStyle,
  type BannerPic,
  type DecorUpload,
  type DecorUploadKind,
  type PresetEffect,
  type PresetFrame,
  type TipDecor,
} from "@/lib/page-doc/decor";
import { Tile } from "../parts/Tile";
import { PreviewSplit } from "../parts/PreviewSplit";
import { Msg } from "../parts/Msg";
import { useUnsavedWarning } from "../parts/useUnsavedWarning";
import { pillPrimary } from "../parts/styles";

const FRAME_INFO: Record<PresetFrame, { label: string; about: string }> = {
  none: { label: "No frame", about: "Your photo or profile picture with nothing around it." },
  widow: { label: "Black Widow", about: "A big spider walks the rim of your photo and settles; small ones crawl over your face." },
};

const AVATAR_INFO = Object.fromEntries(
  AVATAR_PIC_IDS.map((id) => [id, { label: AVATAR_PIC_INFO[id].label, about: AVATAR_PIC_INFO[id].still ? "A picture that replaces your photo." : "An animated picture that replaces your photo." }]),
) as Record<(typeof AVATAR_PIC_IDS)[number], { label: string; about: string }>;

const EFFECT_INFO: Record<PresetEffect, { label: string; about: string }> = {
  none: { label: "No effect", about: "Your banner as it is." },
  embers: { label: "Rising embers", about: "Embers drift up over the banner." },
  clutch: { label: "Clutch pulse", about: "A heartbeat line, a flash and a crosshair that locks on." },
  petals: { label: "Falling petals", about: "Soft petals drifting down and turning." },
  snow: { label: "Soft snow", about: "Small flakes drifting slowly down." },
  stars: { label: "Twinkling stars", about: "Tiny stars that fade in and out." },
};

const preset = (style: string): DecorRender => {
  if (style === "none") return null;
  if (isAvatarPic(style)) {
    const f = AVATAR_PICS[style];
    return { kind: "custom", url: f.url, posterUrl: f.posterUrl, animated: f.animated, round: true };
  }
  if (isFileFrame(style)) {
    const f = FILE_FRAMES[style];
    return { kind: "custom", url: f.url, posterUrl: f.posterUrl, animated: f.animated, scale: f.scale, round: f.round };
  }
  if (isFileFx(style)) {
    const f = FILE_FX[style];
    return { kind: "custom", url: f.url, posterUrl: f.posterUrl, animated: f.animated, wholeHeader: f.wholeHeader };
  }
  return { kind: "preset", style } as DecorRender;
};

// A card you tap to pick a look.
function Choice({ on, label, about, onPick, thumb }: { on: boolean; label: string; about: string; onPick: () => void; thumb?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`flex min-h-11 flex-col items-start gap-0.5 rounded-field border px-4 py-3 text-left transition-colors duration-150 ${
        on ? "border-accent bg-accent font-semibold text-ink" : "border-control text-text hover:border-muted"
      }`}
    >
      {thumb && <Image src={thumb} alt="" width={160} height={64} unoptimized className="mb-1 h-14 w-full rounded-field object-cover" />}
      <span className="text-sm">{label}</span>
      <span className={`text-xs font-normal ${on ? "text-ink/80" : "text-muted"}`}>{about}</span>
    </button>
  );
}

const pillOutline =
  "inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted disabled:opacity-50";

// A file button that checks the first bytes of what was chosen before anything is sent.
function FilePick({ label, busy, disabled, onFile }: { label: string; busy: boolean; disabled: boolean; onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <label
      className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {busy ? "Uploading…" : label}
      <input
        ref={input}
        type="file"
        accept="image/gif,image/png,image/jpeg,image/webp,.gif,.png,.jpg,.jpeg,.webp"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          if (input.current) input.current.value = "";
        }}
        className="sr-only"
      />
    </label>
  );
}

export function EffectsManager({
  saved,
  style,
  pictureUrl,
  name,
  bannerUrl = null,
  creatorId = 0,
  uploadsReady = false,
  canUploadBanner = false,
}: {
  saved: TipDecor;
  style: Record<string, string>;
  pictureUrl: string | null;
  name: string;
  // The banner the creator saved (a picture or an animated GIF or WebP), so the preview shows what fans see.
  bannerUrl?: string | null;
  creatorId?: number;
  uploadsReady?: boolean;
  // The tip page banner switch is on, so the banner can be uploaded here too.
  canUploadBanner?: boolean;
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<AvatarStyle>(saved.avatar);
  const [frame, setFrame] = useState<PresetFrame>(saved.frame);
  const [fx, setFx] = useState<PresetEffect>(saved.bannerFx);
  const [pic, setPic] = useState<BannerPic>(saved.bannerPic);
  const [frameScale, setFrameScale] = useState<number>(saved.frameScale);
  const [live, setLive] = useState<TipDecor>(saved);
  const [avatarUp, setAvatarUp] = useState<DecorUpload | null>(saved.avatarUpload);
  const [frameUp, setFrameUp] = useState<DecorUpload | null>(saved.frameUpload);
  const [banner, setBanner] = useState<string | null>(bannerUrl);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<DecorUploadKind | "banner" | "remove" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [uploadMessage, setUploadMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const same = avatar === live.avatar && frame === live.frame && fx === live.bannerFx && pic === live.bannerPic && frameScale === live.frameScale;
  useUnsavedWarning(!same);
  // Work out each ready-made banner picture's colour now, so tapping one recolours the effect at once.
  useEffect(() => {
    warmBannerTints(BANNER_PICS.filter(isFileFx).map((f) => FILE_FX[f].posterUrl));
  }, []);

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveTipDecor({ avatar, frame, bannerFx: fx, bannerPic: pic, frameScale });
    setBusy(false);
    if (result.status === "ok") {
      setLive({ ...live, avatar, frame, bannerFx: fx, bannerPic: pic, frameScale });
      setMessage({ kind: "ok", text: "Saved. It is live on your tip page now." });
      router.refresh();
    } else {
      setMessage({ kind: "error", text: result.message });
    }
  }

  // The first bytes decide what a file is (not its name or the type the browser guessed); the server
  // checks it again after the upload.
  async function uploadDecor(kind: DecorUploadKind, file: File) {
    setUploadMessage(null);
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const checked = checkMediaFile(head, file.size, DECOR_UPLOAD_MAX_BYTES);
    if (!checked.ok) return setUploadMessage({ kind: "error", text: checked.reason });
    if (checked.sniffed.kind === "webm") return setUploadMessage({ kind: "error", text: "Use a picture, GIF or WebP, not a video." });
    if (kind === "frame" && checked.sniffed.mime === "image/jpeg") {
      return setUploadMessage({ kind: "error", text: "A frame needs a see-through background. Use a PNG, GIF or WebP, not a JPG." });
    }
    setUploading(kind);
    try {
      const folder = decorPathPrefix(creatorId);
      const blob = await upload(`${folder}${mediaFileName(kind, checked.sniffed.mime)}`, file, {
        access: "public",
        handleUploadUrl: "/api/decor/upload",
        contentType: checked.sniffed.mime,
      });
      // A still of the first frame for visitors who ask for less motion (only an animation needs one).
      let posterUrl: string | null = null;
      if (looksAnimated(head)) {
        const still = await makePoster(file);
        if (still) {
          const posterBlob = await upload(`${folder}${mediaFileName("poster", still.type || "image/webp")}`, still, {
            access: "public",
            handleUploadUrl: "/api/decor/upload",
            contentType: still.type || "image/webp",
          });
          posterUrl = posterBlob.url;
        }
      }
      const res = await saveDecorUpload({ kind, url: blob.url, posterUrl, frameScale });
      if (res.status === "error") {
        setUploadMessage({ kind: "error", text: res.message });
      } else {
        if (kind === "avatar") {
          setAvatarUp(res.upload);
          setAvatar("none");
          setLive((l) => ({ ...l, avatar: "none", avatarUpload: res.upload }));
        } else {
          setFrameUp(res.upload);
          setFrame("none");
          setLive((l) => ({ ...l, frame: "none", frameUpload: res.upload, frameScale }));
        }
        setUploadMessage({ kind: "ok", text: kind === "avatar" ? "Done. Your picture now shows on your tip page." : "Done. Your frame now shows on your tip page." });
        router.refresh();
      }
    } catch {
      setUploadMessage({ kind: "error", text: "The upload failed. Check your connection and try again." });
    }
    setUploading(null);
  }

  async function removeDecor(kind: DecorUploadKind) {
    setUploading("remove");
    setUploadMessage(null);
    const res = await removeDecorUpload({ kind });
    setUploading(null);
    if (res.status === "error") return setUploadMessage({ kind: "error", text: res.message });
    if (kind === "avatar") {
      setAvatarUp(null);
      setLive((l) => ({ ...l, avatarUpload: null }));
    } else {
      setFrameUp(null);
      setLive((l) => ({ ...l, frameUpload: null }));
    }
    setUploadMessage({ kind: "ok", text: "Removed." });
    router.refresh();
  }

  // The banner is the same one as on the Banner page (a picture or an animated GIF or WebP), so an effect
  // or an animated banner picture plays over it.
  async function uploadBanner(file: File) {
    setUploadMessage(null);
    const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
    const checked = checkMediaFile(head, file.size, BANNER_MAX_BYTES);
    if (!checked.ok) return setUploadMessage({ kind: "error", text: checked.reason });
    if (!BANNER_UPLOAD_KINDS.includes(checked.sniffed.kind)) return setUploadMessage({ kind: "error", text: "A banner must be a picture or a GIF, not a video." });
    setUploading("banner");
    try {
      const blob = await upload(`${bannerPathPrefix(creatorId)}${mediaFileName("banner", checked.sniffed.mime)}`, file, {
        access: "public",
        handleUploadUrl: "/api/banner/upload",
        contentType: checked.sniffed.mime,
      });
      const res = await saveUploadedBanner({ url: blob.url });
      if (res.status === "error") setUploadMessage({ kind: "error", text: res.message });
      else {
        setBanner(res.url);
        setUploadMessage({ kind: "ok", text: "Done. Your banner now shows on your tip page." });
        router.refresh();
      }
    } catch {
      setUploadMessage({ kind: "error", text: "The upload failed. Check your connection and try again." });
    }
    setUploading(null);
  }

  async function removeBanner() {
    setUploading("remove");
    setUploadMessage(null);
    const res = await removeTipBanner();
    setUploading(null);
    if (res.status === "error") return setUploadMessage({ kind: "error", text: res.message });
    setBanner(null);
    setUploadMessage({ kind: "ok", text: "Removed. Your tip page has no banner." });
    router.refresh();
  }

  // What the tip page draws: an uploaded picture fills a layer only while no ready-made look is chosen for it.
  const avatarRender: DecorRender = isAvatarPic(avatar) ? preset(avatar) : avatarUp ? { kind: "custom", url: avatarUp.url, posterUrl: avatarUp.posterUrl, animated: avatarUp.animated, round: true } : null;
  const frameRender: DecorRender = frame !== "none" ? preset(frame) : frameUp ? { kind: "custom", url: frameUp.url, posterUrl: frameUp.posterUrl, animated: frameUp.animated, scale: frameScale } : null;
  const picBusy = uploading !== null;
  const canUpload = uploadsReady && !picBusy && creatorId > 0;

  return (
    <PreviewSplit
      preview={
        <Tile id="effects-preview" title="Preview" level={2}>
          {/* The tip page's own header, so the banner, the animated banner picture, the effect and both
              frames are layered exactly as fans see them. */}
          <div className="rounded-surface bg-ground p-4" style={style}>
            <CreatorPanel
              displayName={name}
              pictureUrl={pictureUrl}
              bannerUrl={banner}
              ytChannelName={null}
              ytChannelUrl={null}
              bio={null}
              previewMode
              headingAs="h3"
              avatar={avatarRender}
              frame={frameRender}
              bannerFx={preset(fx)}
              bannerPic={pic === "none" ? null : preset(pic)}
            />
          </div>
          <p className="text-sm text-muted">
            Your banner picture is the background, an animated banner picture plays over it, and an effect plays on top of both. Fans whose device
            asks for less motion see the pictures and lines standing still.
          </p>
        </Tile>
      }
    >
      <Tile id="effects-avatar" title="Profile picture" level={2}>
        <p className="text-sm text-muted">Your own photo, a picture you upload, or a ready-made animated picture in its place. The frame below goes over whichever you pick.</p>
        <div role="group" aria-label="Profile picture" className="grid gap-2 sm:grid-cols-2">
          <Choice on={avatar === "none"} label="Your own photo" about={avatarUp ? "Your uploaded picture is showing." : "The photo from your account."} onPick={() => setAvatar("none")} />
          {AVATAR_PIC_IDS.map((id) => (
            <Choice key={id} on={avatar === id} label={AVATAR_INFO[id].label} about={AVATAR_INFO[id].about} thumb={AVATAR_PICS[id].posterUrl} onPick={() => setAvatar(id)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilePick label={avatarUp ? "Upload a different picture" : "Upload your own picture"} busy={uploading === "avatar"} disabled={!canUpload} onFile={(f) => uploadDecor("avatar", f)} />
          {avatarUp && (
            <button type="button" onClick={() => removeDecor("avatar")} disabled={picBusy} className={pillOutline}>
              Remove my uploaded picture
            </button>
          )}
        </div>
        <p className="text-xs text-muted">
          A square PNG, JPG, GIF or WebP up to 3 MB; it is cut round. An animated GIF or WebP works too. Only upload what you made or have the right to
          use. {!uploadsReady && "Uploads are not set up on this site yet."}
        </p>
      </Tile>

      <Tile id="effects-frame" title="Decoration over your photo" level={2}>
        <div role="group" aria-label="Frame over your photo" className="grid gap-2 sm:grid-cols-2">
          {PRESET_FRAMES.map((f) => (
            <Choice key={f} on={frame === f} label={FRAME_INFO[f].label} about={FRAME_INFO[f].about} onPick={() => setFrame(f)} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilePick label={frameUp ? "Upload a different decoration" : "Upload your own decoration"} busy={uploading === "frame"} disabled={!canUpload} onFile={(f) => uploadDecor("frame", f)} />
          {frameUp && (
            <button type="button" onClick={() => removeDecor("frame")} disabled={picBusy} className={pillOutline}>
              Remove my uploaded decoration
            </button>
          )}
        </div>
        {frameUp && frame === "none" && (
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Size of your decoration</span>
            <input
              type="range"
              min={FRAME_SCALE.min}
              max={FRAME_SCALE.max}
              step={FRAME_SCALE.step}
              value={frameScale}
              onChange={(e) => setFrameScale(Number(e.target.value))}
              className="block w-full accent-[var(--color-accent)]"
            />
          </label>
        )}
        <p className="text-xs text-muted">
          A square PNG, GIF or WebP with a see-through background, up to 3 MB. It is drawn bigger than your photo, like a ring around it; make the
          middle empty so your photo shows through. Press Save after changing the size.
        </p>
      </Tile>

      <Tile id="effects-banner" title="Effect over your banner" level={2}>
        <div role="group" aria-label="Effect over your banner" className="grid gap-2 sm:grid-cols-2">
          {PRESET_EFFECTS.map((f) => (
            <Choice key={f} on={fx === f} label={EFFECT_INFO[f].label} about={EFFECT_INFO[f].about} onPick={() => setFx(f)} />
          ))}
        </div>
        <p className="text-xs text-muted">An effect plays on top of your banner and on top of an animated banner picture, so you can have both.</p>
      </Tile>

      <Tile id="effects-pictures" title="Animated banner pictures" level={2}>
        <p className="text-sm text-muted">These replace your banner picture with a ready-made animation. You can still add an effect over it.</p>
        <div role="group" aria-label="Animated banner pictures" className="grid gap-2 sm:grid-cols-2">
          <Choice on={pic === "none"} label="No banner picture" about="Your own banner, or none." onPick={() => setPic("none")} />
          {BANNER_PICS.filter(isFileFx).map((f) => (
            <Choice
              key={f}
              on={pic === f}
              label={FILE_FX_INFO[f].label}
              about={FILE_FX_INFO[f].still ? "A picture that replaces the banner." : "An animated picture that replaces the banner."}
              thumb={FILE_FX[f].posterUrl}
              onPick={() => setPic(f)}
            />
          ))}
        </div>
      </Tile>

      <Tile id="effects-your-banner" title="Your banner" level={2}>
        {canUploadBanner ? (
          <>
            <p className="text-sm text-muted">Upload your own banner, still or animated. A GIF or animated WebP plays like an animated banner, and an effect plays over it.</p>
            <div className="flex flex-wrap items-center gap-3">
              <FilePick label={banner ? "Upload a different banner" : "Upload your banner"} busy={uploading === "banner"} disabled={!canUpload} onFile={uploadBanner} />
              {banner && (
                <button type="button" onClick={removeBanner} disabled={picBusy} className={pillOutline}>
                  Remove the banner
                </button>
              )}
            </div>
            <p className="text-xs text-muted">PNG, JPG, GIF or WebP up to 6 MB, wide (about 1600 by 500 pixels; the middle is what fits). To copy your YouTube banner instead, use the Banner page.</p>
          </>
        ) : (
          <p className="text-sm text-muted">The tip page banner is not switched on for your account, so uploading a banner is not available yet.</p>
        )}
      </Tile>

      <Msg kind={uploadMessage?.kind} text={uploadMessage?.text} />

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={busy || same} className={pillPrimary}>
          {busy ? "Saving…" : "Save"}
        </button>
        {same && !message && <span className="text-sm text-muted">This is what your tip page shows now.</span>}
        <Msg kind={message?.kind} text={message?.text} />
      </div>
    </PreviewSplit>
  );
}

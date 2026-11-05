"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTipDecor } from "@/app/actions/tip-decor";
import { AvatarPicture, BannerEffect, PhotoFrame, type DecorRender } from "@/components/tip/Decor";
import { AVATAR_PICS, AVATAR_PIC_IDS, AVATAR_PIC_INFO, FILE_FRAMES, FILE_FX, FILE_FX_IDS, FILE_FX_INFO, PRESET_BANNER_FX, PRESET_FRAMES, isAvatarPic, isFileFrame, isFileFx, type AvatarStyle, type PresetBannerFx, type PresetFrame, type TipDecor } from "@/lib/page-doc/decor";
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

const FX_INFO: Record<PresetBannerFx, { label: string; about: string }> = {
  none: { label: "No effect", about: "Your banner as it is." },
  embers: { label: "Rising embers", about: "Embers drift up over the banner." },
  clutch: { label: "Clutch pulse", about: "A heartbeat line, a flash and a crosshair that locks on." },
  petals: { label: "Falling petals", about: "Soft petals drifting down and turning." },
  ...(Object.fromEntries(
    FILE_FX_IDS.map((id) => [id, { label: FILE_FX_INFO[id].label, about: FILE_FX_INFO[id].still ? "A picture that replaces the banner." : "An animated picture that replaces the banner." }]),
  ) as Record<Exclude<PresetBannerFx, "none" | "embers" | "clutch" | "petals">, { label: string; about: string }>),
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

export function EffectsManager({
  saved,
  style,
  pictureUrl,
  name,
}: {
  saved: TipDecor;
  style: Record<string, string>;
  pictureUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<AvatarStyle>(saved.avatar);
  const [frame, setFrame] = useState<PresetFrame>(saved.frame);
  const [fx, setFx] = useState<PresetBannerFx>(saved.bannerFx);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [live, setLive] = useState<TipDecor>(saved);
  const same = avatar === live.avatar && frame === live.frame && fx === live.bannerFx;
  useUnsavedWarning(!same);

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveTipDecor({ avatar, frame, bannerFx: fx });
    setBusy(false);
    if (result.status === "ok") {
      setLive({ avatar, frame, bannerFx: fx });
      setMessage({ kind: "ok", text: "Saved. It is live on your tip page now." });
      router.refresh();
    } else {
      setMessage({ kind: "error", text: result.message });
    }
  }

  return (
    <PreviewSplit
      preview={
        <Tile id="effects-preview" title="Preview" level={2}>
        {/* The tip page's header in your page colour: the banner strip with your photo overlapping its corner. */}
        <div className="relative space-y-3 rounded-surface bg-ground p-4" style={style}>
          {/* A finished whole-header effect covers the banner, photo and name, as it does on the tip page. */}
          {isFileFx(fx) && FILE_FX[fx].wholeHeader && (
            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-surface">
              <BannerEffect render={preset(fx)} />
            </div>
          )}
          <div
            className="relative aspect-[16/5] overflow-hidden rounded-[var(--radius-surface)] border border-line/60"
            style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-accent) 30%, var(--color-ground)), var(--color-ground) 80%)" }}
          >
            {!(isFileFx(fx) && FILE_FX[fx].wholeHeader) && <BannerEffect render={preset(fx)} />}
          </div>
          <span className="relative z-10 -mt-14 ml-6 inline-block rounded-full border-2 border-accent bg-ground p-1.5 sm:-mt-16">
            <AvatarPicture render={preset(avatar)} />
            <PhotoFrame render={preset(frame)} />
            {pictureUrl ? (
              <Image src={pictureUrl} alt={`${name}'s profile photo`} width={96} height={96} className="block size-20 rounded-full sm:size-24" />
            ) : (
              <span aria-hidden="true" className="display grid size-20 place-items-center rounded-full bg-accent text-4xl text-ink sm:size-24">
                {[...name][0]?.toUpperCase() ?? "A"}
              </span>
            )}
          </span>
          <p className="display text-3xl">{name}</p>
        </div>
        <p className="text-sm text-muted">
          On your tip page the effect plays over your banner picture if you have one, and over a dark strip of your page colour if not.
          Fans whose device asks for less motion see the frames and lines standing still.
        </p>
      </Tile>
      }
    >

      <Tile id="effects-avatar" title="Profile picture" level={2}>
        <p className="text-sm text-muted">Your own photo, or a ready-made animated picture in its place. The frame below goes over whichever you pick.</p>
        <div role="group" aria-label="Profile picture" className="grid gap-2 sm:grid-cols-2">
          <Choice on={avatar === "none"} label="Your own photo" about="The photo from your account." onPick={() => setAvatar("none")} />
          {AVATAR_PIC_IDS.map((id) => (
            <Choice key={id} on={avatar === id} label={AVATAR_INFO[id].label} about={AVATAR_INFO[id].about} thumb={AVATAR_PICS[id].posterUrl} onPick={() => setAvatar(id)} />
          ))}
        </div>
      </Tile>

      <Tile id="effects-frame" title="Frame over your photo" level={2}>
        <div role="group" aria-label="Frame over your photo" className="grid gap-2 sm:grid-cols-2">
          {PRESET_FRAMES.map((f) => (
            <Choice key={f} on={frame === f} label={FRAME_INFO[f].label} about={FRAME_INFO[f].about} onPick={() => setFrame(f)} />
          ))}
        </div>
      </Tile>

      <Tile id="effects-banner" title="Effect over your banner" level={2}>
        <div role="group" aria-label="Effect over your banner" className="grid gap-2 sm:grid-cols-2">
          {PRESET_BANNER_FX.filter((f) => !isFileFx(f)).map((f) => (
            <Choice key={f} on={fx === f} label={FX_INFO[f].label} about={FX_INFO[f].about} onPick={() => setFx(f)} />
          ))}
        </div>
      </Tile>

      <Tile id="effects-pictures" title="Animated banner pictures" level={2}>
        <p className="text-sm text-muted">These replace your banner picture with a ready-made animation.</p>
        <div role="group" aria-label="Animated banner pictures" className="grid gap-2 sm:grid-cols-2">
          {PRESET_BANNER_FX.filter(isFileFx).map((f) => (
            <Choice key={f} on={fx === f} label={FX_INFO[f].label} about={FX_INFO[f].about} thumb={FILE_FX[f].posterUrl} onPick={() => setFx(f)} />
          ))}
        </div>
      </Tile>

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

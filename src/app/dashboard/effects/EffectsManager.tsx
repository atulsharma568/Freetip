"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTipDecor } from "@/app/actions/tip-decor";
import { BannerEffect, PhotoFrame, type DecorRender } from "@/components/tip/Decor";
import { PRESET_BANNER_FX, PRESET_FRAMES, type PresetBannerFx, type PresetFrame, type TipDecor } from "@/lib/page-doc/decor";
import { Tile } from "../parts/Tile";
import { PreviewSplit } from "../parts/PreviewSplit";
import { Msg } from "../parts/Msg";
import { useUnsavedWarning } from "../parts/useUnsavedWarning";
import { pillPrimary } from "../parts/styles";

const FRAME_INFO: Record<PresetFrame, { label: string; about: string }> = {
  none: { label: "No frame", about: "Just your photo." },
  flame: { label: "Flame ring", about: "A glowing ring turns around your photo." },
  aura: { label: "Pulsing aura", about: "A soft pulse with sparks rising." },
  slash: { label: "Slash ring", about: "A dashed ring with a blade of light." },
  foxfire: { label: "Fox-fire", about: "Small flames crawl over the top of your photo." },
};

const FX_INFO: Record<PresetBannerFx, { label: string; about: string }> = {
  none: { label: "No effect", about: "Your banner as it is." },
  embers: { label: "Rising embers", about: "Embers drift up over the banner." },
  slashes: { label: "Sweeping slashes", about: "Slashes of light sweep across." },
  shimmer: { label: "Soft glow sweep", about: "A soft glow passes over the banner." },
  clutch: { label: "Clutch pulse", about: "A heartbeat line, a flash and a crosshair that locks on." },
  spider: { label: "Spider crawl", about: "A spider scuttles along the bottom, another drops on a thread, a web in the corner." },
  storm: { label: "Storm", about: "Fog drifting across with a lightning flash now and then." },
  glitch: { label: "Neon glitch", about: "Scanlines, a sweeping beam and glitch bars." },
  petals: { label: "Falling petals", about: "Soft petals drifting down and turning." },
};

const preset = (style: string): DecorRender => (style === "none" ? null : ({ kind: "preset", style } as DecorRender));

// A card you tap to pick a look.
function Choice({ on, label, about, onPick }: { on: boolean; label: string; about: string; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onPick}
      className={`flex min-h-11 flex-col items-start gap-0.5 rounded-field border px-4 py-3 text-left transition-colors duration-150 ${
        on ? "border-accent bg-accent font-semibold text-ink" : "border-control text-text hover:border-muted"
      }`}
    >
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
  const [frame, setFrame] = useState<PresetFrame>(saved.frame);
  const [fx, setFx] = useState<PresetBannerFx>(saved.bannerFx);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);
  const [live, setLive] = useState<TipDecor>(saved);
  const same = frame === live.frame && fx === live.bannerFx;
  useUnsavedWarning(!same);

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveTipDecor({ frame, bannerFx: fx });
    setBusy(false);
    if (result.status === "ok") {
      setLive({ frame, bannerFx: fx });
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
        <div className="space-y-3 rounded-surface bg-ground p-4" style={style}>
          <div
            className="relative aspect-[16/5] overflow-hidden rounded-[var(--radius-surface)] border border-line/60"
            style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-accent) 30%, var(--color-ground)), var(--color-ground) 80%)" }}
          >
            <BannerEffect render={preset(fx)} />
          </div>
          <span className="relative z-10 -mt-14 ml-6 inline-block rounded-full border-2 border-accent bg-ground p-1.5 sm:-mt-16">
            <PhotoFrame render={preset(frame)} />
            {pictureUrl ? (
              <Image src={pictureUrl} alt={`${name}'s profile photo`} width={96} height={96} className="block size-20 rounded-full sm:size-24" />
            ) : (
              <span aria-hidden="true" className="display grid size-20 place-items-center rounded-full bg-accent text-4xl text-ink sm:size-24">
                {[...name][0]?.toUpperCase() ?? "A"}
              </span>
            )}
          </span>
        </div>
        <p className="text-sm text-muted">
          On your tip page the effect plays over your banner picture if you have one, and over a dark strip of your page colour if not.
          Fans whose device asks for less motion see the frames and lines standing still.
        </p>
      </Tile>
      }
    >

      <Tile id="effects-frame" title="Frame over your photo" level={2}>
        <div role="group" aria-label="Frame over your photo" className="grid gap-2 sm:grid-cols-2">
          {PRESET_FRAMES.map((f) => (
            <Choice key={f} on={frame === f} label={FRAME_INFO[f].label} about={FRAME_INFO[f].about} onPick={() => setFrame(f)} />
          ))}
        </div>
      </Tile>

      <Tile id="effects-banner" title="Effect over your banner" level={2}>
        <div role="group" aria-label="Effect over your banner" className="grid gap-2 sm:grid-cols-2">
          {PRESET_BANNER_FX.map((f) => (
            <Choice key={f} on={fx === f} label={FX_INFO[f].label} about={FX_INFO[f].about} onPick={() => setFx(f)} />
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

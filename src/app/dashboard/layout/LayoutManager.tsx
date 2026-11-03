"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAlertLayout } from "@/app/actions/alert-layout";
import { AlertStage, type OverlayAlert } from "@/components/overlay/AlertStage";
import { inkFor } from "@/lib/accent";
import { SIDE_CHOICES, parseAlertLayout, type AlertLayout } from "@/lib/alert-layout";
import type { AlertText } from "@/lib/alert-text";
import type { AlertMedia } from "@/lib/media";
import type { FontKey, ThemeKey } from "@/lib/overlay-themes";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { pillPrimary } from "../parts/styles";

const CHIP = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150";
const CHIP_OFF = "border-control text-text hover:border-muted";
const CHIP_ON = "border-accent bg-accent font-semibold text-ink";

// Shown in the preview when the creator has no picture of their own (or no media switch), so
// the left, right and above choices can still be seen. A sample, never played on a stream.
const EXAMPLE_MEDIA: AlertMedia = { url: "/example-alert.gif", kind: "gif", placement: "above", durationMs: null };

// "" is the normal volume.
const VOLUMES = [
  { value: "", label: "Normal" },
  { value: "75", label: "75%" },
  { value: "50", label: "50%" },
  { value: "25", label: "25%" },
] as const;

export function LayoutManager({
  saved,
  accent,
  theme,
  font,
  text,
  media,
  mediaOn,
  fontClasses,
}: {
  saved: AlertLayout | null;
  accent: string;
  theme: ThemeKey;
  font: FontKey;
  text: AlertText | null;
  media: AlertMedia | null;
  mediaOn: boolean;
  fontClasses: string;
}) {
  const router = useRouter();
  const [side, setSide] = useState<string>(saved?.side ?? "above");
  const [soundVolume, setSoundVolume] = useState(saved?.soundVolume ? String(saved.soundVolume) : "");
  const [voiceVolume, setVoiceVolume] = useState(saved?.voiceVolume ? String(saved.voiceVolume) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const input = { side, soundVolume, voiceVolume };
  // The same rules the server applies, so a problem shows before the creator presses Save.
  const parsed = useMemo(() => parseAlertLayout(input), [side, soundVolume, voiceVolume]); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = parsed.ok ? parsed.value : null;
  const problem = parsed.ok ? null : parsed.message;
  const same = JSON.stringify(draft) === JSON.stringify(saved);

  const samples = useMemo<OverlayAlert[]>(
    () => [
      {
        id: 0,
        kind: "alert",
        name: "Riya",
        amountPaise: 50000,
        message: "Loved the last clutch, play ranked tomorrow too.",
        theme: { theme, font },
        text,
        media: media ?? EXAMPLE_MEDIA,
        layout: draft,
      },
    ],
    [theme, font, text, media, draft],
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveAlertLayout(input);
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: "Saved. The next alert uses this; no OBS reload is needed." });
    router.refresh();
  }

  function volumeChoices(label: string, value: string, set: (v: string) => void) {
    return (
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {VOLUMES.map((v) => (
          <button
            key={v.value || "normal"}
            type="button"
            role="radio"
            aria-checked={v.value === value}
            onClick={() => set(v.value)}
            className={`${CHIP} ${v.value === value ? CHIP_ON : CHIP_OFF}`}
          >
            {v.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tile id="preview" level={2} title="Preview" className="sticky top-2 z-20">
        <div className="space-y-4">
          <div
            data-testid="layout-preview"
            className={`mx-auto w-full overflow-hidden rounded-surface border border-line ${fontClasses}`}
            style={
              {
                aspectRatio: "16 / 9",
                maxWidth: "min(100%, 68vh)",
                background: "var(--color-surface)",
                "--ov-accent": accent,
                "--ov-ink": inkFor(accent),
              } as React.CSSProperties
            }
          >
            <AlertStage key={JSON.stringify(draft?.side ?? null)} samples={samples} />
          </div>
          <p className="text-xs text-muted">
            A sample alert on a landscape screen, not a real tip.{" "}
            {media
              ? "The picture is your first one from the Media page. Volume is not played here."
              : mediaOn
                ? "The picture is an example GIF. Upload your own on the Media page and it shows here instead. Volume is not played here."
                : "The picture is an example GIF; showing your own needs custom alert media, which is not switched on for your account. Volume is not played here."}
          </p>
        </div>
      </Tile>

      <Tile id="side" level={2} title="Where the picture goes">
        <div className="space-y-3">
          <div role="radiogroup" aria-label="Where the picture goes" className="flex flex-wrap gap-2">
            {SIDE_CHOICES.map((c) => (
              <button
                key={c.key}
                type="button"
                role="radio"
                aria-checked={c.key === side}
                onClick={() => setSide(c.key)}
                className={`${CHIP} ${c.key === side ? CHIP_ON : CHIP_OFF}`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            This is for a picture, GIF or video you placed &ldquo;above&rdquo; the card. One placed behind
            the card or over the whole screen stays where it is. On a vertical screen the picture always
            stays above.
          </p>
        </div>
      </Tile>

      <Tile id="volume" level={2} title="Volume">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Alert sounds</p>
            {volumeChoices("Alert sound volume", soundVolume, setSoundVolume)}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Spoken voice</p>
            {volumeChoices("Spoken voice volume", voiceVolume, setVoiceVolume)}
          </div>
          <p className="text-xs text-muted">
            A percentage of each sound&rsquo;s own volume (the one you set on the Sounds page) and of the
            voice. Normal plays them exactly as before. You can still change the level of the whole
            browser source in OBS.
          </p>
        </div>
      </Tile>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={busy || same || !!problem} className={pillPrimary}>
          {busy ? "Saving…" : "Save layout"}
        </button>
        <Msg kind={problem ? "error" : message?.kind} text={problem ?? message?.text} />
      </div>
    </div>
  );
}

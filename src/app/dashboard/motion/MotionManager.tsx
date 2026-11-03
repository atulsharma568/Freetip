"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAlertMotion } from "@/app/actions/alert-motion";
import { AlertStage, type OverlayAlert } from "@/components/overlay/AlertStage";
import { inkFor } from "@/lib/accent";
import {
  ENTER_CHOICES,
  EXIT_CHOICES,
  parseAlertMotion,
  type AlertMotion,
  type EnterKey,
  type ExitKey,
} from "@/lib/alert-motion";
import type { AlertText } from "@/lib/alert-text";
import type { FontKey, ThemeKey } from "@/lib/overlay-themes";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { pillOutline, pillPrimary } from "../parts/styles";

const CHIP = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150";
const CHIP_OFF = "border-control text-text hover:border-muted";
const CHIP_ON = "border-accent bg-accent font-semibold text-ink";

// "" is the normal length or pause.
const LENGTHS = [
  { value: "", label: "Normal" },
  { value: "5", label: "5 s" },
  { value: "8", label: "8 s" },
  { value: "12", label: "12 s" },
  { value: "20", label: "20 s" },
  { value: "30", label: "30 s" },
] as const;

const GAPS = [
  { value: "", label: "Normal" },
  { value: "2", label: "2 s" },
  { value: "5", label: "5 s" },
  { value: "10", label: "10 s" },
] as const;

const SIZES = [
  { key: "landscape", label: "Landscape", ratio: 16 / 9 },
  { key: "vertical", label: "Vertical", ratio: 9 / 16 },
] as const;

export function MotionManager({
  saved,
  accent,
  theme,
  font,
  text,
  fontClasses,
}: {
  saved: AlertMotion | null;
  accent: string;
  theme: ThemeKey;
  font: FontKey;
  text: AlertText | null;
  fontClasses: string;
}) {
  const router = useRouter();
  const [enter, setEnter] = useState<EnterKey>(saved?.enter ?? "wipe");
  const [exit, setExit] = useState<ExitKey>(saved?.exit ?? "wipe");
  const [seconds, setSeconds] = useState(saved?.seconds ? String(saved.seconds) : "");
  const [gap, setGap] = useState(saved?.gap ? String(saved.gap) : "");
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("landscape");
  const [replay, setReplay] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const input = { enter, exit, seconds, gap };
  // The same rules the server applies, so a problem shows before the creator presses Save.
  const parsed = useMemo(() => parseAlertMotion(input), [enter, exit, seconds, gap]); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = parsed.ok ? parsed.value : null;
  const problem = parsed.ok ? null : parsed.message;
  const same = JSON.stringify(draft) === JSON.stringify(saved);

  const sizeBox = SIZES.find((s) => s.key === sizeKey)!;
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
        motion: draft,
        previewMs: 4500,
      },
    ],
    [theme, font, text, draft],
  );

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveAlertMotion(input);
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: "Saved. The next alert uses this motion; no OBS reload is needed." });
    router.refresh();
  }

  function choices<T extends string>(
    label: string,
    list: readonly { key: T; label: string }[],
    value: T,
    set: (v: T) => void,
  ) {
    return (
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {list.map((c) => (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={c.key === value}
            onClick={() => set(c.key)}
            className={`${CHIP} ${c.key === value ? CHIP_ON : CHIP_OFF}`}
          >
            {c.label}
          </button>
        ))}
      </div>
    );
  }

  function valueChoices(
    label: string,
    list: readonly { value: string; label: string }[],
    value: string,
    set: (v: string) => void,
  ) {
    return (
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {list.map((c) => (
          <button
            key={c.value || "normal"}
            type="button"
            role="radio"
            aria-checked={c.value === value}
            onClick={() => set(c.value)}
            className={`${CHIP} ${c.value === value ? CHIP_ON : CHIP_OFF}`}
          >
            {c.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tile id="preview" level={2} title="Preview">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Screen shape and replay">
            {SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={s.key === sizeKey}
                onClick={() => setSizeKey(s.key)}
                className={`${CHIP} ${s.key === sizeKey ? CHIP_ON : CHIP_OFF}`}
              >
                {s.label}
              </button>
            ))}
            <span className="w-2" aria-hidden="true" />
            <button type="button" onClick={() => setReplay((n) => n + 1)} className={pillOutline}>
              Play again
            </button>
          </div>
          <div
            data-testid="motion-preview"
            className={`mx-auto w-full overflow-hidden rounded-surface border border-line ${fontClasses}`}
            style={
              {
                aspectRatio: String(sizeBox.ratio),
                maxWidth: sizeBox.ratio < 1 ? "min(100%, 300px)" : "100%",
                background: "var(--color-surface)",
                "--ov-accent": accent,
                "--ov-ink": inkFor(accent),
              } as React.CSSProperties
            }
          >
            <AlertStage key={`${sizeKey}-${replay}-${JSON.stringify(draft)}`} samples={samples} />
          </div>
          <p className="text-xs text-muted">
            A sample alert with a made-up voice, not a real tip. It comes in as soon as you change a
            choice and leaves after a few seconds, so you see both; press Play again to see it once more.
            The real card stays as long as you set below.
          </p>
        </div>
      </Tile>

      <Tile id="enter-exit" level={2} title="Coming in and leaving">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Comes in</p>
            {choices("How the card comes in", ENTER_CHOICES, enter, setEnter)}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Leaves</p>
            {choices("How the card leaves", EXIT_CHOICES, exit, setExit)}
          </div>
          <p className="text-xs text-muted">Wipe in, wipe out is the normal card.</p>
        </div>
      </Tile>

      <Tile id="timing" level={2} title="Timing">
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">How long the card stays</p>
            {valueChoices("How long the card stays", LENGTHS, seconds, setSeconds)}
            <p className="text-xs text-muted">
              Normal is 6 seconds plus time to read the message. The card always stays until the voice,
              sound or video has finished, even if you pick less. A creator rule for a big tip can
              still keep it up longer.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-widest text-muted">Pause before the next alert</p>
            {valueChoices("Pause before the next alert", GAPS, gap, setGap)}
            <p className="text-xs text-muted">
              Normal is under a second. A longer pause gives your chat a breather when several tips
              arrive together.
            </p>
          </div>
        </div>
      </Tile>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={busy || same || !!problem} className={pillPrimary}>
          {busy ? "Saving…" : "Save motion"}
        </button>
        <Msg kind={problem ? "error" : message?.kind} text={problem ?? message?.text} />
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveOverlayStyle } from "@/app/actions/overlay-style";
import { AlertStage, type OverlayAlert } from "@/components/overlay/AlertStage";
import { inkFor } from "@/lib/accent";
import { FONTS, THEMES, type FontKey, type ThemeKey } from "@/lib/overlay-themes";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { pillPrimary } from "../parts/styles";

const CHIP = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150";
const CHIP_OFF = "border-control text-text hover:border-muted";
const CHIP_ON = "border-accent bg-accent font-semibold text-ink";

const AMOUNTS = [
  { key: "99", label: "₹99", paise: 9900, message: "Great stream today!" },
  { key: "500", label: "₹500", paise: 50000, message: "Loved the last clutch, play ranked tomorrow too." },
  { key: "2000", label: "₹2,000", paise: 200000, message: "Best stream I have watched all year." },
] as const;

const SIZES = [
  { key: "landscape", label: "Landscape", ratio: 16 / 9 },
  { key: "vertical", label: "Vertical", ratio: 9 / 16 },
] as const;

export function StyleManager({
  savedTheme,
  savedFont,
  accent,
  fontClasses,
}: {
  savedTheme: ThemeKey;
  savedFont: FontKey;
  accent: string;
  fontClasses: string;
}) {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeKey>(savedTheme);
  const [font, setFont] = useState<FontKey>(savedFont);
  const [amountKey, setAmountKey] = useState<(typeof AMOUNTS)[number]["key"]>("500");
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("landscape");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const size = SIZES.find((s) => s.key === sizeKey)!;
  const amount = AMOUNTS.find((a) => a.key === amountKey)!;
  const samples = useMemo<OverlayAlert[]>(
    () => [
      {
        id: 0,
        kind: "alert",
        name: "Riya",
        amountPaise: amount.paise,
        message: amount.message,
        theme: { theme, font },
      },
    ],
    [amount, theme, font],
  );
  const changed = theme !== savedTheme || font !== savedFont;

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveOverlayStyle({ theme, font });
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: "Saved. The next alert uses this style; no OBS reload is needed." });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Tile id="preview" level={2} title="Preview" className="sticky top-2 z-20">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sample tip and screen shape">
            {AMOUNTS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-pressed={a.key === amountKey}
                onClick={() => setAmountKey(a.key)}
                className={`${CHIP} font-mono ${a.key === amountKey ? CHIP_ON : CHIP_OFF}`}
              >
                {a.label}
              </button>
            ))}
            <span className="w-2" aria-hidden="true" />
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
          </div>
          <div
            data-testid="style-preview"
            className={`mx-auto w-full overflow-hidden rounded-surface border border-line ${fontClasses}`}
            style={
              {
                aspectRatio: String(size.ratio),
                maxWidth: size.ratio < 1 ? "min(100%, 300px, 21vh)" : "min(100%, 68vh)",
                background: "var(--color-surface)",
                "--ov-accent": accent,
                "--ov-ink": inkFor(accent),
              } as React.CSSProperties
            }
          >
            <AlertStage key={`${sizeKey}-${amountKey}-${theme}-${font}`} samples={samples} />
          </div>
          <p className="text-xs text-muted">A sample alert, not a real tip. It repeats every few seconds.</p>
        </div>
      </Tile>

      <Tile id="card-style" level={2} title="Card style">
        <div role="radiogroup" aria-label="Card style" className="grid gap-2 sm:grid-cols-2">
          {THEMES.map((t) => (
            <button
              key={t.key}
              type="button"
              role="radio"
              aria-checked={t.key === theme}
              onClick={() => setTheme(t.key)}
              className={`rounded-[var(--radius-field)] border p-4 text-left transition-colors duration-150 ${
                t.key === theme ? "border-accent bg-raised" : "border-control hover:border-muted"
              }`}
            >
              <span className="block text-sm font-semibold text-text">{t.label}</span>
              <span className="mt-1 block text-xs text-muted">{t.description}</span>
            </button>
          ))}
        </div>
      </Tile>

      <Tile id="font" level={2} title="Font">
        <div role="radiogroup" aria-label="Font" className="flex flex-wrap gap-2">
          {FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={f.key === font}
              onClick={() => setFont(f.key)}
              className={`${CHIP} ${f.key === font ? CHIP_ON : CHIP_OFF}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          The font is used for the name and the message. Amounts keep the Freetip number style so they
          always fit. These fonts have no Hindi letters, so Hindi names and messages show in a plain font.
        </p>
      </Tile>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={busy || !changed} className={pillPrimary}>
          {busy ? "Saving…" : "Save style"}
        </button>
        <Msg kind={message?.kind} text={message?.text} />
      </div>
    </div>
  );
}

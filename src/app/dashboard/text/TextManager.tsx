"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAlertText } from "@/app/actions/alert-text";
import { AlertStage, type OverlayAlert } from "@/components/overlay/AlertStage";
import { inkFor } from "@/lib/accent";
import {
  HEADLINE_MAX,
  TEXT_SIZES,
  TEXT_WEIGHTS,
  baseColours,
  effectiveColours,
  parseAlertText,
  type AlertText,
  type TextSize,
  type TextWeight,
} from "@/lib/alert-text";
import type { FontKey, ThemeKey } from "@/lib/overlay-themes";
import { Tile } from "../parts/Tile";
import { PreviewSplit } from "../parts/PreviewSplit";
import { Msg } from "../parts/Msg";
import { useUnsavedWarning } from "../parts/useUnsavedWarning";
import { pillOutline, pillPrimary, pillText, field, smallLabel } from "../parts/styles";

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

const COLOURS = [
  { key: "bg", label: "Card" },
  { key: "text", label: "Text" },
  { key: "amount", label: "Amount" },
] as const;
type ColourKey = (typeof COLOURS)[number]["key"];

export function TextManager({
  saved,
  accent,
  theme,
  font,
  fontClasses,
}: {
  saved: AlertText | null;
  accent: string;
  theme: ThemeKey;
  font: FontKey;
  fontClasses: string;
}) {
  const router = useRouter();
  const [headline, setHeadline] = useState(saved?.headline ?? "");
  const [colours, setColours] = useState<Record<ColourKey, string | null>>({
    bg: saved?.bg ?? null,
    text: saved?.text ?? null,
    amount: saved?.amount ?? null,
  });
  const [size, setSize] = useState<TextSize>(saved?.size ?? "normal");
  const [weight, setWeight] = useState<TextWeight>(saved?.weight ?? "normal");
  const [amountKey, setAmountKey] = useState<(typeof AMOUNTS)[number]["key"]>("500");
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("landscape");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const base = useMemo(() => baseColours(theme, accent), [theme, accent]);
  const input = { headline, bg: colours.bg, text: colours.text, amount: colours.amount, size, weight };
  // The same rules the server applies, so a problem shows before the creator presses Save.
  const parsed = useMemo(() => parseAlertText(input, base), [input.headline, colours, size, weight, base]); // eslint-disable-line react-hooks/exhaustive-deps
  const draft = parsed.ok ? parsed.value : null;
  const problem = parsed.ok ? null : parsed.message;
  const shown = effectiveColours(draft, base);

  const sizeBox = SIZES.find((s) => s.key === sizeKey)!;
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
        text: draft,
      },
    ],
    [amount, theme, font, draft],
  );
  const same = JSON.stringify(draft) === JSON.stringify(saved);
  useUnsavedWarning(!same);

  async function save() {
    setBusy(true);
    setMessage(null);
    const res = await saveAlertText(input);
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: "Saved. The next alert uses this text; no OBS reload is needed." });
    router.refresh();
  }

  function addToken(token: "{name}" | "{amount}") {
    if (headline.includes(token)) return;
    setHeadline((h) => (h ? `${h} ${token}` : token));
  }

  return (
    <PreviewSplit
      preview={
        <Tile id="preview" level={2} title="Preview">
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
            data-testid="text-preview"
            className={`mx-auto w-full overflow-hidden rounded-surface border border-line ${fontClasses}`}
            style={
              {
                aspectRatio: String(sizeBox.ratio),
                maxWidth: sizeBox.ratio < 1 ? "min(100%, 300px, 21vh)" : "min(100%, 68vh)",
                background: "var(--color-surface)",
                "--ov-accent": accent,
                "--ov-ink": inkFor(accent),
              } as React.CSSProperties
            }
          >
            <AlertStage key={`${sizeKey}-${amountKey}-${JSON.stringify(draft)}`} samples={samples} />
          </div>
          <p className="text-xs text-muted">A sample alert, not a real tip. It repeats every few seconds.</p>
        </div>
      </Tile>
      }
    >

      <Tile id="headline" level={2} title="Headline">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label htmlFor="alert-headline" className={smallLabel}>
              The line above the amount
            </label>
            <span className="text-xs text-muted">
              {headline.length}/{HEADLINE_MAX}
            </span>
          </div>
          <input
            id="alert-headline"
            type="text"
            value={headline}
            maxLength={HEADLINE_MAX}
            placeholder="{name} tipped"
            onChange={(e) => setHeadline(e.target.value)}
            className={field}
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" data-reveal onClick={() => addToken("{name}")} className={pillOutline}>
              Add {"{name}"}
            </button>
            <button type="button" data-reveal onClick={() => addToken("{amount}")} className={pillOutline}>
              Add {"{amount}"}
            </button>
            <button type="button" data-reveal onClick={() => setHeadline("")} disabled={!headline} className={pillOutline}>
              Use the normal line
            </button>
          </div>
          <p className="text-xs text-muted">
            {"{name}"} is the supporter&rsquo;s name and {"{amount}"} the tip. Leave it empty for
            &ldquo;Name tipped&rdquo;. If you add {"{amount}"}, the amount moves into this line. Plain
            text only; the message card that follows an approval still says &ldquo;Name says&rdquo;.
          </p>
        </div>
      </Tile>

      <Tile id="colours" level={2} title="Colours">
        <div className="grid gap-4 sm:grid-cols-3">
          {COLOURS.map((c) => {
            const value = colours[c.key];
            const effective = shown[c.key === "bg" ? "bg" : c.key === "text" ? "fg" : "amount"];
            return (
              <div key={c.key} className="space-y-2">
                <label htmlFor={`colour-${c.key}`} className={smallLabel}>
                  {c.label}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id={`colour-${c.key}`}
                    type="color"
                    value={value ?? effective}
                    onChange={(e) => setColours((cs) => ({ ...cs, [c.key]: e.target.value }))}
                    className="h-12 w-16 cursor-pointer rounded-[var(--radius-field)] border border-control bg-ground p-1"
                  />
                  <button
                    type="button"
                    data-reveal
                    onClick={() => setColours((cs) => ({ ...cs, [c.key]: null }))}
                    disabled={value === null}
                    className={pillText}
                  >
                    {value === null ? "Normal" : "Reset"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          &ldquo;Normal&rdquo; follows your accent colour and your card style. The text and amount
          colours must stand out from the card; if they do not, we say so before you can save.
        </p>
      </Tile>

      <Tile id="size-weight" level={2} title="Size and weight">
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Text size" className="flex flex-wrap gap-2">
            {TEXT_SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={s.key === size}
                onClick={() => setSize(s.key)}
                className={`${CHIP} ${s.key === size ? CHIP_ON : CHIP_OFF}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Text weight" className="flex flex-wrap gap-2">
            {TEXT_WEIGHTS.map((w) => (
              <button
                key={w.key}
                type="button"
                role="radio"
                aria-checked={w.key === weight}
                onClick={() => setWeight(w.key)}
                className={`${CHIP} ${w.key === weight ? CHIP_ON : CHIP_OFF}`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">Size and weight apply to the name line and the message. The amount keeps its fitted size.</p>
        </div>
      </Tile>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={save} disabled={busy || same || !!problem} className={pillPrimary}>
          {busy ? "Saving…" : "Save text"}
        </button>
        <Msg kind={problem ? "error" : message?.kind} text={problem ?? message?.text} />
      </div>
    </PreviewSplit>
  );
}

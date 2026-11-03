"use client";

import { useState } from "react";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { ACCENT_PRESETS, MIN_GROUND_CONTRAST, MIN_INK_CONTRAST, inkFor, pairChecks } from "@/lib/accent";
import type { ThemeResult } from "@/lib/page-doc/edit";
import type { Theme } from "@/lib/page-doc/types";

const HEX = /^#[0-9a-f]{6}$/i;
// The red of the owner's channel: not one of the creator presets, but allowed (it passes the rule).
const SWATCHES = [{ id: "owner-red", label: "Owner red", hex: "#ca1b19" }, ...ACCENT_PRESETS];

// The page's accent colour and the ink on it. A pair that cannot be read is never applied: the
// two ratios are shown with a tick or a mark and the words, not by colour alone.
export function ColourEditor({ theme, onChange }: { theme: Theme; onChange: (accent: string | null, ink: string | null) => ThemeResult }) {
  const [accent, setAccent] = useState(theme.accent ?? "");
  const [ink, setInk] = useState(theme.ink ?? "");
  const [auto, setAuto] = useState(theme.ink === undefined);
  const [problems, setProblems] = useState<string[]>([]);
  const [tried, setTried] = useState<ThemeResult["checks"]>(null);

  // When the colours in the draft change from outside (a reset, a revert, a swatch), the fields
  // follow, during the render rather than in an effect.
  const key = `${theme.accent ?? ""}|${theme.ink ?? ""}`;
  const [seen, setSeen] = useState(key);
  if (key !== seen) {
    setSeen(key);
    setAccent(theme.accent ?? "");
    setInk(theme.ink ?? "");
    setAuto(theme.ink === undefined);
    setTried(null);
    setProblems([]);
  }

  function apply(nextAccent: string, nextInk: string, nextAuto: boolean) {
    if (!HEX.test(nextAccent) || (!nextAuto && !HEX.test(nextInk))) {
      setProblems(nextAccent === "" ? [] : ["Colours are written as #rrggbb."]);
      return;
    }
    const r = onChange(nextAccent, nextAuto ? null : nextInk);
    setProblems(r.problems);
    setTried(r.checks);
  }

  function ownColour() {
    onChange(null, null);
    setAccent("");
    setProblems([]);
    setTried(null);
  }

  const shown = tried ?? (theme.accent ? pairChecks(theme.accent, theme.ink ?? inkFor(theme.accent)) : null);
  const row = (label: string, value: number, needs: number) => (
    <li key={label} className={value >= needs ? "text-muted" : "text-warn"}>
      <span aria-hidden="true">{value >= needs ? "✓ " : "● "}</span>
      {label}: {value.toFixed(1)} to 1 (needs {needs}) {value >= needs ? "" : "- too low"}
    </li>
  );

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        Without a colour here the page uses the creator&apos;s own accent colour. A colour is applied only when the text on it
        can be read and the colour itself shows up on the dark page.
      </p>
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Accent colour</p>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${s.label} ${s.hex}`}
              aria-pressed={theme.accent === s.hex}
              onClick={() => {
                setAccent(s.hex);
                apply(s.hex, ink, auto);
              }}
              style={{ backgroundColor: s.hex }}
              className={`size-9 rounded-full border-2 ${theme.accent === s.hex ? "border-text" : "border-control"}`}
            />
          ))}
        </div>
        <div className="flex items-end gap-2">
          <label className="min-w-0 flex-1 space-y-1 text-xs text-muted">
            Accent (#rrggbb)
            <input
              value={accent}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                setAccent(e.target.value);
                apply(e.target.value, ink, auto);
              }}
              className={`${FIELD_CLASS} numeric block w-full`}
            />
          </label>
          <button type="button" onClick={ownColour} disabled={!theme.accent && !accent} className={buttonClass("quiet", "md")}>
            Creator&apos;s own colour
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-3 text-sm text-text">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => {
              setAuto(e.target.checked);
              if (accent) apply(accent, ink, e.target.checked);
            }}
            className="size-4 accent-[var(--color-accent)]"
          />
          Choose the text colour on the accent automatically
        </label>
        {!auto && (
          <label className="block space-y-1 text-xs text-muted">
            Text on the accent (#rrggbb)
            <input
              value={ink}
              maxLength={7}
              spellCheck={false}
              onChange={(e) => {
                setInk(e.target.value);
                if (accent) apply(accent, e.target.value, false);
              }}
              className={`${FIELD_CLASS} numeric block w-full`}
            />
          </label>
        )}
      </div>
      {shown && (
        <ul aria-label="Colour checks" className="space-y-1 text-xs">
          {row("Text on the colour", shown.inkOnAccent, MIN_INK_CONTRAST)}
          {row("Colour on the page", shown.accentOnGround, MIN_GROUND_CONTRAST)}
        </ul>
      )}
      {problems.length > 0 && (
        <ul role="alert" className="space-y-1 text-xs text-warn">
          {problems.map((p) => (
            <li key={p}>
              <span aria-hidden="true">● </span>
              {p}
            </li>
          ))}
          <li className="text-muted">The page keeps the last good colours until this is fixed.</li>
        </ul>
      )}
    </div>
  );
}

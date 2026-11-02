"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteVariation, saveVariation } from "@/app/actions/alert-variations";
import { AlertStage, type OverlayAlert } from "@/components/overlay/AlertStage";
import { inkFor } from "@/lib/accent";
import { RULE_MAX_RUPEES, STAY_CHOICES, STAY_MIN_RUPEES } from "@/lib/alert-rules";
import { HEADLINE_MAX, baseColours, effectiveColours, type AlertText } from "@/lib/alert-text";
import { VARIATION_MIN_RUPEES, mergeAlertText, parseVariation } from "@/lib/alert-variations";
import type { AlertMedia } from "@/lib/media";
import type { FontKey, ThemeKey } from "@/lib/overlay-themes";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { ConfirmAction } from "../parts/ConfirmAction";
import { SelectField } from "../parts/Controls";
import { EmptyState } from "../parts/EmptyState";
import { field, pillOutline, pillPrimary, pillText, smallLabel } from "../parts/styles";

export interface VariationRow {
  id: number;
  minRupees: number;
  mediaId: number | null;
  mediaName: string | null;
  soundId: number | null;
  soundName: string | null;
  text: AlertText | null;
  staySeconds: number | null;
}

interface Option {
  id: number;
  label: string;
}
interface MediaOption extends Option {
  media: AlertMedia;
}

const CHIP = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition-colors duration-150";
const CHIP_OFF = "border-control text-text hover:border-muted";
const CHIP_ON = "border-accent bg-accent font-semibold text-ink";

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

function stayLabel(seconds: number) {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}

export function VariationsManager({
  rows,
  sounds,
  media,
  mediaOn,
  textOn,
  standardText,
  accent,
  theme,
  font,
  fontClasses,
  max,
}: {
  rows: VariationRow[];
  sounds: Option[];
  media: MediaOption[];
  mediaOn: boolean;
  textOn: boolean;
  standardText: AlertText | null;
  accent: string;
  theme: ThemeKey;
  font: FontKey;
  fontClasses: string;
  max: number;
}) {
  const router = useRouter();
  const [rupees, setRupees] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [soundId, setSoundId] = useState("");
  const [headline, setHeadline] = useState("");
  const [colours, setColours] = useState<Record<ColourKey, string | null>>({ bg: null, text: null, amount: null });
  const [stay, setStay] = useState("");
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("landscape");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const base = useMemo(() => baseColours(theme, accent), [theme, accent]);
  const canStay = Number(rupees) >= STAY_MIN_RUPEES;
  const hasText = textOn && (headline.trim() !== "" || colours.bg || colours.text || colours.amount);
  const input = {
    minRupees: rupees,
    mediaId: mediaId ? Number(mediaId) : null,
    soundId: soundId ? Number(soundId) : null,
    staySeconds: canStay && stay ? Number(stay) : null,
    text: hasText ? { headline, ...colours } : null,
  };
  // The same rules the server applies, so a problem shows before the creator presses Save.
  // Nothing is said until an amount is typed.
  const parsed = useMemo(
    () => parseVariation(input, { base, standard: standardText, textOn }),
    [rupees, mediaId, soundId, stay, headline, colours, canStay, hasText, base, standardText, textOn], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const problem = rupees && !parsed.ok ? parsed.message : null;
  const draftText = parsed.ok ? parsed.value.text : null;
  const shownColours = effectiveColours(mergeAlertText(standardText, draftText, base), base);

  const sizeBox = SIZES.find((s) => s.key === sizeKey)!;
  const previewMedia = mediaOn && mediaId ? (media.find((m) => m.id === Number(mediaId))?.media ?? null) : null;
  const previewRupees = Math.max(Number(rupees) || 500, VARIATION_MIN_RUPEES);
  const samples = useMemo<OverlayAlert[]>(
    () => [
      {
        id: 0,
        kind: "alert",
        name: "Riya",
        amountPaise: previewRupees * 100,
        message: "Loved the last clutch, play ranked tomorrow too.",
        theme: { theme, font },
        text: mergeAlertText(standardText, draftText, base),
        media: previewMedia,
      },
    ],
    [previewRupees, theme, font, standardText, draftText, base, previewMedia],
  );

  function reset() {
    setRupees("");
    setMediaId("");
    setSoundId("");
    setHeadline("");
    setColours({ bg: null, text: null, amount: null });
    setStay("");
  }

  function edit(r: VariationRow) {
    setRupees(String(r.minRupees));
    setMediaId(r.mediaId === null ? "" : String(r.mediaId));
    setSoundId(r.soundId === null ? "" : String(r.soundId));
    setHeadline(r.text?.headline ?? "");
    setColours({ bg: r.text?.bg ?? null, text: r.text?.text ?? null, amount: r.text?.amount ?? null });
    setStay(r.staySeconds === null ? "" : String(r.staySeconds));
    setMessage(null);
    document.getElementById("variation-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await saveVariation(input);
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: "Variation saved. The next tip of that size uses it; no OBS reload is needed." });
    reset();
    router.refresh();
  }

  async function remove(id: number) {
    setBusy(true);
    const res = await deleteVariation(id);
    setBusy(false);
    if (res.status === "error") setMessage({ kind: "error", text: res.message });
    else router.refresh();
  }

  const exists = rows.some((r) => String(r.minRupees) === rupees);
  const full = rows.length >= max && !exists;

  return (
    <div className="space-y-6">
      <Tile id="variation-form" level={2} title={exists ? "Change a variation" : "Add a variation"}>
        <form onSubmit={save} className="space-y-6">
          <label className="block space-y-1">
            <span className={smallLabel}>From this tip size up (₹)</span>
            <input
              inputMode="numeric"
              value={rupees}
              onChange={(e) => setRupees(e.target.value.replace(/\D/g, "").slice(0, String(RULE_MAX_RUPEES).length))}
              placeholder="500"
              className={`${field} w-full`}
              required
            />
          </label>

          {rupees && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Screen shape">
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
                data-testid="variation-preview"
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
                <AlertStage key={`${sizeKey}-${previewRupees}-${JSON.stringify(draftText)}-${mediaId}`} samples={samples} />
              </div>
              <p className="text-xs text-muted">
                A sample ₹{previewRupees.toLocaleString("en-IN")} alert with a made-up voice, not a real tip.
                The sound and the longer stay are not shown here.
              </p>
            </div>
          )}

          {mediaOn && (
            <label className="block space-y-1">
              <span className={smallLabel}>Media to show</span>
              <SelectField value={mediaId} onChange={(e) => setMediaId(e.target.value)} className="w-full">
                <option value="">None (use the normal rotation)</option>
                {media.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </SelectField>
            </label>
          )}

          <label className="block space-y-1">
            <span className={smallLabel}>Sound to play</span>
            <SelectField value={soundId} onChange={(e) => setSoundId(e.target.value)} className="w-full">
              <option value="">None (use the default sound)</option>
              {sounds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </SelectField>
          </label>

          {textOn && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label htmlFor="variation-headline" className={smallLabel}>
                    The line above the amount
                  </label>
                  <span className="text-xs text-muted">
                    {headline.length}/{HEADLINE_MAX}
                  </span>
                </div>
                <input
                  id="variation-headline"
                  type="text"
                  value={headline}
                  maxLength={HEADLINE_MAX}
                  placeholder="{name} tipped"
                  onChange={(e) => setHeadline(e.target.value)}
                  className={field}
                  autoComplete="off"
                />
                <p className="text-xs text-muted">
                  Use {"{name}"} once, and {"{amount}"} if you like. Empty keeps your standard line.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {COLOURS.map((c) => {
                  const value = colours[c.key];
                  const effective = shownColours[c.key === "bg" ? "bg" : c.key === "text" ? "fg" : "amount"];
                  return (
                    <div key={c.key} className="space-y-2">
                      <label htmlFor={`variation-colour-${c.key}`} className={smallLabel}>
                        {c.label}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          id={`variation-colour-${c.key}`}
                          type="color"
                          value={value ?? effective}
                          onChange={(e) => setColours((cs) => ({ ...cs, [c.key]: e.target.value }))}
                          className="h-12 w-16 cursor-pointer rounded-[var(--radius-field)] border border-control bg-ground p-1"
                        />
                        <button
                          type="button"
                          onClick={() => setColours((cs) => ({ ...cs, [c.key]: null }))}
                          disabled={value === null}
                          className={pillText}
                        >
                          {value === null ? "Standard" : "Reset"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {canStay && (
            <label className="block space-y-1">
              <span className={smallLabel}>Stay on screen for</span>
              <SelectField value={stay} onChange={(e) => setStay(e.target.value)} className="w-full">
                <option value="">The normal length</option>
                {STAY_CHOICES.map((s) => (
                  <option key={s} value={s}>
                    {stayLabel(s)}
                  </option>
                ))}
              </SelectField>
              <span className="block text-xs text-muted">
                Tips that come in meanwhile wait their turn. You can press Skip to end it early.
              </span>
            </label>
          )}

          <p className="numeric text-xs text-muted">
            {rows.length} of {max} variations. Saving a size that already has one replaces it.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" disabled={busy || full || !rupees || !parsed.ok} className={pillPrimary}>
              {busy ? "Saving…" : "Save variation"}
            </button>
            {rupees && (
              <button type="button" onClick={reset} className={pillOutline}>
                Clear the form
              </button>
            )}
            <Msg kind={problem ? "error" : message?.kind} text={problem ?? message?.text} />
          </div>
        </form>
      </Tile>

      {rows.length === 0 ? (
        <Tile id="your-variations" level={2} title="Your variations">
          <EmptyState
            sample={
              <div className="flex items-center gap-3 rounded-field border border-line/60 bg-ground px-4 py-3 text-sm">
                <span className="numeric font-medium text-text">From ₹500</span>
                <span className="min-w-0 flex-1 truncate text-muted">Media: Confetti · Sound: Airhorn · Stays 30 s</span>
              </div>
            }
            title="No variations yet."
            body="Without one, every tip plays your normal alert. For example, from ₹500 up the alert could show confetti with a big sound."
          />
        </Tile>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Your variations</h2>
          <ul className="space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="numeric text-base font-medium text-text">From ₹{r.minRupees.toLocaleString("en-IN")}</p>
                  <p className="break-words text-sm text-muted">
                    {[
                      r.mediaName && `Media: ${r.mediaName}`,
                      r.soundName && `Sound: ${r.soundName}`,
                      r.text?.headline && `Line: ${r.text.headline}`,
                      (r.text?.bg || r.text?.text || r.text?.amount) && "Own colours",
                      r.staySeconds && `Stays ${stayLabel(r.staySeconds)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <button type="button" onClick={() => edit(r)} disabled={busy} className={pillOutline}>
                  Change
                </button>
                <ConfirmAction
                  prompt={`Delete the variation from ₹${r.minRupees}?`}
                  confirmLabel="Yes, delete it"
                  keepLabel="Keep it"
                  onConfirm={() => remove(r.id)}
                  disabled={busy}
                  className={pillOutline}
                >
                  Delete
                </ConfirmAction>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { buttonClass, FIELD_CLASS } from "@/components/admin/tones";
import { AlertStage, type OverlayAlert } from "@/components/overlay/AlertStage";
import { GoalBar } from "@/components/overlay/GoalBar";
import { inkFor, safeAccent } from "@/lib/accent";
import { ENTER_CHOICES, EXIT_CHOICES, GAP_MAX_SECONDS, LENGTH_MAX_SECONDS, LENGTH_MIN_SECONDS } from "@/lib/alert-motion";
import { SIDE_CHOICES, VOLUME_MAX_PERCENT, VOLUME_MIN_PERCENT } from "@/lib/alert-layout";
import { HEADLINE_MAX, TEXT_SIZES, TEXT_WEIGHTS } from "@/lib/alert-text";
import { FONTS, THEMES, isFontKey, isThemeKey, resolveOverlayStyle } from "@/lib/overlay-themes";
import { checkDraft, overlayParts, sameValues, type OverlayDraft, type OverlayValues } from "@/lib/overlay-doc/draft";
import type { OverlayResult, SaveResult } from "@/lib/overlay-doc/store";

// What the editor opens with (see loadOverlayState in the store).
export interface OverlayStart {
  // The draft to edit: the saved draft, else the live values written out as fields.
  doc: OverlayDraft;
  // The draft exactly as stored (null when there is none); sent back with every save.
  base: unknown;
  // The live values as a draft: to tell what is not published yet and to go back to.
  live: OverlayDraft;
  source: "draft" | "live";
  hasPrevious: boolean;
}

export type SaveOverlayDraft = (base: unknown, next: OverlayDraft) => Promise<SaveResult>;
export type OverlayAction = () => Promise<OverlayResult>;

const AUTOSAVE_MS = 1500;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const AMOUNTS = [
  { key: "99", label: "₹99", paise: 9900, message: "Great stream today!" },
  { key: "500", label: "₹500", paise: 50000, message: "Loved the last clutch, play ranked tomorrow too." },
  { key: "2000", label: "₹2,000", paise: 200000, message: "Best stream I have watched all year." },
] as const;
const SIZES = [
  { key: "landscape", label: "Landscape", ratio: 16 / 9 },
  { key: "vertical", label: "Vertical", ratio: 9 / 16 },
] as const;
const GOAL_STEPS = [25, 60, 100] as const;
const GOAL_TARGET_PAISE = 1_000_000;

const CHIP = "inline-flex min-h-9 items-center rounded-full border px-3 text-xs transition-colors duration-150";
const CHIP_OFF = "border-control text-text hover:border-muted";
const CHIP_ON = "border-accent bg-accent font-semibold text-ink";

type Tab = "alert" | "goal";

// The owner's editor for a creator's OBS overlays. The working draft lives here; it is saved on its
// own a moment after the last change (the store only accepts a save made from the draft it last
// handed out, so a second tab cannot overwrite this one). Nothing reaches a stream until Publish,
// which the store checks again with the creator's own rules. The preview is the real alert card and
// the real goal bar, drawn from the draft with made-up tips: it never touches the creator's OBS.
export function OverlayEditor({
  start,
  creatorName,
  features,
  accent: storedAccent,
  fontClasses,
  save,
  publish,
  swap,
  discard,
}: {
  start: OverlayStart;
  creatorName: string;
  features: string[];
  accent: string | null;
  fontClasses: string;
  save: SaveOverlayDraft;
  publish: OverlayAction;
  swap: OverlayAction;
  discard: OverlayAction;
}) {
  const row = useMemo(() => ({ paid_features: features, accent: storedAccent }), [features, storedAccent]);
  const parts = useMemo(() => overlayParts(row), [row]);
  const accent = safeAccent(storedAccent);

  const [doc, setDoc] = useState(start.doc);
  const docRef = useRef(start.doc);
  const baseRef = useRef<unknown>(start.base);
  const [sentJson, setSentJson] = useState(() => JSON.stringify(start.doc));
  const sentRef = useRef(sentJson);
  const busyRef = useRef(false);
  const [saved, setSaved] = useState(start.source === "draft");
  const [live, setLive] = useState(start.live);
  const [hasPrevious, setHasPrevious] = useState(start.hasPrevious);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("alert");
  const [asking, setAsking] = useState<"publish" | "revert" | "swap" | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [amountKey, setAmountKey] = useState<(typeof AMOUNTS)[number]["key"]>("500");
  const [sizeKey, setSizeKey] = useState<(typeof SIZES)[number]["key"]>("landscape");
  const [goalPercent, setGoalPercent] = useState<(typeof GOAL_STEPS)[number]>(60);
  const [replay, setReplay] = useState(0);

  const dirty = JSON.stringify(doc) !== sentJson;

  // Every change goes through here, so the latest document is the one that is edited.
  function change(edit: (d: OverlayDraft) => void) {
    const next = structuredClone(docRef.current);
    edit(next);
    docRef.current = next;
    setDoc(next);
    setSaveError(null);
    setNotice(null);
    setAsking(null);
  }

  // The same checks Publish makes, so a problem shows before the owner presses it.
  const checked = useMemo(() => checkDraft(doc, row), [doc, row]);
  const liveChecked = useMemo(() => checkDraft(live, row), [live, row]);
  // The preview keeps the last draft that passed the checks, so a half-typed colour does not blank it.
  const [good, setGood] = useState<OverlayValues>(checked.ok ? checked.values : {});
  if (checked.ok && checked.values !== good) setGood(checked.values);
  const values = good;
  const unpublished = checked.ok && liveChecked.ok ? !sameValues(checked.values, liveChecked.values) : !same(doc, live);

  // Saves a moment after the last change. Stops on a conflict or an error until the owner acts.
  useEffect(() => {
    if (!dirty || saving || conflict || saveError) return;
    const timer = setTimeout(async () => {
      const sent = docRef.current;
      const json = JSON.stringify(sent);
      setSaving(true);
      busyRef.current = true;
      try {
        const result = await save(baseRef.current, sent);
        if (result.ok) {
          baseRef.current = result.doc;
          sentRef.current = json;
          setSentJson(json);
          setSaved(true);
        } else if (result.conflict) setConflict(true);
        else setSaveError(result.message);
      } catch {
        setSaveError("Could not reach the server. Check the connection and try again.");
      } finally {
        busyRef.current = false;
        setSaving(false);
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, doc, saving, conflict, saveError, save]);

  // Leaving by a link inside the site: send the change that was still waiting. Best effort.
  // Kept in a ref: a re-render after Publish gives the action a new identity, and that must
  // not look like leaving the editor.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  useEffect(
    () => () => {
      if (busyRef.current || JSON.stringify(docRef.current) === sentRef.current) return;
      saveRef.current(baseRef.current, docRef.current).catch(() => {});
    },
    [],
  );

  // A warning if the tab is closed with a change that is not saved yet.
  useEffect(() => {
    if (!dirty && !saving) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saving]);

  async function act(kind: "publish" | "revert" | "swap") {
    setWorking(true);
    try {
      if (kind === "publish") {
        const r = await publish();
        setAsking(null);
        if (r.ok) {
          setLive(docRef.current);
          // Publishing always keeps the version it replaced.
          setHasPrevious(true);
        }
        setNotice({ ok: r.ok, text: r.message });
      } else if (kind === "swap") {
        const r = await swap();
        setAsking(null);
        setNotice({ ok: r.ok, text: r.message });
        // The live values and the draft both moved on; start again from the server's.
        if (r.ok) window.location.reload();
      } else {
        const r = await discard();
        setAsking(null);
        if (r.ok) {
          docRef.current = live;
          baseRef.current = null;
          setDoc(live);
          sentRef.current = JSON.stringify(live);
          setSentJson(sentRef.current);
          setSaved(false);
          setConflict(false);
          setSaveError(null);
        }
        setNotice({ ok: r.ok, text: r.ok ? "Back to what is live. The draft is gone." : r.message });
      }
    } catch {
      setNotice({ ok: false, text: "Could not reach the server. Nothing was changed." });
    } finally {
      setWorking(false);
    }
  }

  const status = conflict ? "Changed somewhere else" : saveError ? "Not saved" : saving ? "Saving…" : dirty ? "Changes not saved yet" : saved ? "Draft saved" : "Nothing changed yet";
  const canPublish = !dirty && !saving && !conflict && !saveError && saved && checked.ok && unpublished && !working;
  const canRevert = (saved || dirty) && !working && !saving;

  // The sample the preview plays, from the last draft that passed the checks.
  const amount = AMOUNTS.find((a) => a.key === amountKey)!;
  const sizeBox = SIZES.find((s) => s.key === sizeKey)!;
  // Memoised: a new object every render would restart the preview and queue another sample.
  const style = useMemo(
    () => (parts.style && values.style ? resolveOverlayStyle(values.style) : null),
    [parts.style, values.style],
  );
  const samples = useMemo<OverlayAlert[]>(
    () => [
      {
        id: 0,
        kind: "alert",
        name: "Riya",
        amountPaise: amount.paise,
        message: amount.message,
        theme: style,
        text: values.alertText ?? null,
        motion: values.alertMotion ?? null,
        layout: values.alertLayout ?? null,
        test: true,
      },
    ],
    [amount, style, values.alertText, values.alertMotion, values.alertLayout],
  );
  const goalStyle = values.goalBar ?? null;
  const goalSample = useMemo(() => {
    const raised = Math.floor((GOAL_TARGET_PAISE * goalPercent) / 100);
    const base = { title: "New headset", repeat: "weekly" as const };
    return {
      goals: [goalStyle?.show === "percent" ? { ...base, percent: goalPercent } : { ...base, raisedPaise: raised, targetPaise: GOAL_TARGET_PAISE }],
      style: goalStyle,
    };
  }, [goalPercent, goalStyle]);

  const frame = {
    className: `mx-auto w-full overflow-hidden rounded-surface border border-line ${fontClasses}`,
    style: {
      aspectRatio: String(sizeBox.ratio),
      maxWidth: sizeBox.ratio < 1 ? "min(100%, 300px, 21vh)" : "min(100%, 62vh)",
      background: "var(--color-surface)",
      "--ov-accent": accent,
      "--ov-ink": inkFor(accent),
    } as React.CSSProperties,
  };

  const T = doc.text;
  const M = doc.motion;
  const L = doc.layout;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p role="status" className="text-sm font-medium text-text">
            {status}
          </p>
          <p className="text-xs text-muted">
            {saved ? (unpublished ? "The saved draft is not live yet." : "The saved draft is what is live.") : "Nothing saved yet."} The stream keeps using what is live for{" "}
            {creatorName} until you publish.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {saveError && (
            <button type="button" onClick={() => setSaveError(null)} className={buttonClass("quiet", "md")}>
              Try saving again
            </button>
          )}
          {conflict && (
            <button type="button" onClick={() => window.location.reload()} className={buttonClass("primary", "md")}>
              Reload the latest draft
            </button>
          )}
          {hasPrevious && (
            <button type="button" disabled={working || dirty || saving} title={dirty || saving ? "Wait for Draft saved first" : undefined} onClick={() => setAsking(asking === "swap" ? null : "swap")} aria-expanded={asking === "swap"} className={buttonClass("quiet", "md")}>
              Swap with previous version
            </button>
          )}
          <button type="button" disabled={!canRevert} onClick={() => setAsking(asking === "revert" ? null : "revert")} aria-expanded={asking === "revert"} className={buttonClass("quiet", "md")}>
            Revert to live
          </button>
          <button type="button" disabled={!canPublish} onClick={() => setAsking(asking === "publish" ? null : "publish")} aria-expanded={asking === "publish"} className={buttonClass("primary", "md")}>
            Publish
          </button>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="text-sm text-warn">
          <span aria-hidden="true">● </span>
          {saveError}
        </p>
      )}
      {conflict && (
        <p role="alert" className="text-sm text-warn">
          <span aria-hidden="true">● </span>
          The overlays were changed somewhere else (another tab, or an earlier visit). Saving has stopped so nothing is overwritten. Reload to see the latest draft; your
          changes on this screen are not saved.
        </p>
      )}
      {!checked.ok && (
        <p role="alert" data-testid="overlay-problem" className="text-sm text-warn">
          <span aria-hidden="true">● </span>
          {checked.message} The preview still shows the last version that passed, and Publish is off until this is fixed.
        </p>
      )}
      {asking && (
        <div className="max-w-md space-y-3 rounded-surface border border-control bg-raised p-4">
          <p className="text-sm text-text">
            {asking === "publish"
              ? `Publish this draft? The next alert and the goal bar of ${creatorName} use it at once. What is live now is kept as the previous version.`
              : asking === "swap"
                ? "Swap the live overlays with the previous version? The next alert uses it at once. Doing it again swaps back. Your draft is kept."
                : "Throw the draft away and go back to what is live? The changes in the draft are lost."}
          </p>
          <div className="flex gap-2">
            <button type="button" autoFocus disabled={working} onClick={() => act(asking)} className={buttonClass(asking === "revert" ? "danger" : "primary", "md")}>
              {working ? "Working…" : asking === "publish" ? "Publish now" : asking === "swap" ? "Swap" : "Revert"}
            </button>
            <button type="button" disabled={working} onClick={() => setAsking(null)} className={buttonClass("quiet", "md")}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p role="status" className={`text-sm ${notice.ok ? "text-text" : "text-warn"}`}>
          <span aria-hidden="true">{notice.ok ? "✓ " : "● "}</span>
          {notice.text}
        </p>
      )}

      <p className="rounded-surface border border-control bg-surface p-4 text-sm text-muted lg:hidden">Open this page on a laptop to edit the overlays. The editor needs a wide screen.</p>

      <div className="hidden items-start gap-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="max-h-[calc(100dvh-2rem)] space-y-5 overflow-y-auto pr-1 lg:sticky lg:top-4">
          <div role="tablist" aria-label="Overlay" className="flex gap-2">
            {(
              [
                ["alert", "Alert"],
                ["goal", "Goal bar"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`${CHIP} ${tab === key ? CHIP_ON : CHIP_OFF}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === "alert" ? (
            <div className="space-y-6">
              <Section title="Card style" enabled={parts.style} off="Overlay themes">
                <Select label="Style" value={doc.style.theme} onChange={(v) => change((d) => void (isThemeKey(v) && (d.style.theme = v)))} options={THEMES.map((t) => [t.key, t.label])} />
                <Select label="Font" value={doc.style.font} onChange={(v) => change((d) => void (isFontKey(v) && (d.style.font = v)))} options={FONTS.map((f) => [f.key, f.label])} />
              </Section>

              <Section title="Text and colours" enabled={parts.text} off="Alert text and colours">
                <label className="block space-y-1 text-xs text-muted">
                  <span className="flex justify-between">
                    <span>Headline, with {"{name}"} once and optionally {"{amount}"}</span>
                    <span>
                      {T.headline.length}/{HEADLINE_MAX}
                    </span>
                  </span>
                  <input
                    value={T.headline}
                    onChange={(e) => change((d) => void (d.text.headline = e.target.value))}
                    placeholder="Normal headline"
                    className={`${FIELD_CLASS} block w-full`}
                    maxLength={HEADLINE_MAX + 20}
                  />
                </label>
                {(
                  [
                    ["bg", "Card colour"],
                    ["text", "Text colour"],
                    ["amount", "Amount colour"],
                  ] as const
                ).map(([key, label]) => (
                  <Colour key={key} label={label} value={T[key]} onChange={(v) => change((d) => void (d.text[key] = v))} />
                ))}
                <Select label="Text size" value={T.size} onChange={(v) => change((d) => void (d.text.size = v))} options={TEXT_SIZES.map((s) => [s.key, s.label])} />
                <Select label="Text weight" value={T.weight} onChange={(v) => change((d) => void (d.text.weight = v))} options={TEXT_WEIGHTS.map((w) => [w.key, w.label])} />
              </Section>

              <Section title="Animations and timing" enabled={parts.motion} off="Alert animations and timing">
                <Select label="Comes in" value={M.enter} onChange={(v) => change((d) => void (d.motion.enter = v))} options={ENTER_CHOICES.map((c) => [c.key, c.label])} />
                <Select label="Leaves" value={M.exit} onChange={(v) => change((d) => void (d.motion.exit = v))} options={EXIT_CHOICES.map((c) => [c.key, c.label])} />
                <Digits label={`Stays (${LENGTH_MIN_SECONDS} to ${LENGTH_MAX_SECONDS} seconds, empty is normal)`} value={M.seconds} onChange={(v) => change((d) => void (d.motion.seconds = v))} />
                <Digits label={`Pause before the next alert (0 to ${GAP_MAX_SECONDS} seconds)`} value={M.gap} onChange={(v) => change((d) => void (d.motion.gap = v))} />
              </Section>

              <Section title="Volume and layout" enabled={parts.layout} off="Alert volume and layout">
                <Select label="Picture goes" value={L.side} onChange={(v) => change((d) => void (d.layout.side = v))} options={SIDE_CHOICES.map((c) => [c.key, c.label])} />
                <Digits label={`Sound volume (${VOLUME_MIN_PERCENT} to ${VOLUME_MAX_PERCENT} percent, empty is full)`} value={L.soundVolume} onChange={(v) => change((d) => void (d.layout.soundVolume = v))} />
                <Digits label={`Voice volume (${VOLUME_MIN_PERCENT} to ${VOLUME_MAX_PERCENT} percent, empty is full)`} value={L.voiceVolume} onChange={(v) => change((d) => void (d.layout.voiceVolume = v))} />
              </Section>
            </div>
          ) : (
            <Section title="Goal bar" enabled={parts.goalBar} off="Custom tip page">
              <Colour label="Bar colour (empty is the creator's accent)" value={doc.goalBar.fill} onChange={(v) => change((d) => void (d.goalBar.fill = v))} />
              <Select
                label="Shows"
                value={doc.goalBar.show}
                onChange={(v) => change((d) => void ((v === "amounts" || v === "percent") && (d.goalBar.show = v)))}
                options={[
                  ["amounts", "Rupees and percent"],
                  ["percent", "Percent only"],
                ]}
              />
              <label className="flex items-center gap-3 text-sm text-text">
                <input type="checkbox" checked={doc.goalBar.celebrate} onChange={(e) => change((d) => void (d.goalBar.celebrate = e.target.checked))} className="size-4 accent-[var(--color-accent)]" />
                Mark the moment the goal is reached
              </label>
              <p className="text-xs text-muted">
                In OBS: the creator&apos;s alert link with <span className="numeric">/goal</span> added at the end. With percent only, no rupee figure is sent to OBS at all.
              </p>
            </Section>
          )}
        </div>

        <div className="space-y-4" data-testid="overlay-preview">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Sample and screen shape">
            {tab === "alert"
              ? AMOUNTS.map((a) => (
                  <button key={a.key} type="button" aria-pressed={a.key === amountKey} onClick={() => setAmountKey(a.key)} className={`${CHIP} font-mono ${a.key === amountKey ? CHIP_ON : CHIP_OFF}`}>
                    {a.label}
                  </button>
                ))
              : GOAL_STEPS.map((p) => (
                  <button key={p} type="button" aria-pressed={p === goalPercent} onClick={() => setGoalPercent(p)} className={`${CHIP} font-mono ${p === goalPercent ? CHIP_ON : CHIP_OFF}`}>
                    {p === 100 ? "Goal reached" : `${p}%`}
                  </button>
                ))}
            <span className="w-2" aria-hidden="true" />
            {SIZES.map((s) => (
              <button key={s.key} type="button" aria-pressed={s.key === sizeKey} onClick={() => setSizeKey(s.key)} className={`${CHIP} ${s.key === sizeKey ? CHIP_ON : CHIP_OFF}`}>
                {s.label}
              </button>
            ))}
            {tab === "alert" && (
              <button type="button" onClick={() => setReplay((n) => n + 1)} className={`${CHIP} ${CHIP_OFF}`}>
                Test alert
              </button>
            )}
          </div>
          <div data-testid={tab === "alert" ? "alert-preview" : "goal-preview"} {...frame}>
            {tab === "alert" ? (
              <AlertStage key={`${sizeKey}-${amountKey}-${replay}-${JSON.stringify(values)}`} samples={samples} />
            ) : (
              <GoalBar key={sizeKey} sample={goalSample} />
            )}
          </div>
          <p className="text-xs text-muted">
            A sample, not a real tip, drawn from this draft. Test alert replays it here; nothing is sent to {creatorName}&apos;s OBS and no tip is made.
          </p>
        </div>
      </div>
    </div>
  );
}

// A group of fields. When the creator's paid switch for it is off the fields are disabled: the
// overlay would ignore them, and Publish leaves that part alone.
function Section({ title, enabled, off, children }: { title: string; enabled: boolean; off: string; children: ReactNode }) {
  return (
    <fieldset disabled={!enabled} className="space-y-3 disabled:opacity-60">
      <legend className="mb-2 text-sm font-semibold text-text">{title}</legend>
      {!enabled && (
        <p className="text-xs text-warn">
          <span aria-hidden="true">● </span>Switch on &ldquo;{off}&rdquo; for this creator to change this.
        </p>
      )}
      {children}
    </fieldset>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: (readonly [string, string])[] }) {
  return (
    <label className="block space-y-1 text-xs text-muted">
      <span className="block">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${FIELD_CLASS} block w-full`}>
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function Digits({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block space-y-1 text-xs text-muted">
      <span className="block">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 3))} inputMode="numeric" placeholder="Normal" className={`${FIELD_CLASS} block w-28`} />
    </label>
  );
}

function Colour({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  const valid = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="space-y-1 text-xs text-muted">
      <label htmlFor={id} className="block">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input id={id} value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="#rrggbb or empty" spellCheck={false} className={`${FIELD_CLASS} block w-36 font-mono`} />
        <input
          type="color"
          aria-label={`Pick: ${label}`}
          value={valid ? value.toLowerCase() : "#888888"}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 cursor-pointer rounded border border-control bg-transparent p-0.5"
        />
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs underline hover:text-text">
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

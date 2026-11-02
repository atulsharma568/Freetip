"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteRule, saveRule } from "@/app/actions/alert-rules";
import { RULE_MAX_RUPEES, STAY_CHOICES, STAY_MIN_RUPEES } from "@/lib/alert-rules";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { ConfirmAction } from "../parts/ConfirmAction";
import { SelectField } from "../parts/Controls";
import { EmptyState } from "../parts/EmptyState";
import { pillOutline, pillPrimary } from "../parts/styles";

export interface RuleRow {
  id: number;
  minRupees: number;
  mediaName: string | null;
  soundName: string | null;
  staySeconds: number | null;
}

function stayLabel(seconds: number) {
  return seconds % 60 === 0 ? `${seconds / 60} min` : `${seconds} s`;
}

interface Option {
  id: number;
  label: string;
}

const field =
  "h-11 rounded-[var(--radius-field)] border border-control bg-ground px-3 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent";

export function RulesManager({
  rules,
  sounds,
  media,
  mediaOn,
  maxRules,
}: {
  rules: RuleRow[];
  sounds: Option[];
  media: Option[];
  mediaOn: boolean;
  maxRules: number;
}) {
  const router = useRouter();
  const [rupees, setRupees] = useState("");
  const [mediaId, setMediaId] = useState("");
  const [soundId, setSoundId] = useState("");
  const [stay, setStay] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  const canStay = Number(rupees) >= STAY_MIN_RUPEES;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await saveRule({
      minRupees: rupees,
      mediaId: mediaId ? Number(mediaId) : null,
      soundId: soundId ? Number(soundId) : null,
      staySeconds: canStay && stay ? Number(stay) : null,
    });
    setBusy(false);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({ kind: "ok", text: "Rule saved." });
    setRupees("");
    setMediaId("");
    setSoundId("");
    setStay("");
    router.refresh();
  }

  async function remove(id: number) {
    setBusy(true);
    const res = await deleteRule(id);
    setBusy(false);
    if (res.status === "error") setMessage({ kind: "error", text: res.message });
    else router.refresh();
  }

  const full = rules.length >= maxRules;

  return (
    <div className="space-y-6">
      <Tile id="add-rule" level={2} title="Add a rule">
        <form onSubmit={add} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs uppercase tracking-widest text-muted">Fixed tip amount (₹)</span>
            <input
              inputMode="numeric"
              value={rupees}
              onChange={(e) => setRupees(e.target.value.replace(/\D/g, "").slice(0, String(RULE_MAX_RUPEES).length))}
              placeholder="500"
              className={`${field} w-full`}
              required
            />
          </label>
          {mediaOn && (
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-widest text-muted">Media to show</span>
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
            <span className="text-xs uppercase tracking-widest text-muted">Sound to play</span>
            <SelectField value={soundId} onChange={(e) => setSoundId(e.target.value)} className="w-full">
              <option value="">None (use the default sound)</option>
              {sounds.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </SelectField>
          </label>
          {canStay && (
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-widest text-muted">Stay on screen for</span>
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
            {rules.length} of {maxRules} rules. Saving an amount that already has a rule replaces it.
          </p>
          <button type="submit" disabled={busy || full || !rupees || (!mediaId && !soundId && !(canStay && stay))} className={pillPrimary}>
            {busy ? "Saving…" : "Save rule"}
          </button>
          <Msg kind={message?.kind} text={message?.text} />
        </form>
      </Tile>

      {rules.length === 0 ? (
        <Tile id="your-rules" level={2} title="Your rules">
          <EmptyState
            sample={
              <div className="flex items-center gap-3 rounded-field border border-line/60 bg-ground px-4 py-3 text-sm">
                <span className="numeric font-medium text-text">₹500 pick</span>
                <span className="min-w-0 flex-1 truncate text-muted">Media: Confetti · Sound: Airhorn</span>
              </div>
            }
            title="No rules yet."
            body="Without a rule, every tip plays the normal alert. For example, a ₹500 pick could show a big GIF with a special sound."
          />
        </Tile>
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-medium uppercase tracking-widest text-muted">Your rules</h2>
          <ul className="space-y-3">
            {rules.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-[var(--radius-surface)] border border-line/60 bg-surface p-5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="numeric text-base font-medium text-text">₹{r.minRupees.toLocaleString("en-IN")} pick</p>
                  <p className="break-words text-sm text-muted">
                    {[
                      r.mediaName && `Media: ${r.mediaName}`,
                      r.soundName && `Sound: ${r.soundName}`,
                      r.staySeconds && `Stays ${stayLabel(r.staySeconds)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                <ConfirmAction
                  prompt={`Delete the ₹${r.minRupees} pick?`}
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

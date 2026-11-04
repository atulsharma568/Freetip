"use client";

import { useActionState, useState } from "react";
import { ActionStatus } from "@/components/admin/ActionStatus";
import { ConfirmAction } from "@/components/admin/ConfirmAction";
import { TONE_BADGE, TONE_MARK, TONE_TEXT, buttonClass } from "@/components/admin/tones";
import { TickLoader } from "@/components/ui/TickLoader";
import { ADMIN_IDLE, type AdminAction } from "@/lib/admin/action-state";
import { FEATURES, featureSnapshot, type FeatureKey } from "@/lib/plans";

// A feature that exists in the plan list but is held back by a decision, not by work.
const BLOCKED: Partial<Record<FeatureKey, string>> = {};

const GROUPS = [...new Set(FEATURES.map((f) => f.group))];
const LABEL = new Map<string, string>(FEATURES.map((f) => [f.key, f.label]));

// The per-creator paid switches. Unbuilt features are listed but cannot be ticked
// (the server drops them anyway). Ticking a feature without the ones it needs is
// allowed but warned about, because the site keeps it off until they are on too.
export function FeaturesForm({
  action,
  granted,
  lastChanged,
}: {
  action: AdminAction;
  granted: string[];
  lastChanged: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, ADMIN_IDLE);
  const [ticked, setTicked] = useState<Set<string>>(
    () => new Set(FEATURES.filter((f) => f.built && granted.includes(f.key)).map((f) => f.key)),
  );
  const builtCount = FEATURES.filter((f) => f.built).length;
  const savedOn = FEATURES.filter((f) => f.built && granted.includes(f.key)).length;

  function toggle(key: string, on: boolean) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        <span className="numeric text-text">
          {savedOn} of {builtCount}
        </span>{" "}
        built features are on for this creator.{" "}
        {lastChanged ? `Last changed ${lastChanged}.` : "No change is recorded in the audit history yet."}
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="loaded" value={featureSnapshot(granted)} />
        {GROUPS.map((group) => (
          <fieldset key={group} className="space-y-3 rounded-surface border border-control bg-surface p-4">
            <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">{group}</legend>
            {FEATURES.filter((f) => f.group === group).map((f) => {
              const missing = f.built && ticked.has(f.key) ? (f.needs ?? []).filter((k) => !ticked.has(k)) : [];
              const needsText = (f.needs ?? []).map((k) => LABEL.get(k) ?? k).join(", ");
              const blocked = BLOCKED[f.key];
              return (
                <div key={f.key} className="space-y-1">
                  <label className={`flex items-start gap-3 text-sm ${f.built ? "" : "opacity-70"}`}>
                    <input
                      type="checkbox"
                      name="feature"
                      value={f.key}
                      checked={f.built && ticked.has(f.key)}
                      onChange={(e) => toggle(f.key, e.target.checked)}
                      disabled={!f.built}
                      className="mt-1 h-4 w-4 accent-[var(--color-accent)]"
                    />
                    <span>
                      <span className="text-text">{f.label}</span>
                      {!f.built && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${TONE_BADGE.neutral}`}>Planned</span>
                      )}
                      {blocked && (
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${TONE_BADGE.warn}`}>
                          <span aria-hidden="true">{TONE_MARK.warn} </span>
                          {blocked}
                        </span>
                      )}
                      {needsText && <span className="text-muted"> (needs {needsText})</span>}
                      <span className="block text-xs text-muted">{f.description}</span>
                    </span>
                  </label>
                  {missing.length > 0 && (
                    <p role="status" className={`ml-7 text-xs ${TONE_TEXT.warn}`}>
                      <span aria-hidden="true">{TONE_MARK.warn} </span>
                      {missing.map((k) => LABEL.get(k) ?? k).join(", ")} {missing.length > 1 ? "are" : "is"} not ticked, so this stays off for the creator until {missing.length > 1 ? "they are" : "it is"}.
                    </p>
                  )}
                </div>
              );
            })}
          </fieldset>
        ))}

        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" name="intent" value="save" disabled={pending} className={buttonClass("primary", "md")}>
            Save
          </button>
          <button type="submit" name="intent" value="all" disabled={pending} className={buttonClass("quiet", "md")}>
            Turn on everything that exists
          </button>
          {pending && (
            <span className="inline-flex items-center gap-2 text-xs text-muted">
              <TickLoader count={6} duration={0.6} />
              Saving…
            </span>
          )}
        </div>
        <ActionStatus state={state} />
      </form>

      <ConfirmAction
        action={action}
        label="Turn all off"
        confirmLabel="Turn everything off"
        pendingLabel="Turning off…"
        description="Every paid feature is switched off for this creator. Their overlays and timestamp tools stop showing at once."
        hidden={{ intent: "none" }}
        askReason
        size="md"
      />
    </div>
  );
}

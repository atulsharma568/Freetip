"use client";

import { PressureBar } from "@/components/tip/OwnerExtras";
import { StepHeading } from "@/components/tip/StepHeading";
import { rupeeText } from "@/components/tip/format";
import { blockAttrs, useTipForm } from "@/components/tip/TipFormContext";
import { tipTier } from "@/lib/tip-tier";
import type { Block } from "@/lib/page-doc/types";

const chip =
  "flex h-12 cursor-pointer items-center justify-center rounded-full border border-control px-5 text-sm transition-[transform,background-color,border-color,color] duration-150 hover:border-muted active:scale-[0.97] peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent";

// Step 1: the amount box, the presets and the custom amount. The minimum, the presets and what a
// pick does to the amount come from the form; the page document only says whether the rank bar
// shows and what its words are.
export function AmountBlock({ block, n }: { block: Block<"amount">; n: number }) {
  const {
    amountRupees,
    amountPaise,
    amountLocked,
    lockWarning,
    setLockWarning,
    presets,
    selected,
    custom,
    minTipPaise,
    minRupees,
    pickPreset,
    changeCustom,
    chooseExtra,
    editing,
  } = useTipForm();
  const digitCount = String(Math.trunc(amountRupees)).length;
  const customBelowMin = selected === "custom" && custom !== "" && amountPaise < minTipPaise;

  const ladder = block.settings.ladder;
  // A bar whose top is at or below the smallest tip would never move, so it is not drawn.
  const showBar = ladder !== null && ladder.topRupees > minRupees;

  return (
    <div className="space-y-4" {...blockAttrs(editing, block.id)}>
      <StepHeading n={n} title={block.settings.heading || "Amount"} />
      <div className="space-y-2 rounded-[var(--radius-surface)] bg-ground px-5 py-6 text-center">
        <p
          key={amountRupees}
          aria-hidden="true"
          className={`amount-numeral numeric font-semibold leading-none text-accent ${
            digitCount >= 5
              ? "text-[clamp(2.75rem,12vw,3.5rem)]"
              : digitCount === 4
                ? "text-[clamp(3.25rem,14vw,4.25rem)]"
                : "text-[clamp(4rem,17vw,5.5rem)]"
          }`}
        >
          ₹{rupeeText(amountRupees)}
        </p>
        <p className="text-sm text-muted">{tipTier(amountRupees)}</p>
        {showBar && (
          <PressureBar amountRupees={amountRupees} minRupees={minRupees} ladder={ladder} label={block.settings.barLabel || "Pressure"} />
        )}
      </div>
      <div onClickCapture={() => amountLocked && setLockWarning(true)} className="space-y-3">
      <fieldset>
        <legend className="sr-only">Choose an amount in rupees</legend>
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <label key={preset} className={`relative ${amountLocked ? "opacity-50" : ""}`}>
              <input
                type="radio"
                name="amount"
                value={preset}
                checked={selected === preset}
                disabled={amountLocked}
                onChange={() => pickPreset(preset)}
                className="peer sr-only"
              />
              <span className={`numeric ${chip}`}>₹{preset}</span>
            </label>
          ))}
          <label className={`relative ${amountLocked ? "opacity-50" : ""}`}>
            <input
              type="radio"
              name="amount"
              value="custom"
              checked={selected === "custom"}
              disabled={amountLocked}
              onChange={() => pickPreset("custom")}
              className="peer sr-only"
            />
            <span className={chip}>Custom</span>
          </label>
        </div>
      </fieldset>
      {selected === "custom" && (
        <div className="relative flex items-center">
          <span aria-hidden="true" className="numeric pointer-events-none absolute left-4 text-muted">
            ₹
          </span>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={custom}
            readOnly={amountLocked}
            onChange={(e) => changeCustom(e.target.value)}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-", ".", ","].includes(e.key)) e.preventDefault();
            }}
            placeholder="Enter amount"
            aria-label="Custom tip amount in rupees"
            aria-describedby="tip-min"
            aria-invalid={customBelowMin || undefined}
            className="numeric h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground pl-8 pr-4 text-base text-text transition-[border-color] placeholder:text-muted focus:border-accent"
          />
        </div>
      )}
      <p id="tip-min" className="text-xs text-muted">
        Minimum ₹{minRupees}
      </p>
      </div>
      {amountLocked && (
        <div
          role={lockWarning ? "alert" : undefined}
          className={`rounded-[var(--radius-field)] border px-3 py-2 text-xs ${
            lockWarning ? "border-accent text-text" : "border-line/60 text-muted"
          }`}
        >
          {lockWarning
            ? "The amount is fixed by the pick you chose. To send a different amount, deselect the pick below first."
            : "The amount is set by your pick. To change it, deselect the pick below."}{" "}
          <button
            type="button"
            onClick={() => chooseExtra({ kind: "default" })}
            className="font-semibold text-accent underline underline-offset-2"
          >
            Deselect the pick
          </button>
        </div>
      )}
    </div>
  );
}

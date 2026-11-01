"use client";

import type { ChangeEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Switch } from "@/components/ui/Switch";
import { field, peerRing } from "./styles";

// Native radios and checkboxes become the DESIGN chip: a pill with a Control
// Edge border that fills lime when chosen. The real input stays underneath
// (sr-only) so keyboard and screen readers behave as before.

type RadioProps = Pick<
  InputHTMLAttributes<HTMLInputElement>,
  "name" | "value" | "checked" | "defaultChecked" | "disabled" | "onChange"
>;

const chip =
  "flex min-h-11 items-center rounded-full border border-control px-5 text-sm text-text transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-checked:font-semibold peer-checked:text-ink peer-[:not(:checked)]:hover:border-muted";

export function ChipRadio({ children, ...input }: RadioProps & { children: ReactNode }) {
  return (
    <label className="cursor-pointer">
      <input type="radio" {...input} className="peer sr-only" />
      <span className={`${chip} ${peerRing}`}>{children}</span>
    </label>
  );
}

// The same, as a block with a hint line, for choices that need a sentence.
export function OptionRadio({
  children,
  hint,
  ...input
}: RadioProps & { children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block cursor-pointer">
      <input type="radio" {...input} className="peer sr-only" />
      <span
        className={`block rounded-[var(--radius-field)] border border-control px-4 py-3 text-sm text-text transition-colors duration-200 peer-checked:border-accent peer-checked:bg-accent peer-checked:text-ink peer-checked:[&_.hint]:text-ink peer-[:not(:checked)]:hover:border-muted ${peerRing}`}
      >
        <span className="block font-medium">{children}</span>
        {hint && <span className="hint mt-0.5 block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  );
}

// A labelled plasma switch in place of a checkbox. Pass `name` to submit "on"
// with a form when it is on (as a checkbox did) and nothing when it is off.
export function Toggle({
  id,
  checked,
  onChange,
  name,
  children,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  name?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onChange={onChange} />
      {name && checked && <input type="hidden" name={name} value="on" />}
      <label htmlFor={id} className="min-w-0 cursor-pointer select-none pt-1 text-sm text-text">
        {children}
        {hint && <span className="mt-0.5 block text-xs text-muted">{hint}</span>}
      </label>
    </div>
  );
}

// A flat lime thumb on a Control Edge track. The caller shows the number.
const rangeClass =
  "block h-11 w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-control " +
  "[&::-webkit-slider-thumb]:-mt-[9px] [&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-accent " +
  "[&::-moz-range-track]:h-1.5 [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-control " +
  "[&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-accent";

export function Range({
  value,
  onChange,
  unit,
  ...input
}: Pick<InputHTMLAttributes<HTMLInputElement>, "id" | "name" | "min" | "max" | "step" | "aria-describedby"> & {
  value: number;
  onChange: (value: number) => void;
  unit: string;
}) {
  return (
    <input
      type="range"
      {...input}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
      aria-valuetext={`${value} ${unit}`}
      className={rangeClass}
    />
  );
}

// A select drawn like the tip page's fields, with its own arrow.
export function SelectField({ className = "", children, ...select }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...select} className={`${field} appearance-none pr-10 ${className}`}>
        {children}
      </select>
      <span aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
        ↓
      </span>
    </div>
  );
}

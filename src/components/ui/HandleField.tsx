"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LinkSimple } from "@phosphor-icons/react";
import { SITE_HOST } from "@/lib/site";
import { HANDLE_PATTERN } from "@/lib/waitlist";

// Sample handles the empty field types out. Placeholders, not real creators.
const SAMPLES = ["yourname", "gamingwithriya", "kabirplays", "desi_speedrun", "meera_live"];

const TONES = {
  lime: {
    field:
      "border-ink text-ink has-[:focus-visible]:shadow-[0_14px_32px_-14px_rgb(27_28_20/0.7)] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ink",
    prefix: "text-ink/85",
    ghost: "text-ink/70",
    chip: "bg-ink/10 text-ink",
    hint: "text-ink/80",
    scan: "via-ink/20",
  },
  dark: {
    field:
      "border-control bg-ground text-text hover:border-muted has-[:focus-visible]:border-accent has-[:focus-visible]:shadow-[0_0_0_4px_rgb(191_232_74/0.14),0_0_28px_-4px_rgb(191_232_74/0.35)]",
    prefix: "text-muted",
    ghost: "text-muted",
    chip: "bg-raised text-text",
    hint: "text-muted",
    scan: "via-accent/25",
  },
};

// The "tipsite.in/yourname" handle input. While empty and unfocused it types
// out sample handles; once someone types, a link chip below builds their
// link letter by letter. Each time `scanning` turns on (the form is being
// sent), a light sweeps across the field once. Reduced motion shows a static
// placeholder and no sweep.
export function HandleField({
  id,
  value,
  onChange,
  tone,
  invalid = false,
  describedBy,
  scanning = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  tone: keyof typeof TONES;
  invalid?: boolean;
  describedBy?: string;
  scanning?: boolean;
}) {
  const t = TONES[tone];
  const field = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [ghost, setGhost] = useState(SAMPLES[0]);
  const [typing, setTyping] = useState(false);
  const idle = !focused && !value;

  // Start one full sweep whenever `scanning` turns on; it ends on its own.
  const [wasScanning, setWasScanning] = useState(scanning);
  const [sweeping, setSweeping] = useState(false);
  if (scanning !== wasScanning) {
    setWasScanning(scanning);
    if (scanning) setSweeping(true);
  }

  useEffect(() => {
    const el = field.current;
    if (!idle || !el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let timer = 0;
    let visible = false;
    let sample = 0;
    let text = SAMPLES[0];
    let erasing = true;

    // Erase the current sample, then type the next, holding on each.
    const tick = () => {
      if (!visible) return;
      const target = SAMPLES[sample];
      if (erasing) {
        text = text.slice(0, -1);
        if (!text) {
          erasing = false;
          sample = (sample + 1) % SAMPLES.length;
        }
        setGhost(text);
        timer = window.setTimeout(tick, text ? 38 : 320);
      } else {
        text = SAMPLES[sample].slice(0, text.length + 1);
        setGhost(text);
        const done = text === SAMPLES[sample];
        if (done) erasing = true;
        timer = window.setTimeout(tick, done ? 1500 : 85 + (target.length > 10 ? 0 : 20));
      }
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      window.clearTimeout(timer);
      setTyping(visible);
      if (visible) timer = window.setTimeout(tick, 1200);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
      setTyping(false);
      setGhost(SAMPLES[0]);
    };
  }, [idle]);

  const valid = HANDLE_PATTERN.test(value);

  return (
    <div className="w-full sm:max-w-md sm:flex-1">
      <div
        ref={field}
        className={`relative flex h-16 items-center overflow-hidden rounded-full border-2 px-6 transition-[border-color,box-shadow] duration-200 ease-out-expo ${t.field}`}
      >
        <span className={`numeric text-base ${t.prefix}`}>{SITE_HOST}/</span>
        <span className="relative h-full min-w-0 flex-1">
          <input
            id={id}
            name="handle"
            type="text"
            inputMode="text"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            value={value}
            onChange={(event) =>
              onChange(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            placeholder="yourname"
            className="numeric absolute inset-0 size-full bg-transparent text-base placeholder:text-transparent focus:outline-none"
          />
          {idle && (
            <span
              aria-hidden="true"
              className={`numeric pointer-events-none absolute inset-y-0 left-0 flex items-center text-base ${t.ghost}`}
            >
              {ghost}
              {typing && <span className="caret ml-px h-5 w-0.5 bg-current" />}
            </span>
          )}
        </span>
        {sweeping && (
          <span
            aria-hidden="true"
            onAnimationEnd={() => setSweeping(false)}
            className={`scan pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent to-transparent ${t.scan}`}
          />
        )}
      </div>
      <p aria-hidden="true" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 px-2 text-sm">
        <span className={`numeric inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 ${t.chip}`}>
          <LinkSimple weight="bold" className="shrink-0" />
          <span className="min-w-0 truncate">
            {SITE_HOST}/
            {value ? (
              [...value].map((char, i) => (
                <span key={i} className="char-in">
                  {char}
                </span>
              ))
            ) : (
              <span className="opacity-75">yourname</span>
            )}
          </span>
        </span>
        <span className={`inline-flex items-center gap-1 ${t.hint}`}>
          {valid ? (
            <>
              <Check weight="bold" />
              Valid handle format
            </>
          ) : (
            "3 to 20 letters, numbers or _"
          )}
        </span>
      </p>
    </div>
  );
}

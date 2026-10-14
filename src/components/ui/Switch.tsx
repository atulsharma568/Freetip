"use client";

// A flat on/off switch. Off: a muted thumb on a dark track. On: the track
// fills lime and an ink thumb slides across. The thumb stretches while it is
// pressed, so the press reads before the change. Label it with a <label
// htmlFor={id}>.
export function Switch({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border border-control bg-ground transition-colors duration-300 ease-out-expo hover:border-muted aria-checked:border-accent aria-checked:bg-accent"
    >
      <span
        aria-hidden="true"
        className="absolute left-[3px] h-5 w-5 rounded-full bg-muted transition-[translate,width,background-color] duration-300 ease-out-expo group-active:w-6 group-aria-checked:translate-x-[21px] group-aria-checked:bg-ink group-active:group-aria-checked:translate-x-[17px]"
      />
    </button>
  );
}

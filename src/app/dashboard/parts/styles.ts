// Shared class strings for the creator dashboard, so every pill, field and
// focus ring is spelled once. All of it follows DESIGN.md: lime is a solid
// pill, a control edge is Control Edge, nothing casts a shadow.

export const pillPrimary =
  "inline-flex h-12 items-center justify-center gap-3 rounded-full bg-accent px-6 text-sm font-semibold text-ink transition-[transform,opacity] duration-200 ease-out-expo active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const pillOutline =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-control px-5 text-sm font-medium text-text transition-[transform,border-color] duration-200 ease-out-expo hover:border-muted active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40";

export const pillText =
  "inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-muted transition-colors duration-200 hover:text-text disabled:opacity-40";

export const field =
  "h-12 w-full rounded-[var(--radius-field)] border border-control bg-ground px-4 text-base text-text placeholder:text-muted transition-[border-color] focus:border-accent";

export const label = "text-sm font-medium text-text";

export const smallLabel = "text-xs font-medium uppercase tracking-widest text-muted";

// The ring a hidden (sr-only) radio or checkbox draws on the control beside it.
export const peerRing =
  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-[3px] peer-focus-visible:outline-accent";

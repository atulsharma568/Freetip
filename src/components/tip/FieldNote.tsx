import type { ReactNode } from "react";
import { WarningCircle } from "@phosphor-icons/react";

// A plain problem line: Chalk text with a marker icon, never red (the system
// has one accent and no red). `alert` announces it at once; use it for things
// the fan just caused, not for standing hints.
export function FieldNote({
  children,
  alert = true,
  id,
}: {
  children: ReactNode;
  alert?: boolean;
  id?: string;
}) {
  return (
    <p id={id} role={alert ? "alert" : "status"} className="flex items-start gap-2 text-sm text-text">
      <WarningCircle weight="bold" aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

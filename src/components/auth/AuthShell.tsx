import type { ReactNode } from "react";
import { PageShell } from "@/components/PageShell";

// Page frame for sign up and sign in: one centred column.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </PageShell>
  );
}

export const authField =
  "h-14 w-full rounded-full border-2 border-control bg-ground px-6 text-base text-text placeholder:text-muted transition-[border-color,box-shadow] duration-200 ease-out-expo hover:border-muted focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_rgb(191_232_74/0.14),0_0_28px_-4px_rgb(191_232_74/0.35)] focus-visible:outline-none";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

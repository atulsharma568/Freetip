import type { ReactNode } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

// Page frame for sign up and sign in: the wordmark home, a way back, and one
// centred column.
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <Link href="/" className="display text-2xl">
          {SITE_NAME}
        </Link>
        <Link
          href="/"
          className="text-sm text-muted transition-colors duration-200 hover:text-text"
        >
          Back to home
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

export const authField =
  "h-14 w-full rounded-full border-2 border-control bg-ground px-6 text-base text-text placeholder:text-muted transition-[border-color,box-shadow] duration-200 ease-out-expo hover:border-muted focus-visible:border-accent focus-visible:shadow-[0_0_0_4px_rgb(191_232_74/0.14),0_0_28px_-4px_rgb(191_232_74/0.35)] focus-visible:outline-none";

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

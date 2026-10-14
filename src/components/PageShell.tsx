import type { ReactNode } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { Footer } from "@/components/Footer";

// Frame for pages other than home: the wordmark home, a way back, the page,
// and the full footer.
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-5 focus:py-3 focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <header className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-6">
        <Link href="/" className="display text-2xl">
          {SITE_NAME}
        </Link>
        <Link
          href="/"
          className="-mr-3 inline-flex h-11 items-center px-3 text-sm text-muted transition-colors duration-200 hover:text-text"
        >
          Back to home
        </Link>
      </header>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
    </div>
  );
}

import type { CSSProperties } from "react";
import Link from "next/link";
import { SITE_HOST } from "@/lib/site";

// A creator who has claimed a handle but is not live yet. Same shape as the
// not-found page: a small mono line, a Display headline, one plain sentence
// and a lime pill home.
export function NotReady({ handle, name }: { handle: string; name: string | null }) {
  const displayName = name ?? handle;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-16 sm:px-6 md:pt-28">
      <p className="enter numeric text-sm text-muted">
        {SITE_HOST}/{handle}
      </p>
      <h1 className="rise display mt-4 max-w-[14ch] text-[clamp(2.75rem,9vw,5.5rem)]">Not live yet.</h1>
      <p
        className="enter mt-6 max-w-[46ch] text-pretty text-lg text-muted"
        style={{ "--i": 1 } as CSSProperties}
      >
        {displayName}&apos;s tip page is being set up. Check back soon.
      </p>
      <div className="enter mt-10" style={{ "--i": 2 } as CSSProperties}>
        <Link
          href="/"
          className="inline-flex h-14 items-center rounded-full bg-accent px-8 text-base font-semibold text-ink transition-transform duration-150 ease-out-expo active:scale-[0.97]"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}

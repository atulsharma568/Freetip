import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/PageShell";
import { SITE_HOST, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `Page not found: ${SITE_NAME}`,
};

// Most people who land here typed a creator's link, so say why it doesn't
// work yet and point to the waitlist.
export default function NotFound() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-7xl px-6 pb-28 pt-16 md:pt-28">
        <p className="numeric text-sm text-muted">404</p>
        <h1 className="display mt-4 max-w-[14ch] text-[clamp(2.75rem,9vw,5.5rem)]">
          This page doesn&apos;t exist.
        </h1>
        <p className="mt-6 max-w-[46ch] text-pretty text-lg text-muted">
          If you typed a creator&apos;s link, like{" "}
          <span className="numeric text-text">{SITE_HOST}/name</span>, tip pages
          aren&apos;t live yet. Join the waitlist to hear when they are.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
          <Link
            href="/signup"
            className="inline-flex h-14 items-center rounded-full bg-accent px-8 text-base font-semibold text-ink transition-transform duration-150 ease-out-expo active:scale-[0.97]"
          >
            Join the waitlist
          </Link>
          <Link
            href="/"
            className="text-base font-medium text-text underline decoration-line underline-offset-4 transition-colors duration-200 hover:decoration-accent"
          >
            Back to home
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

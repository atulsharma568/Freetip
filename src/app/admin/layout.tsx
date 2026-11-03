import type { Metadata } from "next";
import Link from "next/link";
import { badgesFrom, getQueue } from "@/lib/admin/queue";
import { razorpayKeyMode } from "@/lib/admin/key-mode";
import { adminDb } from "@/lib/admin/server-db";
import { TONE_BADGE, TONE_MARK } from "@/components/admin/tones";
import { AppBackdrop } from "@/components/AppBackdrop";
import { requireOwner } from "@/lib/owner-auth";
import { AdminNav } from "./_components/AdminNav";

export const metadata: Metadata = {
  title: "Owner console: Freetip",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireOwner();

  // How many things are waiting, for the badges. A count that cannot be read just
  // has no badge (the overview says "could not read" for it).
  const db = adminDb();
  const badges = db ? badgesFrom(await getQueue(db)) : {};
  const keyMode = razorpayKeyMode();

  return (
    <div className="min-h-dvh text-text">
      <AppBackdrop />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to the page
      </a>
      <header className="border-b border-control bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-2">
          <Link href="/admin" className="group block py-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Freetip</p>
            <p className="display text-xl transition-colors group-hover:text-accent">Owner console</p>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            {/* Test money looks like real money on every other page, so say which this is. */}
            <p
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${TONE_BADGE[keyMode.tone]}`}
              title={keyMode.long}
            >
              {TONE_MARK[keyMode.tone] && <span aria-hidden="true">{TONE_MARK[keyMode.tone]}</span>}
              {keyMode.short}
            </p>
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-full border border-control px-4 text-sm text-muted transition-colors hover:border-text/40 hover:text-text"
            >
              Creator view
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:flex-row">
        <AdminNav badges={badges} />

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>
    </div>
  );
}

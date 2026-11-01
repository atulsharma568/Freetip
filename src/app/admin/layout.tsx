import type { Metadata } from "next";
import Link from "next/link";
import { badgesFrom, getQueue } from "@/lib/admin/queue";
import { adminDb } from "@/lib/admin/server-db";
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

  return (
    <div className="min-h-dvh bg-ground text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        Skip to the page
      </a>
      <header className="border-b border-control bg-surface">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-6 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Freetip</p>
            <p className="display text-xl">Owner console</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-full border border-control px-4 text-sm text-muted transition-colors hover:border-text/40 hover:text-text"
          >
            Creator view
          </Link>
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

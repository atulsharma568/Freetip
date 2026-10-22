import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/owner-auth";

export const metadata: Metadata = {
  title: "Owner console: Tipsite",
  robots: { index: false, follow: false },
};

const navigation = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/finance", label: "Finance" },
  { href: "/admin/reconciliation", label: "Reconciliation" },
  { href: "/admin/audit", label: "Audit history" },
];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireOwner();

  return (
    <div className="min-h-dvh bg-ground text-text">
      <header className="border-b border-control bg-surface/80 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-6 px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Tipsite owner console
            </p>
            <p className="display text-xl">Finance foundation</p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 items-center rounded-full border border-control px-4 text-sm text-muted transition-colors hover:border-text/30 hover:text-text"
          >
            Creator view
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:flex-row">
        <nav aria-label="Owner console" className="lg:w-56 lg:shrink-0">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center whitespace-nowrap rounded-xl border border-control px-4 text-sm text-muted transition-colors hover:border-text/30 hover:bg-surface hover:text-text"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

const LEGAL = [
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact and grievances" },
];

// The footer on a creator's pages: a quiet "Powered by Freetip" and the legal
// links a payment page has to keep reachable, instead of the marketing footer.
export function SlimFooter() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-6 text-sm text-muted sm:px-6">
        <p>
          Powered by{" "}
          <Link href="/" className="link-line font-semibold text-text">
            {SITE_NAME}
          </Link>
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="link-line transition-colors duration-200 hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

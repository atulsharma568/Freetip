import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { OPERATOR } from "@/lib/legal";
import { Logo } from "@/components/logo/Logo";

const GROUPS = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact and grievances" },
      { href: "/signin", label: "Sign in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/refunds", label: "Refunds and cancellations" },
      { href: "/delivery", label: "Shipping and delivery" },
      { href: "/community-guidelines", label: "Community guidelines" },
    ],
  },
];

// Site footer on every page: company pages and every policy page (payment
// partners expect policy links on every page).
export function Footer() {
  const linkClass = "link-line transition-colors duration-200 hover:text-text";

  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Link href="/" aria-label={`${SITE_NAME} home`} className="block w-fit text-text">
            <Logo interactive className="h-10 w-auto" />
          </Link>
          <p className="mt-3 max-w-[30ch] text-sm text-muted">
            Tips for Indian YouTube streamers, paid by UPI or card. Not live yet.
          </p>
        </div>
        {GROUPS.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="text-sm font-semibold">{group.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {group.links.map((item) => (
                <li key={item.href}>
                  {item.href.startsWith("/") && !item.href.startsWith("/#") ? (
                    <Link href={item.href} className={linkClass}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className={linkClass}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-7xl px-6 pb-10">
        <Logo decorative interactive loop className="mx-auto h-auto w-full max-w-5xl text-text" />
      </div>
      <div className="mx-auto max-w-7xl border-t border-line/60 px-6 py-6 text-sm text-muted">
        &copy; 2026 {OPERATOR.legalName || SITE_NAME}
      </div>
    </footer>
  );
}

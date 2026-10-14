import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { OPERATOR } from "@/lib/legal";

const SECTIONS = [
  { href: "#how", label: "How it works" },
  { href: "#stream", label: "On stream" },
  { href: "#why", label: "Why Tipsite" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
];

const GROUPS = [
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/pricing", label: "Pricing" },
      { href: "/contact", label: "Contact and grievances" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/refunds", label: "Refunds and cancellations" },
      { href: "/delivery", label: "Delivery policy" },
    ],
  },
];

// Site footer on every page: the home page's sections, company pages and
// every policy page (payment partners expect policy links on every page).
// Off the home page, section links point back to it.
export function Footer({ onHome = false }: { onHome?: boolean }) {
  const groups = [
    {
      title: "Product",
      links: SECTIONS.map((s) => ({ href: onHome ? s.href : `/${s.href}`, label: s.label })),
    },
    ...GROUPS,
  ];
  const link = "transition-colors duration-200 hover:text-text";

  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="display text-2xl">
            {SITE_NAME}
          </Link>
          <p className="mt-3 max-w-[30ch] text-sm text-muted">
            Tips for Indian YouTube streamers, paid by UPI or card. Not live yet.
          </p>
        </div>
        {groups.map((group) => (
          <nav key={group.title} aria-label={group.title}>
            <p className="text-sm font-semibold">{group.title}</p>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              {group.links.map((item) => (
                <li key={item.href}>
                  {item.href.startsWith("/") && !item.href.startsWith("/#") ? (
                    <Link href={item.href} className={link}>
                      {item.label}
                    </Link>
                  ) : (
                    <a href={item.href} className={link}>
                      {item.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto max-w-7xl border-t border-line/60 px-6 py-6 text-sm text-muted">
        &copy; 2026 {OPERATOR.legalName || SITE_NAME}
      </div>
    </footer>
  );
}

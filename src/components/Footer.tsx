import { SITE_NAME } from "@/lib/site";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#stream", label: "On stream" },
  { href: "#why", label: "Why Tipsite" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
];

export function Footer() {
  return (
    <footer className="border-t border-line/60">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="display text-xl">{SITE_NAME}</p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="transition-colors duration-200 hover:text-text"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="text-sm text-muted">&copy; 2026 {SITE_NAME}</p>
      </div>
    </footer>
  );
}

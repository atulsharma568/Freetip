"use client";

import { useRef } from "react";
import Link from "next/link";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SITE_NAME } from "@/lib/site";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#stream", label: "On stream" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
];

export function Nav() {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const header = ref.current;
      const on = () => header?.classList.add("is-scrolled");
      ScrollTrigger.create({
        start: 16,
        end: "max",
        onEnter: on,
        onEnterBack: on,
        onLeaveBack: () => header?.classList.remove("is-scrolled"),
      });
    },
    { scope: ref },
  );

  return (
    <header
      ref={ref}
      className="fixed inset-x-0 top-0 z-40 border-b border-transparent transition-colors duration-300 [&.is-scrolled]:border-line/60 [&.is-scrolled]:bg-ground"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="display text-2xl">
          {SITE_NAME}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-muted">
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
        <a
          href="#claim"
          className="inline-flex h-10 items-center rounded-full bg-accent px-5 text-sm font-semibold text-ink transition-transform duration-200 active:scale-[0.97]"
        >
          Claim your handle
        </a>
      </div>
    </header>
  );
}

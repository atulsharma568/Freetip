"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SITE_NAME } from "@/lib/site";
import { RollText } from "@/components/motion/RollText";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#stream", label: "On stream" },
  { href: "#why", label: "Why Tipsite" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
];

// At the top the nav is a full-width bar. Once the page scrolls it eases into
// a floating capsule, and a solid lime pill slides behind whichever link is
// hovered or focused.
export function Nav() {
  const ref = useRef<HTMLElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [pill, setPill] = useState({ x: 0, width: 0 });

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

  const point = (i: number) => {
    const link = links.current[i];
    if (link) setPill({ x: link.offsetLeft, width: link.offsetWidth });
    setActive(i);
  };

  return (
    <header ref={ref} className="group fixed inset-x-0 top-0 z-40">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between border border-transparent px-6 transition-[max-width,margin,height,padding,background-color,border-color,border-radius] duration-500 ease-out-expo group-[.is-scrolled]:mt-3 group-[.is-scrolled]:h-14 group-[.is-scrolled]:max-w-[min(56rem,calc(100%-1.5rem))] group-[.is-scrolled]:rounded-[28px] group-[.is-scrolled]:border-line/60 group-[.is-scrolled]:bg-surface group-[.is-scrolled]:pr-[7px]">
        <Link href="/" className="display text-2xl">
          {SITE_NAME}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul
            className="relative flex items-center gap-1 text-sm text-muted"
            onPointerLeave={() => setActive(null)}
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[translate,width,opacity] duration-500 ease-out-expo"
              style={{
                translate: `${pill.x}px 0`,
                width: pill.width,
                opacity: active === null ? 0 : 1,
              }}
            />
            {LINKS.map((link, i) => (
              <li key={link.href}>
                <a
                  ref={(el) => {
                    links.current[i] = el;
                  }}
                  href={link.href}
                  onPointerEnter={() => point(i)}
                  onFocus={() => point(i)}
                  onBlur={() => setActive(null)}
                  data-active={active === i}
                  className="relative block rounded-full px-3 py-2 transition-colors duration-200 data-[active=true]:text-ink focus-visible:outline-offset-2"
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
          <RollText>Claim your handle</RollText>
        </a>
      </div>
    </header>
  );
}

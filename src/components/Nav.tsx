"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SITE_NAME } from "@/lib/site";
import { GlassOrbButton } from "@/components/ui/GlassOrbButton";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#stream", label: "On stream" },
  { href: "#why", label: "Why Tipsite" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
];

// At the top the nav is a full-width bar. Once the page scrolls it eases into
// a floating frosted-glass capsule. Links near the pointer lift and swell a
// little, like a dock, and a solid lime pill slides behind whichever link is
// hovered or focused.

// How far (px) from a link's centre the pointer still pulls on it.
const REACH = 90;
export function Nav() {
  const ref = useRef<HTMLElement>(null);
  const links = useRef<(HTMLAnchorElement | null)[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [pill, setPill] = useState({ x: 0, width: 0 });
  const dock = useRef<((x: number | null) => void) | null>(null);

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

      // Dock: each link springs up and swells by how close the pointer is.
      const mm = gsap.matchMedia();
      mm.add("(hover: hover) and (prefers-reduced-motion: no-preference)", () => {
        const items = links.current.filter((a): a is HTMLAnchorElement => !!a);
        const springs = items.map((a) => ({
          y: gsap.quickTo(a, "y", { duration: 0.5, ease: "back.out(3)" }),
          scale: gsap.quickTo(a, "scale", { duration: 0.5, ease: "back.out(3)" }),
        }));
        dock.current = (x) => {
          items.forEach((a, i) => {
            const box = a.getBoundingClientRect();
            const f = x === null ? 0 : Math.max(0, 1 - Math.abs(x - (box.left + box.width / 2)) / REACH);
            springs[i].y(-f * 2.5);
            springs[i].scale(1 + f * 0.08);
          });
        };
        return () => {
          dock.current = null;
        };
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
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between border border-transparent px-6 transition-[max-width,margin,height,padding,background-color,border-color,border-radius] duration-500 ease-out-expo group-[.is-scrolled]:mt-3 group-[.is-scrolled]:h-14 group-[.is-scrolled]:max-w-[min(56rem,calc(100%-1.5rem))] group-[.is-scrolled]:rounded-[28px] group-[.is-scrolled]:border-text/10 group-[.is-scrolled]:bg-surface/60 group-[.is-scrolled]:pr-[6px] group-[.is-scrolled]:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_18px_40px_-20px_rgb(0_0_0/0.8)] group-[.is-scrolled]:backdrop-blur-xl group-[.is-scrolled]:backdrop-saturate-150">
        <Link href="/" className="display text-2xl">
          {SITE_NAME}
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul
            className="relative flex items-center gap-1 text-sm text-muted"
            onPointerMove={(event) => dock.current?.(event.clientX)}
            onPointerLeave={() => {
              setActive(null);
              dock.current?.(null);
            }}
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
        <GlassOrbButton href="#claim">Claim your handle</GlassOrbButton>
      </div>
    </header>
  );
}

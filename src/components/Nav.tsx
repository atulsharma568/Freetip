"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PencilSimple, User, SignOut, SquaresFour } from "@phosphor-icons/react";
import { useSession, signOut } from "next-auth/react";
import { gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";
import { SITE_NAME } from "@/lib/site";
import { Logo } from "@/components/logo/Logo";
import { ChromeButton } from "@/components/ui/ChromeButton";
import { GlassOrbButton } from "@/components/ui/GlassOrbButton";

const LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#stream", label: "On stream" },
  { href: "#why", label: "Why Freetip" },
  { href: "#fees", label: "Fees" },
  { href: "#faq", label: "FAQ" },
];

// At the top the nav is a full-width bar. Once the page scrolls it eases into
// a floating frosted-glass capsule, with Sign in (glass orb) and Sign up
// (chrome) at the right. Links near the pointer lift and swell a
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
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) toggle.current?.focus();
  }, []);

  // The phone menu: lock the page behind it, close on Escape or when the
  // screen grows to the desktop nav, keep Tab inside the header, and rise the
  // links in one after another (a plain fade under reduced motion).
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    root.classList.add("menu-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") return closeMenu(true);
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        ref.current?.querySelectorAll<HTMLElement>("a[href], button:not([disabled])") ?? [],
      ).filter((el) => el.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onResize = () => desktop.matches && closeMenu();
    document.addEventListener("keydown", onKey);
    desktop.addEventListener("change", onResize);
    const items = menu.current?.querySelectorAll<HTMLElement>("[data-menu-item]");
    if (items?.length && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(
        items,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: "expo.out", stagger: 0.06, delay: 0.12, clearProps: "transform,opacity" },
      );
    }
    menu.current?.querySelector<HTMLElement>("a[href]")?.focus({ preventScroll: true });
    return () => {
      root.classList.remove("menu-open");
      document.removeEventListener("keydown", onKey);
      desktop.removeEventListener("change", onResize);
    };
  }, [menuOpen, closeMenu]);

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
      <div className="relative z-10 mx-auto flex h-16 max-w-7xl items-center justify-between border border-transparent px-6 transition-[max-width,margin,height,padding,background-color,border-color,border-radius] duration-500 ease-out-expo group-[.is-scrolled]:mt-3 group-[.is-scrolled]:h-14 group-[.is-scrolled]:max-w-[min(80rem,calc(100%-3rem))] group-[.is-scrolled]:rounded-[28px] group-[.is-scrolled]:border-text/10 group-[.is-scrolled]:bg-surface/60 group-[.is-scrolled]:pr-[6px] group-[.is-scrolled]:shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_18px_40px_-20px_rgb(0_0_0/0.8)] group-[.is-scrolled]:backdrop-blur-xl group-[.is-scrolled]:backdrop-saturate-150">
        <Link href="/" aria-label={`${SITE_NAME} home`} className="-mx-1 block px-1 text-text">
          <Logo interactive className="h-8 w-auto sm:h-9" />
        </Link>
        <nav aria-label="Primary" className="relative hidden lg:block">
          {/* Beside the list, not in it: a list may only hold list items. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[translate,width,opacity] duration-500 ease-out-expo"
            style={{
              translate: `${pill.x}px 0`,
              width: pill.width,
              opacity: active === null ? 0 : 1,
            }}
          />
          <ul
            className="relative flex items-center gap-1 text-sm text-muted"
            onPointerMove={(event) => dock.current?.(event.clientX)}
            onPointerLeave={() => {
              setActive(null);
              dock.current?.(null);
            }}
          >
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
        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
          {session ? (
            <>
              <GlassOrbButton
                  onClick={() => signOut({ callbackUrl: "/" })}
                  icon={<SignOut weight="bold" size={15} />}
                >
                  Sign out
                </GlassOrbButton>
              <ChromeButton href="/dashboard" icon={<SquaresFour weight="bold" size={15} />}>
                Dashboard
              </ChromeButton>
            </>
          ) : (
            <>
              <GlassOrbButton href="/signin" icon={<User weight="bold" size={15} />}>
                  Sign in
                </GlassOrbButton>
              <ChromeButton href="/signup" icon={<PencilSimple weight="bold" size={15} />}>
                Sign up
              </ChromeButton>
            </>
          )}
          </div>
          <button
            ref={toggle}
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            className="menu-toggle grid size-11 shrink-0 place-items-center rounded-full border border-text/15 bg-surface/60 text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.95] lg:hidden"
            data-open={menuOpen}
          >
            <span aria-hidden="true" className="menu-toggle-bars" />
          </button>
        </div>
      </div>
      <div
        ref={menu}
        id="mobile-menu"
        data-lenis-prevent
        data-open={menuOpen}
        inert={!menuOpen}
        className="mobile-menu fixed inset-0 z-0 flex flex-col overflow-y-auto bg-ground/95 px-6 pb-10 pt-28 backdrop-blur-xl lg:hidden"
      >
        <nav aria-label="Menu" className="my-auto">
          <ul className="space-y-1">
            {LINKS.map((link) => (
              <li key={link.href} data-menu-item>
                <a
                  href={link.href}
                  onClick={() => closeMenu()}
                  className="display block py-2 text-[clamp(2.5rem,13vw,4rem)] transition-colors duration-200 hover:text-accent focus-visible:text-accent"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div data-menu-item className="flex flex-wrap items-center gap-3 pt-8">
          {session ? (
            <>
              <GlassOrbButton
                onClick={() => signOut({ callbackUrl: "/" })}
                icon={<SignOut weight="bold" size={15} />}
              >
                Sign out
              </GlassOrbButton>
              <ChromeButton href="/dashboard" icon={<SquaresFour weight="bold" size={15} />}>
                Dashboard
              </ChromeButton>
            </>
          ) : (
            <>
              <GlassOrbButton href="/signin" icon={<User weight="bold" size={15} />}>
                Sign in
              </GlassOrbButton>
              <ChromeButton href="/signup" icon={<PencilSimple weight="bold" size={15} />}>
                Sign up
              </ChromeButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import { useRef, useState, type FormEvent } from "react";
import { Magnetic } from "@/components/motion/Magnetic";
import { gsap, useGSAP } from "@/lib/gsap";
import { SITE_HOST } from "@/lib/site";

type Status = "idle" | "invalid" | "closed";

const MESSAGES: Record<Status, string> = {
  idle: "",
  invalid: "Use 3 to 20 letters, numbers or underscores.",
  closed: "Sign-up isn't open yet, so nothing has been reserved.",
};

export function Closer() {
  const root = useRef<HTMLElement>(null);
  const field = useRef<HTMLDivElement>(null);
  const [handle, setHandle] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add(
        "(prefers-reduced-motion: no-preference) and (min-width: 768px)",
        () => {
          gsap.fromTo(
            field.current,
            { clipPath: "inset(14% 7% 0% 7% round 2rem 2rem 0rem 0rem)" },
            {
              clipPath: "inset(0% 0% 0% 0% round 0rem 0rem 0rem 0rem)",
              ease: "none",
              scrollTrigger: {
                trigger: root.current,
                start: "top 90%",
                end: "top 25%",
                scrub: true,
              },
            },
          );
        },
      );
    },
    { scope: root },
  );

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setStatus(/^[a-z0-9_]{3,20}$/.test(handle) ? "closed" : "invalid");
  };

  return (
    <section
      ref={root}
      id="claim"
      className="scroll-mt-24 overflow-hidden bg-ground"
    >
      <div ref={field} className="on-accent bg-accent text-ink">
        <div className="mx-auto max-w-7xl px-6 py-28 md:py-40">
          <h2 className="display max-w-[14ch] text-[clamp(3rem,9vw,6rem)]">
            Your handle is your link.
          </h2>
          <p className="mt-6 max-w-[40ch] text-pretty text-lg">
            Pick the name your fans will type. Sign&#8209;up isn&apos;t open
            yet, so handles can&apos;t be reserved.
          </p>
          <form onSubmit={onSubmit} noValidate className="mt-10">
            <label
              htmlFor="handle"
              className="mb-2 block text-sm font-semibold"
            >
              Your handle
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex h-16 w-full items-center rounded-full border-2 border-ink px-6 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-ink sm:max-w-md sm:flex-1">
                <span className="numeric text-base text-ink/85">{SITE_HOST}/</span>
                <input
                  id="handle"
                  name="handle"
                  type="text"
                  inputMode="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  maxLength={20}
                  value={handle}
                  onChange={(event) => {
                    setHandle(
                      event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    );
                    setStatus("idle");
                  }}
                  aria-describedby="handle-status"
                  aria-invalid={status === "invalid"}
                  placeholder="yourname"
                  className="numeric h-full min-w-0 flex-1 bg-transparent text-base placeholder:text-ink/85 focus:outline-none"
                />
              </div>
              <Magnetic className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="h-16 w-full rounded-full bg-ink px-8 text-base font-semibold text-accent transition-transform duration-200 active:scale-[0.97] sm:w-auto"
                >
                  Claim your handle
                </button>
              </Magnetic>
            </div>
            <p
              id="handle-status"
              role="status"
              className="mt-4 min-h-6 text-base font-medium"
            >
              {MESSAGES[status]}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}

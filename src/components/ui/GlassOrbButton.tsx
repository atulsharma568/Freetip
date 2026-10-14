import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { RollText } from "@/components/motion/RollText";

const BURST = [0, 45, 90, 135, 180, 225, 270, 315];

// A frosted glass pill with a glowing lime orb at its start. The orb's
// highlight swirls slowly, and a ring of lime sparks bursts out of it on
// hover (see `.glass-btn` and `.orb` in globals.css). The label rolls like
// the other buttons. The orb holds a ₹ unless given another icon.
export function GlassOrbButton({
  href,
  children,
  icon = <span className="text-sm font-bold">₹</span>,
  className = "",
}: {
  href: string;
  children: string;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`glass-btn inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full pl-1.5 pr-5 text-sm font-semibold text-text ${className}`}
    >
      <span aria-hidden="true" className="orb relative grid size-8 place-items-center rounded-full">
        <span className="orb-swirl" />
        <span className="relative grid place-items-center text-ink">{icon}</span>
        <span className="orb-burst absolute inset-0">
          {BURST.map((a) => (
            <span key={a} style={{ "--a": `${a}deg` } as CSSProperties} />
          ))}
        </span>
      </span>
      <RollText>{children}</RollText>
    </Link>
  );
}

import type { ReactNode } from "react";
import {
  Image as ImageIcon,
  ChartBar,
  ChatCircleText,
  Eye,
  FilmSlate,
  Link as LinkIcon,
  ListChecks,
  Medal,
  MonitorPlay,
  MusicNotes,
  Palette,
  Plugs,
  PushPin,
  QrCode,
  SlidersHorizontal,
  SpeakerHigh,
  Stack,
  Target,
  TextAa,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

type Kind = "surface" | "raised" | "accent";

// A small lime badge beside a tile's title, picked by the tile's id so the pages that
// use <Tile> need no change. A tile with no entry here just has no badge.
const ICONS: Record<string, Icon> = {
  queue: ChatCircleText,
  alerts: MonitorPlay,
  overlays: Stack,
  voice: SpeakerHigh,
  goals: Target,
  daily: ChartBar,
  "tip-page": LinkIcon,
  qr: QrCode,
  settings: SlidersHorizontal,
  preview: Eye,
  banner: ImageIcon,
  "card-style": Palette,
  font: TextAa,
  "add-sounds": MusicNotes,
  "your-sounds": MusicNotes,
  "add-rule": ListChecks,
  "your-rules": ListChecks,
  "add-media": FilmSlate,
  "your-media": FilmSlate,
  "pin-settings": PushPin,
  "pin-list": PushPin,
  levels: Medal,
  "streamlabs-connection": Plugs,
};

const KIND: Record<Kind, string> = {
  surface: "border border-line/60 bg-surface",
  raised: "border border-line bg-raised",
  accent: "on-accent bg-accent text-ink",
};

// One dashboard tile: a 20px surface with a small uppercase label for its
// title (the main tile on a page uses its own Display title instead). Carries
// `data-tile`, which `Reveal` wipes in. `level` keeps the heading order
// straight: tiles under a group heading are h3, tiles on a sub page are h2.
export function Tile({
  id,
  title,
  level = 3,
  kind = "surface",
  className = "",
  children,
}: {
  id?: string;
  title?: string;
  level?: 2 | 3;
  kind?: Kind;
  className?: string;
  children: ReactNode;
}) {
  const Heading = level === 2 ? "h2" : "h3";
  const headingId = id ? `${id}-title` : undefined;
  const Badge = id ? ICONS[id] : undefined;
  return (
    <section
      id={id}
      data-tile
      aria-labelledby={title ? headingId : undefined}
      className={`min-w-0 scroll-mt-20 space-y-4 rounded-surface p-6 md:p-8 ${KIND[kind]} ${className}`}
    >
      {title && (
        <div className="flex items-center gap-3">
          {Badge && (
            <span
              aria-hidden="true"
              className={`grid size-9 shrink-0 place-items-center rounded-[var(--radius-field)] ${
                kind === "accent" ? "bg-ink text-accent" : "bg-accent text-ink"
              }`}
            >
              <Badge weight="bold" className="size-5" />
            </span>
          )}
          <Heading id={headingId} className={`text-lg font-semibold ${kind === "accent" ? "text-ink" : "text-text"}`}>
            {title}
          </Heading>
        </div>
      )}
      {children}
    </section>
  );
}

// A group of tiles under a small heading (Today, Stream, Account).
export function Group({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-16 space-y-4 pt-10 first:pt-6">
      <h2
        id={`${id}-heading`}
        className="flex items-center gap-4 text-sm font-semibold uppercase tracking-widest text-text after:h-px after:flex-1 after:bg-line"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

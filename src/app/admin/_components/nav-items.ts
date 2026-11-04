import {
  At,
  Bank,
  ChartBar,
  ChatText,
  ClockCounterClockwise,
  Coins,
  Envelope,
  FilmSlate,
  Gear,
  Heartbeat,
  Percent,
  Receipt,
  Scales,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Users,
  ArrowsLeftRight,
} from "@phosphor-icons/react/ssr";
import type { Icon } from "@phosphor-icons/react";

export type NavItem = { href: string; label: string; icon: Icon; hint: string };

// The one list of owner pages. The sidebar, the Ctrl+K palette and the overview's shortcut tiles
// all read it, so a new page is added here once.
export const NAV_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Operate",
    items: [
      { href: "/admin", label: "Overview", icon: SquaresFour, hint: "What is waiting for you today" },
      { href: "/admin/creators", label: "Creators", icon: Users, hint: "Find, approve, suspend and switch features" },
      { href: "/admin/handle-requests", label: "Handle requests", icon: At, hint: "Approve or refuse a handle change" },
      { href: "/admin/messages", label: "Messages", icon: Envelope, hint: "Contact form messages to read and mark handled" },
      { href: "/admin/sounds", label: "Sounds", icon: SpeakerHigh, hint: "Creator soundboard clips, with removal" },
      { href: "/admin/media", label: "Alert media", icon: FilmSlate, hint: "Approve or take down uploaded GIFs and videos" },
      { href: "/admin/tts-words", label: "Voice words", icon: ChatText, hint: "Hinglish words the voice does not know yet" },
    ],
  },
  {
    title: "Money",
    items: [
      { href: "/admin/finance", label: "Finance", icon: Coins, hint: "Tips captured, posted, owed and unsettled" },
      { href: "/admin/finance/creators", label: "Creator earnings", icon: ChartBar, hint: "Earnings per creator over a date range" },
      { href: "/admin/fees", label: "Fee rates", icon: Percent, hint: "Site-wide and per-creator fee and processing charge" },
      { href: "/admin/finance/balances", label: "Balances", icon: Scales, hint: "Balance, held and available per creator" },
      { href: "/admin/finance/payments", label: "Payment ledger", icon: Receipt, hint: "Every payment the provider reported" },
      { href: "/admin/finance/settlements", label: "Settlements", icon: Bank, hint: "What was settled to you and when" },
      { href: "/admin/reconciliation", label: "Reconciliation", icon: ArrowsLeftRight, hint: "Post missing tips and check for missed payments" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/admin/features", label: "Paid features", icon: Sparkle, hint: "Who has which paid feature on" },
      { href: "/admin/settings", label: "Site settings", icon: Gear, hint: "Site-wide switches such as the voice minimum" },
      { href: "/admin/health", label: "Health", icon: Heartbeat, hint: "Scheduled jobs and which server settings are set" },
      { href: "/admin/audit", label: "Audit history", icon: ClockCounterClockwise, hint: "Append-only history of owner actions" },
    ],
  },
];

// Overview and Finance have pages underneath that are their own items, so they
// only count as current on an exact match.
const EXACT = new Set(["/admin", "/admin/finance"]);

export function isCurrent(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return !EXACT.has(href) && pathname.startsWith(`${href}/`);
}

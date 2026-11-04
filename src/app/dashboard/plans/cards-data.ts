import { TIER_PRICES } from "@/lib/pricing";
import type { PlanCard } from "./PlanCards";

// The words and numbers on the two plan cards, in one place for the plans page and the test fixture.
// `buy`, `status`, `note` and `earlyOpen` are what the plans page fills in for the signed-in creator.
// The cards hold no feature list: every feature is named in the table under them (PlanTable.tsx).
export const PLAN_CARDS: { starter: PlanCard; creator: PlanCard } = {
  starter: {
    plan: "starter",
    name: "Starter",
    tagline: "Your alerts and overlays, in your style.",
    prices: TIER_PRICES.starter,
    buy: { kind: "soon" },
    status: null,
    note: null,
    earlyOpen: null,
  },
  creator: {
    plan: "creator",
    name: "Creator",
    tagline: "Everything in Starter, plus your own media, voices and fan tools.",
    prices: TIER_PRICES.creator,
    buy: { kind: "soon" },
    status: null,
    note: null,
    earlyOpen: null,
  },
};

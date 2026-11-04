import { CREATOR_EXTRA_KEYS, CUSTOM_KEYS, featureTitle, STARTER_KEYS } from "@/lib/plan-catalogue";
import { TIER_PRICES } from "@/lib/pricing";
import type { CustomCard, PlanCard } from "./PlanCards";

// The words and numbers on the three plan cards, in one place for the plans page and the test fixture.
const SHOWN = 4;

export const PLAN_CARDS: { starter: PlanCard; creator: PlanCard; custom: CustomCard } = {
  starter: {
    name: "Starter",
    tagline: "Make your alerts and overlays look like yours.",
    lead: null,
    highlights: STARTER_KEYS.slice(0, SHOWN).map(featureTitle),
    more: STARTER_KEYS.length - SHOWN,
    prices: TIER_PRICES.starter,
  },
  creator: {
    name: "Creator",
    tagline: "Your own media, voices and fan tools, for streams that are growing.",
    lead: "Everything in Starter, plus",
    highlights: CREATOR_EXTRA_KEYS.slice(0, SHOWN).map(featureTitle),
    more: CREATOR_EXTRA_KEYS.length - SHOWN,
    prices: TIER_PRICES.creator,
  },
  custom: {
    name: "Custom page",
    tagline: "A tip page designed and published for you.",
    highlights: CUSTOM_KEYS.map(featureTitle),
    from: TIER_PRICES.customFrom,
  },
};

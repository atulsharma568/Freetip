"use client";

import {
  Crown,
  FilmStrip,
  Flag,
  Gif,
  HandHeart,
  ImageSquare,
  Layout,
  Lightning,
  MagicWand,
  PaintBrush,
  Palette,
  Scroll,
  Timer,
  Translate,
  UsersThree,
} from "@phosphor-icons/react";
import { PricingSection, type PricingPlan } from "@/components/vui/pricing-section";
import { TIER_PRICES, perMonthOfYear, yearSaving } from "@/lib/pricing";

// The public pricing cards: the vui pricing section with our two plans and the by-request custom
// page. The words come from the plan catalogue (what creators see in the dashboard). Prices are
// shown only while `salesOpen`; before that the cards say "Soon" and the billing switch is hidden,
// the same rule the dashboard cards follow (a price that may still change is not shown).
// A plan is a one-off payment for 1 or 12 months that does not renew, so the footnote says it and
// the yearly number is the price of a month when the year is paid at once.

const { starter, creator, customFrom } = TIER_PRICES;
const inr = (n: number) => `₹${new Intl.NumberFormat("en-IN").format(n)}`;
const saving = Math.min(yearSaving(starter.monthly, starter.yearly), yearSaving(creator.monthly, creator.yearly));

export function PricingShowcase({ salesOpen }: { salesOpen: boolean }) {
  const plans: PricingPlan[] = [
    {
      id: "starter",
      name: "Starter",
      description: "Your alerts and overlays, in your style.",
      price: salesOpen
        ? { monthly: starter.monthly, annually: perMonthOfYear(starter.yearly) }
        : "Soon",
      accent: "#a1a1aa",
      glow: 0.8,
      cta: salesOpen
        ? { label: "Choose Starter", href: "/dashboard/plans" }
        : { label: "Get started free", href: "/signup" },
      features: [
        { label: "Your own words and colours", icon: <Palette weight="fill" /> },
        { label: "Animations and timing", icon: <MagicWand weight="fill" /> },
        { label: "Card styles and fonts", icon: <PaintBrush weight="fill" /> },
        { label: "Volume and layout", icon: <Layout weight="fill" /> },
        { label: "Support streak, top and recent supporter overlays", icon: <Lightning weight="fill" /> },
        { label: "Stream timestamps, saved by big tips", icon: <Timer weight="fill" /> },
      ],
    },
    {
      id: "creator",
      name: "Creator",
      description: "Everything in Starter, plus your own media, voices and fan tools.",
      price: salesOpen
        ? { monthly: creator.monthly, annually: perMonthOfYear(creator.yearly) }
        : "Soon",
      accent: "#bfe84a",
      glow: 0.9,
      featured: true,
      badge: "Most complete",
      cta: salesOpen
        ? { label: "Choose Creator", href: "/dashboard/plans" }
        : { label: "Get started free", href: "/signup" },
      features: [
        { label: "Everything in Starter", icon: <Crown weight="fill" /> },
        { label: "Your own GIFs, pictures and clips", icon: <Gif weight="fill" /> },
        { label: "Bigger tips, bigger alerts", icon: <FilmStrip weight="fill" /> },
        { label: "Tip page picks for fans", icon: <HandHeart weight="fill" /> },
        { label: "Banner behind your photo", icon: <ImageSquare weight="fill" /> },
        { label: "Voices in more Indian languages", icon: <Translate weight="fill" /> },
        { label: "Fan levels and a private fan list", icon: <UsersThree weight="fill" /> },
      ],
    },
    {
      id: "custom",
      name: "Custom page",
      description: "We design and publish a tip page made for you. One-time, quoted for each creator.",
      price: `From ${inr(customFrom)}`,
      accent: "#f0b35a",
      glow: 0.8,
      cta: { label: "Ask for a custom page", href: "/contact" },
      features: [
        { label: "A tip page with your colours, words and pictures", icon: <Scroll weight="fill" /> },
        { label: "Pressure meter: your goal as a bar with rank words", icon: <Flag weight="fill" /> },
        { label: "Photo frame and banner effects", icon: <Crown weight="fill" /> },
        { label: "Nothing changes until you are happy", icon: <HandHeart weight="fill" /> },
      ],
    },
  ];

  return (
    <PricingSection
      id="plans"
      badge="Optional paid features"
      title="Plans"
      description="Tipping is free. Plans add looks, media and fan tools for your page and stream."
      plans={plans}
      showBilling={salesOpen}
      billingLabels={{ monthly: "1 month", annually: "12 months" }}
      annualDiscountLabel={saving > 0 ? `-${saving}%` : null}
      currency="₹"
      periodLabel="/month"
      featuresLabel="What you get"
      footnote={
        salesOpen
          ? `One-off payment for 1 or 12 months; it does not renew by itself. 12 months is paid once: ${inr(starter.yearly)} for Starter, ${inr(creator.yearly)} for Creator.`
          : "Plans are not open to buy yet; the prices are announced when they open. A plan is a one-off payment that does not renew by itself."
      }
      className="rounded-[var(--radius-surface)]"
    />
  );
}

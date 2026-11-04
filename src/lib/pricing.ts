// The prices of the two paid plans, in whole rupees, in one place. The plan cards show them and the
// Buy form charges them (the amount is fixed on our side when an order is made, so a later change
// here never reaches an earlier order). `early` is the price for the first creators and `seats` how
// many get it, counted per plan. Change the numbers below at any time; nothing else needs touching.

export type PlanKey = "starter" | "creator";
export const PLAN_KEYS: readonly PlanKey[] = ["starter", "creator"];
export const PLAN_NAMES: Record<PlanKey, string> = { starter: "Starter", creator: "Creator" };

// The shape the order code works with: a price that is not set (null) means "not for sale".
export type PlanPrices = {
  monthly: number | null;
  yearly: number | null;
  early: { monthly: number; yearly: number; seats: number } | null;
};

export type TierPrices = {
  monthly: number;
  yearly: number;
  early: { monthly: number; yearly: number; seats: number };
};

// Starter and Creator are bought; the Custom page is a one-time price, "from", quoted for each
// creator by request (not bought through the Buy form).
export const TIER_PRICES: { starter: TierPrices; creator: TierPrices; customFrom: number } = {
  starter: { monthly: 149, yearly: 1199, early: { monthly: 79, yearly: 599, seats: 50 } },
  creator: { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 50 } },
  customFrom: 2999,
};

// One-time extras, done by hand for a creator on request (not bought through the Buy form and not
// part of a plan). `from` is whole rupees, "from" because the work is agreed with the creator first.
// Placeholders like the plan prices: change them here at any time.
export const ONE_TIME_EXTRAS: readonly { key: string; name: string; blurb: string; from: number }[] = [
  {
    key: "custom-page",
    name: "Custom tip page",
    blurb: "We design and publish a tip page made for you: your colours, words and pictures. Nothing changes until you are happy with it.",
    from: TIER_PRICES.customFrom,
  },
  {
    key: "alert-makeover",
    name: "Alert makeover",
    blurb: "We set up your whole alert for you: wording, colours, motion and a different look for bigger tips.",
    from: 999,
  },
  {
    key: "qr-poster",
    name: "QR poster and panels",
    blurb: "A picture with your name, colours and a QR code to your tip link, plus the support panels for under your stream.",
    from: 699,
  },
  {
    key: "launch-kit",
    name: "Launch kit",
    blurb: "The custom tip page, the alert makeover and the QR poster together, for less than buying them one by one.",
    from: 3999,
  },
];

// The prices above are still placeholders. While this is false nothing can be bought with PayU's
// live key, whatever else is set; with the test key only the owner can buy (src/app/actions/
// plan-checkout.ts), so the Buy form can be tried end to end. Set it to true, in the same commit
// as the final prices, to open sales to creators.
export const LIVE_SALES_OPEN = false;

// Whole percent a year saves against twelve months, and the monthly equivalent of a year.
export const yearSaving = (monthly: number, yearly: number) =>
  Math.max(0, Math.round((1 - yearly / (monthly * 12)) * 100));
export const perMonthOfYear = (yearly: number) => Math.round(yearly / 12);

export type PriceView = {
  monthly: number;
  yearly: number;
  // Whole percent saved by paying for a year at once, against twelve months.
  yearlySavingPercent: number;
  early: { monthly: number; yearly: number; seats: number } | null;
};

// Null until both prices are set.
export function priceView(prices: PlanPrices): PriceView | null {
  const { monthly, yearly } = prices;
  if (monthly === null || yearly === null || monthly <= 0 || yearly <= 0) return null;
  return { monthly, yearly, yearlySavingPercent: yearSaving(monthly, yearly), early: prices.early };
}

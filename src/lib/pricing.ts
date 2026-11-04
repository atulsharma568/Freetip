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

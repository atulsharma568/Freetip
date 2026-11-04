// The paid plan's prices, in whole rupees, in one place. The owner has not set them yet, so
// every price is null: the plan page then says the price is coming and nothing can be bought.
// Fill these in (and nothing else changes) when the prices are decided. `early` is the price
// for the first creators and `earlySeats` how many get it.

export type PlanPrices = {
  monthly: number | null;
  yearly: number | null;
  early: { monthly: number; yearly: number; seats: number } | null;
};

export const PLAN_PRICES: PlanPrices = {
  monthly: null,
  yearly: null,
  early: null,
};

export type PriceView = {
  monthly: number;
  yearly: number;
  // Whole percent saved by paying for a year at once, against twelve months.
  yearlySavingPercent: number;
  early: { monthly: number; yearly: number; seats: number } | null;
};

// Null until both prices are set.
export function priceView(prices: PlanPrices = PLAN_PRICES): PriceView | null {
  const { monthly, yearly } = prices;
  if (monthly === null || yearly === null || monthly <= 0 || yearly <= 0) return null;
  const saving = Math.round((1 - yearly / (monthly * 12)) * 100);
  return { monthly, yearly, yearlySavingPercent: Math.max(0, saving), early: prices.early };
}

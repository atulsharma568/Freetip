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

// The prices the plan cards show for the three offers (Starter, Creator, and the Custom page).
// Placeholders the owner can change here at any time. Display only for now: nothing can be bought
// at these prices yet, because the Buy form still sells one pass at `PLAN_PRICES` above. The
// Custom page is a one-time price, "from", quoted for each creator.
export type TierPrices = {
  monthly: number;
  yearly: number;
  early: { monthly: number; yearly: number; seats: number };
};

export const TIER_PRICES: { starter: TierPrices; creator: TierPrices; customFrom: number } = {
  starter: { monthly: 149, yearly: 1199, early: { monthly: 79, yearly: 599, seats: 50 } },
  creator: { monthly: 299, yearly: 2499, early: { monthly: 149, yearly: 1299, seats: 50 } },
  customFrom: 2999,
};

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
export function priceView(prices: PlanPrices = PLAN_PRICES): PriceView | null {
  const { monthly, yearly } = prices;
  if (monthly === null || yearly === null || monthly <= 0 || yearly <= 0) return null;
  const saving = Math.round((1 - yearly / (monthly * 12)) * 100);
  return { monthly, yearly, yearlySavingPercent: Math.max(0, saving), early: prices.early };
}

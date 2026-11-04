"use server";

import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { configuredOwnerGoogleIds, isOwnerGoogleId } from "@/lib/owner-auth";
import { checkPayer, checkoutForm, CheckoutInputError, payuConfig, type CheckoutPayer, type CheckoutUrls } from "@/lib/payu";
import { createPlanOrder } from "@/lib/plan-orders";
import { buyingOpen, rupees } from "@/lib/plan-view";
import { LIVE_SALES_OPEN, PLAN_NAMES, TIER_PRICES } from "@/lib/pricing";
import { SITE_URL } from "@/lib/url";

export type PlanCheckoutResult =
  // The form to post to PayU: the browser sends it, we never see the card or UPI details.
  | { status: "ok"; action: string; fields: Record<string, string> }
  | { status: "error"; message: string };

const fail = (message: string): PlanCheckoutResult => ({ status: "error", message });

// Starts buying a plan's pass: checks everything on the server (the page's choices are only a request),
// makes the order with the amount fixed on our side, and hands back the signed form for PayU.
// Nothing is switched on here; that happens only when PayU's signed reply is believed
// (src/lib/plan-orders.ts).
export async function startPlanCheckout(input: {
  plan: string;
  term: number;
  phone: string;
  expectAmountMinor: number;
  agreed: boolean;
}): Promise<PlanCheckoutResult> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  const db = getDb();
  if (!googleId || !db) return fail("Sign in again to buy paid features.");

  // The action is callable from anywhere, so every value is checked as if it were hostile.
  const term = Number(input?.term);
  const plan = input?.plan === "starter" || input?.plan === "creator" ? input.plan : null;
  const phone = typeof input?.phone === "string" ? input.phone.slice(0, 30) : "";
  const expectAmountMinor = Number(input?.expectAmountMinor);
  if (input?.agreed !== true) return fail("Tick the box to agree to the terms before you pay.");
  if (!plan || !Number.isSafeInteger(term) || !Number.isSafeInteger(expectAmountMinor) || expectAmountMinor <= 0) {
    return fail("Something went wrong with the form. Reload the page and try again.");
  }

  const config = payuConfig();
  if (!config) return fail("Buying is not open yet.");

  const [user] = await db<{ id: string; handle: string | null; email: string; name: string | null; creator_status: string }[]>`
    select id::text, handle, email, name, creator_status from users where google_id = ${googleId}
  `;
  if (!user?.handle) return fail("Set up your creator page first.");
  if (user.creator_status !== "active") return fail("Paid features can be bought once your page is live.");

  // The same rule the page uses to show the button: live money only once the owner has opened
  // sales (the prices are placeholders until then), test money only for the owner.
  const isOwner = isOwnerGoogleId(googleId, configuredOwnerGoogleIds());
  if (!buyingOpen(config.mode, LIVE_SALES_OPEN, isOwner)) return fail("Buying is not open yet.");

  const urls: CheckoutUrls = {
    success: `${SITE_URL}/api/payu/return`,
    failure: `${SITE_URL}/api/payu/return`,
    cancel: `${SITE_URL}/api/payu/cancel`,
  };
  const payer: CheckoutPayer = { firstname: user.name ?? "", email: user.email, phone };
  // Refuse a bad mobile number or email before an order exists, so a typo does not leave an unpaid
  // order behind (those count towards the hourly limit and hold an early seat).
  try {
    checkPayer(payer, urls);
  } catch (err) {
    if (err instanceof CheckoutInputError) return fail(err.message);
    throw err;
  }

  const created = await createPlanOrder(db as unknown as LedgerDb, {
    creatorId: Number(user.id),
    term,
    plan,
    prices: TIER_PRICES[plan],
    livemode: config.mode === "live",
    isOwner,
    expectAmountMinor,
  });
  if (!created.ok) {
    switch (created.reason) {
      case "no_price":
        return fail("The price has not been set yet.");
      case "test_not_allowed":
        return fail("Buying is not open yet.");
      case "not_active":
        return fail("Paid features can be bought once your page is live.");
      case "too_many":
        return fail("You started several payments in the last hour. Finish one, or try again later.");
      case "already_covered":
        return fail("Your Creator plan already includes everything in Starter for that long. You can buy Starter after Creator ends.");
      case "price_changed":
        return fail(`The price changed to ${rupees(created.amountMinor)}. Reload the page to see it and try again.`);
      default:
        return fail("Choose a plan and 1 month or 12 months.");
    }
  }

  const { action, fields } = checkoutForm(
    config,
    { txnid: created.order.txnid, amountMinor: created.order.amountMinor, productinfo: `Freetip ${PLAN_NAMES[plan]} plan`, orderRef: String(created.order.id) },
    payer,
    urls,
  );
  return { status: "ok", action, fields };
}

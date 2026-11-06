"use server";

import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getDb } from "@/lib/db";
import { configuredOwnerGoogleIds, isOwnerGoogleId } from "@/lib/owner-auth";
import { attachProviderOrder, createPlanOrder, failUnstartedOrder, settleRazorpayOrder } from "@/lib/plan-orders";
import { buyingOpen, rupees } from "@/lib/plan-view";
import { TERMS_VERSION } from "@/lib/legal";
import { LIVE_SALES_OPEN, PLAN_NAMES, planPrices } from "@/lib/pricing";
import { checkoutSignatureIsValid, createRazorpayOrder, razorpayConfig, razorpayDeps } from "@/lib/razorpay-plan";

export type PlanCheckoutResult =
  // What the Razorpay popup needs. The creator pays inside it; we never see card or UPI details.
  | {
      status: "ok";
      keyId: string;
      orderId: string;
      amountMinor: number;
      description: string;
      prefill: { name: string; email: string };
    }
  | { status: "error"; message: string };

const fail = (message: string): PlanCheckoutResult => ({ status: "error", message });

async function signedInCreator(): Promise<{ googleId: string; db: NonNullable<ReturnType<typeof getDb>> } | null> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  const db = getDb();
  return googleId && db ? { googleId, db } : null;
}

// Starts buying a plan's pass: checks everything on the server (the page's choices are only a request),
// makes the order with the amount fixed on our side, makes the matching Razorpay order for that amount,
// and hands back what the popup needs. Nothing is switched on here; that happens only when Razorpay's
// own word says the order was paid (src/lib/plan-orders.ts, settleRazorpayOrder).
export async function startPlanCheckout(input: {
  plan: string;
  term: number;
  expectAmountMinor: number;
  agreed: boolean;
}): Promise<PlanCheckoutResult> {
  const who = await signedInCreator();
  if (!who) return fail("Sign in again to buy paid features.");
  const { googleId, db } = who;

  // The action is callable from anywhere, so every value is checked as if it were hostile.
  const term = Number(input?.term);
  const plan = input?.plan === "starter" || input?.plan === "creator" ? input.plan : null;
  const expectAmountMinor = Number(input?.expectAmountMinor);
  if (input?.agreed !== true) return fail("Tick the box to agree to the terms before you pay.");
  if (!plan || !Number.isSafeInteger(term) || !Number.isSafeInteger(expectAmountMinor) || expectAmountMinor <= 0) {
    return fail("Something went wrong with the form. Reload the page and try again.");
  }

  const config = razorpayConfig();
  if (!config) return fail("Buying is not open yet.");

  // Anything that goes wrong from here (the database, Razorpay) is told to the creator in words, never
  // left to the dashboard's error page. The order and the closing of the older pending ones are one
  // transaction; an order whose Razorpay order could not be made is closed straight away.
  try {
    const [user] = await db<{ id: string; handle: string | null; email: string; name: string | null; creator_status: string }[]>`
      select id::text, handle, email, name, creator_status from users where google_id = ${googleId}
    `;
    if (!user?.handle) return fail("Set up your creator page first.");
    if (user.creator_status !== "active") return fail("Paid features can be bought once your page is live.");

    // The same rule the page uses to show the button: live money once the owner has opened sales (the
    // prices are placeholders until then) and always for the owner, test money only for the owner.
    const isOwner = isOwnerGoogleId(googleId, configuredOwnerGoogleIds());
    if (!buyingOpen(config.mode, LIVE_SALES_OPEN, isOwner)) return fail("Buying is not open yet.");

    const ledger = db as unknown as LedgerDb;
    let created: Awaited<ReturnType<typeof createPlanOrder>>;
    try {
      created = await createPlanOrder(ledger, {
        creatorId: Number(user.id),
        term,
        plan,
        prices: planPrices(plan),
        livemode: config.mode === "live",
        isOwner,
        expectAmountMinor,
        // What the creator agreed to by ticking the box: the time is the server's, the text is the
        // version published now (TERMS_VERSION in legal.ts).
        termsVersion: TERMS_VERSION,
        provider: "razorpay",
      });
    } catch (err) {
      // Before migration 0060 the order cannot say it is a Razorpay order: refuse, charge nothing.
      if ((err as { code?: string }).code === "42703") {
        console.error("Buying a plan: plan_orders.provider is missing (run migration 0060).");
        return fail("Buying is not open yet.");
      }
      throw err;
    }
    if (!created.ok) {
      switch (created.reason) {
        case "no_price":
          return fail("The price has not been set yet.");
        case "test_not_allowed":
          return fail("Buying is not open yet.");
        case "not_active":
          return fail("Paid features can be bought once your page is live.");
        case "too_many":
          return fail("You started a lot of payments in the last hour. Try again a little later.");
        case "already_covered":
          return fail("Your Creator plan already includes everything in Starter for that long. You can buy Starter after Creator ends.");
        case "price_changed":
          return fail(`The price changed to ${rupees(created.amountMinor)}. Reload the page to see it and try again.`);
        case "no_agreement":
          return fail("Something went wrong with the form. Reload the page and try again.");
        default:
          return fail("Choose a plan and 1 month or 12 months.");
      }
    }

    const { order } = created;
    const rzp = await createRazorpayOrder(config, {
      amountMinor: order.amountMinor,
      receipt: order.txnid,
      planOrderId: order.id,
      plan,
      termMonths: order.term,
    });
    if (!rzp.ok) {
      console.error(`Buying a plan: Razorpay order for plan order ${order.id} could not be made: ${rzp.reason}`);
      await failUnstartedOrder(ledger, order.id);
      return fail("We could not start the payment. Nothing was charged. Please try again in a minute.");
    }
    if (!(await attachProviderOrder(ledger, order.id, rzp.orderId))) {
      // Another request touched the order in the meantime (it is no longer pending): do not open a popup
      // for an order we could not record against.
      console.error(`Buying a plan: could not record Razorpay order ${rzp.orderId} on plan order ${order.id}.`);
      return fail("We could not start the payment. Nothing was charged. Please try again in a minute.");
    }
    return {
      status: "ok",
      keyId: config.keyId,
      orderId: rzp.orderId,
      amountMinor: order.amountMinor,
      description: `${PLAN_NAMES[plan]} plan, ${order.term === 12 ? "12 months" : "1 month"}`,
      prefill: { name: user.name ?? "", email: user.email },
    };
  } catch (err) {
    console.error("Buying a plan: could not start the payment:", err instanceof Error ? err.message : err);
    return fail("We could not start the payment. Nothing was charged. Please try again in a minute.");
  }
}

export type PlanConfirmResult = { status: "paid" | "pending" | "failed" | "problem" };

// Called by the Buy form when the Razorpay popup says the creator paid. The popup's reply is only a hint:
// its signature must check out, the order must be this creator's, and then our server asks Razorpay's API
// which payment of that order was captured and for how much. The webhook settles the same order too;
// whichever comes first wins and the other changes nothing.
export async function confirmPlanPayment(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<PlanConfirmResult> {
  const who = await signedInCreator();
  const config = razorpayConfig();
  if (!who || !config) return { status: "problem" };
  if (!checkoutSignatureIsValid({ orderId: input?.orderId, paymentId: input?.paymentId, signature: input?.signature }, config.keySecret)) {
    console.error("Buying a plan: a popup reply with a signature that does not match was ignored.");
    return { status: "problem" };
  }
  try {
    const { googleId, db } = who;
    const [mine] = await db<{ id: string }[]>`
      select o.id::text from plan_orders o join users u on u.id = o.creator_id
       where o.provider_order_ref = ${input.orderId} and u.google_id = ${googleId}
    `;
    if (!mine) return { status: "problem" };
    const result = await settleRazorpayOrder(db as unknown as LedgerDb, input.orderId, razorpayDeps(config));
    if (result.status === "activated" || result.status === "already_paid") return { status: "paid" };
    if (result.status === "failed") return { status: "failed" };
    if (result.status === "pending" || result.status === "unavailable") return { status: "pending" };
    console.error(`Buying a plan: Razorpay payment for order ${input.orderId} not believed: ${result.reason}`);
    return { status: "problem" };
  } catch (err) {
    console.error("Buying a plan: could not confirm a payment:", err instanceof Error ? err.message : err);
    // The webhook and the page's own check will still settle it.
    return { status: "pending" };
  }
}

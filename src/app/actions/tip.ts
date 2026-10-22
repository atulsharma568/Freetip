"use server";

import { randomBytes } from "crypto";
import { getDb } from "@/lib/db";

export type TipOrderResult =
  | { status: "error"; message: string }
  | { status: "ok"; razorpayOrderId: string; razorpayKeyId: string; amountPaise: number };

export async function createTipOrder(
  handle: string,
  amountPaise: number,
  fanName: string | null,
  fanMessage: string | null,
  anonymous: boolean,
): Promise<TipOrderResult> {
  if (!Number.isInteger(amountPaise) || amountPaise < 100) {
    return { status: "error", message: "Invalid tip amount" };
  }
  if (amountPaise > 10_000_000) {
    return { status: "error", message: "Tip cannot exceed ₹1,00,000" };
  }
  if (fanName && fanName.length > 50) {
    return { status: "error", message: "Name too long" };
  }
  if (fanMessage && fanMessage.length > 500) {
    return { status: "error", message: "Message too long" };
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return { status: "error", message: "Payments are not configured yet — try again later" };
  }

  const db = getDb();
  if (!db) return { status: "error", message: "Service unavailable — try again shortly" };

  // Fetch creator — must be active.
  const creators = await db<{ id: number; min_tip_paise: number; message_max_chars: number }[]>`
    select id, min_tip_paise, message_max_chars
    from users
    where handle = ${handle} and creator_status = 'active'
  `;
  const creator = creators[0];
  if (!creator) {
    return { status: "error", message: "Creator not found or not accepting tips" };
  }

  if (amountPaise < creator.min_tip_paise) {
    return {
      status: "error",
      message: `Minimum tip is ₹${Math.ceil(creator.min_tip_paise / 100)}`,
    };
  }
  if (fanMessage && fanMessage.length > creator.message_max_chars) {
    return {
      status: "error",
      message: `Message cannot exceed ${creator.message_max_chars} characters`,
    };
  }

  const publicReference = `tip_${randomBytes(8).toString("hex")}`;

  // Create Razorpay order.
  let razorpayOrderId: string;
  try {
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const rzRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: publicReference,
      }),
    });
    if (!rzRes.ok) {
      const body = await rzRes.text().catch(() => "");
      console.error("Razorpay order creation failed", rzRes.status, body);
      return { status: "error", message: "Could not start payment — try again shortly" };
    }
    const rzOrder = (await rzRes.json()) as { id: string };
    razorpayOrderId = rzOrder.id;
  } catch (err) {
    console.error("Razorpay order creation error", err);
    return { status: "error", message: "Could not start payment — try again shortly" };
  }

  // Persist order + payment attempt. A failure here is non-fatal: the Razorpay
  // order exists and the webhook will still arrive, so we log and continue.
  try {
    const storedName = anonymous ? null : (fanName?.trim() || null);
    const storedMessage = fanMessage?.trim() || null;

    const orders = await db<{ id: number }[]>`
      insert into tip_orders
        (creator_id, public_reference, gross_amount_minor, currency,
         fan_name, fan_message, anonymous, status)
      values
        (${creator.id}, ${publicReference}, ${amountPaise}, 'INR',
         ${storedName}, ${storedMessage}, ${anonymous}, 'payment_pending')
      returning id
    `;

    await db`
      insert into payment_attempts
        (tip_order_id, provider, provider_order_ref, amount_minor, currency, idempotency_key)
      values
        (${orders[0].id}, 'razorpay', ${razorpayOrderId}, ${amountPaise}, 'INR', ${publicReference})
    `;
  } catch (err) {
    console.error("DB persist error for tip order", err);
  }

  return { status: "ok", razorpayOrderId, razorpayKeyId: keyId, amountPaise };
}

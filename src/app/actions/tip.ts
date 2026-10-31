"use server";

import { createHmac, randomBytes } from "crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { messageLimitFor, nextMessageStep } from "@/lib/message-limit";
import { findBlockedWord, parseBannedWords } from "@/lib/message-filter";
import { checkPick } from "@/lib/sounds";
import { checkVoicePick } from "@/lib/tts-rules";
import { ttsAvailable } from "@/lib/tts";

export type TipOrderResult =
  | { status: "error"; message: string }
  | { status: "ok"; razorpayOrderId: string; razorpayKeyId: string; amountPaise: number };

// Tips one network may start per hour. High on purpose: Indian mobile users share
// one address behind their carrier, and turning away a fan who is about to pay
// costs more than an unpaid order does. This only stops a script creating orders
// without end.
const ORDER_LIMIT_PER_HOUR = 60;

// True when this network may start another tip, and counts it. Never the reason a
// payment fails: if the check can't run (no salt or address, or the table from
// migration 0012 is missing) it logs and lets the tip through.
async function underOrderLimit(db: NonNullable<ReturnType<typeof getDb>>): Promise<boolean> {
  const salt = process.env.WAITLIST_SALT;
  if (!salt || salt.length < 16) {
    console.error("Tip: WAITLIST_SALT is not set, so tips are not rate limited.");
    return true;
  }

  const list = await headers();
  const ip = list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip");
  // With no address every visitor would share one count and could lock each other out.
  if (!ip) return true;
  // Only a keyed hash of the address is kept, and only for the hour the limit needs it.
  const ipHash = createHmac("sha256", salt).update(ip).digest("hex");

  try {
    return await db.begin(async (tx) => {
      // One request per network at a time, so a burst can't all read the count
      // before any of it is recorded. The lock is released when the transaction ends.
      await tx`select pg_advisory_xact_lock(hashtextextended(${ipHash}, 0))`;
      const [{ recent }] = await tx<{ recent: number }[]>`
        select count(*)::int as recent from tip_order_attempts
        where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'
      `;
      // A refused request is not recorded, so a flood can't keep real users on the
      // same address locked out beyond the hour.
      if (recent >= ORDER_LIMIT_PER_HOUR) return false;
      await tx`insert into tip_order_attempts (ip_hash) values (${ipHash})`;
      await tx`delete from tip_order_attempts where created_at < now() - interval '1 hour'`;
      return true;
    });
  } catch (err) {
    console.error("Tip: rate limit check failed, letting the tip through.", err);
    return true;
  }
}

export async function createTipOrder(
  handle: string,
  amountPaise: number,
  fanName: string | null,
  fanMessage: string | null,
  anonymous: boolean,
  soundId: number | null = null,
  voice = false,
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

  if (!(await underOrderLimit(db))) {
    return {
      status: "error",
      message: "Too many tips started from your network — please try again in a little while",
    };
  }

  // Fetch creator — must be active.
  const creators = await db<
    { id: number; min_tip_paise: number; message_max_chars: number; tts_enabled: boolean; tts_min_paise: number }[]
  >`
    select id, min_tip_paise, message_max_chars, tts_enabled, tts_min_paise
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
  const messageLimit = messageLimitFor(creator.message_max_chars, amountPaise);
  if (fanMessage && fanMessage.length > messageLimit) {
    const more = nextMessageStep(creator.message_max_chars, amountPaise);
    return {
      status: "error",
      message:
        `Message cannot exceed ${messageLimit} characters` +
        (more ? `. Tip ₹${more.rupees} or more for ${more.limit}.` : ""),
    };
  }

  // Our profanity list plus the creator's own banned words, on the message and on
  // the name (both appear on the stream). Checked before payment so a fan never
  // pays for words that would not be shown. The creator's list (migration 0016) is
  // looked up apart so a missing column only drops that list, never the tip.
  let bannedWords: string[] = [];
  try {
    const [row] = await db<{ banned_words: string }[]>`
      select banned_words from users where id = ${creator.id}
    `;
    bannedWords = parseBannedWords(row?.banned_words);
  } catch (err) {
    console.error("Tip: could not read the creator's banned words.", err);
  }
  if (
    findBlockedWord(fanMessage, bannedWords) !== null ||
    (!anonymous && findBlockedWord(fanName, bannedWords) !== null)
  ) {
    return {
      status: "error",
      message: "Your name or message has a word that isn't allowed on this stream. Please change it and try again.",
    };
  }

  // A tip uses a sound or the voice, never both, and the voice needs the site
  // switch, the creator's setting, a message and a big enough tip.
  if (voice) {
    const problem = checkVoicePick({
      platformOn: ttsAvailable(),
      creatorEnabled: creator.tts_enabled,
      minPaise: creator.tts_min_paise,
      amountPaise,
      message: fanMessage,
      hasSound: soundId !== null,
    });
    if (problem) return { status: "error", message: problem };
  }

  // The fan's sound pick. The creator's rules are enforced here, not on the page.
  if (soundId !== null) {
    if (!Number.isSafeInteger(soundId)) {
      return { status: "error", message: "That sound is no longer available. Pick another or clear your choice." };
    }
    let sound: { enabled: boolean; min_paise: number } | undefined;
    try {
      [sound] = await db<{ enabled: boolean; min_paise: number }[]>`
        select enabled, min_paise from creator_sounds
        where id = ${soundId} and creator_id = ${creator.id}
      `;
    } catch (err) {
      // The sounds table (migration 0013) is missing: refuse the pick, not the tip.
      console.error("Tip: could not check the sound pick.", err);
    }
    const problem = checkPick(sound, amountPaise);
    if (problem) return { status: "error", message: problem };
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

  // Persist order + payment attempt before the fan can pay. The webhook can only
  // credit a payment to a row that exists, so if we can't save the rows the fan
  // is told to try again and the payment popup never opens: nobody pays for a tip
  // we can't track. The unused Razorpay order is harmless, and the one transaction
  // means we never keep an order without its attempt.
  const storedName = anonymous ? null : (fanName?.trim() || null);
  const storedMessage = fanMessage?.trim() || null;
  // Which Razorpay mode this payment is in (migration 0023), saved in the same
  // transaction as the attempt. Only live money is ever posted to a creator's books;
  // a missing value counts as test money. Before the migration has run the column
  // does not exist, so that case is retried without it (undefined_column, 42703).
  const live = keyId.startsWith("rzp_live_");

  const persist = (withMode: boolean) =>
    db.begin(async (tx) => {
      // sound_id (migration 0013) and tts_requested (migration 0014) are only
      // written when the fan chose them: every other tip works before those
      // migrations are run.
      const orders =
        soundId !== null
          ? await tx<{ id: number }[]>`
              insert into tip_orders
                (creator_id, public_reference, gross_amount_minor, currency,
                 fan_name, fan_message, anonymous, status, sound_id)
              values
                (${creator.id}, ${publicReference}, ${amountPaise}, 'INR',
                 ${storedName}, ${storedMessage}, ${anonymous}, 'payment_pending', ${soundId})
              returning id
            `
          : voice
            ? await tx<{ id: number }[]>`
                insert into tip_orders
                  (creator_id, public_reference, gross_amount_minor, currency,
                   fan_name, fan_message, anonymous, status, tts_requested)
                values
                  (${creator.id}, ${publicReference}, ${amountPaise}, 'INR',
                   ${storedName}, ${storedMessage}, ${anonymous}, 'payment_pending', true)
                returning id
              `
            : await tx<{ id: number }[]>`
                insert into tip_orders
                  (creator_id, public_reference, gross_amount_minor, currency,
                   fan_name, fan_message, anonymous, status)
                values
                  (${creator.id}, ${publicReference}, ${amountPaise}, 'INR',
                   ${storedName}, ${storedMessage}, ${anonymous}, 'payment_pending')
                returning id
              `;

      if (withMode) {
        await tx`
          insert into payment_attempts
            (tip_order_id, provider, provider_order_ref, amount_minor, currency, idempotency_key, livemode)
          values
            (${orders[0].id}, 'razorpay', ${razorpayOrderId}, ${amountPaise}, 'INR', ${publicReference}, ${live})
        `;
      } else {
        await tx`
          insert into payment_attempts
            (tip_order_id, provider, provider_order_ref, amount_minor, currency, idempotency_key)
          values
            (${orders[0].id}, 'razorpay', ${razorpayOrderId}, ${amountPaise}, 'INR', ${publicReference})
        `;
      }
    });

  try {
    try {
      await persist(true);
    } catch (err) {
      if ((err as { code?: string }).code !== "42703") throw err;
      console.error("Tip: payment_attempts.livemode is missing (migration 0023 not run yet)");
      await persist(false);
    }
  } catch (err) {
    console.error("DB persist error for tip order", razorpayOrderId, err);
    return { status: "error", message: "Service unavailable — try again shortly" };
  }

  return { status: "ok", razorpayOrderId, razorpayKeyId: keyId, amountPaise };
}

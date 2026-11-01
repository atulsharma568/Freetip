"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { sendContactEmail, sendContactReceipt } from "@/lib/contact-email";
import { parseContact, ticketNumber, type ContactState } from "@/lib/contact";

// Saved messages allowed per network per hour. Kept low: a person sends one
// or two, and every message is read by hand.
const LIMIT = 5;

export async function sendContact(
  _previous: ContactState,
  form: FormData,
): Promise<ContactState> {
  // People never see this field; bots fill it in. Say it worked, save nothing.
  if (form.get("website")) return { status: "ok", ticket: ticketNumber(Math.floor(Math.random() * 90000) + 10000) };

  const parsed = parseContact(form);
  if (!parsed.ok) return { status: "invalid", field: parsed.field };
  const { entry } = parsed;

  const sql = getDb();
  const salt = process.env.WAITLIST_SALT;
  if (!sql || !salt || salt.length < 16) {
    console.error("Contact: DATABASE_URL or WAITLIST_SALT is not set.");
    return { status: "unavailable" };
  }

  // Only a keyed hash of the IP address is kept, and only for the hour the
  // limit needs it. It is never stored with the message.
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip") ||
    "unknown";
  const ipHash = createHmac("sha256", salt).update(ip).digest("hex");

  try {
    const [{ recent }] = await sql<{ recent: number }[]>`
      select count(*)::int as recent from contact_attempts
      where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'
    `;
    if (recent >= LIMIT) return { status: "rate_limited" };

    const [saved] = await sql<{ id: number }[]>`
      with attempt as (
        insert into contact_attempts (ip_hash) values (${ipHash})
      ), purge as (
        delete from contact_attempts where created_at < now() - interval '1 hour'
      )
      insert into contact_messages (name, email, topic, payment_ref, message)
      values (${entry.name}, ${entry.email}, ${entry.topic}, ${entry.paymentRef}, ${entry.message})
      returning id::int as id
    `;
    const ticket = ticketNumber(saved.id);
    // Saved. Both emails are courtesies; a failure is only logged.
    await Promise.all([sendContactEmail(entry, ticket), sendContactReceipt(entry, ticket)]);
    return { status: "ok", ticket };
  } catch (error) {
    console.error("Contact: save failed.", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

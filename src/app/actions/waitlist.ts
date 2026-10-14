"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { WAITLIST_CONSENT_VERSION } from "@/lib/legal";
import { parseWaitlist, type WaitlistState } from "@/lib/waitlist";

// Saved sign-ups allowed per network per hour. Generous, because many
// Indian mobile users share one IP address behind their carrier.
const LIMIT = 20;

export async function joinWaitlist(
  _previous: WaitlistState,
  form: FormData,
): Promise<WaitlistState> {
  // People never see this field; bots fill it in. Say it worked, save nothing.
  if (form.get("website")) return { status: "ok" };

  const parsed = parseWaitlist(form);
  if (!parsed.ok) return { status: "invalid", field: parsed.field };
  const { entry } = parsed;

  const sql = getDb();
  const salt = process.env.WAITLIST_SALT;
  if (!sql || !salt || salt.length < 16) {
    console.error("Waitlist: DATABASE_URL or WAITLIST_SALT is not set.");
    return { status: "unavailable" };
  }

  // Only a keyed hash of the IP address is stored, and only for the hour the
  // limit needs it.
  const list = await headers();
  const ip =
    list.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    list.get("x-real-ip") ||
    "unknown";
  const ipHash = createHmac("sha256", salt).update(ip).digest("hex");

  try {
    const [{ recent }] = await sql<{ recent: number }[]>`
      select count(*)::int as recent from waitlist_attempts
      where ip_hash = ${ipHash} and created_at > now() - interval '1 hour'
    `;
    if (recent >= LIMIT) return { status: "rate_limited" };

    // An address that is already on the list is left as it was, and gets the
    // same answer, so the form never reveals who has signed up.
    await sql`
      with attempt as (
        insert into waitlist_attempts (ip_hash) values (${ipHash})
      ), purge as (
        delete from waitlist_attempts where created_at < now() - interval '1 hour'
      )
      insert into waitlist (email, handle, channel_url, source, consent_version)
      values (${entry.email}, ${entry.handle}, ${entry.channel}, ${entry.source}, ${WAITLIST_CONSENT_VERSION})
      on conflict (email) do nothing
    `;
    return { status: "ok" };
  } catch (error) {
    console.error("Waitlist: save failed.", error instanceof Error ? error.message : error);
    return { status: "unavailable" };
  }
}

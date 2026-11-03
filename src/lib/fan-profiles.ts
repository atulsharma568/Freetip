import { createHmac } from "crypto";
import type { LedgerDb } from "./accrual";
import { xpForTip } from "./fan-levels";
import { planFeatures } from "./plans";

// Fan identity, name only. A fan profile is kept per creator, for creators who switched
// on fan levels or the fan list, for a tip that carries a name. Honest limits (also on the
// privacy page): the same name is one fan, anyone can type someone else's name, a changed
// spelling is a new fan, and an anonymous tip is never counted.
//
// A tip is counted once it is captured (idempotent: the tip order id is the key of
// fan_xp_events, so a repeated webhook counts once) and taken back when Razorpay takes
// the whole payment back. Profiles live 12 months after the last tip (retention.ts),
// until the creator deletes the fan, or until the account is closed.
//
// No site imports and no `server-only`, so the tests run it against an in-memory Postgres.

export const FAN_PROFILE_MONTHS = 12;
export const FAN_NOTE_MAX = 300;

// The name as it is compared: Unicode-normalised, trimmed, one space between words,
// lower case. Empty means there is no name to keep a profile for.
export function normaliseFanName(name: string | null | undefined): string {
  return (name ?? "").normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

// The scrambled code kept instead of the name for matching. It depends on the creator,
// so the same name on two creators' pages cannot be linked. `secret` is the site's salt.
export function fanKey(secret: string, creatorId: number | string, name: string): string {
  return createHmac("sha256", secret).update(`fan\u0000${creatorId}\u0000${normaliseFanName(name)}`).digest("hex");
}

export type FanCountResult =
  | { status: "counted"; xp: number }
  | { status: "already" }
  | { status: "skipped"; reason: "no_such_payment" | "not_captured" | "feature_off" | "no_name" | "no_secret" };

export async function postFanXp(db: LedgerDb, paymentRef: string, secret: string | undefined): Promise<FanCountResult> {
  if (!secret || secret.length < 16) return { status: "skipped", reason: "no_secret" };
  return db.begin(async (tx) => {
    const [tip] = await tx<
      {
        tip_id: string;
        creator_id: string;
        fan_name: string | null;
        anonymous: boolean | null;
        gross: string;
        status: string;
        paid_features: string[] | null;
      }[]
    >`
      select t.id::text as tip_id, t.creator_id::text as creator_id, t.fan_name, t.anonymous,
             t.gross_amount_minor::text as gross, t.status, u.paid_features
        from payment_attempts pa
        join tip_orders t on t.id = pa.tip_order_id
        join users u on u.id = t.creator_id
       where pa.provider_payment_ref = ${paymentRef}
    `;
    if (!tip) return { status: "skipped", reason: "no_such_payment" } as const;
    if (tip.status !== "captured") return { status: "skipped", reason: "not_captured" } as const;

    // The creator's switches, as they are when the tip is captured. Switching on later
    // has no history: only tips from then on are counted.
    const features = planFeatures({ paid_features: tip.paid_features });
    if (!features.fanLevels && !features.fanCrm) return { status: "skipped", reason: "feature_off" } as const;

    const display = tip.anonymous ? "" : (tip.fan_name ?? "").trim().replace(/\s+/g, " ");
    if (!normaliseFanName(display)) return { status: "skipped", reason: "no_name" } as const;

    const key = fanKey(secret, tip.creator_id, display);
    const gross = Number(tip.gross);
    const xp = xpForTip(gross);

    const [event] = await tx<{ tip_order_id: string }[]>`
      insert into fan_xp_events (tip_order_id, creator_id, fan_key, xp, paise)
      values (${tip.tip_id}::bigint, ${tip.creator_id}::bigint, ${key}::text, ${xp}::int, ${gross}::bigint)
      on conflict (tip_order_id) do nothing
      returning tip_order_id::text
    `;
    if (!event) return { status: "already" } as const;

    await tx`
      insert into fan_profiles
        (creator_id, fan_key, display_name, tips, total_paise, xp, first_at, last_at)
      values
        (${tip.creator_id}::bigint, ${key}::text, ${display.slice(0, 50)}::text, 1, ${gross}::bigint,
         ${xp}::bigint, now(), now())
      on conflict (creator_id, fan_key) do update set
        display_name = excluded.display_name,
        tips         = fan_profiles.tips + 1,
        total_paise  = fan_profiles.total_paise + excluded.total_paise,
        xp           = fan_profiles.xp + excluded.xp,
        last_at      = now()
    `;
    return { status: "counted", xp } as const;
  });
}

// Razorpay took the whole payment back: the tip no longer counts. A profile left with no
// tips and no note is removed. A tip that was never counted (feature off, anonymous) is
// left alone.
export async function reverseFanXp(db: LedgerDb, paymentRef: string): Promise<{ reversed: boolean }> {
  return db.begin(async (tx) => {
    const [event] = await tx<{ tip_order_id: string; creator_id: string; fan_key: string; xp: number; paise: string }[]>`
      select e.tip_order_id::text, e.creator_id::text, e.fan_key, e.xp, e.paise::text
        from fan_xp_events e
        join payment_attempts pa on pa.tip_order_id = e.tip_order_id
       where pa.provider_payment_ref = ${paymentRef}
       for update of e
    `;
    if (!event) return { reversed: false };
    await tx`delete from fan_xp_events where tip_order_id = ${event.tip_order_id}::bigint`;
    await tx`
      update fan_profiles
         set tips        = greatest(tips - 1, 0),
             total_paise = greatest(total_paise - ${event.paise}::bigint, 0),
             xp          = greatest(xp - ${event.xp}::bigint, 0)
       where creator_id = ${event.creator_id}::bigint and fan_key = ${event.fan_key}::text
    `;
    await tx`
      delete from fan_profiles
       where creator_id = ${event.creator_id}::bigint and fan_key = ${event.fan_key}::text
         and tips = 0 and note is null
    `;
    return { reversed: true };
  });
}

// The creator deletes one fan: the profile and its counted tips go. Only that creator's own fan.
export async function deleteFan(db: LedgerDb, creatorId: number, key: string): Promise<{ deleted: boolean }> {
  return db.begin(async (tx) => {
    await tx`delete from fan_xp_events where creator_id = ${creatorId}::bigint and fan_key = ${key}::text`;
    const gone = await tx<{ fan_key: string }[]>`
      delete from fan_profiles where creator_id = ${creatorId}::bigint and fan_key = ${key}::text returning fan_key
    `;
    return { deleted: gone.length > 0 };
  });
}

// Closing the account: every profile of this creator.
export async function eraseFans(db: LedgerDb, creatorId: number): Promise<number> {
  return db.begin(async (tx) => {
    await tx`delete from fan_xp_events where creator_id = ${creatorId}::bigint`;
    const gone = await tx<{ fan_key: string }[]>`
      delete from fan_profiles where creator_id = ${creatorId}::bigint returning fan_key
    `;
    return gone.length;
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { fetchChannelBanner } from "@/lib/tip-banner";

export type TipBannerActionResult = { status: "ok"; url: string | null } | { status: "error"; message: string };

async function owner() {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  const db = getDb();
  if (!googleId || !db) return null;
  const [row] = await db<
    { id: number; handle: string | null; yt_channel_id: string | null; paid_features: string[] | null }[]
  >`select id, handle, yt_channel_id, paid_features from users where google_id = ${googleId} and handle is not null`;
  return row ? { db, row } : null;
}

function refresh(handle: string | null) {
  revalidatePath("/dashboard/banner");
  if (handle) revalidatePath(`/${handle}`);
}

// Copies the creator's current YouTube banner. Checked here, not only in the page: the switch,
// then the address through the same rules the tip page applies.
export async function copyYouTubeBanner(): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  if (!hasFeature(ctx.row, "tipBanner")) {
    return { status: "error", message: "The tip page banner is not switched on for your account." };
  }
  const found = await fetchChannelBanner(ctx.row.yt_channel_id);
  if (!found.ok) {
    const message = {
      "not-configured": "Reading your YouTube banner is not set up on this site yet. Please try again later.",
      "no-channel": "We could not find your YouTube channel. Sign out and sign in again with the channel you stream on.",
      "no-banner":
        "Your YouTube channel has no banner yet. Add one in YouTube Studio (Customization, Branding), then press the button again.",
      failed: "Could not reach YouTube just now. Please try again in a minute.",
    }[found.reason];
    return { status: "error", message };
  }
  try {
    await ctx.db`update users set tip_banner_url = ${found.url} where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not save the tip page banner (migration 0048 run?)", err);
    return { status: "error", message: "Could not save your banner, try again shortly" };
  }
  refresh(ctx.row.handle);
  return { status: "ok", url: found.url };
}

// Takes the banner off the tip page. Allowed even if the switch was turned off since.
export async function removeTipBanner(): Promise<TipBannerActionResult> {
  const ctx = await owner();
  if (!ctx) return { status: "error", message: "Sign in again to change your tip page banner." };
  try {
    await ctx.db`update users set tip_banner_url = null where id = ${ctx.row.id}`;
  } catch (err) {
    console.error("Could not remove the tip page banner (migration 0048 run?)", err);
    return { status: "error", message: "Could not remove your banner, try again shortly" };
  }
  refresh(ctx.row.handle);
  return { status: "ok", url: null };
}

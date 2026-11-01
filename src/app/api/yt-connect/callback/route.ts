import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { seal, secretBoxAvailable } from "@/lib/secret-box";
import { SITE_URL } from "@/lib/url";
import { YT_COMMENT_SCOPE, YT_STATE_COOKIE, ytRedirectUri } from "@/lib/yt-connect";

// Step two: Google sends the creator back here with a one-time code. We swap it for a
// refresh token, check the Google account really is the creator's own YouTube channel
// (nobody can link someone else's), and keep the token encrypted.

const back = (query: string) => {
  const res = NextResponse.redirect(`${SITE_URL}/dashboard/timestamps?${query}`);
  res.cookies.set(YT_STATE_COOKIE, "", { path: "/api/yt-connect", maxAge: 0 });
  return res;
};

export async function GET(request: Request) {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.redirect(`${SITE_URL}/signin`);

  const params = new URL(request.url).searchParams;
  const cookie = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${YT_STATE_COOKIE}=`))?.split("=")[1];
  const state = params.get("state");
  if (params.get("error")) return back("yt=declined");
  if (!cookie || !state || cookie !== state) return back("yt=failed");
  const code = params.get("code");
  if (!code) return back("yt=failed");

  const db = getDb();
  if (!db || !secretBoxAvailable()) return back("yt=unavailable");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.AUTH_GOOGLE_ID ?? "",
        client_secret: process.env.AUTH_GOOGLE_SECRET ?? "",
        redirect_uri: ytRedirectUri(),
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const token = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };
    if (!tokenRes.ok || !token.access_token || !token.refresh_token) return back("yt=failed");
    if (!(token.scope ?? "").split(" ").includes(YT_COMMENT_SCOPE)) return back("yt=declined");

    // Whose channel is this?
    const chRes = await fetch("https://www.googleapis.com/youtube/v3/channels?part=id&mine=true", {
      headers: { Authorization: `Bearer ${token.access_token}` },
      signal: AbortSignal.timeout(12_000),
    });
    const channelId = ((await chRes.json().catch(() => ({}))) as { items?: { id?: string }[] }).items?.[0]?.id;

    const [user] = await db<{ id: string; yt_channel_id: string | null }[]>`
      select id::text, yt_channel_id from users where google_id = ${googleId}
    `;
    if (!user?.yt_channel_id || !channelId || channelId !== user.yt_channel_id) return back("yt=wrong_channel");

    await db`
      update users
         set yt_refresh_token_enc = ${seal(token.refresh_token)}, yt_connected_at = now(), yt_reconnect_needed = false
       where id = ${user.id}
    `;
    return back("yt=connected");
  } catch (err) {
    console.error("YouTube connect failed (migration 0032 run?).", err);
    return back("yt=failed");
  }
}

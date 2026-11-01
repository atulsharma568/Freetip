import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { secretBoxAvailable } from "@/lib/secret-box";
import { SITE_URL } from "@/lib/url";
import { youtubeConfigured } from "@/lib/youtube";
import { YT_COMMENT_SCOPE, YT_STATE_COOKIE, ytRedirectUri } from "@/lib/yt-connect";

// Step one of "Connect YouTube for timestamps": a separate, opt-in Google consent for
// the one permission that lets us post the timestamps comment on the creator's own
// stream. It is not part of normal sign-in, so only creators who want the feature grant it.

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(`${SITE_URL}/signin`);
  if (!youtubeConfigured() || !secretBoxAvailable()) {
    return NextResponse.redirect(`${SITE_URL}/dashboard/timestamps?yt=unavailable`);
  }

  const state = randomBytes(24).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.AUTH_GOOGLE_ID ?? "");
  url.searchParams.set("redirect_uri", ytRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YT_COMMENT_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set(YT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/yt-connect",
    maxAge: 600,
  });
  return res;
}

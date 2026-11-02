import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getSessionFeatures } from "@/lib/creator-features";
import {
  STREAMLABS_AUTHORIZE_URL,
  STREAMLABS_SCOPE,
  STREAMLABS_STATE_COOKIE,
  streamlabsConfigured,
  streamlabsRedirectUri,
} from "@/lib/streamlabs";
import { SITE_URL } from "@/lib/url";

// Step one of "Connect Streamlabs": sends the creator to Streamlabs to allow showing
// alerts in their own alert box. A random state is kept in a cookie and checked on the way
// back, so nobody can be tricked into linking someone else's Streamlabs account.

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.redirect(`${SITE_URL}/signin`);
  if (!(await getSessionFeatures()).streamlabs) return NextResponse.redirect(`${SITE_URL}/dashboard`);
  if (!streamlabsConfigured()) return NextResponse.redirect(`${SITE_URL}/dashboard/streamlabs?sl=unavailable`);

  const state = randomBytes(24).toString("base64url");
  const url = new URL(STREAMLABS_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.STREAMLABS_CLIENT_ID ?? "");
  url.searchParams.set("redirect_uri", streamlabsRedirectUri());
  url.searchParams.set("scope", STREAMLABS_SCOPE);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url);
  res.cookies.set(STREAMLABS_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/streamlabs",
    maxAge: 600,
  });
  return res;
}

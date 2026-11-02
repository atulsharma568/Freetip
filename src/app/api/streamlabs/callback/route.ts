import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { LedgerDb } from "@/lib/accrual";
import { getSessionFeatures } from "@/lib/creator-features";
import { getDb } from "@/lib/db";
import { STREAMLABS_STATE_COOKIE, exchangeCode, fetchDisplayName, streamlabsConfigured } from "@/lib/streamlabs";
import { saveStreamlabsConnection } from "@/lib/streamlabs-outbox";
import { SITE_URL } from "@/lib/url";

// Step two: Streamlabs sends the creator back here with a one-time code (valid for five
// minutes). We check the state, swap the code for tokens and keep them sealed. Only the
// signed-in creator's own row is written.

const back = (query: string) => {
  const res = NextResponse.redirect(`${SITE_URL}/dashboard/streamlabs?${query}`);
  res.cookies.set(STREAMLABS_STATE_COOKIE, "", { path: "/api/streamlabs", maxAge: 0 });
  return res;
};

export async function GET(request: Request) {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.redirect(`${SITE_URL}/signin`);

  if (!(await getSessionFeatures()).streamlabs) return back("sl=unavailable");

  const params = new URL(request.url).searchParams;
  const cookie = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith(`${STREAMLABS_STATE_COOKIE}=`))?.split("=")[1];
  const state = params.get("state");
  if (params.get("error")) return back("sl=declined");
  if (!cookie || !state || cookie !== state) return back("sl=failed");
  const code = params.get("code");
  if (!code) return back("sl=failed");

  const sql = getDb();
  if (!sql || !streamlabsConfigured()) return back("sl=unavailable");

  try {
    const exchanged = await exchangeCode(code);
    if (exchanged.status !== "ok") return back("sl=failed");

    const [user] = await sql<{ id: string }[]>`select id::text from users where google_id = ${googleId}`;
    if (!user) return back("sl=failed");

    const name = await fetchDisplayName(exchanged.tokens.accessToken);
    await saveStreamlabsConnection(sql as unknown as LedgerDb, Number(user.id), exchanged.tokens, name);
    return back("sl=connected");
  } catch (err) {
    console.error("Streamlabs connect failed (migration 0041 run?)", err);
    return back("sl=failed");
  }
}

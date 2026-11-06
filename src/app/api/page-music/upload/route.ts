import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isOwnerTipPage } from "@/lib/owner-page";
import { MUSIC_MAX_BYTES, MUSIC_TYPES, musicPathPrefix } from "@/lib/page-music";

// Issues a short-lived token so the owner's browser can send one music file straight to Vercel Blob
// (a function would cap the body at 4.5 MB). Owner's own page only; audio types only; up to 12 MB;
// only under the owner's own folder. Nothing is saved to the database here: savePageMusic does that
// after the upload, so this does not depend on a callback.
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const db = getDb();
  if (!db || !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads are not set up yet." }, { status: 503 });
  }
  const [creator] = await db<{ id: number; handle: string }[]>`
    select id, handle from users where google_id = ${googleId} and handle is not null
  `;
  if (!creator || !isOwnerTipPage(creator.handle, googleId)) {
    return NextResponse.json({ error: "Not available for this account." }, { status: 403 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(musicPathPrefix(creator.id)) || pathname.includes("..")) {
          throw new Error("Wrong upload folder");
        }
        return { allowedContentTypes: [...MUSIC_TYPES], maximumSizeInBytes: MUSIC_MAX_BYTES, addRandomSuffix: true };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Music upload token failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 400 });
  }
}

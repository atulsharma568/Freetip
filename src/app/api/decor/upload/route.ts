import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { isOwnerTipPage } from "@/lib/owner-page";
import { DECOR_POSTER_MAX_BYTES, DECOR_UPLOAD_MAX_BYTES, decorPathPrefix, mayPickTipDecor } from "@/lib/page-doc/decor";

// Issues a short-lived token so the browser can send a profile picture, a frame (or the still of
// one) straight to Vercel Blob. The token only allows picture types, only under the signed-in creator's
// own decor folder, only for a name that says what the file is for (avatar, frame or poster), and only
// while the creator may use photo and banner effects. Nothing is saved to the database here: the
// saveDecorUpload action checks the file again and records it once the upload is done.
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const db = getDb();
  if (!db || !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads are not set up yet." }, { status: 503 });
  }

  const [creator] = await db<{ id: number; handle: string; paid_features: string[] | null }[]>`
    select id, handle, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  if (!creator) return NextResponse.json({ error: "Claim your handle first." }, { status: 403 });
  if (!mayPickTipDecor(isOwnerTipPage(creator.handle, googleId), creator)) {
    return NextResponse.json({ error: "Photo and banner effects are not switched on for your account." }, { status: 403 });
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
        const prefix = decorPathPrefix(Number(creator.id));
        if (!pathname.startsWith(prefix) || pathname.includes("..")) throw new Error("Wrong upload folder");
        const name = pathname.slice(prefix.length);
        // The browser names a file after what it is for ("avatar.png"); the store adds a random suffix.
        const kind = /^(avatar|frame|poster)\.[a-z]{3,4}$/.exec(name)?.[1];
        if (!kind) throw new Error("Wrong file name");
        const poster = kind === "poster";
        return {
          allowedContentTypes: poster ? ["image/png", "image/webp"] : ["image/gif", "image/png", "image/jpeg", "image/webp"],
          maximumSizeInBytes: poster ? DECOR_POSTER_MAX_BYTES : DECOR_UPLOAD_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Decor upload token failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 400 });
  }
}

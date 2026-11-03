import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import { BANNER_MAX_BYTES, BANNER_UPLOAD_TYPES, bannerPathPrefix } from "@/lib/tip-banner";

// Issues a short-lived token so the browser can send a tip page banner (a picture, an animated
// GIF or WebP) straight to Vercel Blob. The token only allows those image types, only up to
// 3 MB, only under the signed-in creator's own banner folder and only while the paid switch is
// on for them. Nothing is saved to the database here: the saveUploadedBanner action checks the
// file again and records it once the upload is done.
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const db = getDb();
  if (!db || !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads are not set up yet." }, { status: 503 });
  }

  const [creator] = await db<{ id: number; paid_features: string[] | null }[]>`
    select id, paid_features from users where google_id = ${googleId} and handle is not null
  `;
  if (!creator) return NextResponse.json({ error: "Claim your handle first." }, { status: 403 });
  if (!hasFeature(creator, "tipBanner")) {
    return NextResponse.json({ error: "The tip page banner is not switched on for your account." }, { status: 403 });
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
        if (!pathname.startsWith(bannerPathPrefix(Number(creator.id))) || pathname.includes("..")) {
          throw new Error("Wrong upload folder");
        }
        return {
          allowedContentTypes: [...BANNER_UPLOAD_TYPES],
          maximumSizeInBytes: BANNER_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Banner upload token failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 400 });
  }
}

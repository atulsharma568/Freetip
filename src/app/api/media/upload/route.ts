import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { hasFeature } from "@/lib/plans";
import {
  ALL_MEDIA_CONTENT_TYPES,
  MAX_MEDIA_PER_CREATOR,
  MEDIA_WEBM_MAX_BYTES,
  mediaPathPrefix,
} from "@/lib/media";

// Issues a short-lived token so the browser can send a GIF, picture or WebM straight
// to Vercel Blob (a function would cap the body at 4.5 MB). The token only allows
// those types, only up to 8 MB and only under the signed-in creator's own folder, and
// only while the paid switch is on for them. Nothing is saved to the database here:
// the file is checked again and recorded by the addMedia action once the upload is
// done, so this does not depend on a callback.
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const db = getDb();
  if (!db || !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Media uploads are not set up yet." }, { status: 503 });
  }

  const [creator] = await db<{ id: number; paid_features: string[] | null; files: number }[]>`
    select u.id, u.paid_features,
           (select count(*)::int from creator_media m
             where m.creator_id = u.id and m.review_state <> 'removed') as files
    from users u
    where u.google_id = ${googleId} and u.handle is not null
  `;
  if (!creator) return NextResponse.json({ error: "Claim your handle first." }, { status: 403 });
  if (!hasFeature(creator, "customAlertMedia")) {
    return NextResponse.json({ error: "Custom alert media is not switched on for your account." }, { status: 403 });
  }
  if (creator.files >= MAX_MEDIA_PER_CREATOR) {
    return NextResponse.json({ error: `You can keep up to ${MAX_MEDIA_PER_CREATOR} files.` }, { status: 400 });
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
        if (!pathname.startsWith(mediaPathPrefix(Number(creator.id))) || pathname.includes("..")) {
          throw new Error("Wrong upload folder");
        }
        return {
          allowedContentTypes: ALL_MEDIA_CONTENT_TYPES,
          maximumSizeInBytes: MEDIA_WEBM_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Media upload token failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 400 });
  }
}

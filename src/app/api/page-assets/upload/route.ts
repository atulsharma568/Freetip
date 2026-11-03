import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getDb } from "@/lib/db";
import { getOwnerAccess } from "@/lib/owner-auth";
import { hasFeature } from "@/lib/plans";
import { ASSET_LIMITS } from "@/lib/page-doc/assets";
import { ALL_MEDIA_CONTENT_TYPES, MEDIA_WEBM_MAX_BYTES } from "@/lib/media";

// Issues a short-lived token so the owner's browser can send a picture, GIF or WebM (and the still
// picture of its first frame) straight to Vercel Blob (a function would cap the body at 4.5 MB).
// Owner only. The token allows only those types, only up to 8 MB, and only under
// `page/<creator id>/` for a creator who exists and has the "Custom tip page" switch on. Nothing is
// saved to the database here: the addPageAsset action checks the file again from its first bytes
// and records it, so this does not depend on a callback.
const PATH = /^page\/(\d{1,10})\/[^/]+$/;

export async function POST(request: Request): Promise<Response> {
  const access = await getOwnerAccess();
  if (access === "unauthenticated") return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (access !== "authorized") return NextResponse.json({ error: "Not allowed." }, { status: 403 });

  const db = getDb();
  if (!db || !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Uploads are not set up yet." }, { status: 503 });
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
        const match = PATH.exec(pathname);
        if (!match || pathname.includes("..")) throw new Error("Wrong upload folder");
        const creatorId = Number(match[1]);
        if (!Number.isSafeInteger(creatorId) || creatorId < 1 || creatorId > 2147483647) throw new Error("Wrong upload folder");
        const [creator] = await db<{ paid_features: string[] | null; files: number }[]>`
          select u.paid_features,
                 (select count(*)::int from page_assets a where a.creator_id = u.id and a.review_state = 'approved') as files
          from users u where u.id = ${creatorId}
        `;
        if (!creator) throw new Error("No such creator");
        if (!hasFeature(creator, "pageBuilder")) throw new Error("The custom tip page is not switched on for this creator");
        if (creator.files >= ASSET_LIMITS.files) throw new Error("This page already has the most files it can keep");
        return {
          allowedContentTypes: ALL_MEDIA_CONTENT_TYPES,
          maximumSizeInBytes: MEDIA_WEBM_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Page asset upload token failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 400 });
  }
}

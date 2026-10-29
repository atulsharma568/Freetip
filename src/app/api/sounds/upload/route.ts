import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import {
  MAX_SOUNDS_PER_CREATOR,
  SOUND_MAX_BYTES,
  soundPathPrefix,
} from "@/lib/sounds";

// Issues a short-lived token so the browser can send the repaired WAV straight to
// Vercel Blob (a function would cap the body at 4.5 MB). The token only allows
// WAV, only up to 8 MB and only under the signed-in creator's own folder. Nothing
// is saved to the database here: the file is checked again and recorded by the
// addSound action once the upload is done, so this does not depend on a callback.
export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  const googleId = (session?.user as { googleId?: string } | undefined)?.googleId;
  if (!googleId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const db = getDb();
  if (!db || !process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Sound uploads are not set up yet." }, { status: 503 });
  }

  const [creator] = await db<{ id: number; sounds: number }[]>`
    select u.id, (select count(*)::int from creator_sounds s where s.creator_id = u.id) as sounds
    from users u
    where u.google_id = ${googleId} and u.handle is not null
  `;
  if (!creator) return NextResponse.json({ error: "Claim your handle first." }, { status: 403 });
  if (creator.sounds >= MAX_SOUNDS_PER_CREATOR) {
    return NextResponse.json({ error: `You can keep up to ${MAX_SOUNDS_PER_CREATOR} sounds.` }, { status: 400 });
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
        if (!pathname.startsWith(soundPathPrefix(creator.id)) || pathname.includes("..")) {
          throw new Error("Wrong upload folder");
        }
        return {
          allowedContentTypes: ["audio/wav", "audio/x-wav", "audio/wave"],
          maximumSizeInBytes: SOUND_MAX_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    console.error("Sound upload token failed", err);
    return NextResponse.json({ error: "Could not start the upload." }, { status: 400 });
  }
}

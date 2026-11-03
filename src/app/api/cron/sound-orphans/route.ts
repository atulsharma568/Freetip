import { timingSafeEqual } from "crypto";
import { del, list } from "@vercel/blob";
import { getDb } from "@/lib/db";

// Daily clean-up, run by Vercel Cron (see vercel.json). A creator's browser
// uploads a file to Blob first and the site saves it afterwards, so a closed tab
// or a failed save leaves a file nothing points to. This deletes files under
// sounds/ that no creator_sounds row uses, under media/ that no creator_media
// row uses and under page/ that no live page_assets row uses (a taken-down file whose delete failed is
// cleaned here), that are over a day old (so an upload still being saved is never
// touched). Vercel sends CRON_SECRET as a
// bearer token.
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("Unauthorized", { status: 401 });

  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const match =
    provided.length === expected.length &&
    timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!match) return new Response("Unauthorized", { status: 401 });

  const sql = getDb();
  if (!sql || !process.env.BLOB_READ_WRITE_TOKEN) return new Response("Not set up", { status: 503 });

  // `page/` holds the tip page pictures and their stills; both addresses of a row are in use.
  const folders: { prefix: string; table: "creator_sounds" | "creator_media" | "page_assets" }[] = [
    { prefix: "sounds/", table: "creator_sounds" },
    { prefix: "media/", table: "creator_media" },
    { prefix: "page/", table: "page_assets" },
  ];
  let removed = 0;
  const skipped: string[] = [];
  for (const { prefix, table } of folders) {
    let used: Set<string>;
    try {
      const rows =
        table === "page_assets"
          ? await sql<{ blob_url: string }[]>`
              select blob_url from page_assets where review_state = 'approved'
              union select poster_url from page_assets where review_state = 'approved' and poster_url is not null`
          : await sql<{ blob_url: string }[]>`select blob_url from ${sql(table)}`;
      used = new Set(rows.map((r) => r.blob_url));
    } catch {
      // The table (migration 0013, 0036 or 0052) is missing: nothing to compare with, delete nothing there.
      skipped.push(table);
      continue;
    }

    const stale: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, cursor, limit: 1000 });
      for (const blob of page.blobs) {
        if (!used.has(blob.url) && Date.now() - blob.uploadedAt.getTime() > MIN_AGE_MS) stale.push(blob.url);
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);

    for (let i = 0; i < stale.length; i += 100) await del(stale.slice(i, i + 100));
    removed += stale.length;
  }
  return new Response(`OK (${removed} removed${skipped.length ? `, no table: ${skipped.join(", ")}` : ""})`);
}

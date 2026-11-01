import sharp from "sharp";
import { accentFromPixels } from "@/lib/accent";

const MAX_BYTES = 2_000_000;

// Google profile pictures only: the address comes from our own database, but it
// is still checked before the server fetches it.
function allowedPictureUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && (u.hostname === "googleusercontent.com" || u.hostname.endsWith(".googleusercontent.com"));
  } catch {
    return false;
  }
}

// The picture's dominant colour, pulled into a readable band, or null when there
// is no picture, it cannot be fetched or it has no clear colour.
export async function accentFromPicture(url: string | null): Promise<string | null> {
  if (!url || !allowedPictureUrl(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), redirect: "error" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) return null;
    const raw = await sharp(buf).resize(32, 32, { fit: "cover" }).removeAlpha().raw().toBuffer();
    return accentFromPixels(raw);
  } catch {
    return null;
  }
}

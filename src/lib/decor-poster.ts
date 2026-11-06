import { isAnimatedWebp } from "@/lib/page-doc/decor";

// Browser only. Whether the first bytes of a file are an animation (a GIF, or a WebP whose header says
// it is animated), so the page knows to make a still of it for visitors who ask for less motion.
export function looksAnimated(head: Uint8Array): boolean {
  const gif = head.length >= 6 && String.fromCharCode(...head.slice(0, 3)) === "GIF";
  return gif || isAnimatedWebp(head);
}

// A still of the first frame of a picture, GIF or WebP, small enough to be a poster (at most 512 px on
// its longer side). Keeps see-through pixels (WebP, or PNG where WebP is not supported). Null when the
// browser cannot decode it; the picture then plays regardless.
export async function makePoster(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob && blob.size > 0 && blob.size <= 300 * 1024 ? blob : null;
  } catch {
    return null;
  }
}

import { isAnimatedPicture } from "./page-doc/assets";
import { checkPicture, UPLOAD_RULES, type CheckedPicture, type UploadRuleKind } from "./upload-rules";

// Browser only. A picture that is big enough but the wrong shape (too tall or too wide) or too large
// is trimmed from the middle and shrunk to fit the rule, instead of being refused. It never makes a
// small picture bigger, and it leaves animations alone (re-drawing would stop the movement).

export type FitResult =
  | { ok: true; file: File; bytes: Uint8Array; picture: CheckedPicture; note: string | null }
  | { ok: false; reason: string };

async function draw(file: File, kind: UploadRuleKind): Promise<File | null> {
  const r = UPLOAD_RULES[kind];
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  let sw = bitmap.width;
  let sh = bitmap.height;
  let sx = 0;
  let sy = 0;
  // Trim the long side from the middle, aiming just inside the allowed shape.
  const hi = r.ratio[1] * 0.99;
  const lo = r.ratio[0] * 1.01;
  const ratio = sw / sh;
  if (ratio > r.ratio[1]) {
    sw = Math.floor(sh * hi);
    sx = Math.floor((bitmap.width - sw) / 2);
  } else if (ratio < r.ratio[0]) {
    sh = Math.floor(sw / lo);
    sy = Math.floor((bitmap.height - sh) / 2);
  }
  // Shrink (never enlarge) to the longest side allowed.
  const scale = Math.min(1, r.maxSide / Math.max(sw, sh));
  const dw = Math.max(1, Math.floor(sw * scale));
  const dh = Math.max(1, Math.floor(sh * scale));
  if (dw < r.minWidth || dh < r.minHeight) return null;
  const canvas = document.createElement("canvas");
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, dw, dh);
  bitmap.close?.();
  const type = file.type === "image/jpeg" ? "image/jpeg" : "image/webp";
  for (const q of [0.92, 0.82, 0.7, 0.55]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));
    if (blob && blob.size <= r.maxBytes) {
      const ext = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp";
      return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: blob.type });
    }
  }
  return null;
}

// Checks the file; when it fails only because of its shape or size, tries to fit it and checks again.
export async function checkOrFitPicture(kind: UploadRuleKind, file: File): Promise<FitResult> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const first = checkPicture(kind, bytes, file.size);
  if (first.ok) return { ok: true, file, bytes, picture: first.picture, note: null };
  if (kind === "decorFrame") return first;
  if (!/pixels|MB|large|big/i.test(first.reason)) return first;
  if (file.type === "image/gif" || isAnimatedPicture(bytes)) return first;
  const fitted = await draw(file, kind);
  if (!fitted) return first;
  const fittedBytes = new Uint8Array(await fitted.arrayBuffer());
  const second = checkPicture(kind, fittedBytes, fitted.size);
  if (!second.ok || second.picture.animated) return first;
  return { ok: true, file: fitted, bytes: fittedBytes, picture: second.picture, note: "Your picture was trimmed and shrunk from the middle to fit." };
}

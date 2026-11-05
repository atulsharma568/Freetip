import { ASSET_LIMITS, checkAssetFile, needsPoster, type AssetKind } from "@/lib/page-doc/assets";

// Everything the owner's browser does to a file before it is sent: look at its first bytes (the
// same rule the server applies again), measure it, and for a GIF or a video draw the still picture
// of its first frame. A file that fails here is never uploaded. Browser only (images, video and
// canvas); the rules themselves are the pure ones in assets.ts.

export interface PreparedFile {
  kind: AssetKind;
  mime: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  // The first frame as a small picture; null for a still image, which needs none.
  poster: Blob | null;
}

export type Prepared = { ok: true; file: PreparedFile } | { ok: false; reason: string };

const refuse = (reason: string): Prepared => ({ ok: false, reason });
const TIMEOUT_MS = 15_000;

function waitFor(target: EventTarget, done: string, fail = "error"): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS);
    target.addEventListener(
      done,
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    target.addEventListener(
      fail,
      () => {
        clearTimeout(timer);
        reject(new Error(fail));
      },
      { once: true },
    );
  });
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await waitFor(img, "load");
  return img;
}

async function loadVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  await waitFor(video, "loadeddata");
  return video;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

// Draws a source at most 1280 px wide and tries WebP (then JPEG, for browsers that cannot write
// WebP) at falling quality and size until it is under the poster cap.
async function drawPoster(source: CanvasImageSource, width: number, height: number): Promise<Blob | null> {
  let scale = Math.min(1, ASSET_LIMITS.posterWidth / width);
  for (let shrink = 0; shrink < 4; shrink++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    for (const type of ["image/webp", "image/jpeg"]) {
      for (const quality of [0.8, 0.65, 0.5, 0.35]) {
        const blob = await toBlob(canvas, type, quality);
        if (blob && blob.type === type && blob.size <= ASSET_LIMITS.posterBytes) return blob;
        if (blob && blob.type !== type) break; // the browser wrote another type: this one is not supported
      }
    }
    scale *= 0.7;
  }
  return null;
}

export async function prepareFile(file: File): Promise<Prepared> {
  const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const checked = checkAssetFile(head, file.size);
  if (!checked.ok) return refuse(checked.reason);
  let { sniffed } = checked;
  // A picture is read whole, because its size (a JPEG or WebP) and whether it is animated (a WebP
  // or PNG) are only in the body. The server checks the same again.
  if (sniffed.kind !== "webm") {
    const whole = checkAssetFile(new Uint8Array(await file.arrayBuffer()), file.size);
    if (!whole.ok) return refuse(whole.reason);
    sniffed = whole.sniffed;
  }

  const url = URL.createObjectURL(file);
  try {
    if (sniffed.kind === "webm") {
      let video: HTMLVideoElement;
      try {
        video = await loadVideo(url);
      } catch {
        return refuse("This browser could not read the video. Try another file, or another browser.");
      }
      const seconds = video.duration;
      if (!Number.isFinite(seconds) || seconds <= 0) return refuse("The length of the video could not be read.");
      if (seconds * 1000 > ASSET_LIMITS.webmMs) return refuse(`A video can be at most ${ASSET_LIMITS.webmMs / 1000} seconds. This one is ${Math.round(seconds)}.`);
      const { videoWidth: width, videoHeight: height } = video;
      if (!width || !height || width > ASSET_LIMITS.side || height > ASSET_LIMITS.side) return refuse(`The video must be at most ${ASSET_LIMITS.side} pixels on each side.`);
      try {
        video.currentTime = Math.min(0.1, seconds / 2);
        await waitFor(video, "seeked");
      } catch {
        return refuse("This browser could not take the first frame of the video.");
      }
      const poster = await drawPoster(video, width, height);
      if (!poster) return refuse("The first frame could not be made small enough. Try a smaller video.");
      return { ok: true, file: { kind: "webm", mime: sniffed.mime, width, height, durationMs: Math.max(1, Math.round(seconds * 1000)), poster } };
    }

    let img: HTMLImageElement;
    try {
      img = await loadImage(url);
    } catch {
      return refuse("This browser could not read the picture.");
    }
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    if (!width || !height || width > ASSET_LIMITS.side || height > ASSET_LIMITS.side) return refuse(`The picture must be at most ${ASSET_LIMITS.side} pixels on each side.`);
    let poster: Blob | null = null;
    if (needsPoster(sniffed.kind)) {
      poster = await drawPoster(img, width, height);
      if (!poster) return refuse("The first frame could not be made small enough. Try a smaller or shorter animation.");
    }
    return { ok: true, file: { kind: sniffed.kind, mime: sniffed.mime, width, height, durationMs: null, poster } };
  } finally {
    URL.revokeObjectURL(url);
  }
}

import { hasFeature, type FeatureSource } from "../plans";
import { BLOB_HOST_SUFFIX } from "../media";
import type { PageDoc } from "./types";

// The animated frame over a creator's photo and the effect over their banner (the way Discord's
// avatar decorations and profile effects work): a choice from a short list of ready-made looks that
// are drawn in CSS (so no file is loaded and they follow the page accent) or are a finished animation
// that ships with the site, or "custom", a picture or GIF the owner uploaded to the page's library. Pure, so the parser, the editor and the tests share it.

// Square animated pictures that are profile pictures, not banners: they play in the photo's own
// place, cut round, like an animated avatar. Same ids and files as before, moved out of the banner list.
export const AVATAR_PIC_IDS = ["peakyblinders", "applekitty", "explosivecat", "killua", "angel", "nanami", "naoya"] as const;
export type AvatarPicId = (typeof AVATAR_PIC_IDS)[number];

// Three separate things on the header: the profile picture (the creator's own photo, or one of these
// animated pictures in its place), the frame drawn over it, and the effect over the banner.
export const AVATAR_STYLES = ["none", ...AVATAR_PIC_IDS] as const;
export type AvatarStyle = (typeof AVATAR_STYLES)[number];
export const isAvatarStyle = (v: unknown): v is AvatarStyle => typeof v === "string" && (AVATAR_STYLES as readonly string[]).includes(v);

export const FRAME_STYLES = ["none", "widow", "custom"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

// The ready-made animations that ship with the site, one file each (see FILE_FX below). Listed here
// so the stored value can be checked; the ids are the file names without the extension.
export const FILE_FX_IDS = ["sakura", "sololeveling", "toney", "eternal", "fkimgworkkk"] as const;

const FILE_INFO: Record<AvatarPicId | (typeof FILE_FX_IDS)[number], { label: string; file: string; still?: boolean }> = {
  peakyblinders: { label: "Peaky Blinders", file: "peaky-blinders" },
  sakura: { label: "Sakura", file: "sakura" },
  sololeveling: { label: "Solo Leveling", file: "solo-leveling" },
  applekitty: { label: "Apple kitty", file: "apple-kitty" },
  toney: { label: "Toney", file: "toney" },
  eternal: { label: "Eternal", file: "eternal" },
  fkimgworkkk: { label: "Fkimgworkkk", file: "fkimgworkkk" },
  explosivecat: { label: "Explosive cat", file: "explosive-cat" },
  killua: { label: "Killua", file: "killua" },
  angel: { label: "Angel", file: "angel", still: true },
  nanami: { label: "Nanami", file: "nanami" },
  naoya: { label: "Naoya", file: "naoya" },
};
export const FILE_FX_INFO: Record<(typeof FILE_FX_IDS)[number], { label: string; file: string; still?: boolean }> = FILE_INFO;
export const AVATAR_PIC_INFO: Record<AvatarPicId, { label: string; file: string; still?: boolean }> = FILE_INFO;
export const BANNER_FX = ["none", "embers", "clutch", "petals", "snow", "stars", ...FILE_FX_IDS, "custom"] as const;
export type BannerFx = (typeof BANNER_FX)[number];

export const FRAME_OPTIONS: { value: FrameStyle; label: string }[] = [
  { value: "none", label: "No frame" },
  { value: "widow", label: "Black Widow (a spider walks the rim of the photo, small ones crawl over it)" },
  { value: "custom", label: "Your own picture or GIF" },
];

export const AVATAR_OPTIONS: { value: AvatarStyle; label: string }[] = [
  { value: "none", label: "Your own photo" },
  ...AVATAR_PIC_IDS.map((id) => ({ value: id, label: `${AVATAR_PIC_INFO[id].label} (animated profile picture)` })),
];

export const BANNER_FX_OPTIONS: { value: BannerFx; label: string }[] = [
  { value: "none", label: "No effect" },
  { value: "embers", label: "Rising embers" },
  { value: "clutch", label: "Clutch pulse (heartbeat and crosshair lock-on)" },
  { value: "petals", label: "Falling petals" },
  { value: "snow", label: "Soft snow" },
  { value: "stars", label: "Twinkling stars" },
  ...FILE_FX_IDS.map((id) => ({ value: id, label: `${FILE_FX_INFO[id].label} (animated picture)` })),
  { value: "custom", label: "Your own picture or GIF" },
];

// Frames that are a finished animation shipped with the site (drawn once by tools/decor-render and
// saved as an animated WebP with a still of its first frame), not drawn in CSS. `scale` is the size
// as a percent of the photo's ring, the same number as the `frameScale` setting of an uploaded frame.
// `round` cuts the picture to a circle (the animated profile pictures, which are opaque squares at the photo's own size).
export const FILE_FRAMES: Record<"widow", { url: string; posterUrl: string; scale: number; round?: boolean; animated: boolean }> = {
  widow: { url: "/decorations/black-widow.webp", posterUrl: "/decorations/black-widow.poster.webp", scale: 220, animated: true },
};
export type FileFrame = keyof typeof FILE_FRAMES;
export const isFileFrame = (v: string): v is FileFrame => Object.hasOwn(FILE_FRAMES, v);

// The animated profile pictures: opaque squares cut round that play in the photo's own place.
export const AVATAR_PICS: Record<AvatarPicId, { url: string; posterUrl: string; animated: boolean }> = Object.fromEntries(
  AVATAR_PIC_IDS.map((id) => {
    const i = AVATAR_PIC_INFO[id];
    return [id, { url: `/decorations/${i.file}.webp`, posterUrl: `/decorations/${i.file}.poster.webp`, animated: !i.still }];
  }),
) as Record<AvatarPicId, { url: string; posterUrl: string; animated: boolean }>;
export const isAvatarPic = (v: string): v is AvatarPicId => Object.hasOwn(AVATAR_PICS, v);

// Before the profile picture had its own setting, an animated one was stored as the frame. Read it
// back as a profile picture so a saved page keeps its look.
export function splitLegacyFrame(frame: unknown, avatar: unknown): { frame: unknown; avatar: unknown } {
  if (avatar === undefined && isAvatarStyle(frame) && frame !== "none") return { frame: "none", avatar: frame };
  return { frame, avatar };
}

// Effects that are a finished animation too: ready-made animated pictures (the files in
// public/decorations, converted to animated WebP by tools/decor-render/import-gifs.mjs, each with a
// still of its first frame). They are opaque pictures, so they play over the banner strip, cut to
// fit; `wholeHeader` is for a see-through animation made for the whole header (none ships now).
// They are third-party clips the owner chose to ship; see docs/avatar-decorations-plan.md.
export const FILE_FX: Record<
  (typeof FILE_FX_IDS)[number],
  { url: string; posterUrl: string; animated: boolean; wholeHeader: boolean }
> = Object.fromEntries(
  FILE_FX_IDS.map((id) => {
    const i = FILE_FX_INFO[id];
    return [id, { url: `/decorations/${i.file}.webp`, posterUrl: `/decorations/${i.file}.poster.webp`, animated: !i.still, wholeHeader: false }];
  }),
) as Record<(typeof FILE_FX_IDS)[number], { url: string; posterUrl: string; animated: boolean; wholeHeader: boolean }>;
export type FileFx = keyof typeof FILE_FX;
export const isFileFx = (v: string): v is FileFx => Object.hasOwn(FILE_FX, v);

// How big a picture or animation frame is drawn, as a percent of the photo (100 is the photo's own
// size; the ready-made rings are about 134). Standard is the size custom frames always had.
export const FRAME_SCALE = { min: 100, max: 220, step: 4, standard: 144 } as const;

// Where a picture or animation effect plays: only over the banner strip, or over the whole header
// (banner, photo, name and bio), the way a Discord profile effect covers the card.
export const FX_AREAS = ["banner", "header"] as const;
export type FxArea = (typeof FX_AREAS)[number];
export const FX_AREA_OPTIONS: { value: FxArea; label: string }[] = [
  { value: "banner", label: "Over the banner only" },
  { value: "header", label: "Over the whole header (banner, photo, name)" },
];
export const isFxArea = (v: unknown): v is FxArea => typeof v === "string" && (FX_AREAS as readonly string[]).includes(v);

export const isFrameStyle = (v: unknown): v is FrameStyle => typeof v === "string" && (FRAME_STYLES as readonly string[]).includes(v);
export const isBannerFx = (v: unknown): v is BannerFx => typeof v === "string" && (BANNER_FX as readonly string[]).includes(v);

// How many little lights a ready-made effect draws. Fixed counts and fixed positions (computed from
// the index, never random), so the server's page and the browser's first draw agree.
export const EMBER_COUNT = 14;
export const PETAL_COUNT = 12;
export const SNOW_COUNT = 16;
export const STAR_COUNT = 14;

// A number between 0 and 1 that is always the same for the same index and salt.
export function steady(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

// The effects drawn in CSS over a banner, and the ready-made animated banner pictures. They are two
// separate layers on a creator's page: a picture (or the creator's own banner) is the background and
// an effect plays on top of it, so the two can be saved together.
export const PRESET_EFFECTS = ["none", "embers", "clutch", "petals", "snow", "stars"] as const;
export type PresetEffect = (typeof PRESET_EFFECTS)[number];
export const BANNER_PICS = ["none", ...FILE_FX_IDS] as const;
export type BannerPic = (typeof BANNER_PICS)[number];

// A picture the creator uploaded for their profile picture or for the ring over it. Only an address in
// our own Blob store under the creator's decor folder is ever kept (see safeDecorUrl). `posterUrl` is
// a still of the first frame so a visitor who asks for less motion sees it standing still.
export interface DecorUpload {
  url: string;
  posterUrl: string | null;
  animated: boolean;
  // The saved item in the creator's library this file belongs to (decor_items, migration 0062), or
  // null for a file saved before the library existed. A worn file whose item was taken down or whose
  // grant was withdrawn is dropped when the page is read (see resolveWornItems).
  itemId: number | null;
  // Where a decoration sits on the photo. Only a decoration (frame) uses it; a profile picture takes
  // the photo's own place.
  placement: DecorPlacement;
}

// Where the creator wants the decoration: the spot on the photo it is centred on (the ring is the
// whole photo, the others its edges and corners), its size as a percent of the photo, and a fine
// nudge in percent of the photo. All of it is clamped when read, so a stored value can never push
// the picture far out of the header.
export const DECOR_ANCHORS = ["ring", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type DecorAnchor = (typeof DECOR_ANCHORS)[number];
export const DECOR_ANCHOR_LABELS: Record<DecorAnchor, string> = {
  ring: "Around the photo",
  top: "Top",
  bottom: "Bottom",
  left: "Left",
  right: "Right",
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};
export interface DecorPlacement {
  anchor: DecorAnchor;
  size: number;
  dx: number;
  dy: number;
}
export const DECOR_NUDGE = { min: -40, max: 40, step: 2 } as const;
// A decoration that sits on an edge or corner is a smaller piece than a ring, so it may be drawn small.
export const DECOR_PLACED_SIZE = { min: 20, max: 220, step: 4, standard: 60 } as const;

export const isDecorAnchor = (v: unknown): v is DecorAnchor => typeof v === "string" && (DECOR_ANCHORS as readonly string[]).includes(v);

const clampInt = (raw: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : fallback;
  return Math.min(max, Math.max(min, n));
};

// The placement as stored, read leniently. `legacyScale` is the single size every decoration had
// before placements existed, so a page saved earlier keeps looking exactly the same (the ring).
export function parsePlacement(raw: unknown, legacyScale: number = FRAME_SCALE.standard): DecorPlacement {
  const r = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const anchor = isDecorAnchor(r.anchor) ? r.anchor : "ring";
  const size =
    anchor === "ring"
      ? clampInt(r.size ?? legacyScale, FRAME_SCALE.min, FRAME_SCALE.max, FRAME_SCALE.standard)
      : clampInt(r.size, DECOR_PLACED_SIZE.min, DECOR_PLACED_SIZE.max, DECOR_PLACED_SIZE.standard);
  return { anchor, size, dx: clampInt(r.dx, DECOR_NUDGE.min, DECOR_NUDGE.max, 0), dy: clampInt(r.dy, DECOR_NUDGE.min, DECOR_NUDGE.max, 0) };
}

// Where the centre of the decoration goes on the photo box, in percent from its top-left corner.
const ANCHOR_POINT: Record<DecorAnchor, [number, number]> = {
  ring: [50, 50],
  top: [50, 0],
  bottom: [50, 100],
  left: [0, 50],
  right: [100, 50],
  "top-left": [0, 0],
  "top-right": [100, 0],
  "bottom-left": [0, 100],
  "bottom-right": [100, 100],
};

// The box of the decoration inside the photo's own box, as percents (left, top, width and height),
// so the CSS needs no maths and the same numbers draw the preview on the dashboard and the page.
export function placementBox(p: DecorPlacement): { left: number; top: number; size: number } {
  const [cx, cy] = ANCHOR_POINT[p.anchor];
  return { left: cx + p.dx - p.size / 2, top: cy + p.dy - p.size / 2, size: p.size };
}

export const DECOR_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
export const DECOR_POSTER_MAX_BYTES = 300 * 1024;
export const decorPathPrefix = (creatorId: number) => `decor/${creatorId}/`;
// What a file under the decor folder is for, from its name: an avatar, a frame, or the still of one.
export const DECOR_UPLOAD_KINDS = ["avatar", "frame"] as const;
export type DecorUploadKind = (typeof DECOR_UPLOAD_KINDS)[number];

// The address to draw, or null when it is not one of our own decor files.
export function safeDecorUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw || raw.length > 600 || raw.includes("..")) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  if (!url.hostname.endsWith(BLOB_HOST_SUFFIX)) return null;
  return /^\/decor\/\d+\/[\w.-]+$/.test(url.pathname) && !url.pathname.includes("..") ? url.toString() : null;
}

// A Blob file that is animated: a GIF always is here; a WebP says so in its header (a VP8X chunk with the
// animation flag set). Used where the file is saved, so an animated one gets a still and the motion rule.
export function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 21) return false;
  const tag = (i: number, t: string) => t.split("").every((c, k) => bytes[i + k] === c.charCodeAt(0));
  return tag(0, "RIFF") && tag(8, "WEBP") && tag(12, "VP8X") && (bytes[20] & 0x02) !== 0;
}

function parseUpload(raw: unknown, legacyScale?: unknown): DecorUpload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const url = safeDecorUrl(r.url);
  if (!url) return null;
  const itemId = typeof r.itemId === "number" && Number.isInteger(r.itemId) && r.itemId > 0 ? r.itemId : null;
  return {
    url,
    posterUrl: safeDecorUrl(r.posterUrl),
    animated: r.animated === true,
    itemId,
    placement: parsePlacement(r.placement, clampFrameScale(legacyScale)),
  };
}

export const clampFrameScale = (raw: unknown): number => {
  const n = typeof raw === "number" && Number.isFinite(raw) ? Math.round(raw) : FRAME_SCALE.standard;
  return Math.min(FRAME_SCALE.max, Math.max(FRAME_SCALE.min, n));
};

// A creator's own pick from the dashboard: the ready-made looks (the profile picture, the frame, the
// effect over the banner and an animated banner picture) and the pictures they uploaded themselves
// (a profile picture and a frame). Stored as jsonb in users.tip_decor; null means nothing was ever
// saved, and the page's own document decides.
export type PresetFrame = Exclude<FrameStyle, "custom">;
export type PresetBannerFx = Exclude<BannerFx, "custom">;
// A look template: a whole set of cosmetics (ring over the photo, banner, nameplate, card frame and
// effect) drawn in code. "classic" is the page as it always was (the creator's own picks below);
// the others add their layers on top. Chosen on the dashboard Effects page; it never changes what the
// other picks hold, so switching back to Classic brings the old look back exactly.
export const TIP_TEMPLATES = ["classic", "deadpool"] as const;
export type TipTemplate = (typeof TIP_TEMPLATES)[number];
export const isTipTemplate = (v: unknown): v is TipTemplate => typeof v === "string" && (TIP_TEMPLATES as readonly string[]).includes(v);

export interface TipDecor {
  template: TipTemplate;
  avatar: AvatarStyle;
  frame: PresetFrame;
  bannerFx: PresetEffect;
  bannerPic: BannerPic;
  avatarUpload: DecorUpload | null;
  frameUpload: DecorUpload | null;
  frameScale: number;
}

export const PRESET_FRAMES: readonly PresetFrame[] = FRAME_STYLES.filter((f): f is PresetFrame => f !== "custom");
export const PRESET_BANNER_FX: readonly PresetBannerFx[] = BANNER_FX.filter((f): f is PresetBannerFx => f !== "custom");

// What is stored, read back leniently: anything that is not a ready-made look becomes "none". Not an
// object at all (nothing saved) gives null. Before the effect and the picture were two settings, an
// animated picture was stored as the effect; it is read back as the picture.
export function parseTipDecor(raw: unknown): TipDecor | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const split = splitLegacyFrame(r.frame, r.avatar);
  const legacyPic = typeof r.bannerFx === "string" && isFileFx(r.bannerFx) ? r.bannerFx : null;
  return {
    template: TIP_TEMPLATES.find((t) => t === r.template) ?? "classic",
    avatar: AVATAR_STYLES.find((a) => a === split.avatar) ?? "none",
    frame: PRESET_FRAMES.find((f) => f === split.frame) ?? "none",
    bannerFx: PRESET_EFFECTS.find((f) => f === r.bannerFx) ?? "none",
    bannerPic: BANNER_PICS.find((f) => f === (r.bannerPic ?? legacyPic)) ?? "none",
    avatarUpload: parseUpload(r.avatarUpload),
    frameUpload: parseUpload(r.frameUpload, r.frameScale),
    frameScale: clampFrameScale(r.frameScale),
  };
}

// The page document with the creator's own pick in its header (and no uploaded file in those two
// places, since the pick replaces them). Nothing saved leaves the document as it is. The uploaded
// pictures and the animated banner picture are drawn from `TipDecor` by the header, not the document.
export function applyTipDecor(doc: PageDoc, decor: TipDecor | null): PageDoc {
  if (!decor) return doc;
  return {
    ...doc,
    blocks: doc.blocks.map((b) =>
      b.type === "header" ? { ...b, settings: { ...b.settings, avatar: decor.avatar, frame: decor.frame, frameAsset: null, bannerFx: decor.bannerFx, bannerFxAsset: null } } : b,
    ),
  };
}

// What the tip page draws from a creator's pick beyond the document: their uploaded pictures and the
// animated banner picture. Plain data, so it can go from the server page to the browser.
export interface DecorLayers {
  template: TipTemplate;
  avatarUpload: DecorUpload | null;
  frameUpload: DecorUpload | null;
  frameScale: number;
  bannerPic: BannerPic;
}
export function decorLayers(decor: TipDecor | null): DecorLayers | null {
  if (!decor) return null;
  return { template: decor.template, avatarUpload: decor.avatarUpload, frameUpload: decor.frameUpload, frameScale: decor.frameScale, bannerPic: decor.bannerPic };
}

// Who may pick a frame and an effect on the dashboard: the owner's own page, or a creator the owner
// has switched "Photo frame and banner effects" on for.
export function mayPickTipDecor(ownerPage: boolean, row: FeatureSource): boolean {
  return ownerPage || hasFeature(row, "tipDecor");
}

// Which templates a page may use: Classic for everyone who may pick a look, Deadpool for the owner's
// page and for creators the owner switched "Deadpool template" on for (a paid feature).
export function mayUseTemplate(ownerPage: boolean, row: FeatureSource, template: TipTemplate): boolean {
  return template === "classic" || ownerPage || hasFeature(row, "deadpoolTemplate");
}

// Whose saved pick the tip page wears. The owner's page always; a creator's only while their switch is
// on and no Custom tip page is on, because a done-for-you page decides its own frame and effect.
export function wearsTipDecor(ownerPage: boolean, row: FeatureSource): boolean {
  return ownerPage || (hasFeature(row, "tipDecor") && !hasFeature(row, "pageBuilder"));
}

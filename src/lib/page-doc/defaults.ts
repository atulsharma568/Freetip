import { defaultSettings } from "./blocks";
import { ONE_PIECE_LADDER } from "./ladder";
import { PAGE_DOC_VERSION, type Block, type BlockType, type PageDoc, type SettingsByType, type Slot } from "./types";

// The two pages that exist today, as documents. A creator with no stored document gets
// `defaultPageDoc()`; the owner's own page gets `ownerPageDoc()`. Each call returns a fresh copy,
// so nothing that edits one can change the next. Every word setting is empty: the standard
// wording lives in the components.

// A block with its settings at their normal values, then the ones given.
function make<T extends BlockType>(type: T, slot: Slot, settings: Partial<SettingsByType[T]> = {}): Block<T> {
  return { id: type, type, visible: true, slot, settings: { ...defaultSettings(type), ...settings } } as Block<T>;
}

export function defaultPageDoc(): PageDoc {
  return {
    version: PAGE_DOC_VERSION,
    blocks: [
      make("header", "side"),
      make("alertPreview", "side"),
      make("qr", "side"),
      make("amount", "main"),
      make("note", "main"),
      make("send", "main"),
      make("successScreen", "success"),
    ],
    theme: {},
  };
}

// The owner's page: the normal layout in the red of the avatar's collar, a brand backdrop, a
// line of words and the Instagram under the header, a pressure bar in the amount box, a strip
// under the card and the "GG" sign-off after a tip. The red fails 4.5:1 for small text on black,
// so it is used for fills only and small text stays white or grey.
export function ownerPageDoc(): PageDoc {
  return structuredClone({
    version: PAGE_DOC_VERSION,
    blocks: [
      make("backdrop", "background"),
      // The "Clutch pulse" banner (a heartbeat line and a crosshair lock-on, in the page's crimson) and
      // no ring over the photo. They are only the owner's default: another creator's page starts with
      // neither (see decor.ts).
      make("header", "side", { avatar: "none", frame: "none", bannerFx: "clutch" }),
      make("creatorLinks", "side", { tagline: "Valorant / Live & Highlights", instagram: "acepressure.gg" }),
      make("alertPreview", "side"),
      make("qr", "side"),
      make("amount", "main", { ladder: ONE_PIECE_LADDER }),
      make("note", "main"),
      make("send", "main"),
      make("strip", "bottom", { left: "YouTube / AcePressure", right: "@acepressure.gg" }),
      make("successScreen", "success", { style: "owner" }),
    ],
    theme: { accent: "#ca1b19", ink: "#f6f6f1" },
  } satisfies PageDoc);
}

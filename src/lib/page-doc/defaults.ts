import { ONE_PIECE_LADDER } from "./ladder";
import { PAGE_DOC_VERSION, type Block, type PageDoc } from "./types";

// The two pages that exist today, as documents. A creator with no stored document gets
// `defaultPageDoc()`; the owner's own page gets `ownerPageDoc()`. Each call returns a fresh copy,
// so nothing that edits one can change the next.

const header: Block<"header"> = { id: "header", type: "header", visible: true, slot: "side", settings: {} };
const alertPreview: Block<"alertPreview"> = { id: "alertPreview", type: "alertPreview", visible: true, slot: "side", settings: {} };
const qr: Block<"qr"> = { id: "qr", type: "qr", visible: true, slot: "side", settings: {} };
const note: Block<"note"> = { id: "note", type: "note", visible: true, slot: "main", settings: {} };
const send: Block<"send"> = { id: "send", type: "send", visible: true, slot: "main", settings: {} };

function copy<T>(value: T): T {
  return structuredClone(value);
}

export function defaultPageDoc(): PageDoc {
  return copy({
    version: PAGE_DOC_VERSION,
    blocks: [
      header,
      alertPreview,
      qr,
      { id: "amount", type: "amount", visible: true, slot: "main", settings: { ladder: null } },
      note,
      send,
      { id: "successScreen", type: "successScreen", visible: true, slot: "success", settings: { style: "default" } },
    ],
    theme: {},
  } satisfies PageDoc);
}

// The owner's page: the normal layout in the red of the avatar's collar, a brand backdrop, a
// line of words and the Instagram under the header, a pressure bar in the amount box, a strip
// under the card and the "GG" sign-off after a tip. The red fails 4.5:1 for small text on black,
// so it is used for fills only and small text stays white or grey.
export function ownerPageDoc(): PageDoc {
  return copy({
    version: PAGE_DOC_VERSION,
    blocks: [
      { id: "backdrop", type: "backdrop", visible: true, slot: "background", settings: { style: "ember" } },
      header,
      {
        id: "creatorLinks",
        type: "creatorLinks",
        visible: true,
        slot: "side",
        settings: { tagline: "Valorant / Live & Highlights", instagram: "acepressure.gg" },
      },
      alertPreview,
      qr,
      { id: "amount", type: "amount", visible: true, slot: "main", settings: { ladder: ONE_PIECE_LADDER } },
      note,
      send,
      { id: "strip", type: "strip", visible: true, slot: "bottom", settings: { left: "YouTube / AcePressure", right: "@acepressure.gg" } },
      { id: "successScreen", type: "successScreen", visible: true, slot: "success", settings: { style: "owner" } },
    ],
    theme: { accent: "#ca1b19", ink: "#f6f6f1" },
  } satisfies PageDoc);
}

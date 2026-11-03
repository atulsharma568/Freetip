import { isBlockType } from "./blocks";
import { parsePageDoc } from "./parse";
import type { BlockType, PageDoc } from "./types";

// The two windows of the owner's editor talk by postMessage: the editor page sends the draft to
// the preview frame and the frame sends back which block was clicked. Each side believes only a
// message from its own site, sent by the window it expects (the frame's parent, or the frame it
// opened), whose content is checked before use. Anything else is ignored, never an error.

export const MSG_READY = "freetip-preview-ready";
export const MSG_DOC = "freetip-preview-doc";
export const MSG_SELECT = "freetip-preview-select";

interface Incoming {
  origin: string;
  source: unknown;
  data: unknown;
}

const trusted = (event: Incoming, origin: string, from: unknown) => from != null && event.origin === origin && event.source === from;
const typeOf = (data: unknown): string | null =>
  typeof data === "object" && data !== null && typeof (data as { type?: unknown }).type === "string" ? (data as { type: string }).type : null;

// Frame side: a draft from the editor, cleaned by the same parser the real page uses. A document
// that is not a page, or a message that is not from the editor, gives null.
export function readDocMessage(event: Incoming, origin: string, parent: unknown): PageDoc | null {
  if (!trusted(event, origin, parent) || typeof event.data !== "object") return null;
  if (typeOf(event.data) !== MSG_DOC) return null;
  return parsePageDoc((event.data as { doc?: unknown }).doc)?.doc ?? null;
}

// Frame side: which block the editor has selected (null clears it).
export function readSelectMessage(event: Incoming, origin: string, parent: unknown): { block: BlockType | null } | null {
  if (!trusted(event, origin, parent) || typeOf(event.data) !== MSG_SELECT) return null;
  const id = (event.data as { id?: unknown }).id;
  if (id === null) return { block: null };
  return isBlockType(id) ? { block: id } : null;
}

// Editor side: the frame says it is ready for a draft.
export function isReadyMessage(event: Incoming, origin: string, frame: unknown): boolean {
  return trusted(event, origin, frame) && typeOf(event.data) === MSG_READY;
}

// Editor side: the block the owner clicked in the frame.
export function readPickMessage(event: Incoming, origin: string, frame: unknown): BlockType | null {
  if (!trusted(event, origin, frame) || typeOf(event.data) !== MSG_SELECT) return null;
  const id = (event.data as { id?: unknown }).id;
  return isBlockType(id) ? id : null;
}

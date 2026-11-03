import { getCreatorAccent, getPageRow, getPinOffer, getTipBanner, getTipPhoto, getTipRules, getTipSounds, type CreatorRow } from "./creator";
import type { TipPageData } from "./TipPageView";
import { getDb } from "@/lib/db";
import { MIN_TIP_PAISE } from "@/lib/money";
import { isOwnerTipPage, ownerBrand } from "@/lib/owner-page";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { resolvePageDoc } from "@/lib/page-doc/store";
import type { PageDoc } from "@/lib/page-doc/types";
import { ttsAvailable } from "@/lib/tts";
import { effectiveTtsMinPaise, getTtsFloorPaise } from "@/lib/site-settings";

// Everything the tip page needs from the database, read once and shared by the real page and the
// owner's editor preview, so the two cannot drift apart.

// The page a creator shows when nothing is published: the owner's own page for the owner, the
// normal page for everyone else.
export function defaultDocFor(handle: string, creator: Pick<CreatorRow, "google_id">): PageDoc {
  return isOwnerTipPage(handle, creator.google_id) ? ownerPageDoc() : defaultPageDoc();
}

export interface TipPageOptions {
  // The document to draw. Without one, the creator's published document is used while their
  // "Custom tip page" switch is on, else the default page (the editor preview passes its draft).
  doc?: PageDoc;
  previewMode: boolean;
  // Only the owner's editor preview: the blocks are marked so a click can pick one.
  editing?: boolean;
}

export async function loadTipPageData(handle: string, creator: CreatorRow, options: TipPageOptions): Promise<TipPageData> {
  const ownerPage = isOwnerTipPage(handle, creator.google_id);
  const displayName = ownerPage ? ownerBrand() : (creator.display_name ?? creator.name ?? handle);
  const [sounds, rules, pinOffer, bannerUrl, tipPhoto, pageRow] = await Promise.all([
    getTipSounds(handle),
    getTipRules(handle),
    getPinOffer(handle),
    getTipBanner(handle),
    getTipPhoto(handle),
    getPageRow(handle),
  ]);
  // The voice is offered only when the site switch and the creator both have it on.
  const voiceMinPaise =
    ttsAvailable() && creator.tts_enabled ? effectiveTtsMinPaise(creator.tts_min_paise, await getTtsFloorPaise(getDb())) : null;

  // The page is drawn from a document of blocks: the stored one while the creator's "Custom tip
  // page" switch is on, otherwise today's page (the owner's own page for the owner, whose document
  // carries the channel's red, whatever accent is saved).
  const doc = options.doc ?? resolvePageDoc(pageRow, defaultDocFor(handle, creator));
  const storedAccent = ownerPage ? null : await getCreatorAccent(handle);

  return {
    handle,
    displayName,
    doc,
    storedAccent,
    pictureUrl: tipPhoto ?? creator.picture_url,
    bannerUrl,
    ytChannelName: creator.yt_channel_name,
    ytChannelUrl: creator.yt_channel_url,
    minTipPaise: MIN_TIP_PAISE,
    messageMaxChars: creator.message_max_chars,
    bio: creator.bio,
    alertMode: creator.alert_mode,
    sounds,
    rules,
    voiceMinPaise,
    pinOffer,
    previewMode: options.previewMode,
    editing: options.editing,
  };
}


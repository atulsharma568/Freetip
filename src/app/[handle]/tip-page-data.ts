import { getCreatorAccent, getPageRow, getPinOffer, getTipBanner, getTipPhoto, getTipRules, getTipSounds, type CreatorRow } from "./creator";
import type { TipPageData } from "./TipPageView";
import { getDb } from "@/lib/db";
import { MIN_TIP_PAISE } from "@/lib/money";
import type { Query } from "@/lib/accrual";
import { isOwnerTipPage, ownerBrand } from "@/lib/owner-page";
import { usedAssetIds } from "@/lib/page-doc/assets";
import { loadPageAssets, resolveAssets } from "@/lib/page-doc/asset-store";
import { loadGoalProgress, type GoalProgress } from "@/lib/goal-progress";
import { loadMeterReading, type MeterReading } from "@/lib/page-doc/pressure";
import { defaultPageDoc, ownerPageDoc } from "@/lib/page-doc/defaults";
import { resolvePageDoc } from "@/lib/page-doc/store";
import type { PageDoc } from "@/lib/page-doc/types";
import { hasFeature } from "@/lib/plans";
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
  // The pictures the document uses, read in one query and only when it uses any, so a page without
  // pictures costs nothing more. The owner's editor preview gets every live file of the creator
  // instead, so a file just uploaded can be drawn before it is saved into the draft.
  const assets = await pageAssets(creator.id, doc, options.editing === true);

  const { meterOn, meter, meterGoals } = await pageMeter(creator.id, doc, pageRow, options.editing === true);

  return {
    handle,
    displayName,
    doc,
    assets,
    meterOn,
    meter,
    meterGoals,
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


async function pageAssets(creatorId: number, doc: PageDoc, all: boolean) {
  const db = getDb();
  if (!db) return {};
  if (all) {
    try {
      return await resolveAssets(db as unknown as Query, creatorId);
    } catch (err) {
      console.error("Page preview: could not read the page pictures (migration 0052 run?).", err);
      return {};
    }
  }
  const ids = usedAssetIds(doc);
  return ids.length === 0 ? {} : loadPageAssets(db as unknown as Query, creatorId, ids);
}

// The Pressure meter's first reading, read with the page so it is in the served HTML. Only when
// the document has a visible meter that shows on the page, and both switches are on: otherwise no
// query is made. A failed read is logged and the meter is left out. The owner's editor preview
// gets every goal of the creator instead and works the reading out itself from the live draft.
async function pageMeter(creatorId: number, doc: PageDoc, pageRow: Parameters<typeof hasFeature>[0], editing: boolean) {
  const none: { meterOn: boolean; meter: MeterReading | null; meterGoals?: GoalProgress[] } = { meterOn: false, meter: null };
  const db = getDb();
  if (!db) return none;
  if (editing) {
    try {
      return { ...none, meterGoals: await loadGoalProgress(db as unknown as Query, creatorId) };
    } catch (err) {
      console.error("Page preview: could not read the goals.", err);
      return { ...none, meterGoals: [] };
    }
  }
  const block = doc.blocks.find((b) => b.type === "pressureMeter");
  if (!block || block.type !== "pressureMeter" || !block.visible || block.settings.where === "obs") return none;
  if (!hasFeature(pageRow, "pressureMeter")) return none;
  try {
    return { ...none, meterOn: true, meter: await loadMeterReading(db as unknown as Query, creatorId, block.settings) };
  } catch (err) {
    console.error("Tip page: could not read the Pressure meter.", err);
    return none;
  }
}

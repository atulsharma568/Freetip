import type { AlertMode } from "@/lib/alerts";
import type { PinOffer } from "@/lib/pinned";
import { PageShell } from "@/components/PageShell";
import { BackdropBlock } from "@/components/tip/blocks/BackdropBlock";
import { findBlock } from "@/lib/page-doc/blocks";
import { themeFor } from "@/lib/page-doc/theme";
import type { ResolvedAsset } from "@/lib/page-doc/assets";
import type { DecorLayers } from "@/lib/page-doc/decor";
import type { GoalProgress } from "@/lib/goal-progress";
import type { MeterReading } from "@/lib/page-doc/pressure";
import type { PageDoc } from "@/lib/page-doc/types";
import type { TipRule, TipSound } from "./creator";
import { TipForm } from "./TipForm";
import { EmberTrail, SignatureRays } from "@/components/tip/Signature";
import { OwnerMusic } from "@/components/tip/OwnerMusic";
import type { PageMusic } from "@/lib/page-music";

// What the tip page needs, already read from the database. The real page builds it from the
// creator's rows; the test-only fixture route builds it from made-up values, and both render
// through TipPageView so the two cannot drift apart.
export interface TipPageData {
  handle: string;
  displayName: string;
  // The page as a checked document of blocks, and the creator's saved accent colour (used when
  // the document sets none).
  doc: PageDoc;
  // The pictures the document may draw, by id: only what the document uses on the real page, every
  // live file of the creator in the owner's editor preview. Empty when there are none.
  assets: Record<number, ResolvedAsset>;
  // The Pressure meter: whether the page draws one, and its first reading (null: no goal). Left
  // out, no meter is drawn.
  meterOn?: boolean;
  meter?: MeterReading | null;
  // The owner's editor preview only: every goal of the creator, so a meter added or changed in the
  // draft can be drawn at once, without a reload.
  meterGoals?: GoalProgress[];
  storedAccent: string | null;
  pictureUrl: string | null;
  bannerUrl: string | null;
  // The creator's uploaded profile picture and frame and animated banner picture; null when none is worn.
  decorLayers?: DecorLayers | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  minTipPaise: number;
  messageMaxChars: number;
  bio: string | null;
  alertMode: AlertMode;
  sounds: TipSound[];
  rules: TipRule[];
  voiceMinPaise: number | null;
  pinOffer: PinOffer | null;
  previewMode: boolean;
  // The owner's editor preview only: blocks carry `data-block-id`.
  editing?: boolean;
  // The site owner's own page (isOwnerTipPage): draws the signature layer (Signature.tsx). Never
  // set from a page document, so no other creator can turn it on.
  signature?: boolean;
  // The owner's uploaded track (dashboard Effects); drawn as a small player on the owner's page only.
  music?: PageMusic | null;
}

export function TipPageView({ data }: { data: TipPageData }) {
  const { style, accent } = themeFor(data.doc, data.storedAccent);
  const backdrop = findBlock(data.doc, "backdrop");
  return (
    <PageShell slim>
      <div className="contents" style={style}>
        {backdrop?.visible && <BackdropBlock block={backdrop} asset={backdrop.settings.asset === null ? null : (data.assets[backdrop.settings.asset] ?? null)} />}
        {data.signature && <SignatureRays />}
        {data.signature && !data.editing && <EmberTrail />}
        <TipForm
          doc={data.doc}
          assets={data.assets}
          meterOn={data.meterOn}
          meter={data.meter}
          accent={accent}
          sounds={data.sounds}
          rules={data.rules}
          voiceMinPaise={data.voiceMinPaise}
          handle={data.handle}
          displayName={data.displayName}
          pictureUrl={data.pictureUrl}
          bannerUrl={data.bannerUrl}
          decorLayers={data.decorLayers}
          ytChannelName={data.ytChannelName}
          ytChannelUrl={data.ytChannelUrl}
          minTipPaise={data.minTipPaise}
          messageMaxChars={data.messageMaxChars}
          bio={data.bio}
          alertMode={data.alertMode}
          pinOffer={data.pinOffer}
          previewMode={data.previewMode}
          editing={data.editing}
          signature={data.signature}
        />
        {data.signature && data.music && !data.editing && <OwnerMusic music={data.music} artist={data.displayName} />}
      </div>
    </PageShell>
  );
}

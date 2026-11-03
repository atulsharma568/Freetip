import type { AlertMode } from "@/lib/alerts";
import type { PinOffer } from "@/lib/pinned";
import { PageShell } from "@/components/PageShell";
import { OwnerBackdrop } from "@/components/tip/OwnerBackdrop";
import type { TipRule, TipSound } from "./creator";
import { TipForm } from "./TipForm";

// What the tip page needs, already read from the database. The real page builds it from the
// creator's rows; the test-only fixture route builds it from made-up values, and both render
// through TipPageView so the two cannot drift apart.
export interface TipPageData {
  handle: string;
  displayName: string;
  ownerPage: boolean;
  accent: string | undefined;
  themeStyle: Record<string, string> | undefined;
  pictureUrl: string | null;
  bannerUrl: string | null;
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
}

export function TipPageView({ data }: { data: TipPageData }) {
  return (
    <PageShell slim>
      <div className="contents" style={data.themeStyle}>
        {data.ownerPage && <OwnerBackdrop />}
        <TipForm
          accent={data.accent}
          sounds={data.sounds}
          rules={data.rules}
          voiceMinPaise={data.voiceMinPaise}
          handle={data.handle}
          displayName={data.displayName}
          pictureUrl={data.pictureUrl}
          bannerUrl={data.bannerUrl}
          ytChannelName={data.ytChannelName}
          ytChannelUrl={data.ytChannelUrl}
          minTipPaise={data.minTipPaise}
          messageMaxChars={data.messageMaxChars}
          bio={data.bio}
          alertMode={data.alertMode}
          pinOffer={data.pinOffer}
          variant={data.ownerPage ? "owner" : "default"}
          previewMode={data.previewMode}
        />
      </div>
    </PageShell>
  );
}

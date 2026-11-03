"use client";

import { CreatorPanel } from "@/components/tip/CreatorPanel";
import { useTipForm } from "@/components/tip/TipFormContext";

// The creator's photo, banner, name, channel and bio. All of it is the creator's own account data.
export function HeaderBlock() {
  const { displayName, pictureUrl, bannerUrl, ytChannelName, ytChannelUrl, bio, previewMode } = useTipForm();
  return (
    <CreatorPanel
      displayName={displayName}
      pictureUrl={pictureUrl}
      bannerUrl={bannerUrl}
      ytChannelName={ytChannelName}
      ytChannelUrl={ytChannelUrl}
      bio={bio}
      previewMode={previewMode}
    />
  );
}

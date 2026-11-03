import { OwnerLinks } from "@/components/tip/OwnerExtras";
import type { Block } from "@/lib/page-doc/types";

// A line of words and an Instagram link under the header.
export function CreatorLinksBlock({ block }: { block: Block<"creatorLinks"> }) {
  return <OwnerLinks tagline={block.settings.tagline} instagram={block.settings.instagram} />;
}

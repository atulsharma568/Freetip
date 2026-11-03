import { OwnerStrip } from "@/components/tip/OwnerExtras";
import type { Block } from "@/lib/page-doc/types";

// The line under the form card.
export function StripBlock({ block }: { block: Block<"strip"> }) {
  return <OwnerStrip left={block.settings.left} right={block.settings.right} />;
}

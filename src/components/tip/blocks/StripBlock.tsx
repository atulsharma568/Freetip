import { OwnerStrip } from "@/components/tip/OwnerExtras";
import type { Block } from "@/lib/page-doc/types";

// The line under the form card.
export function StripBlock({ block, editing = false }: { block: Block<"strip">; editing?: boolean }) {
  return <OwnerStrip left={block.settings.left} right={block.settings.right} blockId={editing ? block.id : undefined} />;
}

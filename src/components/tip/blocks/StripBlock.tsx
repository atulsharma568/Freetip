import { OwnerStrip } from "@/components/tip/OwnerExtras";
import { SignatureMarquee } from "@/components/tip/Signature";
import type { Block } from "@/lib/page-doc/types";

// The line under the form card. On the owner's own page it is an endless marquee of the page's
// tagline parts and the strip's two sides (Signature.tsx).
export function StripBlock({
  block,
  editing = false,
  signature = false,
  tagline = "",
}: {
  block: Block<"strip">;
  editing?: boolean;
  signature?: boolean;
  tagline?: string;
}) {
  const blockId = editing ? block.id : undefined;
  if (signature) {
    const { left, right } = block.settings;
    return <SignatureMarquee items={[...tagline.split("/"), left, right]} read={[left, right]} blockId={blockId} />;
  }
  return <OwnerStrip left={block.settings.left} right={block.settings.right} blockId={blockId} />;
}

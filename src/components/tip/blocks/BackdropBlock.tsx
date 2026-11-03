import { OwnerBackdrop } from "@/components/tip/OwnerBackdrop";
import { usableFor, type ResolvedAsset } from "@/lib/page-doc/assets";
import type { Block } from "@/lib/page-doc/types";
import { BackdropMedia } from "./BackdropMedia";

// Sits behind the whole page. "ember" is the owner's smoke, slashes and embers. "media" is a
// picture, GIF or video from the library, under a layer of the page colour (`dim` percent thick) so
// the words stay readable. A media backdrop whose file is missing, taken down or the wrong kind
// draws nothing, so the page is plain rather than broken.
export function BackdropBlock({ block, asset }: { block: Block<"backdrop">; asset: ResolvedAsset | null }) {
  if (block.settings.style === "ember") return <OwnerBackdrop />;
  if (!asset || !usableFor(asset.kind, "backdrop")) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ground">
      <BackdropMedia asset={asset} />
      <div className="absolute inset-0 bg-ground" style={{ opacity: block.settings.dim / 100 }} />
    </div>
  );
}

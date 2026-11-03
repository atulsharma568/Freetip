"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { removeTipBanner, copyYouTubeBanner } from "@/app/actions/tip-banner";
import { CreatorPanel } from "@/components/tip/CreatorPanel";
import { Tile } from "../parts/Tile";
import { Msg } from "../parts/Msg";
import { pillPrimary } from "../parts/styles";

export function BannerManager({
  saved,
  handle,
  style,
  displayName,
  pictureUrl,
  ytChannelName,
  ytChannelUrl,
  bio,
}: {
  saved: string | null;
  handle: string;
  style: CSSProperties | Record<string, string> | undefined;
  displayName: string;
  pictureUrl: string | null;
  ytChannelName: string | null;
  ytChannelUrl: string | null;
  bio: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"copy" | "remove" | null>(null);
  const [message, setMessage] = useState<{ kind: "error" | "ok"; text: string } | null>(null);

  async function run(which: "copy" | "remove") {
    setBusy(which);
    setMessage(null);
    const res = which === "copy" ? await copyYouTubeBanner() : await removeTipBanner();
    setBusy(null);
    if (res.status === "error") {
      setMessage({ kind: "error", text: res.message });
      return;
    }
    setMessage({
      kind: "ok",
      text: which === "copy" ? "Done. Your YouTube banner now shows on your tip page." : "Removed. Your tip page has no banner.",
    });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <Tile id="preview" level={2} title="Preview">
        <div className="space-y-4">
          <div data-testid="banner-preview" style={style as CSSProperties} className="rounded-surface border border-line bg-ground p-5">
            <CreatorPanel
              displayName={displayName}
              pictureUrl={pictureUrl}
              bannerUrl={saved}
              ytChannelName={ytChannelName}
              ytChannelUrl={ytChannelUrl}
              bio={bio}
              previewMode
              headingAs="h3"
            />
          </div>
          <p className="text-xs text-muted">
            The top of your tip page at <span className="numeric">/{handle}</span>.{" "}
            {saved ? "This is the banner fans see." : "You have no banner yet, so fans see your photo on its own."}
          </p>
        </div>
      </Tile>

      <Tile id="banner" level={2} title="Your YouTube banner">
        <div className="space-y-4">
          <p className="text-sm text-muted">
            We read the public banner of your YouTube channel and keep a link to it. We never change
            anything on your channel. YouTube shows banners wide, so the middle of the picture is what
            fits behind your photo.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => run("copy")} disabled={busy !== null} className={pillPrimary}>
              {busy === "copy" ? "Reading YouTube…" : saved ? "Update from YouTube" : "Use my YouTube banner"}
            </button>
            {saved && (
              <button
                type="button"
                onClick={() => run("remove")}
                disabled={busy !== null}
                className="inline-flex min-h-11 items-center rounded-full border border-control px-5 text-sm transition-colors duration-150 hover:border-muted disabled:opacity-50"
              >
                {busy === "remove" ? "Removing…" : "Remove the banner"}
              </button>
            )}
          </div>
          <Msg kind={message?.kind} text={message?.text} />
        </div>
      </Tile>
    </div>
  );
}

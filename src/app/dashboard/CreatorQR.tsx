"use client";

import { useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  handle: string;
}

export function CreatorQR({ url, handle }: Props) {
  const download = useCallback(() => {
    const svg = document.querySelector<SVGSVGElement>("#creator-qr svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${handle}-tip-qr.svg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [handle]);

  return (
    <div className="space-y-4">
      <div
        id="creator-qr"
        className="flex items-center justify-center rounded-[var(--radius-surface)] bg-white p-4 w-fit"
        aria-label={`QR code for ${url}`}
      >
        <QRCodeSVG
          value={url}
          size={160}
          fgColor="#0a0a0a"
          bgColor="#ffffff"
          level="M"
        />
      </div>
      <button
        type="button"
        onClick={download}
        className="inline-flex h-10 items-center rounded-full border border-control px-5 text-sm font-medium text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.97]"
      >
        Download SVG
      </button>
      <p className="text-xs text-muted">
        Show this on stream or print it. Fans scan to open your tip page.
      </p>
    </div>
  );
}

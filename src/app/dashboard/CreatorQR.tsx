"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";

interface Props {
  url: string;
  handle: string;
}

const PNG_SIZE = 1024;
const PNG_MARGIN = 96;

const noopSubscribe = () => () => {};
const canShare = () => typeof navigator !== "undefined" && "share" in navigator;

const buttonClass =
  "inline-flex h-10 items-center rounded-full border border-control px-5 text-sm font-medium text-text transition-[transform,border-color] duration-150 hover:border-muted active:scale-[0.97]";

function save(href: string, filename: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
}

export function CreatorQR({ url, handle }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [notice, setNotice] = useState("");
  const shareable = useSyncExternalStore(noopSubscribe, canShare, () => false);

  const flash = useCallback((message: string) => {
    setNotice(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 2200);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      flash("Link copied");
    } catch {
      flash("Could not copy. Select the link and copy it by hand.");
    }
  }, [url, flash]);

  const share = useCallback(async () => {
    try {
      await navigator.share({ title: "Tip me", url });
    } catch {
      // The person closed the share sheet: nothing to report.
    }
  }, [url]);

  const downloadSvg = useCallback(() => {
    const svg = box.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const href = URL.createObjectURL(blob);
    save(href, `${handle}-tip-qr.svg`);
    URL.revokeObjectURL(href);
  }, [handle]);

  const downloadPng = useCallback(() => {
    const svg = box.current?.querySelector("svg");
    if (!svg) return;
    const source = URL.createObjectURL(
      new Blob([svg.outerHTML], { type: "image/svg+xml" }),
    );
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = PNG_SIZE;
      canvas.height = PNG_SIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PNG_SIZE, PNG_SIZE);
        // Smooth scaling would blur the module edges and hurt scanning.
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          image,
          PNG_MARGIN,
          PNG_MARGIN,
          PNG_SIZE - PNG_MARGIN * 2,
          PNG_SIZE - PNG_MARGIN * 2,
        );
        canvas.toBlob((blob) => {
          if (!blob) return flash("Could not make the PNG.");
          const href = URL.createObjectURL(blob);
          save(href, `${handle}-tip-qr.png`);
          URL.revokeObjectURL(href);
        }, "image/png");
      }
      URL.revokeObjectURL(source);
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      flash("Could not make the PNG.");
    };
    image.src = source;
  }, [handle, flash]);

  return (
    <div className="space-y-4">
      <div
        ref={box}
        className="flex items-center justify-center rounded-[var(--radius-surface)] bg-white p-4 w-fit"
        role="img"
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
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className={buttonClass}>
          Copy link
        </button>
        {shareable && (
          <button type="button" onClick={share} className={buttonClass}>
            Share
          </button>
        )}
        <button type="button" onClick={downloadPng} className={buttonClass}>
          Download PNG
        </button>
        <button type="button" onClick={downloadSvg} className={buttonClass}>
          Download SVG
        </button>
      </div>
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-accent">
        {notice}
      </p>
      <p className="text-xs text-muted">
        Show this on stream or print it. Fans scan to open your tip page. PNG is
        easiest for OBS and sharing; SVG stays sharp at any print size.
      </p>
    </div>
  );
}

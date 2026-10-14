import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { INK_HEX, SITE_HOST, SITE_NAME } from "@/lib/site";

// The link preview shown when the site is shared (WhatsApp, X, Discord…).
// Flat, in the site's palette and fonts; built once at build time.
export const alt = `${SITE_NAME}: Your link. Their UPI. Your bank.`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const GROUND = "#12130e";
const TEXT = "#eff0ea";
const MUTED = "#b0b2a8";
const LIME = "#bfe84a";

const font = (file: string) => readFile(join(process.cwd(), "src/assets/fonts", file));

export default async function Image() {
  const [display, body, mono] = await Promise.all([
    font("bricolage-semicondensed-800.ttf"),
    font("bricolage-500.ttf"),
    font("geist-mono-500.ttf"),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: GROUND,
          color: TEXT,
          fontFamily: "Bricolage",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: LIME,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 18, height: 18, borderRadius: 9, background: INK_HEX }} />
          </div>
          <div style={{ fontFamily: "Display", fontSize: 40 }}>{SITE_NAME}</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Display",
            fontSize: 120,
            lineHeight: 0.98,
            letterSpacing: "-0.015em",
          }}
        >
          <div>Your link.</div>
          <div style={{ color: LIME }}>Their UPI.</div>
          <div>Your bank.</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <div
            style={{
              display: "flex",
              flexShrink: 0,
              padding: "14px 28px",
              borderRadius: 999,
              whiteSpace: "nowrap",
              background: LIME,
              color: INK_HEX,
              fontFamily: "Mono",
              fontSize: 30,
            }}
          >
            {SITE_HOST}/yourname
          </div>
          <div style={{ fontSize: 28, color: MUTED }}>
            Tips for Indian YouTube streamers
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: 800, style: "normal" },
        { name: "Bricolage", data: body, weight: 500, style: "normal" },
        { name: "Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}

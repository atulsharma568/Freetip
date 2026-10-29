import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { INK_HEX } from "@/lib/site";
import { LogoStatic } from "@/components/logo/LogoStatic";

// Shared by every link preview (WhatsApp, X, Discord…): flat, in the site's
// palette and fonts. Pages pass their own headline lines and footer.
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_TYPE = "image/png";

const GROUND = "#12130e";
const TEXT = "#eff0ea";
const MUTED = "#b0b2a8";
const LIME = "#bfe84a";

const font = (file: string) => readFile(join(process.cwd(), "src/assets/fonts", file));

export type OgLine = { text: string; accent?: boolean };

export async function renderOg({
  lines,
  pill,
  note,
  fontSize = 120,
}: {
  lines: OgLine[];
  pill: string;
  note: string;
  fontSize?: number;
}) {
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
        <div style={{ display: "flex", alignItems: "center" }}>
          <LogoStatic height={72} color={TEXT} />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontFamily: "Display",
            fontSize,
            lineHeight: 0.98,
            letterSpacing: "-0.015em",
          }}
        >
          {lines.map((line) => (
            <div key={line.text} style={line.accent ? { color: LIME } : undefined}>
              {line.text}
            </div>
          ))}
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
            {pill}
          </div>
          <div style={{ fontSize: 28, color: MUTED }}>{note}</div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Display", data: display, weight: 800, style: "normal" },
        { name: "Bricolage", data: body, weight: 500, style: "normal" },
        { name: "Mono", data: mono, weight: 500, style: "normal" },
      ],
    },
  );
}

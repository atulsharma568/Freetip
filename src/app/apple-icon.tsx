import { ImageResponse } from "next/og";
import { INK_HEX } from "@/lib/site";

// Home-screen icon for iPhone and iPad: the favicon's lime square and ink
// dot, full bleed (iOS rounds the corners itself).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#bfe84a",
        }}
      >
        <div style={{ width: 68, height: 68, borderRadius: 34, background: INK_HEX }} />
      </div>
    ),
    size,
  );
}

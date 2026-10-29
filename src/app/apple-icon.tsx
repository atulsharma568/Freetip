import { ImageResponse } from "next/og";
import { CoinMark } from "@/components/logo/LogoStatic";

// Home-screen icon for iPhone and iPad: the logo's coin on the site's dark
// ground, full bleed (iOS rounds the corners itself).
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
          background: "#12130e",
        }}
      >
        <CoinMark size={132} />
      </div>
    ),
    size,
  );
}

import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/auth/Providers";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SITE_NAME } from "@/lib/site";
import { SITE_URL } from "@/lib/url";

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
});

const title = `${SITE_NAME}: tips for YouTube streamers, paid by UPI or card`;
const description =
  "Your link. Their UPI. Your bank. Tips for Indian YouTube streamers: fans pay with UPI or card, no account needed, with OBS alerts and text-to-speech.";

// The share image comes from app/opengraph-image.tsx.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description,
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_IN", title, description },
  twitter: { card: "summary_large_image", title, description },
  // The site is already dark and its colours are tuned, so the Dark Reader extension is told to leave it alone.
  other: { "darkreader-lock": "true" },
};

export const viewport: Viewport = {
  themeColor: "#12130e",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${mono.variable} ${display.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Runs before first paint so a returning visitor never sees the analytics banner flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var c=localStorage.getItem("freetip-analytics-consent");if(c==="granted"||c==="denied")document.documentElement.dataset.consent=c}catch(e){}`,
          }}
        />
      </head>
      <body>
        <Providers>
          <SmoothScroll />
          {children}
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}

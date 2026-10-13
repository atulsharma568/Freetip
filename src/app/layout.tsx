import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { SITE_NAME } from "@/lib/site";

const mono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

const display = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin", "latin-ext"],
  axes: ["opsz", "wdth"],
});

export const metadata: Metadata = {
  title: `${SITE_NAME}: tips for YouTube streamers, paid by UPI or card`,
  description:
    "Your link. Their UPI. Your bank. Tips for Indian YouTube streamers: fans pay with UPI or card, no account needed, with OBS alerts and text-to-speech.",
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
    >
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}

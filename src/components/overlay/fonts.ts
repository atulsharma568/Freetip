import { Bangers, Playfair_Display, Poppins, Press_Start_2P } from "next/font/google";

// The fixed set of overlay fonts (the list and the CSS variable names are in
// src/lib/overlay-themes.ts). Self-hosted by next/font at build time; there is no
// upload. Put OVERLAY_FONT_CLASSES on the element that wraps the alert so the
// variables exist for the card.

const poppins = Poppins({ variable: "--font-ov-poppins", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });
const bangers = Bangers({ variable: "--font-ov-bangers", subsets: ["latin"], weight: "400", display: "swap" });
const pixel = Press_Start_2P({ variable: "--font-ov-pixel", subsets: ["latin"], weight: "400", display: "swap" });
const playfair = Playfair_Display({ variable: "--font-ov-playfair", subsets: ["latin"], display: "swap" });

export const OVERLAY_FONT_CLASSES = [poppins, bangers, pixel, playfair].map((f) => f.variable).join(" ");

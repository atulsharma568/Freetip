import { Archivo } from "next/font/google";

// The heavy italic face of the owner's stream screens, used only on the owner's tip page.
// `preload: false` so other creators' pages never download it.
export const ownerFont = Archivo({
  subsets: ["latin"],
  style: ["italic"],
  weight: ["800", "900"],
  display: "swap",
  preload: false,
});

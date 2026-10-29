// Colours and hand-drawn coin symbols for the Freetip logo. Colours were
// sampled from the finalised artwork. The symbols are strokes rather than
// text so the coin does not depend on any font (and works in OG images).

export const LOGO_OLIVE = "#889360";
export const LOGO_COIN_LIGHT = "#c4cb9f";
export const LOGO_COIN_MID = "#99a36f";
export const LOGO_COIN_DARK = "#7b8653";
export const LOGO_COIN_RIM = "#b8bf94";
export const LOGO_COIN_EDGE = "#4b5730";
export const LOGO_COIN_LINE = "#1b2610";
export const LOGO_COIN_SYMBOL = "#37431f";

// Both symbols are drawn around (0, 0) for a coin of radius 96.
/** Front face: a dollar sign, as in the logo. */
export const COIN_DOLLAR =
  "M 24 -34 C 24 -58 -26 -58 -26 -30 C -26 -4 26 -10 26 18 C 26 46 -24 46 -24 22 M 0 -64 V 64";
/** Back face: a rupee sign, since the product is for India. */
export const COIN_RUPEE =
  "M -26 -40 H 28 M -26 -14 H 28 M -26 -40 H -2 C 32 -40 32 6 -2 6 H -26 L 22 62";

/** Where the swoosh begins and ends, which is where the coin rides it. */
export const COIN_RIDE_SCALE = 0.42;

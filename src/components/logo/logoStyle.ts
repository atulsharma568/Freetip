// Colours and hand-drawn coin symbols for the Freetip logo. The accent is the
// site's own lime (--color-accent) so the logo and the page agree; the coin
// shades are built around it. The symbols are strokes rather than text so the
// coin does not depend on any font (and works in OG images).

export const LOGO_ACCENT = "#bfe84a";
export const LOGO_COIN_LIGHT = "#e8f8a8";
export const LOGO_COIN_MID = "#bfe84a";
export const LOGO_COIN_DARK = "#93b82a";
export const LOGO_COIN_RIM = "#dff59a";
export const LOGO_COIN_EDGE = "#6c8a1a";
export const LOGO_COIN_LINE = "#2a380b";
export const LOGO_COIN_SYMBOL = "#222f08";

// Both symbols are drawn around (0, 0) for a coin of radius 96.
/** Back face: a dollar sign, as in the original artwork. */
export const COIN_DOLLAR =
  "M 24 -34 C 24 -58 -26 -58 -26 -30 C -26 -4 26 -10 26 18 C 26 46 -24 46 -24 22 M 0 -64 V 64";
/** Front face (the side the coin lands on): a rupee sign, since the product is for India. */
export const COIN_RUPEE =
  "M -26 -40 H 28 M -26 -14 H 28 M -26 -40 H -2 C 32 -40 32 6 -2 6 H -26 L 22 62";

/** Scale of the coin while it rides the swoosh, before it grows into the p. */
export const COIN_RIDE_SCALE = 0.42;

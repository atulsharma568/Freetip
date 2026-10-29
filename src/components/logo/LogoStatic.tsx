import {
  LOGO_BANG_BODY,
  LOGO_BANG_DOT,
  LOGO_BODY,
  LOGO_COIN,
  LOGO_I_DOT,
  LOGO_VIEWBOX,
} from "./logoPaths";
import {
  COIN_RUPEE,
  LOGO_COIN_DARK,
  LOGO_COIN_LIGHT,
  LOGO_COIN_LINE,
  LOGO_COIN_MID,
  LOGO_COIN_RIM,
  LOGO_COIN_SYMBOL,
  LOGO_OLIVE,
} from "./logoStyle";

// The finished logo with no animation and no hooks, so it can render in
// share images and other server-only places (Logo.tsx is the animated one).
// Plain gradient ids are fine here: each image holds one logo.
export function LogoStatic({ height, color = "#eff0ea" }: { height: number; color?: string }) {
  const [, , w, h] = LOGO_VIEWBOX.split(" ").map(Number);
  return (
    <svg width={Math.round((height * w) / h)} height={height} viewBox={LOGO_VIEWBOX} fill="none">
      <defs>
        <radialGradient id="logo-coin-face" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={LOGO_COIN_LIGHT} />
          <stop offset="0.55" stopColor={LOGO_COIN_MID} />
          <stop offset="1" stopColor={LOGO_COIN_DARK} />
        </radialGradient>
      </defs>
      <path d={LOGO_BODY} fill={color} fillRule="evenodd" />
      <path d={LOGO_I_DOT} fill={color} fillRule="evenodd" />
      <path d={LOGO_BANG_BODY} fill={LOGO_OLIVE} fillRule="evenodd" />
      <path d={LOGO_BANG_DOT} fill={LOGO_OLIVE} fillRule="evenodd" />
      <g transform={`translate(${LOGO_COIN.cx} ${LOGO_COIN.cy})`}>
        <circle r={LOGO_COIN.r} fill="url(#logo-coin-face)" stroke={LOGO_COIN_LINE} strokeWidth="6" />
        <circle r={LOGO_COIN.r - 13} stroke={LOGO_COIN_RIM} strokeWidth="6" opacity="0.85" />
        <path d={COIN_RUPEE} stroke={LOGO_COIN_SYMBOL} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Just the coin, for favicons and app icons. */
export function CoinMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="-100 -100 200 200" fill="none">
      <defs>
        <radialGradient id="coin-mark-face" cx="35%" cy="30%" r="80%">
          <stop offset="0" stopColor={LOGO_COIN_LIGHT} />
          <stop offset="0.55" stopColor={LOGO_COIN_MID} />
          <stop offset="1" stopColor={LOGO_COIN_DARK} />
        </radialGradient>
      </defs>
      <circle r="96" fill="url(#coin-mark-face)" stroke={LOGO_COIN_LINE} strokeWidth="8" />
      <circle r="80" stroke={LOGO_COIN_RIM} strokeWidth="7" opacity="0.85" />
      <path d={COIN_RUPEE} stroke={LOGO_COIN_SYMBOL} strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

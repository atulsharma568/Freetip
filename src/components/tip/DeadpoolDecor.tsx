"use client";

import { useId, useState, type ReactNode } from "react";
import { useMotionAllowed } from "./blocks/use-motion";

// The "Deadpool" look template (dashboard, Photo and banner effects).
// Drawn in code: the profile frame (a battered red mask with angry eyes, after the Discord original), the banner
// and the dressed-up form card. Delivered as real artwork the owner supplies (see docs/deadpool-template-assets.md):
// the avatar decoration, the nameplate art and the profile effect. These three are illustrated, animated pieces
// that code-drawn shapes cannot match, so each is a slot that shows its image file when the file exists and
// nothing when it does not. Every layer is decoration (aria-hidden, never takes a click). Motion is CSS only for
// the code-drawn parts and stops under prefers-reduced-motion; artwork shows its still (the `.poster.webp`) then.

function useUid() {
  return useId().replace(/[^a-zA-Z0-9]/g, "");
}

// A supplied picture of the template, /decorations/deadpool/<name>.webp (animated or still). With reduced motion,
// or before the page has loaded, it shows <name>.poster.webp if there is one. A missing file draws nothing and
// calls `onShow(false)`; a loaded one calls `onShow(true)`.
const ASSET_DIR = "/decorations/deadpool/";
function AssetImg({ name, className, onShow }: { name: string; className: string; onShow?: (shown: boolean) => void }) {
  const motion = useMotionAllowed();
  const [posterBad, setPosterBad] = useState(false);
  const [gone, setGone] = useState(false);
  const [ready, setReady] = useState(false);
  const still = !motion && !posterBad;
  if (gone) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a supplied file that may not exist; next/image would show a broken picture
    <img
      src={`${ASSET_DIR}${name}${still ? ".poster" : ""}.webp`}
      alt=""
      draggable={false}
      className={className}
      style={{ opacity: ready ? 1 : 0 }}
      onLoad={() => {
        setReady(true);
        onShow?.(true);
      }}
      onError={() => {
        if (still) {
          setPosterBad(true);
        } else {
          setGone(true);
          onShow?.(false);
        }
      }}
    />
  );
}

// ---- the eyes of the frame ----------------------------------------------------------------------------
// One eye in a 160 x 73 box, traced from the reference and lit like it: a glossy black socket (rim light along the top
// edge, a deep inner shadow, a faint bounce at the bottom lip) holding a sharp white wedge that is shaded round its
// edges, darkened under the socket's brow and softly glowing. `right` mirrors it.
function Eye({ right = false }: { right?: boolean }) {
  const uid = useUid();
  const socket = "M25 3.4 L123 12.6 Q142 14.5 150 24 Q156 32 155 50 Q154 66 142 69.5 L22 69.5 Q8 68 5 54 Q2.5 36 8 18 Q13 5 25 3.4 Z";
  const wedge = "M51.4 20.6 L123 51.6 Q113 56.6 98 56.4 Q74 56.2 62 43.5 Q54 34.5 51.4 20.6 Z";
  return (
    <svg aria-hidden="true" focusable="false" className={`dp-eye ${right ? "dp-eye-r" : "dp-eye-l"}`} viewBox="0 0 160 73" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#26262a" />
          <stop offset="0.14" stopColor="#0b0b0d" />
          <stop offset="0.7" stopColor="#020203" />
          <stop offset="1" stopColor="#101012" />
        </linearGradient>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b4b4ba" />
          <stop offset="0.35" stopColor="#6c6c72" />
          <stop offset="1" stopColor="#1c1c20" />
        </linearGradient>
        <radialGradient id={`${uid}w`} cx="0.62" cy="0.78" r="0.85">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#f2f2f3" />
          <stop offset="0.82" stopColor="#c4c4c8" />
          <stop offset="1" stopColor="#8e8e94" />
        </radialGradient>
        <linearGradient id={`${uid}o`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0.62" />
          <stop offset="0.5" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}c`}>
          <path d={socket} />
        </clipPath>
        <clipPath id={`${uid}k`}>
          <path d={wedge} />
        </clipPath>
        <filter id={`${uid}b`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.2" />
        </filter>
        <filter id={`${uid}g`} x="-30%" y="-40%" width="160%" height="180%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <g transform={right ? "translate(160 0) scale(-1 1)" : undefined}>
        <path d={socket} fill={`url(#${uid}s)`} />
        {/* inner shadow: a blurred dark stroke clipped to the socket */}
        <g clipPath={`url(#${uid}c)`}>
          <path d={socket} fill="none" stroke="#000" strokeWidth="9" filter={`url(#${uid}b)`} opacity="0.95" />
          <path d="M14 66 Q70 72 145 66" fill="none" stroke="#6a6a72" strokeWidth="2.2" filter={`url(#${uid}b)`} opacity="0.28" />
        </g>
        <path d="M13 11 Q18 6 27 5.4 L121 14.4" fill="none" stroke="#fff" strokeWidth="1.1" strokeLinecap="round" opacity="0.28" />
        <path d={socket} fill="none" stroke={`url(#${uid}r)`} strokeWidth="1.9" strokeLinejoin="round" />
        <path d="M27 7.2 L121 16.2 Q137 17.8 143 25 Q148 32 147.5 50 Q147 62 139 65 L24 65 Q13 64 10 53 Q8 38 12 22 Q16 9 27 7.2 Z" fill="none" stroke="#3a3a40" strokeWidth="0.8" opacity="0.8" />
        {/* the eye: a glow behind, the shaded wedge, the brow's shadow across it, a thin dark edge and a catch-light */}
        <path d={wedge} fill="#fff" opacity="0.5" filter={`url(#${uid}g)`} />
        <path d={wedge} fill={`url(#${uid}w)`} />
        <g clipPath={`url(#${uid}k)`}>
          <path d="M40 14 L130 14 L130 40 L40 28 Z" fill={`url(#${uid}o)`} />
          <path d={wedge} fill="none" stroke="#6a6a70" strokeWidth="3" opacity="0.45" />
        </g>
        <path d={wedge} fill="none" stroke="#0a0a0c" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M60 46 Q80 54 108 54" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
      </g>
    </svg>
  );
}

// The profile frame, copied from the Discord Deadpool frame: a battered red mask around the card, chipped paint,
// two black angry eyes with sharp white slashes across the top, small tabs at the sides. The card sits in the
// opening with a thin dark line round it. Padding leaves room for the eyes.
export function DeadpoolFrame({ children, card = false }: { children: ReactNode; card?: boolean }) {
  return (
    <div className={`dp-frame ${card ? "dp-frame-card" : ""}`}>
      <Eye />
      <Eye right />
      <span aria-hidden="true" className="dp-tab dp-tab-l" />
      <span aria-hidden="true" className="dp-tab dp-tab-r" />
      {children}
    </div>
  );
}

// ---- the avatar decoration (a supplied picture) -------------------------------------------------------
// avatar-decoration.webp: a transparent square with a clear middle for the photo, drawn over it about 1.4 times
// the photo's size (like a Discord avatar decoration).
export function DeadpoolRing() {
  return (
    <span aria-hidden="true" className="dp-ring">
      <AssetImg name="avatar-decoration" className="dp-asset dp-asset-contain" />
    </span>
  );
}

// ---- the banner ---------------------------------------------------------------------------------------
// A dark crimson scene: smoky red fog, two slow beams of light on the diagonal, the mask as a glossy emblem on the
// right (same sharp eyes as the frame) and a thin glowing edge along the bottom. It fills its 16:5 box and
// covers the creator's own banner picture while the template is on.
export function DeadpoolBanner() {
  const uid = useUid();
  return (
    <svg aria-hidden="true" focusable="false" className="dp-banner" viewBox="0 0 320 100" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={`${uid}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#12060a" />
          <stop offset="0.55" stopColor="#3a0a11" />
          <stop offset="1" stopColor="#1a070b" />
        </linearGradient>
        <radialGradient id={`${uid}m`} cx="0.35" cy="0.25" r="0.9">
          <stop offset="0" stopColor="#f0545b" />
          <stop offset="0.45" stopColor="#b3121b" />
          <stop offset="1" stopColor="#4d070d" />
        </radialGradient>
        <radialGradient id={`${uid}r`} cx="0.8" cy="0.5" r="0.7">
          <stop offset="0" stopColor="#ff4a52" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ff4a52" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}l`} x1="0" x2="1">
          <stop offset="0" stopColor="#ff6a70" stopOpacity="0" />
          <stop offset="0.5" stopColor="#ff6a70" />
          <stop offset="1" stopColor="#ff6a70" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}e`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#c4c4c4" />
        </linearGradient>
        <filter id={`${uid}n`} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.02" numOctaves="4" seed="5" />
          <feColorMatrix values="0 0 0 0 0.85  0 0 0 0 0.1  0 0 0 0 0.14  1.5 0 0 0 -0.45" />
        </filter>
        <linearGradient id={`${uid}v`} x1="0" x2="1">
          <stop offset="0" stopColor="#0a0405" stopOpacity="0.85" />
          <stop offset="0.6" stopColor="#0a0405" stopOpacity="0.25" />
          <stop offset="1" stopColor="#0a0405" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="100" fill={`url(#${uid}b)`} />
      <rect width="320" height="100" filter={`url(#${uid}n)`} opacity="0.55" />
      <rect width="320" height="100" fill={`url(#${uid}r)`} />
      {/* no face here: the profile effect brings the character. Just crimson smoke, two blade-sharp diagonal cuts and a bullet-hole spray on the right */}
      <path d="M170 -4 L214 104 L196 104 L152 -4 Z" fill="#050506" opacity="0.55" />
      <path d="M232 -4 L268 104 L260 104 L224 -4 Z" fill="#ff4a52" opacity="0.16" />
      <g fill="#050506" stroke="#ff6a70" strokeOpacity="0.35" strokeWidth="0.8">
        <circle cx="288" cy="22" r="3.2" /><circle cx="302" cy="38" r="2.2" /><circle cx="279" cy="44" r="1.8" /><circle cx="296" cy="16" r="1.4" />
      </g>
      {/* beams of light across the scene */}
      <g className="dp-beams">
        <path d="M-20 100 L90 -10 L102 -10 L-8 100 Z" fill="#ff6a70" opacity="0.07" />
        <path d="M40 100 L150 -10 L158 -10 L48 100 Z" fill="#ff6a70" opacity="0.05" />
      </g>
      <rect width="320" height="100" fill={`url(#${uid}v)`} />
      <rect y="95.4" width="320" height="1.2" fill={`url(#${uid}l)`} opacity="0.9" />
      <rect y="96.6" width="320" height="3.4" fill="#120508" />
      <rect className="dp-sheen" x="-90" y="0" width="60" height="100" fill="#fff" opacity="0.06" transform="skewX(-20)" />
    </svg>
  );
}

// ---- the nameplate ------------------------------------------------------------------------------------
// A dark strip fading from near-black on the left to crimson on the right (as in the reference), lit along its top
// edge, with the supplied nameplate.webp over its right side when that file exists. The name keeps its own heading.
export function DeadpoolNameplate({ children }: { children: ReactNode }) {
  return (
    <span className="dp-plate">
      <AssetImg name="nameplate" className="dp-plate-art" />
      <span className="dp-plate-name">{children}</span>
    </span>
  );
}

// ---- the profile effect (a supplied picture) -----------------------------------------------------------
// profile-effect.webp: a transparent animation drawn over the header (the way a Discord profile effect covers the
// card). It plays once or loops as the artist made it; with reduced motion the still shows.
export function DeadpoolEffect() {
  return (
    <span aria-hidden="true" className="dp-fx">
      <AssetImg name="profile-effect" className="dp-asset dp-asset-cover" />
    </span>
  );
}

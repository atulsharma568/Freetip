# Tipsite

Pre-launch landing page for a tipping site for Indian YouTube creators. Fans pay a tip from a creator's page with UPI or card, with no account. Payments are not integrated and sign-up is a stub.

Next.js 16 (App Router), Tailwind v4, GSAP with ScrollTrigger, Lenis smooth scroll, and one vendored React Bits component (ClickSpark).

## Run

```bash
npm run dev      # http://localhost:3000
npm run build && npm run start
```

## Where things are

- `PRODUCT.md`: what the product is, what is confirmed, and what must not be claimed.
- `DESIGN.md`: the visual system (colors, type, shapes, components, rules).
- `src/lib/site.ts`: placeholder name, host and sample handle.
- `src/components/hero/TipCard.tsx`: the self-playing sample tip card.
- `src/components/sections/Differentiators.tsx`: the competitor-led "Why Tipsite" section covering no fan email/account, anonymous tips, QR-first sharing and safer approved text-to-speech.

## Placeholders to replace

Name `Tipsite`, host `tipsite.in`, sample handle `aarav`, the sample creator, and the claim form (it only validates and says sign-up is not open).

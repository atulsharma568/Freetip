# Custom alert box and regional voices: overview (paid feature, not built yet)

Owner idea, 2026-11-01: "Custom Alertbox + TTS. Upload GIFs, WebM videos and custom sounds. Hindi and English voice, plus Indian regional voice accents, reading viewer messages aloud on stream." Meant for the paid version. This file is the plan; nothing here is built yet and no price or plan name goes on the site until the owner decides.

## What already exists

- OBS alert card with the fan's name, amount and message, three sizes, instant, split or approve-first modes, the creator's accent colour, goal bars (`/overlay/<token>`).
- Soundboard: creators upload their own sounds, each with a minimum tip and volume, plus a default (`creator_sounds`, migration 0013).
- Voice: Hindi and English through Azure Speech (Amazon Polly as backup), male or female, Roman Hindi turned into Devanagari first, clip cache and character caps. A tip uses a sound or the voice, never both.

## What this adds

1. **Alert media.** A creator uploads a GIF, a short WebM video or an image that shows inside the alert card (or as the whole alert), with sound from the soundboard or the voice.
2. **Rules by tip size.** For example: under ₹100 the plain card, ₹100 and up a GIF, ₹500 and up a WebM with its own sound. The same minimum-tip idea the soundboard already uses, applied to media.
3. **Regional voices.** Voices for more Indian languages than Hindi and English.

## Things to be honest about

- **Regional "accents" are really other languages.** Azure Speech has neural voices for several Indian languages (Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati and others; exact list, voices and free-tier use to be confirmed before building). It does not offer "Hindi with a Tamil accent". Each message must also be read in the right language: Devanagari, Tamil and the other scripts can be detected by script, but a message typed in Roman letters (Tanglish, Telugu in English letters) needs a dictionary like our Hinglish one, which does not exist and is a large job per language. Start with messages typed in the native script and let the creator pick a default language.
- **Video is the expensive part.** Storage and bandwidth on Vercel Blob grow fast with video. Suggested limits to start: GIF or image up to 3 MB, WebM up to 8 MB and 10 seconds, a total per creator, files re-checked on upload (type and size on the server, not just the browser), and the same owner removal tool as sounds (`/admin/sounds`) extended to media. The overlay should preload media before showing the alert so OBS does not stutter.
- **Uploads can be abusive.** Creators upload their own files, but copyrighted clips or adult content on a stream tied to our name is a real risk: terms and community guidelines already say creators are responsible; the owner needs a fast removal path and a report route.
- **Voice cost.** More voices and longer messages mean more characters from the Azure free allowance (see the monthly allowance discussion: about 500,000 characters free across the whole site, about ₹0.14 per 100-character message once paid). A paid plan is the natural place for a bigger per-creator allowance.

## How it would be gated

`src/lib/plans.ts` already exists (every feature on for everyone today). Add two switches, `customAlertMedia` and `regionalVoices`, and make the free level the current card plus soundboard plus Hindi and English voice. Turning them paid later is one edit plus the billing flow, which is blocked on the same legal and provider questions as payouts.

## Build order (each its own migration, commit and check)

1. **Media uploads and rules by tip size.** Upload action reusing the sound upload path (`src/app/actions/sounds.ts`, Vercel Blob), a media list page next to Sounds, the overlay and tip-page preview showing media, admin removal.
2. **Regional voices.** Language detection by script, voice choice per language in settings, the test-voice button gets the language, cache keys already include the voice.
3. **Polish.** Per-media volume and duration, preload in the overlay, usage numbers for the owner.

## Questions for the owner

- Which paid-feature bundle: media only, voices only, or both together?
- Start regional voices with which languages (those your creators ask for)?
- Allowed formats: GIF and WebM only, or also MP4?

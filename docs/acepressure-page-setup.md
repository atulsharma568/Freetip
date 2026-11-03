# AcePressure: the fullest tip page, step by step

The owner's own channel (`@AcePressure`, signed in as the Google account behind it). Written 2026-11-03.

The tip page is one shared design; what makes a page different is the switches and settings below. Nothing here needs code. Work in this order, because later steps need the earlier ones.

Not known to us: what the channel streams and its look (the public YouTube page gave us only its name). Wording and colours marked "your call" depend on that.

## 1. Owner: in `/admin/creators/<id>` (Paid features box)

Run migrations 0045 to 0048 and 0050 in Neon first (`OPERATIONS.md` section 5), then deploy, then tick every built switch for this creator:

- Tip page: Banner on the tip page (also covers the YouTube photo).
- Alert box: Custom alert media, Tip page picks, Regional language voices, Overlay themes and fonts, Paid highlighted messages, Alert text and colours, Alert animations and timing, Automatic tiers by tip size, Alert volume and layout.
- Fans: Fan levels (XP), Fan list (CRM).
- OBS overlays: Support streak, Top supporter, Recent supporters.
- Stream timestamps: all five (needs `YT_DATA_API_KEY`, `YT_TOKEN_KEY` and the YouTube connect from `OPERATIONS.md` 7b).
- Streamlabs alerts: only if the channel uses Streamlabs; it overlaps with our own alert.

## 2. Creator: in the dashboard, signed in as the channel's account

| Page | What to set |
|---|---|
| `/dashboard/banner` | Press "Use my YouTube banner", then "Use my YouTube photo". Check the preview; the banner crops to its middle, so if the logo sits at the edge, upload a 1600 by 500 picture instead. |
| `/dashboard` settings | Display name `AcePressure`. Bio, 160 characters at most (your call; one line on what the stream is and a thank-you). Minimum tip: low enough to be easy. Alert mode: instant for a trusted chat, approve-first if the chat gets rowdy. |
| `/dashboard` accent | Pick a preset by eye next to the banner. Lime matches Freetip itself; "auto from picture" still reads the Google account photo, not the YouTube one. |
| `/dashboard` goal | One to three goals (a new setup, a stream day). The goal bar overlay shows them. |
| `/dashboard/sounds`, `/dashboard/media` | Upload the channel's own sounds, GIFs and short clips. New media waits for the owner's approval in `/admin/media`. |
| `/dashboard/rules` | Picks fans tap on the tip page: a GIF with its sound at a fixed amount, for example ₹50, ₹100, ₹500, ₹1,000. Keep to about five so the row stays readable. |
| `/dashboard/variations` | Automatic tiers: bigger tips get a bigger alert, longer stay and a louder sound. |
| `/dashboard/style`, `/dashboard/text`, `/dashboard/motion`, `/dashboard/layout` | One look for the whole alert: font and card style, wording and colours, the entrance and exit, picture position and volume. Use each page's preview; it stays pinned while you scroll. |
| `/dashboard/pinned` | Paid highlighted messages: set a minimum (for example ₹500) and how long it stays up. |
| `/dashboard` voice | Voice on, with a regional language only if the audience speaks it; listen to the voice with "Test the voice" first. |
| `/dashboard/fans` | Fan levels and the fan list. Fans are known by name only, which is stated in the privacy policy. |
| `/dashboard/timestamps` | Make the chat command, connect YouTube, optionally a Discord webhook. |
| OBS | Add the alert link as a browser source (1920 by 1080). The streak, top and recent overlays use the same link plus `/streak`, `/top` and `/recent`. |

## 3. Check before sharing the link

Open `freetip.in/<handle>` on a phone and on a laptop. Send a real small tip and look for: the alert in OBS, the voice, the sound, the pick, the goal moving and the entry in `/dashboard/tips`. None of the alert studio has been seen in a browser or OBS yet (see `PROGRESS.md`), so expect to adjust things.

## 4. If you want a layout nobody else has

Everything above is available to any creator you switch it on for. A layout built only for this handle would be code that special-cases one creator. If you want that, say what it should look like (for example a full-width banner header, a custom hero section or a different arrangement of the three steps) and it can be built as a general feature that you switch on for this creator only.

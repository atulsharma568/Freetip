---
name: Tipsite
description: A dark, flat tipping page for Indian YouTube streamers. One acid-lime accent is spent as full fields at the moment a tip lands.
colors:
  ground: "oklch(0.155 0.008 115)"
  surface: "oklch(0.205 0.009 115)"
  raised: "oklch(0.26 0.01 115)"
  line: "oklch(0.36 0.01 115)"
  control: "oklch(0.52 0.011 115)"
  muted: "oklch(0.74 0.01 110)"
  text: "oklch(0.95 0.006 110)"
  accent: "#bfe84a"
  ink: "oklch(0.2 0.025 120)"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 9vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 82"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 82"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 4vw, 3rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.015em"
    fontVariation: "'wdth' 82"
  body:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  button:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  label:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  amount:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: "1.5rem"
    fontFeature: "'tnum'"
  numeral:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "clamp(4.5rem, 18vw, 7rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
    fontFeature: "'tnum'"
rounded:
  field: "12px"
  surface: "20px"
  pill: "9999px"
spacing:
  gutter: "24px"
  tile-gap: "16px"
  heading-gap: "64px"
  heading-gap-wide: "96px"
  section: "128px"
  section-wide: "192px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "56px"
    padding: "0 32px"
  button-primary-compact:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 20px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.accent}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "64px"
    padding: "0 32px"
  button-outline-ink:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 20px"
  button-outline-ink-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.accent}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    typography: "{typography.amount}"
    rounded: "{rounded.pill}"
    height: "48px"
  chip-selected:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
  field:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.text}"
    rounded: "{rounded.field}"
    height: "48px"
    padding: "0 16px"
  field-handle:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.amount}"
    rounded: "{rounded.pill}"
    height: "64px"
    padding: "0 24px"
  card-tip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "24px"
  tile-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.ink}"
    rounded: "{rounded.surface}"
    padding: "32px"
  tile-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "32px"
  tile-raised:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
    padding: "32px"
  nav-scrolled:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.muted}"
    height: "64px"
---

# Design System: Tipsite

## Overview

**Creative North Star: "The Moment It Lands"**

The whole system is a dark room with one light that switches on when money arrives. Almost everything is warm near-black, off-white type and hairlines. The single acid-lime accent is held back and then spent in full fields: the tip card flooding lime on success, the stream alert, the UPI tile, the closing section. Lime reads as an event, not a decoration.

It is flat and exact. There are no shadows, gradients, glows or blurs. Depth comes from three tonal steps, and the lime fields are the loudest layer. Type does the personality work: a condensed, heavy Bricolage Grotesque for headlines, the same family at normal width for sentences, and Geist Mono reserved for money and the handle. Motion exists to demonstrate the product. The hero hands exchange a lime ₹ note once, a sample card plays itself and lights the headline beats, a sample stream alert lights its message word by word, and every motion is gated off under reduced motion.

The owner pinned the direction as dark, flat and one sharp accent, and the page must not look AI-generated or templated. The system refuses the streamer-tool default of neon glow, mesh gradients and dense grids of feature cards. The "Why Tipsite" section is one deliberate bento-style explanation of the product edge, not a catalogue of every possible feature.

**Key Characteristics:**
- Warm-tinted near-black ground with off-white text. One lime accent plus its dark ink, and no second hue.
- Lime is spent as full fields or solid pills, never as glow, gradient, outline or tint. The one exception is the beam button's moving segment and its reduced-motion ring, shown only on hover or keyboard focus.
- One sans family at two widths (82% for display, 100% for text) plus a mono for money.
- Flat at rest: no shadows. Three tonal steps and 1px hairlines carry structure.
- Pills for actions, 20px surfaces, 12px inputs.
- Motion is demonstration: expo-out reveals, a self-playing card, reduced motion honored.

## Colors

A warm, olive-tinted neutral ladder (hue 110 to 120) with one acid-lime accent and the near-black ink that sits on it.

### Primary
- **Acid Lime** (#bfe84a, oklch(0.873 0.185 122.9)): The only accent. It fills whole areas: the tip card's success state, the stream alert, the UPI tile, the closing section. It also fills every primary pill, the selected chip, the avatar and the lit headline beat. It is the selection highlight, text caret and default focus ring on dark surfaces.

### Neutral
- **Warm Night** (oklch(0.155 0.008 115), about #0c0d09): Page ground and the well behind form fields.
- **Card Dusk** (oklch(0.205 0.009 115), about #171813): Surfaces: the sample tip card and the Cards tile.
- **Raised Smoke** (oklch(0.26 0.01 115), about #24251f): The one raised tile ("What it costs"), a quiet step above surface.
- **Hairline** (oklch(0.36 0.01 115), about #3d3e38): Decorative lines only: nav and footer rules, FAQ and step dividers, tile borders. It measures 1.8:1 on ground by design and is never a control edge.
- **Control Edge** (oklch(0.52 0.011 115), about #686a63): Borders of interactive controls, meaning fields and unselected chips. It measures 3.56:1 on ground and 3.26:1 on surface.
- **Ash** (oklch(0.74 0.01 110), about #ababa4): Secondary text: sublines, labels, placeholders, nav links. It measures 8.5:1 on ground, 7.8:1 on surface and 6.7:1 on raised.
- **Chalk** (oklch(0.95 0.006 110), about #eeefea): Primary text and headlines. It measures 16.9:1 on ground.
- **Field Ink** (oklch(0.2 0.025 120), about #14180b): Text, borders and fills on lime. It measures 12.8:1 on Acid Lime. Secondary ink on lime (prefix, placeholder) is Field Ink at 85%, which measures 4.6:1.

### Named Rules
**The Full Field Rule.** Lime is a surface, not a highlight. It fills a whole tile, card state, section or solid pill. It never glows, fades, outlines or tints.

**The Ink-On-Lime Rule.** Everything that sits on lime is Field Ink: text, borders, icons, buttons and keyboard focus rings. The `on-accent` wrapper flips the ring from lime to ink. Chalk and Ash never appear on lime.

**The Edge Rule.** Hairline separates and Control Edge identifies. A line a user must see to find or press a control uses Control Edge. Hairline is decoration only.

## Typography

**Display Font:** Bricolage Grotesque at 82% width, weight 800 (fallback system-ui)
**Body Font:** Bricolage Grotesque at 100% width, automatic optical size, weights 400 to 600
**Label/Mono Font:** Geist Mono with tabular figures, for amounts and the handle only

**Character:** One characterful grotesque stretched two ways: a condensed black voice for headlines and plain-spoken regular-width sentences. The mono appears only where numbers matter, so money looks like money.

### Hierarchy
- **Display** (800, clamp(3.25rem, 9vw, 6rem), 0.98): Hero beats, the closing headline and step verbs. Tracking -0.015em, word spacing +0.03em, balanced wrapping.
- **Headline** (800, clamp(2.5rem, 6vw, 4.5rem), 0.98): Section titles.
- **Title** (800, clamp(2.25rem, 4vw, 3rem), 0.98): Tile titles such as "Cards" and "What it costs".
- **Body** (400, 1.125rem to 1.25rem, 1.75rem): Sublines and answers, pretty wrapping, measure 34ch to 56ch. FAQ questions use the same face at 600 and 1.25rem to 1.5rem.
- **Button** (600, 1rem, 1.5rem): Every button label.
- **Label** (500, 0.875rem, 1.25rem): Field and group labels, nav links, footer.
- **Amount** (400, 1rem, Geist Mono): Amount chips and the handle field.
- **Numeral** (600, clamp(4.5rem, 18vw, 7rem), 1, -0.025em, Geist Mono): The success amount on the tip card and the amount on the stream alert, larger than every headline on its screen. The UPI tile lettering (up to 11rem) is a one-off graphic and not a type role.

### Named Rules
**The Money-In-Mono Rule.** Amount chips, the success numeral, the alert amount and the handle field are Geist Mono. Running text and button labels are not.

**The Two-Widths Rule.** One sans family only: 82% width at weight 800 for display, 100% width for everything else. Never add a second sans or a serif.

## Layout

One container, `max-w-7xl` (1280px) with 24px side gutters, on a 12-column grid from md up. The hero is a full-viewport two-column grid (7/5 at lg) with the headline bottom-anchored on the left and a 26rem card starting higher on the right. Sections stack with 128px of space below (192px from md) and 64px between a section title and its content (96px from md). On stream is a 5/7 split with the copy on the left and the alert tile on the right. Fees is a 12-column bento: the UPI tile takes 7 columns across two rows and the other two tiles share 5. The FAQ is a 5/7 split with a sticky title. The nav is fixed at 64px and anchors use a 96px scroll margin.

Below md the nav drops its links, leaving wordmark and claim pill. The hero stacks copy above the card, the closing form stacks field over button, and the closing section's scroll expansion is disabled. The closing section is a full-bleed lime field that, from md up and with motion allowed, expands from an inset rounded shape to full width as it scrolls into view.

The "Why Tipsite" section follows the stream alert. It uses a tall fan-friction tile beside two shorter payment and QR tiles, then a full-width safety tile. On small screens these tiles stack in reading order. The QR is an illustration labelled "Non-scannable sample QR" until real creator pages exist.

## Elevation & Depth

Flat. There is no box-shadow, text-shadow, gradient, glow or backdrop blur anywhere. Depth is tonal (Warm Night, Card Dusk, Raised Smoke) with the lime fields as the loudest layer. A state change is a color flip or a clip-path wipe, such as the success flood, and never a lift. The scrolled nav is a solid Card Dusk capsule with a 60% Hairline border, so content never ghosts through it and it holds its edge over a lime field.

### Named Rules
**The Flat At Rest Rule.** Nothing casts a shadow. If a layer must stand apart, use the next tonal step or a Hairline. If it must be the event, make it a lime field.

## Shapes

Three radii and no others: pill (9999px) for every action control (buttons, chips, the handle field), 20px for surfaces (the tip card, the stream alert and the fee tiles), and 12px for text inputs. Borders are 1px. The only 2px borders are Field Ink outlines on lime: the closing handle field and "Tip again". Clip-path is a motion device (the circle flood on success, top-down tile wipes, the closing expansion), not a static silhouette.

The closing handle field is a pill instead of 12px because it sits beside a pill button. This is a deliberate, documented exception.

## Components

### Buttons
- **Shape:** Pill (9999px). Heights: 40px in the nav, 56px for the hero CTA and the card submit, 64px for the closing submit, 44px for "Tip again".
- **Primary:** Acid Lime fill, Field Ink text, 600 weight, 32px side padding (20px and 14px type in the nav). The hero CTA ends in a 40px Field Ink circle holding a lime Phosphor arrow (arrow endcap, 8px right padding); on hover or focus the arrow flies out up-right and a fresh one slides in from the lower left (500ms expo).
- **Ink:** On lime fields, Field Ink fill with Acid Lime text (the closing submit).
- **Outline Ink:** Transparent with a 2px Field Ink border. Hover fills Field Ink with Acid Lime text ("Tip again").
- **Hover / Focus:** Press scales to 0.97 (0.98 on the full-width card submit) over 200ms. A magnetic pull applies on hover-capable pointers only. Focus is a 2px ring offset 3px, lime on dark and ink on lime.
- **Text link:** Chalk with a 1px Hairline underline at 0.25em offset. The underline turns lime on hover.
- **Beam:** A solid lime segment with hard ends runs around the pill once every 1.6s while it is hovered (hover-capable pointers) or keyboard-focused, and fades out when left. It is the `.beam` class in `globals.css`: a hard-stop conic gradient masked to a 2px ring, so it draws one flat segment, never a blend or glow. Under reduced motion the full ring lights up and holds still. Used on the hero's secondary "See how it works" (a 56px pill with a 1px Hairline border, beam on the edge) and on the closing ink submit (beam inset 5px so it stays inside the ink pill against the lime field). Never on the primary lime buttons. The idea came from a reference "gradient beam" button, rebuilt flat in our palette; no third-party code is used.

- **Letter roll:** Pill button labels roll up letter by letter (16ms stagger, 550ms expo) on hover or keyboard focus and land on the same label (`RollText` + `.roll`). The hero CTA arrow nudges up-right at the same time. Screen readers get the plain label. Used on the nav, hero and closing CTAs and the card submit.
- **Sending state:** The card submit shows "Sending ₹amount" with a stepped-ticks loader for about 1.1s before the success flood. Reduced motion skips straight to success.

### Switch
A flat on/off switch (`Switch`, `role="switch"`): 48 by 28px pill. Off is a Smoke Control outline on Warm Night with a muted thumb; on fills Acid Lime with a Field Ink thumb that slides across over 300ms expo. The thumb stretches while pressed. Labelled with a visible `<label>`. In the sample card it is "Tip anonymously": on clears and disables the name field, which then reads "Anonymous".

### Stepped-ticks loader
`TickLoader`: a row of 3px ticks in currentColor (every fourth taller, like gauge marks) that switch on one step at a time from 25% to full and hold. Ink on lime in the card submit; it can be lime on dark elsewhere. Decorative only, always next to words saying what is happening. Adapted flat from a reference "uplink" loader: no neon, scanlines or grain.

### Chips
- **Style:** Pill, 1px Control Edge border, Chalk text. Amount chips are 48px and Geist Mono, payment-method chips are 44px and use the label face.
- **State:** Selected chips fill Acid Lime with Field Ink text, a lime border and weight 600. Hover on an unselected chip brightens its border to Ash. Both groups are real radio inputs beneath the chips with a visible focus ring.

### Cards / Containers
- **Corner Style:** 20px.
- **Background:** Card Dusk with a 1px Hairline border at 60% for the tip card, Card Dusk with a full Hairline for the Cards tile, Raised Smoke for the cost tile, Acid Lime for the UPI tile and the stream alert.
- **Shadow Strategy:** None (see Elevation & Depth).
- **Internal Padding:** 24px in the tip card, 32px in tiles and the stream alert (40px from md).

### Inputs / Fields
- **Style:** 48px high, 12px radius, Warm Night fill, 1px Control Edge border, Chalk text, Ash placeholder, 16px side padding.
- **Focus:** The border turns Acid Lime and the global 2px ring appears. The closing handle is a 64px pill outlined in 2px Field Ink with the focus ring drawn on its wrapper.
- **Error / Disabled:** An invalid handle sets `aria-invalid` and shows one plain sentence in a polite status region below the field. There is no red.

### Navigation
- **Style:** Fixed. At the top it is a transparent 64px full-width bar. Once the page scrolls 16px it eases (500ms expo) into a floating capsule: 56px tall, 12px from the top, at most 56rem wide (12px side margins on small screens), Card Dusk fill, a 60% Hairline border and a full pill radius, so it holds its edge over the lime closing field. Wordmark in Display, links in Ash at 14px, one lime pill at the right.
- **Link highlight:** A solid Acid Lime pill slides (500ms expo) behind whichever link is hovered or keyboard-focused, and that link turns Field Ink. It fades out when the pointer leaves the links. Adapted from a reference "command bar" dock, rebuilt flat.
- **Mobile:** Links are removed below md.

### Tip Card (signature component)
The self-playing sample. It carries the line "Sample page. No payment is taken." and plays a scripted tip once: it picks 250, types a name and a short message, and lights the three headline beats in turn. It waits for the hero hands to finish, then starts when the card is half in view (at once beside the headline on desktop, after a short scroll on stacked layouts). After a short "Sending" beat with stepped ticks on the submit button, it floods Acid Lime from the bottom of the card with the amount on odometer reels (`Odometer`: each digit spins one full turn and lands, the rightmost last; reduced motion shows the digits at rest), a Field Ink badge and a short ink spark burst fanned above the badge. Any pointer or focus kills the demo and hands over control. While the success state shows, the form is inert and keyboard focus moves to "Tip again", which resets the card and returns focus to the chosen amount.

### Stream Alert
The sample of what viewers see on a streamer's stream when a tip lands. It sits inside a Card Dusk "stream screen" (a LIVE chip with a lime dot and a "Sample stream" label). The screen starts tilted away in perspective (rotateX 24°, rotateY −18°, 88% scale) and scrubs flat as it scrolls up to the middle of the viewport; flat CSS 3D, no shadow. The alert is an Acid Lime card in the screen's lower left, labeled "Sample alert. Nothing is sent to a stream." Everything on it is Field Ink: the fan's name with "tipped", the amount as a Numeral, and the message beside a bold speaker icon. It plays the same sample tip as the hero card, kept in one shared object so the two cannot drift. Once the screen faces the viewer, the alert wipes in from its top edge. Then the message lights one word at a time as text-to-speech would read it: a Field Ink pill with Acid Lime text that snaps from word to word with no fade, then clears. Under reduced motion the screen is flat, the alert static and no word lights. The tile is a labeled group and the message stays plain text, so the lit pill is decoration only.

### Alert Fan
On screens 1280px and wider, labelled sample alerts fan out from behind the hero tip card's left edge, tucked 3.5rem under it: up to three cards, each turned a little further (−4°, −11°, −18°) and stepped up and left. The front one is Acid Lime with Field Ink text, the others Raised Smoke with a Hairline border. When the card's success state settles (after the odometer lands), the tip it "sent" deals out from behind the card to the front (900ms expo), the others step back and the oldest fades out. Two sample alerts are fanned from the start. Decorative and `aria-hidden`; every card says "Sample alert". Hidden below 1280px, where there is no room beside the headline.

### Steps Rail
"How it works" has four steps: Claim, Share, Go live, Get paid. From md up with motion allowed, the section pins for one screen and the steps slide left as the page scrolls (scrubbed), while a 3px Acid Lime line fills a Hairline track under the heading; each verb rises as it enters. On phones, and under reduced motion, it is the stacked list with a Hairline rule above each step.

### Fee Odometer
The "What it costs" tile leads with "5%" in Geist Mono on odometer reels. It stays hidden until the tile is well in view, then the reel spins a full turn and lands on 5. The reels render at rest on their digit, so without motion it reads "5%" directly. The fee wording beside it stays the plain sentence "We take 5% of every tip."

### Hero Handoff
The hero handoff is a flat, decorative GSAP SVG band above the sample tip card, full-bleed on phones and spanning the hero on desktop. The fan's lighter hand enters from the left pinching a lime ₹ note; the streamer's muted hand enters open from the right, its fingers close over the note, the fan's pinch opens with a small tick burst, and the streamer leaves with the note. It plays once (about 2.7 seconds) when the band scrolls into view, after a short delay so the headline and CTA come first, and the sample tip card starts only after it ends. Only transforms and opacity animate; every turning part rotates around its own pivot. It has no shadow, gradient or realistic currency detail, and lime appears only on the note. The component is `aria-hidden`. Under reduced motion it shows the static exchange frame. Owner status: approved for now (2026-10-14), may be revised.

### Why Tipsite
The competitor-led differentiator section is a calm bento composition of surfaces, not a feature wall. It uses one accent tile for UPI + card, a dark fan-friction tile for no account/no email/anonymous tipping, a raised QR tile with a non-scannable sample illustration, and a surface tile for the three-step safety treatment. Labels distinguish planned product behavior from a working feature, and the QR must remain labelled as a sample until it is generated from a real creator handle.

### Accordion
FAQ rows have 24px vertical padding and Hairline dividers. Questions are 600 weight in the body face, with a bold Plus that rotates 45 degrees over 500ms. Answers expand by grid-rows with expo-out easing, and question hover turns lime.

## Do's and Don'ts

### Do:
- **Do** spend Acid Lime as a full field or a solid pill, and put Field Ink on it.
- **Do** draw control edges with the Control Edge token and decoration with Hairline.
- **Do** keep text on Warm Night at Ash or brighter (8.5:1 or better).
- **Do** wrap lime fields in `on-accent` so keyboard focus rings flip to ink.
- **Do** set headlines at 82% width and weight 800 with balanced wrapping, and body at 100% width.
- **Do** gate every motion on `prefers-reduced-motion: no-preference` and leave a static equivalent.
- **Do** label sample content as a sample wherever it appears.

### Don't:
- **Don't** add shadows, gradients, glows, blurs or a second accent hue.
- **Don't** use Hairline for the edge of anything a user must find or press.
- **Don't** set Chalk or Ash text on Acid Lime.
- **Don't** set mono outside amounts and the handle.
- **Don't** add a second sans family or a serif.

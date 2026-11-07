# Deadpool template: art files

The three files are original art drawn in code by `tools/decor-render/merc-art.html` and rendered with
`node tools/decor-render/merc-art.mjs build` (needs Chrome and `brew install webp`; takes a few minutes).
Edit the scene, rebuild, done. You can also replace any file with your own art in the same format.

The Deadpool template draws the frame, eyes, banner and form card in code. Three pieces are
illustrated art and are loaded from files. Until a file exists, its slot is simply not drawn.
Put the files in `public/decorations/deadpool/`. You must own, or have a licence for, the art.

| File | What it is | Size and format |
| --- | --- | --- |
| `avatar-decoration.webp` | Ring or decoration around the photo. Transparent middle. Sits about 1.4x the photo size. | Square, 512x512 or larger, transparent. Animated WebP allowed. |
| `nameplate.webp` | Art behind the creator name. Keep the left 55% quiet for the name; put the art on the right. | Wide strip, for example 1000x200, transparent. Animated WebP allowed. |
| `profile-effect.webp` | Animation over the header, for example a character leaping in. | About 600x700, transparent. Animated WebP allowed. |

Each file may have a still twin named `<name>.poster.webp` (for example `nameplate.poster.webp`).
It is shown when the visitor prefers reduced motion. Without one, the animated file is used.

To convert GIFs to animated WebP plus poster, see `tools/decor-render/import-gifs.mjs`.

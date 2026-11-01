# Suggesting Hinglish spellings offline (IndicXlit)

Why: the voice reads Roman Hindi by converting it to Devanagari with our own word
tables (`src/lib/hinglish-words.ts`). Words it does not know are logged in
`/admin/tts-words`. IndicXlit (AI4Bharat, Apache-2.0, free for commercial use) is a
trained Roman-to-Devanagari model that can suggest spellings for those words. It runs
on your computer only, never on the site, and you decide what is added.

Do not copy code or data from the `harrrshall/hinglish-tts` repo: its licence is
unclear and its word lists are tiny.

## Run it

1. In `/admin/tts-words` press the export link; save the file as `voice-words.csv`
   in the project folder.
2. One-time setup (needs Python 3.9 to 3.11; the model is a few hundred MB):
   ```
   python3 -m venv .venv-indicxlit
   source .venv-indicxlit/bin/activate
   pip install ai4bharat-transliteration
   ```
   If `pip install` fails on `fairseq`, and the dictionary will be updated (a Python 3.10
   venv usually fixes it).
3. `python3 scripts/indicxlit-candidates.py voice-words.csv`
4. Open `indicxlit-review.csv`, fill the last column (`y`, `n`, or your own spelling),
   and say so. The approved rows get added to the dictionary.

`--no-model` checks the file handling without the model. The CSV holds words fans
typed, so both CSV files are git-ignored and must never be committed.

## One-time setup, repeat run

- **Setup is once per computer.** The virtual environment (`.venv-indicxlit`) stays
  on that computer; it is not in git, so a second computer needs its own setup.
- **Running is repeated**, only when `/admin/tts-words` has collected enough new
  unknown words (say once a month, or after a busy stream week). Each run is steps 1,
  3 and 4 above, a few minutes.
- You do not need it on every computer. Pick one. The export is a download from the
  admin page, so it works from any computer's browser.

## On the Windows PC

The script is in the repo, so `git pull` brings it. Untested on Windows: `fairseq`
(a dependency of IndicXlit) often fails to build there. Easiest options, in order:
1. Do the run on the Mac, copy only `indicxlit-review.csv` across, and give it to
   we on any computer.
2. Use WSL (Ubuntu) on the PC and follow the Mac steps inside it.
3. Native Windows: install Python 3.10 and the Visual Studio Build Tools, then use
   `py -3.10 -m venv .venv-indicxlit`, `.venv-indicxlit\Scripts\activate`, and the
   same `pip install`. If it fails, use option 1 or 2.

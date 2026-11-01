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
